const DATA_URL = "./comments.json";
const $ = (selector) => document.querySelector(selector);

const ui = {
  library: $("#library-view"),
  editor: $("#editor-view"),
  present: $("#present-view"),
  thumbs: $("#thumbnail-list"),
  previewImage: $("#preview-image"),
  previewCounter: $("#preview-counter"),
  previewTitle: $("#preview-title"),
  commentTitle: $("#comment-title"),
  commentTopic: $("#comment-topic"),
  commentEditor: $("#comment-editor"),
  slideTitleEditor: $("#slide-title-editor"),
  keywordsEditor: $("#keywords-editor"),
  keywords: $("#keyword-list"),
  saveStatus: $("#save-status"),
  stageImage: $("#stage-image"),
  toast: $("#toast"),
  suggestionResult: $("#suggestion-result"),
};

let deck;
let current = 0;
let toastTimer;
let saveTimer;
let stageClickTimer;
let comments = {};
let keywords = {};
let decks = [];
let activeId = "demo";
let session = null;
let voiceSocket = null;
let mediaRecorder = null;
let mediaStream = null;
let audioContext = null;
let meterTimer = null;
let speechLevel = 0;
let speechDevice = "";
let listening = false;
let pending = null;
let suggestionTimeout = null;
let suggestionTick = null;
let lastSuggestionAt = 0;
let recentSpeech = [];
let navigationHistory = [];
let navigationCommandPrefix = null;
let recognitionEpoch = 0;
let speechMode = "off";
let speechError = "";
let speechHeard = "";
let speechFinalCount = 0;
let deepgramConfigured = false;
let lastVoiceAction = "";
let semanticConfigured = true;
let semanticSignature = "";
let semanticPromise = null;
let semanticBusy = false;
let lastSemanticAt = 0;
let visitedSlides = [];
let blockedSuggestions = new Map();
let saveQueue = Promise.resolve();
let reconnectTimer = null;
let reconnectAttempts = 0;
let reconnectAllowed = false;
let presentationState = "prepared";
let voiceCommands = { next: [], prev: [], history: [], defaults: { next: true, prev: true, history: true } };
const COMMAND_LABELS = { next: "Próximo slide", prev: "Slide anterior", history: "Voltar ao histórico" };

function imagePath(page) {
  return deck.telas.find((slide) => slide.pagina_pdf === page)?.image || `./assets/page-${String(page).padStart(2, "0")}.jpg`;
}

function storageKey(kind) { return `slide-assistido.${kind}.${activeId === "demo" ? "v1" : activeId}`; }

function numericSetting(selector, fallback, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number($(selector).value) || fallback));
}

function readSettings() {
  return {
    microphone: $("#mic-enabled").checked,
    semantic: $("#semantic-enabled").checked,
    seconds: numericSetting("#suggestion-seconds", 8, 3, 60),
    keep_open: $("#keep-suggestion-open").checked,
    store_transcript: $("#store-transcript").checked,
    minimum_score: numericSetting("#minimum-score", 0.42, 0.1, 0.95),
    minimum_margin: numericSetting("#minimum-margin", 0.025, 0, 0.3),
    speech_window: numericSetting("#speech-window", 12, 4, 30),
    suggestion_interval: numericSetting("#suggestion-interval", 12, 3, 60),
    rejection_block: numericSetting("#rejection-block", 45, 5, 300),
  };
}

function applySettings(settings = {}) {
  $("#mic-enabled").checked = settings.microphone !== false;
  $("#semantic-enabled").checked = settings.semantic === true;
  $("#suggestion-seconds").value = String(settings.seconds || 8);
  $("#keep-suggestion-open").checked = settings.keep_open === true;
  $("#store-transcript").checked = settings.store_transcript === true;
  $("#minimum-score").value = String(settings.minimum_score ?? 0.42);
  $("#minimum-margin").value = String(settings.minimum_margin ?? 0.025);
  $("#speech-window").value = String(settings.speech_window || 12);
  $("#suggestion-interval").value = String(settings.suggestion_interval || 12);
  $("#rejection-block").value = String(settings.rejection_block || 45);
}

