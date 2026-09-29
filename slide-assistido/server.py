"""Servidor local da biblioteca Slide Assistido. Requer PyMuPDF; PPTX requer LibreOffice."""
import json
import os
import asyncio
import threading
import hashlib
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

import fitz
from websockets.asyncio.client import connect
from websockets.asyncio.server import serve

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "user_data"
DATA.mkdir(exist_ok=True)
MAX_BYTES = 60 * 1024 * 1024
MAX_PAGES = 150
VOICE_KEY = ""
SEMANTIC_MODEL = None
SEMANTIC_LOCK = threading.Lock()
SEMANTIC_CACHE = {}
INTENT_CACHE = None
VOICE_UPSTREAM = "wss://api.deepgram.com/v1/listen?model=nova-3&language=pt-BR&interim_results=true&punctuate=true&endpointing=300"


def create_embeddings(texts):
    """Multilingual semantic vectors run on the user's computer, with no text API."""
    global SEMANTIC_MODEL
    with SEMANTIC_LOCK:
        if SEMANTIC_MODEL is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as error:
                raise ValueError("Instale sentence-transformers para ativar a busca semântica local.") from error
            try:
                SEMANTIC_MODEL = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
            except Exception as error:
                raise ValueError("Não foi possível baixar o modelo semântico. Confira a internet e tente novamente.") from error
        return SEMANTIC_MODEL.encode(texts, show_progress_bar=False, normalize_embeddings=True).tolist()


def similarity(left, right):
    numerator = sum(a * b for a, b in zip(left, right))
    norm_left = math.sqrt(sum(a * a for a in left))
    norm_right = math.sqrt(sum(b * b for b in right))
    return numerator / (norm_left * norm_right) if norm_left and norm_right else 0


def valid_deck_id(deck_id):
    return len(deck_id) == 32 and all(character in "0123456789abcdef" for character in deck_id)


def atomic_json(path, payload):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def semantic_path(deck_id):
    return DATA / ("_semantic_demo.json" if deck_id == "demo" else f"{deck_id}/semantic.json")


def load_semantic_cache(deck_id, digest=None):
    cached = SEMANTIC_CACHE.get(deck_id)
    if cached and (digest is None or cached.get("digest") == digest):
        return cached
    path = semantic_path(deck_id)
    try:
        stored = json.loads(path.read_text(encoding="utf-8"))
        if digest is None or stored.get("digest") == digest:
            SEMANTIC_CACHE[deck_id] = stored
            return stored
    except (OSError, ValueError, TypeError):
        pass
    return None


def classify_intent(text):
    global INTENT_CACHE
    examples = {
        "yes": ["sim, pode abrir", "pode ir para essa tela", "claro, prossiga", "confirmo a mudança", "vamos para o slide sugerido"],
        "no": ["não, fique nesta tela", "não quero mudar", "deixe como está", "agora não", "ignore essa sugestão"],
    }
    if INTENT_CACHE is None:
        labels = [(label, phrase) for label, phrases in examples.items() for phrase in phrases]
        INTENT_CACHE = {"labels": [item[0] for item in labels], "vectors": create_embeddings([item[1] for item in labels])}
    probe = create_embeddings([text])[0]
    by_label = {"yes": [], "no": []}
    for label, vector in zip(INTENT_CACHE["labels"], INTENT_CACHE["vectors"]):
        by_label[label].append(similarity(probe, vector))
    yes_score = max(by_label["yes"])
    no_score = max(by_label["no"])
    if max(yes_score, no_score) >= 0.56 and abs(yes_score - no_score) >= 0.06:
        return {"intent": "yes" if yes_score > no_score else "no", "score": round(max(yes_score, no_score), 3)}
    return {"intent": "ambiguous", "score": round(max(yes_score, no_score), 3)}


