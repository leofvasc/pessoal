const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const names = [
  "normalize", "commandKey", "customNavigationCommand", "parseCommandLines", "validateVoiceCommands", "classifyAnswer", "isReturnCommand", "isReturnCommandPrefix", "classifyNavigationCommand",
  "isNavigationCommandPrefix", "executeVoiceNavigation", "recordSpeech",
];
function extractFunction(name) {
  let start = source.indexOf(`async function ${name}(`);
  if (start === -1) start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} deve existir`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Função incompleta: ${name}`);
}

const state = {
  current: 0,
  count: 4,
  pending: null,
  history: [],
  actions: [],
};
const context = vm.createContext({
  Date,
  navigationCommandPrefix: null,
  voiceCommands: { next: [], prev: [], history: [], defaults: { next: true, prev: true, history: true } },
  COMMAND_LABELS: { next: "Próximo slide", prev: "Slide anterior", history: "Voltar ao histórico" },
  recentSpeech: [],
  session: { lines: [], metrics: { accepted: 0 } },
  ui: { present: { classList: { contains: () => false } } },
  currentSlide: () => ({ pagina_pdf: state.current + 1 }),
  saveSession: () => {},
  updateSpeechDiagnostics: () => {},
  handleAction: (action) => {
    state.actions.push(action);
    state.pending = null;
    context.pending = null;
    const next = Math.max(0, Math.min(state.count - 1, state.current + (action === "next" ? 1 : -1)));
    if (next !== state.current) state.history.push(state.current);
    state.current = next;
  },
  returnToPreviousSlide: () => {
    state.actions.push("history");
    state.pending = null;
    context.pending = null;
    if (state.history.length) state.current = state.history.pop();
  },
  classifyAnswerSemantic: async () => null,
  acceptSuggestion: () => {
    state.actions.push("accept");
    state.history.push(state.current);
    state.current = context.pending.index;
    context.pending = null;
  },
  rejectSuggestion: () => { throw new Error("Comando de navegação não deve rejeitar sugestão"); },
  findSuggestions: () => { throw new Error("Comando não deve iniciar uma sugestão"); },
  readSettings: () => ({ speech_window: 12, suggestion_interval: 12 }),
  $: () => ({ checked: false }),
  lastVoiceAction: "",
  lastSuggestionAt: Date.now(),
});
vm.runInContext(names.map(extractFunction).join("\n"), context);

const cases = [
  ["próximo slide", "next"], ["passe para o próximo slide", "next"],
  ["passe para a próxima tela", "next"], ["avance para a próxima tela", "next"],
  ["slide seguinte", "next"], ["Próximo slide, por favor", "next"],
  ["slide anterior", "prev"], ["passe para o slide anterior", "prev"],
  ["voltar ao slide anterior", "history"], ["volte para a tela anterior", "history"],
  ["voltar um slide", "history"], ["no próximo slide veremos os resultados", null],
  ["eu gostaria de passar para o próximo slide", null],
  ["sim, abrir o próximo slide", null], ["o slide anterior tem dados", null],
];
for (const [phrase, action] of cases) {
  assert.equal(context.classifyNavigationCommand(phrase), action, phrase);
}

// Frases personalizadas, com e sem as frases padrão.
const custom = {
  next: ["seguindo adiante"], prev: ["voltar um slide"], history: ["retome a tela de antes"],
  defaults: { next: true, prev: true, history: false },
};
const customCases = [
  ["Seguindo adiante!", "next"], ["retome a tela de antes, por favor", "history"],
  ["voltar um slide", "prev"], ["volte para a tela anterior", null],
  ["próximo slide", "next"], ["slide anterior", "prev"], ["agora seguindo adiante com o tema", null],
];
for (const [phrase, action] of customCases) {
  assert.equal(context.classifyNavigationCommand(phrase, custom), action, `personalizado: ${phrase}`);
}
assert.equal(context.isNavigationCommandPrefix("retome a tela", custom), true, "Início de frase personalizada aguarda o restante");
assert.equal(context.isNavigationCommandPrefix("voltar ao slide", custom), false, "Frases padrão desativadas não retêm trechos");
assert.equal(context.classifyNavigationCommand("volte para a tela anterior"), "history", "Sem personalização, o padrão continua valendo");
assert.equal(JSON.stringify(context.parseCommandLines(" seguindo  adiante \n\nSeguindo adiante\nretome")), JSON.stringify(["seguindo adiante", "retome"]));
const valid = (overrides) => context.validateVoiceCommands({ next: [], prev: [], history: [], defaults: {}, ...overrides });
assert.equal(valid(custom), null);
assert.match(valid({ next: ["vai"] }), /curta demais/);
assert.match(valid({ history: ["não agora"] }), /resposta às sugestões/);
assert.match(valid({ next: ["seguindo adiante"], prev: ["Seguindo adiante"] }), /está em/);

async function exercise() {
  state.pending = { index: 3 };
  context.pending = state.pending;
  await context.recordSpeech("passe para o próximo slide");
  assert.equal(state.current, 1);
  assert.equal(state.actions.at(-1), "next");
  assert.equal(context.pending, null, "A navegação fecha a sugestão sem aceitá-la");

  context.pending = null;
  await context.recordSpeech("voltar ao slide");
  assert.equal(state.current, 1, "Trecho parcial não navega");
  await context.recordSpeech("anterior");
  assert.equal(state.current, 0, "Retorno usa histórico");

  await context.recordSpeech("passe para o próximo");
  assert.equal(state.current, 0, "Trecho parcial não navega");
  await context.recordSpeech("slide");
  assert.equal(state.current, 1, "Avanço reúne trechos finais da transcrição");

  await context.recordSpeech("slide anterior");
  assert.equal(state.current, 0, "Recuo comum usa ordem da apresentação");
  context.pending = { index: 3 };
  await context.recordSpeech("sim, abrir");
  assert.equal(state.current, 3, "Resposta afirmativa ainda aceita a sugestão");
  await context.recordSpeech("voltar ao slide anterior");
  assert.equal(state.current, 0, "Retorno após salto recupera a origem, não a tela adjacente");

  const beforeNarrative = state.actions.length;
  await context.recordSpeech("no próximo slide veremos os resultados");
  assert.equal(state.actions.length, beforeNarrative, "Fala narrativa não navega");
  assert.deepEqual(state.actions, ["next", "history", "next", "prev", "accept", "history"]);
  context.voiceCommands = custom;
  await context.recordSpeech("retome a tela");
  await context.recordSpeech("de antes");
  assert.equal(state.actions.at(-1), "history", "Frase personalizada dividida em dois trechos navega");
  console.log(`VOICE_NAVIGATION_OK ${cases.length + customCases.length} frases e fluxo com sugestão e trechos divididos`);
}
exercise().catch((error) => { console.error(error); process.exitCode = 1; });