function persistDeck(payload) {
  if (activeId === "demo") return Promise.resolve(null);
  const deckId = activeId;
  saveQueue = saveQueue.then(async () => {
    const response = await fetch(`/api/decks/${deckId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível salvar a apresentação.");
    return data;
  }).catch((error) => {
    ui.saveStatus.textContent = "Falha ao salvar no servidor";
    ui.saveStatus.style.color = "#b45309";
    showToast(error.message);
    return null;
  });
  return saveQueue;
}

function loadEdits() {
  const serverSettings = deck?.settings || {};
  try {
    const legacyComments = JSON.parse(localStorage.getItem(storageKey("comments")) || "{}");
    const legacyKeywords = JSON.parse(localStorage.getItem(storageKey("keywords")) || "{}");
    comments = Object.fromEntries(deck.telas.map((slide) => [String(slide.pagina_pdf), slide.comentario_adicional_proposto || ""]));
    keywords = Object.fromEntries(deck.telas.map((slide) => [String(slide.pagina_pdf), slide.palavras_chave || []]));
    for (const slide of deck.telas) slide._savedSignature = JSON.stringify([slide.tema, slide.comentario_adicional_proposto || "", slide.palavras_chave || []]);
    comments = { ...comments, ...legacyComments };
    keywords = { ...keywords, ...legacyKeywords };
    const legacySettings = JSON.parse(localStorage.getItem(storageKey("settings")) || "{}");
    applySettings({ ...serverSettings, ...legacySettings });
    if (activeId !== "demo" && (Object.keys(legacyComments).length || Object.keys(legacyKeywords).length || Object.keys(legacySettings).length)) {
      const slides = deck.telas.map((slide, index) => ({ index, title: slide.tema, comment: comments[String(slide.pagina_pdf)] || "", keywords: keywords[String(slide.pagina_pdf)] || [] }));
      persistDeck({ slides, settings: readSettings() }).then((saved) => {
        if (!saved) return;
        localStorage.removeItem(storageKey("comments"));
        localStorage.removeItem(storageKey("keywords"));
        localStorage.removeItem(storageKey("settings"));
      });
    }
  } catch { comments = {}; keywords = {}; }
  renderSessionSummary();
}

function renderSessionSummary() {
  let saved;
  try { saved = session?.deckId === activeId ? session : JSON.parse(localStorage.getItem(storageKey("transcript")) || "null"); }
  catch { saved = null; }
  $("#session-summary").classList.toggle("hidden", !saved?.lines?.length);
  const metrics = saved?.metrics;
  $("#transcript-count").textContent = saved?.lines?.length ? `${saved.lines.length} trechos · ${metrics?.suggestions || 0} sugestões · ${metrics?.accepted || 0} aceitas` : "";
}

function currentSlide() {
  return deck.telas[current];
}

function storedComment(slide) {
  return comments[String(slide.pagina_pdf)] ?? slide.comentario_adicional_proposto ?? "";
}

function storedKeywords(slide) {
  return keywords[String(slide.pagina_pdf)] ?? slide.palavras_chave ?? [];
}

function parseKeywords(value) {
  return [...new Set(value.split(",").map((word) => word.trim()).filter(Boolean))];
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2100);
}

function setView(view) {
  document.body.classList.toggle("presenting", view === "present");
  ui.library.classList.toggle("hidden", view !== "library");
  ui.editor.classList.toggle("hidden", view !== "editor");
  ui.present.classList.toggle("hidden", view !== "present");
}

function saveSlideFields() {
  if (!deck || ui.editor.classList.contains("hidden")) return;
  const slide = currentSlide();
  slide.tema = ui.slideTitleEditor.value.trim() || slide.tema;
  comments[String(slide.pagina_pdf)] = ui.commentEditor.value;
  keywords[String(slide.pagina_pdf)] = parseKeywords(ui.keywordsEditor.value);
  slide.comentario_adicional_proposto = comments[String(slide.pagina_pdf)];
  slide.palavras_chave = keywords[String(slide.pagina_pdf)];
  const newSignature = JSON.stringify([slide.tema, slide.comentario_adicional_proposto, slide.palavras_chave]);
  if (newSignature === slide._savedSignature) return;
  slide._savedSignature = newSignature;
  semanticSignature = "";
  const activeThumb = ui.thumbs.children[current];
  if (activeThumb) activeThumb.querySelector("b").textContent = `${String(slide.pagina_pdf).padStart(2, "0")} · ${slide.tema}`;
  try {
    if (activeId === "demo") {
      localStorage.setItem(storageKey("comments"), JSON.stringify(comments));
      localStorage.setItem(storageKey("keywords"), JSON.stringify(keywords));
    }
    ui.saveStatus.textContent = activeId === "demo" ? "Salvo neste navegador" : "Salvando no servidor…";
    ui.saveStatus.style.color = "#168d78";
  } catch {
    ui.saveStatus.textContent = "Não foi possível salvar";
    ui.saveStatus.style.color = "#b45309";
  }
  if (activeId !== "demo") {
    persistDeck({ slide: { index: current, title: slide.tema, comment: slide.comentario_adicional_proposto, keywords: slide.palavras_chave } }).then((saved) => {
      if (saved) {
        ui.saveStatus.textContent = "Salvo com a apresentação";
        ui.saveStatus.style.color = "#168d78";
      }
    });
  }
}

function semanticTexts() {
  return deck.telas.map((slide) =>
    `Tela ${slide.pagina_pdf}. Tema: ${slide.tema}. Palavras-chave: ${storedKeywords(slide).join(", ").slice(0, 450)}. Comentário: ${storedComment(slide).slice(0, 1600)}. Conteúdo: ${(slide.texto_extraido || "").slice(0, 1400)}`.slice(0, 3900));
}

async function ensureSemanticIndex() {
  if (!$("#semantic-enabled").checked || !semanticConfigured) return false;
  const texts = semanticTexts();
  const signature = JSON.stringify([activeId, texts]);
  if (signature === semanticSignature) return true;
  if (semanticPromise) {
    try { await semanticPromise; return ensureSemanticIndex(); }
    catch { return false; }
  }
  $("#semantic-status").textContent = "Preparando a comparação semântica das telas…";
  semanticPromise = (async () => {
    const response = await fetch("/api/semantic/index", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deck_id: activeId, texts }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha na preparação semântica.");
    semanticSignature = signature;
    $("#semantic-status").textContent = `${data.pages} telas preparadas para comparação semântica.`;
  })();
  try { await semanticPromise; return true; }
  catch (error) { $("#semantic-status").textContent = `${error.message} Busca por palavras continua disponível.`; return false; }
  finally { semanticPromise = null; }
}

async function findBestSuggestion(query, slideIndex = current) {
  const lexicalCandidates = findSuggestions(query, slideIndex);
  const lexical = lexicalCandidates[0] || null;
  if (!$("#semantic-enabled").checked || !semanticConfigured) return { match: lexical, candidates: lexicalCandidates, semantic: false };
  if (!await ensureSemanticIndex()) return { match: lexical, candidates: lexicalCandidates, semantic: false };
  try {
    const now = Date.now();
    for (const [index, until] of blockedSuggestions) if (until <= now) blockedSuggestions.delete(index);
    const settings = readSettings();
    const recent = [...new Set(visitedSlides.filter((item) => now - item.at < 90000).map((item) => item.index))];
    const response = await fetch("/api/semantic/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deck_id: activeId, query: query.slice(0, 1500), current: slideIndex, excluded: [...blockedSuggestions.keys()], recent, minimum_score: settings.minimum_score, minimum_margin: settings.minimum_margin }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha na análise semântica.");
    return { match: data.match || null, candidates: data.candidates || [], semantic: true };
  } catch (error) {
    $("#semantic-status").textContent = `${error.message} Usando busca por palavras.`;
    return { match: lexical, candidates: lexicalCandidates, semantic: false };
  }
}

function renderKeywordPreview() {
  const terms = parseKeywords(ui.keywordsEditor.value);
  ui.keywords.replaceChildren(...terms.map((keyword) => {
    const tag = document.createElement("span");
    tag.className = "keyword";
    tag.textContent = keyword;
    return tag;
  }));
  const activeThumb = ui.thumbs.children[current];
  if (activeThumb) activeThumb.querySelector(".thumb-keywords").textContent = terms.slice(0, 2).join(" · ");
}

function renderEditor() {
  const slide = currentSlide();
  ui.previewImage.src = imagePath(slide.pagina_pdf);
  ui.previewImage.alt = `Tela ${slide.pagina_pdf}: ${slide.tema}`;
  ui.previewCounter.textContent = `${String(slide.pagina_pdf).padStart(2, "0")} / ${String(deck.telas.length).padStart(2, "0")}`;
  ui.previewTitle.textContent = slide.tema;
  ui.commentTitle.textContent = `Tela ${String(slide.pagina_pdf).padStart(2, "0")}`;
  ui.commentTopic.textContent = slide.tema;
  ui.slideTitleEditor.value = slide.tema;
  ui.commentEditor.value = storedComment(slide);
  ui.keywordsEditor.value = storedKeywords(slide).join(", ");
  renderKeywordPreview();
  [...ui.thumbs.children].forEach((thumb, index) => {
    thumb.classList.toggle("active", index === current);
    if (index === current) thumb.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

function renderPresent() {
  const slide = currentSlide();
  ui.stageImage.src = imagePath(slide.pagina_pdf);
  ui.stageImage.alt = `Tela ${slide.pagina_pdf}`;
  for (const index of [current - 2, current - 1, current + 1, current + 2]) {
    if (index >= 0 && index < deck.telas.length) new Image().src = imagePath(deck.telas[index].pagina_pdf);
  }
}

function goTo(index, fromHistory = false) {
  const destination = Math.max(0, Math.min(deck.telas.length - 1, index));
  if (!fromHistory && destination !== current && !ui.present.classList.contains("hidden")) navigationHistory.push(current);
  clearTimeout(saveTimer);
  saveSlideFields();
  current = destination;
  visitedSlides.push({ index: current, at: Date.now() });
  visitedSlides = visitedSlides.filter((item) => Date.now() - item.at < 120000).slice(-12);
  if (activeId !== "demo") persistDeck({ last_slide: current });
  if (!ui.editor.classList.contains("hidden")) renderEditor();
  if (!ui.present.classList.contains("hidden")) renderPresent();
}

function openEditor(resume = true) {
  if (resume) current = Math.max(0, Math.min(deck.telas.length - 1, Number(deck.last_slide) || 0));
  ui.thumbs.replaceChildren(...deck.telas.map((slide, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "thumb";
    button.innerHTML = `<img src="${imagePath(slide.pagina_pdf)}" alt=""><span class="thumb-info"><b>${String(slide.pagina_pdf).padStart(2, "0")} · ${escapeHtml(slide.tema)}</b><span class="thumb-keywords">${storedKeywords(slide).slice(0, 2).map(escapeHtml).join(" · ")}</span></span>`;
    button.addEventListener("click", () => goTo(index));
    return button;
  }));
  setView("editor");
  $(".editor-heading h1").textContent = deck.title || "ECA Digital e o Decreto 12.880/2026";
  $("#rail-count").textContent = String(deck.telas.length).padStart(2, "0");
  ui.suggestionResult.replaceChildren();
  renderEditor();
}

function moveCurrentSlide(offset) {
  const destination = current + offset;
  if (destination < 0 || destination >= deck.telas.length) return;
  saveSlideFields();
  const [slide] = deck.telas.splice(current, 1);
  deck.telas.splice(destination, 0, slide);
  current = destination;
  semanticSignature = "";
  openEditor(false);
  if (activeId !== "demo") persistDeck({ order: deck.telas.map((item) => item.pagina_pdf), last_slide: current });
  else showToast("A ordem da demonstração é temporária.");
}

async function selectDeck(id) {
  saveSlideFields();
  if (id === "demo") {
    deck = await (await fetch(DATA_URL)).json();
  } else {
    const response = await fetch(`/api/decks/${id}`);
    if (!response.ok) throw new Error("Não foi possível abrir esta apresentação.");
    deck = await response.json();
  }
  activeId = id;
  semanticSignature = "";
  loadEdits();
  openEditor();
}

function renderLibrary() {
  const grid = $("#presentation-grid");
  grid.querySelectorAll(".imported-card").forEach((node) => node.remove());
  for (const item of decks) {
    const card = document.createElement("article");
    card.className = "presentation-card imported-card";
    const button = document.createElement("button");
    button.className = "card-cover";
    button.type = "button";
    const img = document.createElement("img");
    img.src = `./user_data/${item.id}/page-001.png`;
    img.alt = "Capa da apresentação";
    button.append(img);
    button.addEventListener("click", () => selectDeck(item.id).catch((e) => showToast(e.message)));
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const title = document.createElement("div"); title.className = "card-title"; title.textContent = item.title;
    const subtitle = document.createElement("div"); subtitle.className = "card-subtitle"; subtitle.textContent = `${item.pages} telas · PDF convertido`;
    const actions = document.createElement("div"); actions.className = "card-management";
    const rename = document.createElement("button"); rename.type = "button"; rename.textContent = "Renomear";
    rename.addEventListener("click", () => renameDeck(item));
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Excluir"; remove.className = "danger-link";
    remove.addEventListener("click", () => deleteDeck(item));
    actions.append(rename, remove);
    meta.append(title, subtitle, actions);
    card.append(button, meta);
    grid.insertBefore(card, grid.querySelector(".add-card"));
  }
  $(".count").textContent = String(decks.length + 1).padStart(2, "0");
}

async function renameDeck(item = decks.find((entry) => entry.id === activeId)) {
  if (!item) return;
  const title = prompt("Novo título da apresentação:", item.title)?.trim();
  if (!title || title === item.title) return;
  await saveQueue;
  const response = await fetch(`/api/decks/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
  const data = await response.json();
  if (!response.ok) return showToast(data.error || "Não foi possível renomear.");
  item.title = data.title;
  if (deck?.id === item.id) {
    deck.title = data.title;
    $(".editor-heading h1").textContent = data.title;
  }
  renderLibrary();
  showToast("Apresentação renomeada.");
}

async function deleteDeck(item) {
  if (!confirm(`Excluir “${item.title}” e os arquivos armazenados neste computador?`)) return;
  const response = await fetch(`/api/decks/${item.id}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) return showToast(data.error || "Não foi possível excluir.");
  decks = decks.filter((entry) => entry.id !== item.id);
  localStorage.removeItem(`slide-assistido.comments.${item.id}`);
  localStorage.removeItem(`slide-assistido.keywords.${item.id}`);
  localStorage.removeItem(`slide-assistido.settings.${item.id}`);
  localStorage.removeItem(`slide-assistido.transcript.${item.id}`);
  renderLibrary();
  showToast("Apresentação excluída.");
}

function normalize(text) {
  return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function findSuggestions(query, slideIndex = current) {
  const phrase = normalize(query);
  const ignored = new Set(["para", "com", "que", "uma", "das", "dos", "isso", "sobre", "como", "esse", "esta", "pela", "pelo", "mais", "tambem"]);
  const words = [...new Set(phrase.split(" ").filter((word) => word.length >= 4 && !ignored.has(word)))];
  if (!words.length && phrase.length < 8) return [];
  return deck.telas.map((slide, index) => {
    const title = normalize(slide.tema);
    const tags = storedKeywords(slide).map(normalize).filter(Boolean);
    const comment = normalize(storedComment(slide));
    const extracted = normalize(slide.texto_extraido || "");
    let score = 0;
    for (const word of words) {
      if (tags.some((tag) => tag.split(" ").includes(word))) score += 5;
      if (title.split(" ").includes(word)) score += 3;
      if (comment.split(" ").includes(word)) score += 1.5;
      if (extracted.split(" ").includes(word)) score += 0.5;
    }
    for (const tag of tags) if (tag.length > 5 && phrase.includes(tag)) score += 6;
    if (phrase.length >= 8 && comment.includes(phrase)) score += 12;
    if (phrase.length >= 8 && title.includes(phrase)) score += 8;
    return { index, score };
  }).filter((result) => result.index !== slideIndex && !blockedSuggestions.has(result.index) && result.score >= 2.5).sort((a, b) => b.score - a.score).slice(0, 5);
}

async function testSuggestion() {
  saveSlideFields();
  const target = ui.suggestionResult;
  target.replaceChildren();
  target.textContent = "Analisando a frase…";
  const text = $("#rehearsal-text").value;
  if (normalize(text).length < 5) {
    target.textContent = "Digite ou fale uma frase antes de procurar.";
    return;
  }
  const initialDeck = activeId;
  const analysis = await findBestSuggestion(text);
  const found = analysis.match;
  if (initialDeck !== activeId) return;
  target.replaceChildren();
  const ranking = document.createElement("div");
  ranking.className = "candidate-ranking";
  for (const candidate of analysis.candidates) {
    const row = document.createElement("div");
    const candidateSlide = deck.telas[candidate.index];
    const value = analysis.semantic ? `${Math.round(candidate.score * 100)}%` : `${candidate.score.toFixed(1)} pts`;
    row.innerHTML = `<span>Tela ${candidateSlide.pagina_pdf} · ${escapeHtml(candidateSlide.tema)}</span><b>${value}</b>`;
    ranking.append(row);
  }
  if (!found) {
    const phrase = normalize(text);
    const slide = currentSlide();
    const currentText = normalize([slide.tema, storedComment(slide), ...storedKeywords(slide)].join(" "));
    const message = document.createElement("p");
    message.textContent = phrase.length >= 8 && currentText.includes(phrase)
      ? "A frase corresponde à tela que já está aberta. A sugestão só aparece quando a fala aponta para outra tela."
      : "Nenhuma candidata superou os limites atuais. Veja as melhores pontuações abaixo ou ajuste a calibração.";
    target.append(message, ranking);
    return;
  }
  const slide = deck.telas[found.index];
  const label = document.createElement("p");
  label.textContent = `Sugestão: tela ${slide.pagina_pdf} · ${slide.tema}`;
  const button = document.createElement("button");
  button.type = "button"; button.className = "button button-primary"; button.textContent = "Abrir tela sugerida";
  button.addEventListener("click", () => { goTo(found.index); target.replaceChildren(); });
  target.append(label, ranking, button);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function updateSpeechDiagnostics() {
  const status = $("#mic-status").textContent;
  const signal = listening ? (speechLevel >= 2 ? `Sinal do microfone: ${speechLevel}% (${speechDevice || "padrão"})` : "Sem sinal de áudio detectável. Confira o microfone selecionado.") : "Microfone parado.";
  $("#speech-preview").textContent = `${signal} ${speechHeard ? `Última fala transcrita: “${speechHeard}”.` : "Nenhuma fala transcrita ainda."} ${speechFinalCount} trecho(s) final(is).`;
  $("#speech-debug").textContent = `Microfone: ${status}\n${signal}\nTrechos finais: ${speechFinalCount}\nÚltima fala: ${speechHeard || "nenhuma"}\nAção: ${lastVoiceAction || "aguardando"}`;
}

function setPresentationState(state) {
  presentationState = state;
  const labels = { prepared: "IA aguardando", presenting: "IA ativa", pending: "Aguardando resposta", degraded: "Modo manual", reconnecting: "Reconectando", ended: "Sessão encerrada" };
  const indicator = $("#ai-status");
  if (indicator) {
    indicator.className = `ai-status ${state}`;
    indicator.querySelector("span").textContent = labels[state] || state;
  }
}

function setMicStatus(message) {
  $("#mic-status").textContent = message;
  $("#command-mic-status").textContent = message;
  updateSpeechDiagnostics();
}

async function refreshMicrophones() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const select = $("#mic-device");
  const chosen = select.value || localStorage.getItem("slide-assistido.microphone-device.v1") || "";
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput");
  select.replaceChildren(new Option("Microfone padrão do sistema", ""), ...devices.map((device, index) => new Option(device.label || `Microfone ${index + 1}`, device.deviceId)));
  if ([...select.options].some((option) => option.value === chosen)) select.value = chosen;
}

function clearSuggestion(reason = "dismissed") {
  if (pending && reason === "expired" && session?.metrics) session.metrics.ignored++;
  pending = null;
  clearTimeout(suggestionTimeout);
  clearInterval(suggestionTick);
  $("#live-suggestion").classList.add("hidden");
  $("#suggestion-progress-bar").style.width = "0%";
  if (!ui.present.classList.contains("hidden")) setPresentationState(listening ? "presenting" : "degraded");
}

function offerSuggestion(match) {
  const index = typeof match === "number" ? match : match.index;
  if (pending || index === current || ui.present.classList.contains("hidden")) return;
  const settings = readSettings();
  const duration = settings.seconds * 1000;
  const expires = settings.keep_open ? null : Date.now() + duration;
  pending = { index, expires, openedAt: Date.now(), duration, score: match.score, margin: match.margin };
  if (session?.metrics) session.metrics.suggestions++;
  lastSuggestionAt = Date.now();
  const slide = deck.telas[index];
  $("#live-suggestion-label").textContent = `Tela ${slide.pagina_pdf} · ${slide.tema}`;
  $("#live-suggestion").classList.remove("hidden");
  setPresentationState("pending");
  const countdown = () => {
    if (!pending) return;
    if (!pending.expires) {
      $("#suggestion-timer").textContent = "Aguardando sua resposta";
      $("#suggestion-progress-bar").style.width = "100%";
      return;
    }
    const remaining = Math.max(0, pending.expires - Date.now());
    $("#suggestion-timer").textContent = `Responda em até ${Math.ceil(remaining / 1000)} segundos`;
    $("#suggestion-progress-bar").style.width = `${Math.max(0, Math.min(100, remaining / pending.duration * 100))}%`;
  };
  countdown();
  suggestionTick = setInterval(countdown, 300);
  if (expires) suggestionTimeout = setTimeout(() => clearSuggestion("expired"), expires - Date.now());
}

function holdSuggestionWhileAnswering(phrase) {
  if (!pending || !pending.expires || !classifyAnswer(phrase)) return;
  pending.expires = Math.max(pending.expires, Date.now() + 3000);
  clearTimeout(suggestionTimeout);
  suggestionTimeout = setTimeout(() => clearSuggestion("expired"), pending.expires - Date.now());
}

function acceptSuggestion() {
  if (!pending || pending.expires && Date.now() > pending.expires) { clearSuggestion("expired"); return; }
  const destination = pending.index;
  if (session?.metrics) session.metrics.accepted++;
  lastVoiceAction = `Sugestão aceita: tela ${deck.telas[destination].pagina_pdf}`;
  updateSpeechDiagnostics();
  clearSuggestion("accepted");
  goTo(destination);
}

function rejectSuggestion(source = "botão") {
  if (!pending) return;
  const destination = pending.index;
  blockedSuggestions.set(destination, Date.now() + readSettings().rejection_block * 1000);
  if (session?.metrics) session.metrics.rejected++;
  lastVoiceAction = `Sugestão recusada por ${source}`;
  updateSpeechDiagnostics();
  clearSuggestion("rejected");
}

function returnToPreviousSlide() {
  clearSuggestion();
  if (navigationHistory.length) {
    const destination = navigationHistory.pop();
    goTo(destination, true);
    lastVoiceAction = `Retorno por voz: tela ${deck.telas[destination].pagina_pdf}`;
  } else {
    lastVoiceAction = "Sem tela anterior no histórico desta apresentação";
  }
  updateSpeechDiagnostics();
}

function isReturnCommand(phrase) {
  const normalized = normalize(phrase);
  return /^(?:por favor )?(?:volte|voltar|retorne|retornar|regresse|regressar)(?: para| ao)? (?:a |o )?(?:tela|slide) anterior(?: por favor)?$/.test(normalized)
    || /^(?:por favor )?(?:volte|voltar|retorne|retornar)(?: uma tela| um slide)(?: por favor)?$/.test(normalized);
}

function isReturnCommandPrefix(phrase) {
  const normalized = normalize(phrase);
  return /^(?:por favor )?(?:volte|voltar|retorne|retornar|regresse|regressar)(?:(?: para| ao| a| o)?(?: a| o)?(?: tela| slide)?|(?: uma| um)(?: tela| slide)?)$/.test(normalized);
}

function commandKey(phrase) {
  return /^(?:por favor )?(.+?)(?: por favor)?$/.exec(normalize(phrase))?.[1] || "";
}

// As frases personalizadas têm prioridade e podem substituir uma frase padrão de outro comando.
function customNavigationCommand(phrase, commands = voiceCommands) {
  const key = commandKey(phrase);
  if (!key) return null;
  return ["history", "prev", "next"].find((type) => (commands[type] || []).some((item) => commandKey(item) === key)) || null;
}

function classifyNavigationCommand(phrase, commands = voiceCommands) {
  const custom = customNavigationCommand(phrase, commands);
  if (custom) return custom;
  const defaults = commands.defaults || {};
  if (defaults.history !== false && isReturnCommand(phrase)) return "history";
  const courtesy = commandKey(phrase);
  if (defaults.next !== false && /^(?:proximo slide|proxima tela|slide seguinte|tela seguinte|slide proximo|tela proxima)$/.test(courtesy)) return "next";
  if (defaults.prev !== false && /^(?:slide|tela) anterior$/.test(courtesy)) return "prev";
  if (defaults.next !== false && /^(?:passe|passa|avance|avanca|siga|va)(?: para| ao)? (?:o |a )?(?:(?:proximo|proxima|seguinte) (?:slide|tela)|(?:slide|tela) (?:proximo|proxima|seguinte))$/.test(courtesy)) return "next";
  if (defaults.prev !== false && /^(?:passe|passa|retroceda|retroceder)(?: para| ao)? (?:o |a )?(?:slide|tela) anterior$/.test(courtesy)) return "prev";
  return null;
}

function isNavigationCommandPrefix(phrase, commands = voiceCommands) {
  const normalized = normalize(phrase);
  const key = commandKey(phrase);
  if (key && ["next", "prev", "history"].some((type) => (commands[type] || []).some((item) => commandKey(item).startsWith(`${key} `)))) return true;
  const defaults = commands.defaults || {};
  if (defaults.history !== false && isReturnCommandPrefix(phrase)) return true;
  if (defaults.next === false && defaults.prev === false) return false;
  if (/^(?:por favor )?(?:proximo|proxima|slide|tela)$/.test(normalized)) return true;
  return /^(?:por favor )?(?:passe|passa|avance|avanca|siga|va|retroceda|retroceder)(?: para| ao)?(?: o| a)?(?: proximo| proxima| seguinte| slide| tela)?(?: slide| tela| anterior)?$/.test(normalized);
}

function executeVoiceNavigation(command) {
  recentSpeech = [];
  if (command === "history") return returnToPreviousSlide();
  handleAction(command);
  lastVoiceAction = command === "next" ? `Avanço por voz: tela ${currentSlide().pagina_pdf}` : `Recuo por voz: tela ${currentSlide().pagina_pdf}`;
  updateSpeechDiagnostics();
}

function parseCommandLines(value) {
  const seen = new Set();
  return value.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => {
    const key = commandKey(line);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function validateVoiceCommands(commands) {
  const owners = new Map();
  for (const type of Object.keys(COMMAND_LABELS)) {
    if (commands[type].length > 20) return `Use no máximo 20 frases em “${COMMAND_LABELS[type]}”.`;
    for (const phrase of commands[type]) {
      const key = commandKey(phrase);
      if (phrase.length > 80) return `A frase “${phrase}” passa de 80 caracteres.`;
      if (key.split(" ").length < 2 && key.length < 6) return `“${phrase}” é curta demais. Use duas palavras ou pelo menos seis letras para não mudar de tela por engano.`;
      if (classifyAnswer(phrase)) return `“${phrase}” é uma resposta às sugestões (sim ou não). Escolha outra frase.`;
      if (owners.has(key) && owners.get(key) !== type) return `“${phrase}” está em “${COMMAND_LABELS[owners.get(key)]}” e em “${COMMAND_LABELS[type]}”.`;
      owners.set(key, type);
    }
  }
  return null;
}

function readCommandDraft() {
  const draft = { defaults: {} };
  for (const type of Object.keys(COMMAND_LABELS)) {
    draft[type] = parseCommandLines($(`#command-${type}`).value);
    draft.defaults[type] = $(`#command-${type}-defaults`).checked;
  }
  return draft;
}

function openVoiceCommands() {
  for (const type of Object.keys(COMMAND_LABELS)) {
    $(`#command-${type}`).value = voiceCommands[type].join("\n");
    $(`#command-${type}-defaults`).checked = voiceCommands.defaults[type] !== false;
  }
  $("#command-test-result").textContent = "";
  $("#commands-status").textContent = "";
  $("#commands-dialog").showModal();
}

function showCommandTest(text) {
  const draft = readCommandDraft();
  const type = classifyNavigationCommand(text, draft);
  const result = $("#command-test-result");
  if (normalize(text).length < 2) result.textContent = "Digite ou fale uma frase para verificar.";
  else if (type) result.textContent = `“${text}” → ${COMMAND_LABELS[type]} (${customNavigationCommand(text, draft) ? "frase personalizada" : "frase padrão"}).`;
  else if (isNavigationCommandPrefix(text, draft)) result.textContent = `“${text}” é o começo de um comando. Na apresentação, o sistema espera até 4 segundos pelo restante.`;
  else result.textContent = `“${text}” não é comando. Na apresentação, será tratada como fala comum.`;
}

async function saveVoiceCommands() {
  const draft = readCommandDraft();
  const problem = validateVoiceCommands(draft);
  if (problem) { $("#commands-status").textContent = problem; return; }
  try {
    const response = await fetch("/api/voice-commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível salvar os comandos.");
    voiceCommands = data;
    if (speechMode === "commands") stopRecognition();
    $("#commands-dialog").close();
    showToast("Comandos de voz salvos.");
  } catch (error) { $("#commands-status").textContent = error.message; }
}

function classifyAnswer(phrase) {
  const normalized = normalize(phrase);
  if (!normalized || normalized.split(" ").length > 9) return null;
  if (/^(nao|negativo|agora nao|nao agora|deixa|deixa como esta|fica aqui|fique aqui|permaneca|depois|nao abra|nao mude|nao quero|nao pode)( por favor| obrigado)?$/.test(normalized)) return "no";
  if (/^(sim|claro|pode|confirmo|confirmado|isso mesmo|vamos la)( por favor| obrigado)?$/.test(normalized)) return "yes";
  if (/^(sim |claro |pode |vamos |pode sim )?(pode )?(abrir|abra|abre|avancar|avance|avanca|mudar|mude|muda|ir|va|passar|passe)( (o|a|para o|para a) (slide|tela|proximo slide|proxima tela))?( por favor)?$/.test(normalized)) return "yes";
  return null;
}

async function classifyAnswerSemantic(phrase) {
  // Sem a busca semântica ativada, o modelo não é carregado (nem baixado) no meio da apresentação.
  if (!semanticConfigured || !$("#semantic-enabled").checked) return null;
  try {
    const response = await fetch("/api/semantic/intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deck_id: activeId, text: phrase.slice(0, 500) }) });
    const data = await response.json();
    return response.ok && (data.intent === "yes" || data.intent === "no") ? data.intent : null;
  } catch { return null; }
}

function saveSession() {
  if (!session) return;
  if (!$("#store-transcript").checked) {
    localStorage.removeItem(storageKey("transcript"));
    return;
  }
  try { localStorage.setItem(storageKey("transcript"), JSON.stringify(session)); }
  catch { setMicStatus("Não há espaço no navegador para guardar a transcrição. Baixe o arquivo ao encerrar."); }
}

async function recordSpeech(phrase) {
  const text = phrase.trim();
  if (!text || !session) return;
  session.lines.push({ time: new Date().toISOString(), slide: currentSlide().pagina_pdf, text });
  saveSession();
  if (ui.present.classList.contains("hidden")) { renderSessionSummary(); return; }
  const combined = navigationCommandPrefix && Date.now() - navigationCommandPrefix.at < 4000
    ? `${navigationCommandPrefix.text} ${text}` : text;
  navigationCommandPrefix = null;
  const navigation = classifyNavigationCommand(combined) || classifyNavigationCommand(text);
  if (navigation) {
    executeVoiceNavigation(navigation);
    return;
  }
  if (isNavigationCommandPrefix(combined) || isNavigationCommandPrefix(text)) {
    navigationCommandPrefix = { text: isNavigationCommandPrefix(combined) ? combined : text, at: Date.now() };
    return;
  }
  if (pending) {
    const answer = classifyAnswer(text) || await classifyAnswerSemantic(text);
    if (answer === "yes") acceptSuggestion();
    if (answer === "no") rejectSuggestion("voz");
    if (!answer) { lastVoiceAction = `Resposta ambígua: ${text}`; updateSpeechDiagnostics(); }
    return;
  }
  recentSpeech.push({ text, at: Date.now() });
  const settings = readSettings();
  recentSpeech = recentSpeech.filter((entry) => Date.now() - entry.at < settings.speech_window * 1000).slice(-5);
  if (Date.now() - lastSuggestionAt < settings.suggestion_interval * 1000) return;
  const query = recentSpeech.map((entry) => entry.text).join(" ");
  if ($("#semantic-enabled").checked && semanticConfigured) {
    if (semanticBusy || Date.now() - lastSemanticAt < 4000) return;
    const source = current;
    const started = session.started;
    semanticBusy = true;
    lastSemanticAt = Date.now();
    findBestSuggestion(query, source).then((analysis) => {
      if (analysis.match && session?.started === started && current === source && !pending) offerSuggestion(analysis.match);
    }).finally(() => { semanticBusy = false; });
  } else {
    const match = findSuggestions(query)[0];
    if (match) offerSuggestion(match);
  }
}

function stopRecognition(manual = true) {
  if (manual) {
    reconnectAllowed = false;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  recognitionEpoch++;
  listening = false;
  clearInterval(meterTimer);
  meterTimer = null;
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  mediaRecorder = null;
  if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  if (audioContext) audioContext.close().catch(() => {});
  audioContext = null;
  const socket = voiceSocket;
  if (socket && socket.readyState === WebSocket.OPEN && socket.datasetStop !== true) {
    socket.datasetStop = true;
    setTimeout(() => { if (socket.readyState === WebSocket.OPEN) socket.close(); }, 4500);
  }
  voiceSocket = null;
  speechMode = "off";
  $("#test-microphone").textContent = "Testar microfone";
  $("#command-test-microphone").textContent = "Testar com o microfone";
  if (!speechError) setMicStatus(`Microfone encerrado. ${speechFinalCount} trecho(s) reconhecido(s).`);
}

function scheduleReconnect(mode, message) {
  if (!reconnectAllowed || mode !== "present" || ui.present.classList.contains("hidden") || reconnectTimer) return;
  if (reconnectAttempts >= 4) {
    speechError = "Não foi possível restabelecer a Deepgram.";
    setMicStatus(`${speechError} A apresentação manual continua disponível.`);
    setPresentationState("degraded");
    stopRecognition(true);
    return;
  }
  speechError = message;
  stopRecognition(false);
  reconnectAttempts++;
  if (session?.metrics) session.metrics.reconnects++;
  const delay = Math.min(8000, 1000 * 2 ** (reconnectAttempts - 1));
  setMicStatus(`${message} Nova tentativa em ${delay / 1000} segundo(s).`);
  setPresentationState("reconnecting");
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    beginRecognition(mode, true);
  }, delay);
}

async function beginRecognition(mode = "present", reconnecting = false) {
  if (mode === "present" && !deepgramConfigured) {
    speechError = "Chave Deepgram ausente.";
    setMicStatus("Configure a chave da Deepgram no painel para transcrever a apresentação.");
    return;
  }
  speechMode = mode;
  if (!reconnecting) reconnectAttempts = 0;
  reconnectAllowed = mode === "present";
  speechError = "";
  if (!reconnecting) {
    speechHeard = "";
    speechFinalCount = 0;
  }
  speechLevel = 0;
  $("#test-microphone").textContent = mode === "test" ? "Parar teste" : "Testar microfone";
  $("#command-test-microphone").textContent = mode === "commands" ? "Parar teste" : "Testar com o microfone";
  setMicStatus("Solicitando acesso ao microfone…");
  listening = true;
  const epoch = ++recognitionEpoch;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("O navegador não disponibilizou o microfone.");
    const deviceId = $("#mic-device").value;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) }, video: false });
    if (!listening || epoch !== recognitionEpoch) { stream.getTracks().forEach((track) => track.stop()); return; }
    mediaStream = stream;
    speechDevice = stream.getAudioTracks()[0]?.label || "padrão";
    refreshMicrophones().catch(() => {});
    const Context = window.AudioContext || window.webkitAudioContext;
    if (Context) {
      audioContext = new Context();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      meterTimer = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let total = 0;
        for (const sample of samples) total += (sample - 128) ** 2;
        speechLevel = Math.min(100, Math.round(Math.sqrt(total / samples.length) * 5));
        updateSpeechDiagnostics();
      }, 250);
    }
    setMicStatus("Microfone aberto. Conectando à Deepgram…");
    if (!window.MediaRecorder) throw new Error("O navegador não oferece gravação de áudio em tempo real.");
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error("Formato de áudio incompatível com este navegador.");
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorder = recorder;
    const socket = new WebSocket("ws://127.0.0.1:4176");
    voiceSocket = socket;
    socket.onopen = () => { if (!listening || epoch !== recognitionEpoch) socket.close(); };
    let queue = Promise.resolve();
    recorder.ondataavailable = (event) => {
      if (event.data.size) queue = queue.then(() => event.data.arrayBuffer()).then((bytes) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(bytes);
      }).catch(() => {});
    };
    recorder.onstop = () => {
      queue.then(() => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "stop" })); });
    };
    socket.onmessage = (event) => {
      if (epoch !== recognitionEpoch) return;
      const message = JSON.parse(event.data);
      if (message.type === "ready" && listening) {
        reconnectAttempts = 0;
        recorder.start(250);
        setMicStatus(reconnecting ? "Deepgram reconectada." : "Deepgram conectada. Fale para testar a transcrição.");
        if (mode === "present") setPresentationState("presenting");
      } else if (message.type === "result") {
        speechHeard = message.text;
        if (!message.final && pending) holdSuggestionWhileAnswering(message.text);
        if (message.final) {
          speechFinalCount++;
          if (mode === "present") recordSpeech(message.text);
          if (mode === "test") {
            $("#rehearsal-text").value = message.text;
            testSuggestion();
          }
          if (mode === "commands") {
            $("#command-test-text").value = message.text;
            showCommandTest(message.text);
          }
        }
        updateSpeechDiagnostics();
      } else if (message.type === "error") {
        if (mode === "present" && !/chave|autentica/i.test(message.message)) scheduleReconnect(mode, message.message);
        else {
          speechError = message.message;
          setMicStatus(message.message);
          setPresentationState("degraded");
          stopRecognition(true);
        }
      }
    };
    socket.onerror = () => {
      if (!listening || epoch !== recognitionEpoch || speechError) return;
      if (mode === "present") scheduleReconnect(mode, "A conexão de voz falhou.");
      else {
        speechError = "A conexão local de voz falhou.";
        setMicStatus(speechError);
        stopRecognition(true);
      }
    };
    socket.onclose = () => {
      if (listening && epoch === recognitionEpoch && !speechError && voiceSocket === socket) {
        if (mode === "present") scheduleReconnect(mode, "A Deepgram encerrou a conexão.");
        else {
          speechError = "A Deepgram encerrou a conexão.";
          setMicStatus(speechError);
          stopRecognition(true);
        }
      }
    };
  } catch (error) {
    speechError = error.message || "Falha ao abrir microfone.";
    setMicStatus(`Microfone indisponível: ${speechError}`);
    setPresentationState("degraded");
    stopRecognition(true);
  }
}