async def voice_connection(browser):
    origin = browser.request.headers.get("Origin", "")
    if origin not in ("http://localhost:4174", "http://127.0.0.1:4174"):
        await browser.close(code=1008, reason="Origem não autorizada")
        return
    key = VOICE_KEY
    if not key:
        await browser.send(json.dumps({"type": "error", "message": "Configure a chave da Deepgram no painel antes de testar."}))
        await browser.close()
        return
    try:
        async with connect(VOICE_UPSTREAM, additional_headers={"Authorization": f"Token {key}"}, open_timeout=10, max_size=2**20) as deepgram:
            await browser.send(json.dumps({"type": "ready"}))

            async def send_audio():
                async for message in browser:
                    if isinstance(message, bytes):
                        await deepgram.send(message)
                    elif json.loads(message).get("type") == "stop":
                        await deepgram.send(json.dumps({"type": "Finalize"}))
                        await asyncio.sleep(0.5)
                        await deepgram.send(json.dumps({"type": "CloseStream"}))
                        return

            async def receive_text():
                async for raw in deepgram:
                    data = json.loads(raw)
                    if data.get("type") == "Results":
                        alternatives = data.get("channel", {}).get("alternatives", [])
                        transcript = alternatives[0].get("transcript", "") if alternatives else ""
                        if transcript:
                            await browser.send(json.dumps({"type": "result", "text": transcript, "final": bool(data.get("is_final"))}, ensure_ascii=False))
                    elif data.get("type") == "Error":
                        await browser.send(json.dumps({"type": "error", "message": "A Deepgram informou uma falha na transcrição."}))

            sending = asyncio.create_task(send_audio())
            receiving = asyncio.create_task(receive_text())
            done, pending_tasks = await asyncio.wait((sending, receiving), return_when=asyncio.FIRST_COMPLETED)
            if sending in done and receiving not in done:
                try:
                    await asyncio.wait_for(receiving, timeout=3)
                except (asyncio.TimeoutError, ConnectionError):
                    pass
            for task in pending_tasks:
                task.cancel()
            for task in done:
                if not task.cancelled():
                    task.result()
    except Exception as exc:
        if browser.state.name == "OPEN":
            detail = "Autenticação recusada pela Deepgram." if "401" in str(exc) or "403" in str(exc) else "Não foi possível conectar à Deepgram. Confira a chave e a internet."
            await browser.send(json.dumps({"type": "error", "message": detail}))


def run_voice_server():
    async def runner():
        async with serve(voice_connection, "127.0.0.1", 4176, max_size=2**19):
            await asyncio.Future()
    asyncio.run(runner())


