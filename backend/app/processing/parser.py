import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Union

if TYPE_CHECKING:
    from app.providers.llm.base import LLMProvider

logger = logging.getLogger(__name__)


@dataclass
class ParseResult:
    text: str
    file_type: str
    char_count: int
    page_count: int


IMAGE_EXTENSIONS = {"png", "jpg", "jpeg"}

_MIME_BY_EXT = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}

VISION_MIN_LONG_EDGE = 1500


def _upscale_for_vision(image_bytes: bytes, ext: str) -> tuple[bytes, str]:
    """Upscale small images so the long edge is at least VISION_MIN_LONG_EDGE px.

    Returns (bytes, mime_type). PNG output is used to avoid JPEG re-compression
    artifacts that would hurt OCR-like tasks.
    """
    import io

    from PIL import Image

    with Image.open(io.BytesIO(image_bytes)) as img:
        long_edge = max(img.size)
        if long_edge >= VISION_MIN_LONG_EDGE:
            return image_bytes, _MIME_BY_EXT[ext]

        scale = VISION_MIN_LONG_EDGE / long_edge
        new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
        upscaled = img.resize(new_size, Image.LANCZOS)

        if upscaled.mode not in ("RGB", "RGBA"):
            upscaled = upscaled.convert("RGB")

        buf = io.BytesIO()
        upscaled.save(buf, format="PNG", optimize=False)
        return buf.getvalue(), "image/png"

VISION_PROMPT = """Décris fidèlement le contenu de cette image en français pour qu'il puisse être indexé et recherché.

D'abord, transcris tout texte visible (titre, légende, axes, labels, annotations).

Si l'image est un chart de poker (grille 13x13 de mains AA/AKs/AKo/...):

1. Indique le titre ou le contexte exact tel qu'il apparaît (position, stack, situation), sans l'inventer.
2. Si une légende explicite associe une couleur à une action, retranscris-la mot pour mot.

3. ÉNUMÉRATION EXHAUSTIVE des 169 cases — c'est CRITIQUE :
   - Scanne la grille **ligne par ligne**, de haut en bas, gauche à droite.
   - La grille suit le format standard : la diagonale contient les paires (AA, KK, QQ, JJ, TT, 99, 88, 77, 66, 55, 44, 33, 22). Au-dessus de la diagonale = mains suited (ex: AKs, AQs). En-dessous = offsuit (ex: AKo, AQo).
   - Pour CHAQUE case observée, note la main et sa couleur brute. NE PAS sauter de case, même si tu hésites — indique "?" pour la couleur si vraiment incertain.

4. Regroupe ensuite les 169 mains **par couleur brute observée** (ex: "Bleu :", "Rouge :", "Vert :", "Jaune :", "Gris :"). Distingue les nuances si plusieurs (ex: "Bleu foncé", "Bleu clair").

5. SANITY CHECK : à la fin, compte le total des mains listées toutes couleurs confondues. Le total DOIT être 169 (13×13). Si ce n'est pas le cas, complète les mains manquantes en relisant la grille.

6. NE PAS deviner l'action associée à une couleur si elle n'est pas indiquée par la légende dans l'image. Mieux vaut "Bleu : AA, KK, ..." que "Call : AA, KK, ..." sans légende explicite.

Si l'image n'est pas un chart poker, décris brièvement la structure visuelle (tableau, schéma, graphique...).
Réponds uniquement avec le contenu extrait, sans préambule ni conclusion."""

VISION_MAX_TOKENS = 4096


class DocumentParser:
    @staticmethod
    def supported_types() -> list[str]:
        return sorted(["docx", "jpeg", "jpg", "md", "pdf", "png", "txt"])

    @staticmethod
    def parse(file_path: Union[str, Path]) -> ParseResult:
        path = Path(file_path)

        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = path.suffix.lstrip(".").lower()

        if ext not in DocumentParser.supported_types():
            raise ValueError(f"Unsupported file type: {ext!r}")

        if ext == "pdf":
            return DocumentParser._parse_pdf(path)
        elif ext == "docx":
            return DocumentParser._parse_docx(path)
        elif ext in IMAGE_EXTENSIONS:
            return DocumentParser._parse_image(path, ext)
        else:
            return DocumentParser._parse_text(path, ext)

    @staticmethod
    def _parse_text(path: Path, file_type: str) -> ParseResult:
        text = path.read_text(encoding="utf-8")
        return ParseResult(
            text=text,
            file_type=file_type,
            char_count=len(text),
            page_count=1,
        )

    @staticmethod
    def _parse_pdf(path: Path) -> ParseResult:
        import fitz  # PyMuPDF

        doc = fitz.open(str(path))
        pages = [page.get_text() for page in doc]
        doc.close()

        text = "\n".join(pages)
        return ParseResult(
            text=text,
            file_type="pdf",
            char_count=len(text),
            page_count=len(pages),
        )

    @staticmethod
    def _parse_docx(path: Path) -> ParseResult:
        import docx

        document = docx.Document(str(path))
        text = "\n".join(para.text for para in document.paragraphs)
        return ParseResult(
            text=text,
            file_type="docx",
            char_count=len(text),
            page_count=1,
        )

    @staticmethod
    def _parse_image(path: Path, file_type: str) -> ParseResult:
        import pytesseract
        from PIL import Image

        with Image.open(str(path)) as img:
            text = pytesseract.image_to_string(img, lang="fra+eng")

        text = text.strip()
        return ParseResult(
            text=text,
            file_type=file_type,
            char_count=len(text),
            page_count=1,
        )


async def parse_document(
    file_path: Union[str, Path],
    llm: "LLMProvider | None" = None,
) -> ParseResult:
    """Parse a document, using LLM vision for images when available.

    Falls back to Tesseract OCR if the LLM doesn't support vision or if the
    vision call fails.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = path.suffix.lstrip(".").lower()

    if ext in IMAGE_EXTENSIONS and llm is not None and llm.supports_vision():
        try:
            raw_bytes = await asyncio.to_thread(path.read_bytes)
            image_bytes, mime_type = await asyncio.to_thread(_upscale_for_vision, raw_bytes, ext)
            text = await llm.describe_image(
                image_bytes=image_bytes,
                mime_type=mime_type,
                prompt=VISION_PROMPT,
                max_tokens=VISION_MAX_TOKENS,
            )
            text = (text or "").strip()
            if text:
                return ParseResult(
                    text=text,
                    file_type=ext,
                    char_count=len(text),
                    page_count=1,
                )
            logger.warning("Vision returned empty text for %s, falling back to OCR", path.name)
        except Exception as exc:
            logger.warning("Vision describe failed for %s (%s), falling back to OCR", path.name, exc)

    return await asyncio.to_thread(DocumentParser.parse, str(path))