function downloadTranscript() {
  let saved;
  try { saved = session?.deckId === activeId ? session : JSON.parse(localStorage.getItem(storageKey("transcript")) || "null"); }
  catch { return showToast("Transcrição indisponível neste navegador."); }
  if (!saved?.lines?.length) return showToast("Nenhuma fala foi transcrita nesta sessão.");
  const metrics = saved.metrics || {};
  const heading = `${saved.title}\nInício: ${new Date(saved.started).toLocaleString("pt-BR")}\nFim: ${new Date(saved.ended || Date.now()).toLocaleString("pt-BR")}\nSugestões: ${metrics.suggestions || 0} · aceitas: ${metrics.accepted || 0} · recusadas: ${metrics.rejected || 0} · ignoradas: ${metrics.ignored || 0} · reconexões: ${metrics.reconnects || 0}\n\n`;
  const body = saved.lines.map((line) => `[${new Date(line.time).toLocaleTimeString("pt-BR")}] [Tela ${line.slide}] ${line.text}`).join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", heading, body, "\n"], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `transcricao-slide-assistido-${saved.started.slice(0, 10)}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function startPresentation() {
  saveSlideFields();
  if (speechMode === "test" || speechMode === "commands") stopRecognition();
  session = { deckId: activeId, title: deck.title || deck.titulo || "Apresentação", started: new Date().toISOString(), ended: null, lines: [], metrics: { suggestions: 0, accepted: 0, rejected: 0, ignored: 0, reconnects: 0 } };
  saveSession();
  recentSpeech = [];
  navigationHistory = [];
  visitedSlides = [{ index: current, at: Date.now() }];
  blockedSuggestions.clear();
  navigationCommandPrefix = null;
  lastSuggestionAt = 0;
  lastVoiceAction = "";
  lastSemanticAt = 0;
  clearSuggestion();
  setView("present");
  setPresentationState($("#mic-enabled").checked ? "presenting" : "degraded");
  renderPresent();
  if ($("#semantic-enabled").checked && semanticConfigured) ensureSemanticIndex();
  try {
    const fullscreen = document.fullscreenElement ? Promise.resolve() : ui.present.requestFullscreen();
    if ($("#mic-enabled").checked) beginRecognition("present");
    else setMicStatus("Microfone desativado para esta apresentação.");
    await fullscreen;
  } catch {
    showToast("Tela cheia não disponível. Você ainda pode apresentar normalmente.");
  }
}