def office_path():
    for name in ("soffice", "libreoffice"):
        found = shutil.which(name)
        if found:
            return found
    for base in (os.environ.get("ProgramFiles", ""), os.environ.get("ProgramFiles(x86)", "")):
        if base:
            candidate = Path(base) / "LibreOffice" / "program" / "soffice.exe"
            if candidate.exists():
                return str(candidate)
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def json_response(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def authorized_origin(self):
        return self.headers.get("Origin") in ("http://localhost:4174", "http://127.0.0.1:4174")

    def read_json(self, maximum=1024 * 1024):
        length = int(self.headers.get("Content-Length", "0"))
        if not 2 <= length <= maximum:
            raise ValueError("Dados inválidos ou muito extensos.")
        return json.loads(self.rfile.read(length))

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/backup":
            with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as temporary:
                backup_path = Path(temporary.name)
            try:
                with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as archive:
                    for item in DATA.rglob("*"):
                        if item.is_file() and not item.name.endswith(".tmp"):
                            archive.write(item, item.relative_to(DATA))
                size = backup_path.stat().st_size
                self.send_response(200)
                self.send_header("Content-Type", "application/zip")
                self.send_header("Content-Disposition", "attachment; filename=slide-assistido-backup.zip")
                self.send_header("Content-Length", str(size))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                with backup_path.open("rb") as source:
                    shutil.copyfileobj(source, self.wfile)
                return
            finally:
                backup_path.unlink(missing_ok=True)
        if path == "/api/voice-status":
            return self.json_response(200, {"configured": bool(VOICE_KEY)})
        if path == "/api/semantic-status":
            return self.json_response(200, {"configured": True})
        if path == "/api/health":
            return self.json_response(200, {"application": "ok", "deepgram_key": bool(VOICE_KEY), "semantic_model_loaded": SEMANTIC_MODEL is not None})
        if path == "/api/decks":
            entries = []
            for item in DATA.glob("*/deck.json"):
                try:
                    deck = json.loads(item.read_text(encoding="utf-8"))
                    entries.append({"id": deck["id"], "title": deck["title"], "pages": len(deck["telas"]), "updated_at": deck.get("updated_at")})
                except (OSError, ValueError, KeyError):
                    continue
            return self.json_response(200, sorted(entries, key=lambda d: d["title"].casefold()))
        if path.startswith("/api/decks/"):
            deck_id = path.removeprefix("/api/decks/")
            if not valid_deck_id(deck_id):
                return self.json_response(404, {"error": "Apresentação não encontrada."})
            try:
                return self.json_response(200, json.loads((DATA / deck_id / "deck.json").read_text(encoding="utf-8")))
            except (OSError, ValueError):
                return self.json_response(404, {"error": "Apresentação não encontrada."})
        if path.endswith("/deck.json") or path.endswith("/semantic.json") or "/original." in path or path.endswith(".py"):
            return self.send_error(404)
        return super().do_GET()

    def do_PATCH(self):
        path = urlsplit(self.path).path
        if not self.authorized_origin() or not path.startswith("/api/decks/"):
            return self.json_response(403, {"error": "Operação não autorizada."})
        deck_id = path.removeprefix("/api/decks/")
        if not valid_deck_id(deck_id):
            return self.json_response(404, {"error": "Apresentação não encontrada."})
        deck_path = DATA / deck_id / "deck.json"
        try:
            body = self.read_json(2 * 1024 * 1024)
            deck = json.loads(deck_path.read_text(encoding="utf-8"))
            if "title" in body:
                title = str(body["title"]).strip()
                if not 1 <= len(title) <= 150:
                    raise ValueError("O título deve ter entre 1 e 150 caracteres.")
                deck["title"] = title
            if "last_slide" in body:
                last_slide = int(body["last_slide"])
                if not 0 <= last_slide < len(deck["telas"]):
                    raise ValueError("Tela inválida.")
                deck["last_slide"] = last_slide
            if "order" in body:
                order = body["order"]
                expected = [slide["pagina_pdf"] for slide in deck["telas"]]
                if not isinstance(order, list) or sorted(order) != sorted(expected):
                    raise ValueError("Ordem de telas inválida.")
                by_page = {slide["pagina_pdf"]: slide for slide in deck["telas"]}
                deck["telas"] = [by_page[page] for page in order]
                SEMANTIC_CACHE.pop(deck_id, None)
                semantic_path(deck_id).unlink(missing_ok=True)
            if "settings" in body:
                settings = body["settings"]
                if not isinstance(settings, dict):
                    raise ValueError("Configurações inválidas.")
                allowed = ("microphone", "semantic", "seconds", "keep_open", "store_transcript", "minimum_score", "minimum_margin", "speech_window", "suggestion_interval", "rejection_block")
                deck["settings"] = {key: settings[key] for key in allowed if key in settings}
            slide_updates = body.get("slides", [body["slide"]] if "slide" in body else [])
            if not isinstance(slide_updates, list) or len(slide_updates) > MAX_PAGES:
                raise ValueError("Atualizações de telas inválidas.")
            if slide_updates:
                for update in slide_updates:
                    if not isinstance(update, dict):
                        raise ValueError("Atualização de tela inválida.")
                    index = int(update.get("index", -1))
                    if not 0 <= index < len(deck["telas"]):
                        raise ValueError("Tela inválida.")
                    slide = deck["telas"][index]
                    slide["comentario_adicional_proposto"] = str(update.get("comment", ""))[:8000]
                    terms = update.get("keywords", [])
                    if not isinstance(terms, list) or len(terms) > 100:
                        raise ValueError("Palavras-chave inválidas.")
                    slide["palavras_chave"] = [str(term).strip()[:100] for term in terms if str(term).strip()]
                    if "title" in update:
                        title = str(update["title"]).strip()
                        if title:
                            slide["tema"] = title[:150]
                SEMANTIC_CACHE.pop(deck_id, None)
                try:
                    semantic_path(deck_id).unlink()
                except FileNotFoundError:
                    pass
            deck["updated_at"] = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
            atomic_json(deck_path, deck)
            return self.json_response(200, deck)
        except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
            return self.json_response(400, {"error": str(error) or "Não foi possível salvar."})

    def do_DELETE(self):
        path = urlsplit(self.path).path
        if not self.authorized_origin() or not path.startswith("/api/decks/"):
            return self.json_response(403, {"error": "Operação não autorizada."})
        deck_id = path.removeprefix("/api/decks/")
        if not valid_deck_id(deck_id):
            return self.json_response(404, {"error": "Apresentação não encontrada."})
        folder = DATA / deck_id
        if not (folder / "deck.json").exists():
            return self.json_response(404, {"error": "Apresentação não encontrada."})
        shutil.rmtree(folder)
        SEMANTIC_CACHE.pop(deck_id, None)
        return self.json_response(200, {"deleted": True})

    def do_POST(self):
        global VOICE_KEY
        if urlsplit(self.path).path.startswith("/api/semantic/"):
            if not self.authorized_origin():
                return self.json_response(403, {"error": "Origem não autorizada."})
            try:
                body = self.read_json()
                path = urlsplit(self.path).path
                deck_id = str(body.get("deck_id", ""))
                if not (deck_id == "demo" or valid_deck_id(deck_id)):
                    raise ValueError("Apresentação inválida.")
                if path == "/api/semantic/index":
                    texts = body.get("texts")
                    if not isinstance(texts, list) or not 1 <= len(texts) <= MAX_PAGES or any(not isinstance(t, str) or not 1 <= len(t) <= 4000 for t in texts):
                        raise ValueError("Telas inválidas para análise semântica.")
                    digest = hashlib.sha256(json.dumps(texts, ensure_ascii=False).encode()).hexdigest()
                    if not load_semantic_cache(deck_id, digest):
                        cache = {"digest": digest, "vectors": create_embeddings(texts)}
                        SEMANTIC_CACHE[deck_id] = cache
                        atomic_json(semantic_path(deck_id), cache)
                    return self.json_response(200, {"ready": True, "pages": len(texts)})
                if path == "/api/semantic/match":
                    query = body.get("query", "")
                    current = body.get("current")
                    cache = load_semantic_cache(deck_id)
                    if not cache:
                        raise ValueError("Prepare novamente a apresentação para a busca semântica.")
                    vectors = cache["vectors"]
                    if not isinstance(query, str) or not 5 <= len(query) <= 1500 or not isinstance(current, int) or not 0 <= current < len(vectors):
                        raise ValueError("Trecho de fala inválido.")
                    probe = create_embeddings([query])[0]
                    scores = [similarity(probe, vector) for vector in vectors]
                    excluded = {int(value) for value in body.get("excluded", []) if isinstance(value, int) and 0 <= value < len(vectors)}
                    recent = {int(value) for value in body.get("recent", []) if isinstance(value, int) and 0 <= value < len(vectors)}
                    candidates = [(i, score - (0.035 if i in recent else 0)) for i, score in enumerate(scores) if i != current and i not in excluded]
                    if not candidates:
                        return self.json_response(200, {"match": None, "candidates": []})
                    ranked = sorted(candidates, key=lambda item: item[1], reverse=True)
                    winner, score = ranked[0]
                    runner_up = ranked[1][1] if len(ranked) > 1 else 0
                    minimum_score = max(0.1, min(0.95, float(body.get("minimum_score", 0.42))))
                    minimum_margin = max(0, min(0.3, float(body.get("minimum_margin", 0.025))))
                    match = {"index": winner, "score": round(score, 3), "margin": round(score - runner_up, 3)} if score >= minimum_score and score - runner_up >= minimum_margin else None
                    details = [{"index": index, "score": round(value, 3)} for index, value in ranked[:5]]
                    return self.json_response(200, {"match": match, "candidates": details})
                if path == "/api/semantic/intent":
                    text = str(body.get("text", "")).strip()
                    if not 1 <= len(text) <= 500:
                        raise ValueError("Resposta inválida.")
                    return self.json_response(200, classify_intent(text))
                return self.json_response(404, {"error": "Endereço desconhecido."})
            except (ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
                return self.json_response(400, {"error": str(error) or "Dados inválidos."})
            except Exception:
                return self.json_response(502, {"error": "Falha no modelo semântico local. Confira o terminal do servidor."})
        if urlsplit(self.path).path == "/api/voice-config":
            if not self.authorized_origin():
                return self.json_response(403, {"error": "Origem não autorizada."})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 10 <= length <= 2048:
                    raise ValueError()
                key = json.loads(self.rfile.read(length)).get("key", "").strip()
                if not 10 <= len(key) <= 512 or any(c.isspace() for c in key):
                    raise ValueError()
            except (ValueError, AttributeError, UnicodeDecodeError):
                return self.json_response(400, {"error": "Informe uma chave de API válida."})
            VOICE_KEY = key
            return self.json_response(200, {"configured": True})
        if urlsplit(self.path).path != "/api/import":
            return self.json_response(404, {"error": "Endereço não encontrado."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 1 or length > MAX_BYTES:
            return self.json_response(413, {"error": "Arquivo vazio ou maior que 60 MB."})
        name = unquote(self.headers.get("X-Filename", "apresentacao.pdf"))
        suffix = Path(name).suffix.lower()
        if suffix not in (".pdf", ".pptx"):
            return self.json_response(400, {"error": "Escolha um arquivo PDF ou PPTX."})
        deck_id = uuid.uuid4().hex
        folder = DATA / deck_id
        folder.mkdir()
        try:
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("O envio do arquivo foi interrompido.")
            if suffix == ".pdf" and not raw.startswith(b"%PDF-"):
                raise ValueError("O arquivo informado não contém um PDF válido.")
            if suffix == ".pptx":
                try:
                    with zipfile.ZipFile(__import__("io").BytesIO(raw)) as archive:
                        names = set(archive.namelist())
                        if "[Content_Types].xml" not in names or "ppt/presentation.xml" not in names:
                            raise ValueError("O arquivo informado não contém uma apresentação PPTX válida.")
                        if any(name.lower().endswith("vbaproject.bin") for name in names):
                            raise ValueError("Apresentações com macros não são aceitas.")
                except zipfile.BadZipFile as error:
                    raise ValueError("O arquivo informado não contém uma apresentação PPTX válida.") from error
            original = folder / ("original" + suffix)
            original.write_bytes(raw)
            pdf = original
            if suffix == ".pptx":
                office = office_path()
                if not office:
                    raise ValueError("Para importar PPTX, instale o LibreOffice no computador. PDF já pode ser importado.")
                with tempfile.TemporaryDirectory() as profile:
                    result = subprocess.run([office, "-env:UserInstallation=file:///" + profile.replace("\\", "/"), "--headless", "--convert-to", "pdf", "--outdir", str(folder), str(original)], capture_output=True, timeout=120)
                pdf = folder / "original.pdf"
                if result.returncode or not pdf.exists():
                    raise ValueError("O LibreOffice não conseguiu converter este PPTX.")
            document = fitz.open(pdf)
            if document.needs_pass:
                document.close()
                raise ValueError("Apresentações protegidas por senha não são aceitas.")
            if document.page_count < 1 or document.page_count > MAX_PAGES:
                raise ValueError("A apresentação deve ter entre 1 e 150 telas.")
            slides = []
            for index, page in enumerate(document):
                page_number = index + 1
                text = page.get_text().strip()
                title = next((line.strip()[:100] for line in text.splitlines() if line.strip()), f"Tela {page_number}")
                page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False).save(folder / f"page-{page_number:03}.png")
                slides.append({"pagina_pdf": page_number, "tema": title, "texto_extraido": text[:15000], "comentario_adicional_proposto": "", "palavras_chave": [], "image": f"./user_data/{deck_id}/page-{page_number:03}.png"})
            document.close()
            deck = {"id": deck_id, "title": Path(name).stem[:150], "telas": slides, "last_slide": 0, "settings": {"microphone": True, "semantic": True, "seconds": 8, "keep_open": False, "store_transcript": False, "minimum_score": 0.42, "minimum_margin": 0.025, "speech_window": 12, "suggestion_interval": 12, "rejection_block": 45}, "updated_at": None}
            atomic_json(folder / "deck.json", deck)
            return self.json_response(201, deck)
        except (ValueError, RuntimeError, TimeoutError, fitz.FileDataError) as exc:
            shutil.rmtree(folder)
            return self.json_response(400, {"error": str(exc)})
        except Exception:
            shutil.rmtree(folder)
            return self.json_response(500, {"error": "Falha ao importar. Verifique o arquivo e tente novamente."})


if __name__ == "__main__":
    print("Slide Assistido: http://localhost:4174", flush=True)
    threading.Thread(target=run_voice_server, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", 4174), Handler).serve_forever()