function exitPresentation() {
  if (ui.present.classList.contains("hidden")) return;
  stopRecognition();
  clearSuggestion();
  if (session) { session.ended = new Date().toISOString(); saveSession(); }
  setPresentationState("ended");
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  setView("editor");
  renderEditor();
  renderSessionSummary();
}

function handleAction(action) {
  if (!deck) return;
  if (action === "open") return selectDeck("demo").catch((error) => showToast(error.message));
  if (action === "library") {
    if (speechMode === "test") stopRecognition();
    saveSlideFields();
    setView("library");
    return;
  }
  if (action === "start") return startPresentation();
  if (action === "exit") return exitPresentation();
  if (action === "next") {
    clearSuggestion();
    if (current < deck.telas.length - 1) goTo(current + 1);
    return;
  }
  if (action === "prev") {
    clearSuggestion();
    if (current > 0) goTo(current - 1);
  }
}

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (control) handleAction(control.dataset.action);
});

ui.commentEditor.addEventListener("input", () => {
  ui.saveStatus.textContent = "Salvando…";
  ui.saveStatus.style.color = "#788498";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSlideFields, 300);
});

ui.keywordsEditor.addEventListener("input", () => {
  renderKeywordPreview();
  ui.saveStatus.textContent = "Salvando…";
  ui.saveStatus.style.color = "#788498";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSlideFields, 300);
});

ui.slideTitleEditor.addEventListener("input", () => {
  ui.commentTopic.textContent = ui.slideTitleEditor.value;
  ui.previewTitle.textContent = ui.slideTitleEditor.value;
  ui.saveStatus.textContent = "Salvando…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSlideFields, 400);
});

ui.present.addEventListener("click", (event) => {
  if (event.target.closest("#live-suggestion")) return;
  const direction = event.clientX < window.innerWidth / 2 ? "prev" : "next";
  clearTimeout(stageClickTimer);
  stageClickTimer = setTimeout(() => handleAction(direction), 220);
});

ui.present.addEventListener("dblclick", (event) => {
  event.preventDefault();
  clearTimeout(stageClickTimer);
  exitPresentation();
});

$("#start-presentation").addEventListener("click", startPresentation);
$("#new-presentation").addEventListener("click", () => $("#file-import").click());
$("#add-presentation-card").addEventListener("click", () => $("#file-import").click());
$("#download-backup").addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = "/api/backup";
  link.download = "slide-assistido-backup.zip";
  link.click();
});
$("#rename-presentation").addEventListener("click", () => {
  if (activeId === "demo") return showToast("A apresentação de demonstração mantém o título original.");
  renameDeck();
});
$("#move-slide-up").addEventListener("click", () => moveCurrentSlide(-1));
$("#move-slide-down").addEventListener("click", () => moveCurrentSlide(1));
$("#file-import").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const button = $("#new-presentation");
  const addCard = $("#add-presentation-card");
  button.disabled = true;
  addCard.disabled = true;
  button.textContent = "Importando…";
  try {
    const response = await fetch("/api/import", { method: "POST", headers: { "X-Filename": encodeURIComponent(file.name), "Content-Type": "application/octet-stream" }, body: file });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível importar.");
    decks.push({ id: result.id, title: result.title, pages: result.telas.length });
    renderLibrary();
    await selectDeck(result.id);
  } catch (error) { showToast(error.message); }
  finally { button.disabled = false; addCard.disabled = false; button.textContent = "＋ Nova apresentação"; event.target.value = ""; }
});
$("#test-suggestion").addEventListener("click", testSuggestion);
$("#test-microphone").addEventListener("click", () => {
  if (speechMode === "test") stopRecognition();
  else beginRecognition("test");
});
$("#mic-device").addEventListener("change", () => {
  localStorage.setItem("slide-assistido.microphone-device.v1", $("#mic-device").value);
  if (speechMode === "test") { stopRecognition(); beginRecognition("test"); }
});
refreshMicrophones().catch(() => {});
$("#configure-deepgram").addEventListener("click", async () => {
  const field = $("#deepgram-key");
  const key = field.value.trim();
  if (!key) return showToast("Cole sua chave da Deepgram no campo acima.");
  const button = $("#configure-deepgram");
  button.disabled = true;
  try {
    const response = await fetch("/api/voice-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível ativar a Deepgram.");
    deepgramConfigured = true;
    field.value = "";
    $("#provider-status").textContent = "Chave ativada somente nesta sessão local. Teste o microfone antes de apresentar.";
  } catch (error) { $("#provider-status").textContent = error.message; }
  finally { button.disabled = false; }
});
fetch("/api/voice-status").then((response) => response.json()).then((status) => {
  deepgramConfigured = status.configured;
  if (deepgramConfigured) $("#provider-status").textContent = "Deepgram configurada neste servidor local.";
}).catch(() => {});
fetch("/api/semantic-status").then((response) => response.json()).then((status) => {
  semanticConfigured = status.configured;
  $("#semantic-status").textContent = semanticConfigured
    ? "Busca semântica local disponível. O primeiro uso baixa o modelo uma vez."
    : "Modelo semântico local indisponível. Confira a instalação no servidor.";
}).catch(() => { semanticConfigured = false; });
$("#accept-suggestion").addEventListener("click", (event) => { event.stopPropagation(); acceptSuggestion(); });
$("#dismiss-suggestion").addEventListener("click", (event) => { event.stopPropagation(); rejectSuggestion("botão"); });
$("#download-transcript").addEventListener("click", downloadTranscript);
document.querySelectorAll(".open-voice-commands").forEach((button) => button.addEventListener("click", openVoiceCommands));
$("#save-commands").addEventListener("click", saveVoiceCommands);
$("#commands-dialog").addEventListener("input", () => { $("#commands-status").textContent = ""; });
$("#close-commands").addEventListener("click", () => $("#commands-dialog").close());
$("#commands-dialog").addEventListener("close", () => { if (speechMode === "commands") stopRecognition(); });
$("#command-test-button").addEventListener("click", () => showCommandTest($("#command-test-text").value));
$("#command-test-text").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); showCommandTest(event.target.value); } });
$("#command-test-microphone").addEventListener("click", () => {
  if (speechMode === "commands") stopRecognition();
  else {
    if (speechMode === "test") stopRecognition();
    beginRecognition("commands");
  }
});
fetch("/api/voice-commands").then((response) => response.ok ? response.json() : null).then((data) => { if (data) voiceCommands = data; }).catch(() => {});
function saveSettings() {
  const settings = readSettings();
  applySettings(settings);
  if (activeId === "demo") localStorage.setItem(storageKey("settings"), JSON.stringify(settings));
  else persistDeck({ settings });
}
for (const selector of ["#mic-enabled", "#semantic-enabled", "#suggestion-seconds", "#keep-suggestion-open", "#store-transcript", "#minimum-score", "#minimum-margin", "#speech-window", "#suggestion-interval", "#rejection-block"]) {
  $(selector).addEventListener("change", saveSettings);
}
$("#reset-calibration").addEventListener("click", () => {
  applySettings({ ...readSettings(), minimum_score: 0.42, minimum_margin: 0.025, speech_window: 12, suggestion_interval: 12, rejection_block: 45 });
  saveSettings();
  showToast("Calibração restaurada.");
});
$("#search-input").addEventListener("input", (event) => {
  const term = normalize(event.target.value);
  document.querySelectorAll(".presentation-card").forEach((card) => card.classList.toggle("hidden", !normalize(card.textContent).includes(term)));
});

document.addEventListener("keydown", (event) => {
  if (ui.present.classList.contains("hidden")) return;
  if (event.key.toLowerCase() === "d") {
    event.preventDefault();
    $("#speech-debug").classList.toggle("hidden");
    return;
  }
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) {
    event.preventDefault();
    handleAction("next");
  } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    handleAction("prev");
  } else if (event.key === "Escape" && !document.fullscreenElement) {
    exitPresentation();
  }
});

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement || ui.present.classList.contains("hidden")) return;
  exitPresentation();
});

fetch(DATA_URL)
  .then((response) => {
    if (!response.ok) throw new Error("Não foi possível carregar a apresentação de demonstração.");
    return response.json();
  })
  .then((data) => {
    deck = data;
    loadEdits();
    $("#rail-count").textContent = String(deck.telas.length).padStart(2, "0");
    return fetch("/api/decks");
  })
  .then((response) => response.ok ? response.json() : [])
  .then((items) => { decks = items; renderLibrary(); })
  .catch((error) => showToast(error.message));
