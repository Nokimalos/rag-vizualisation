import io
from pathlib import Path

import pytest

from app.processing.parser import (
    VISION_MIN_LONG_EDGE,
    DocumentParser,
    ParseResult,
    _upscale_for_vision,
    parse_document,
)


def _make_image(path: Path, text: str = "Hello OCR") -> None:
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (400, 100), color="white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 32)
    except OSError:
        font = ImageFont.load_default()
    draw.text((10, 30), text, fill="black", font=font)
    img.save(str(path))


class _FakeVisionLLM:
    def __init__(
        self,
        *,
        supports: bool = True,
        result: str = "Vision result",
        raises: Exception | None = None,
    ) -> None:
        self._supports = supports
        self._result = result
        self._raises = raises
        self.calls: list[dict] = []

    def name(self) -> str:
        return "fake"

    def supports_vision(self) -> bool:
        return self._supports

    async def describe_image(
        self, image_bytes: bytes, mime_type: str, prompt: str, max_tokens: int = 2048
    ) -> str:
        self.calls.append({"mime_type": mime_type, "size": len(image_bytes)})
        if self._raises is not None:
            raise self._raises
        return self._result


class TestDocumentParser:
    def test_parse_txt(self, tmp_path):
        content = "Hello, this is a test document.\nWith two lines."
        f = tmp_path / "test.txt"
        f.write_text(content, encoding="utf-8")

        result = DocumentParser.parse(str(f))

        assert result.text == content
        assert result.file_type == "txt"
        assert result.char_count == 47
        assert result.page_count == 1

    def test_parse_md(self, tmp_path):
        content = "# Title\n\nSome **markdown** content."
        f = tmp_path / "test.md"
        f.write_text(content, encoding="utf-8")

        result = DocumentParser.parse(str(f))

        assert "# Title" in result.text
        assert result.file_type == "md"
        assert result.page_count == 1

    def test_parse_unsupported_format(self, tmp_path):
        f = tmp_path / "test.xyz"
        f.write_text("some content", encoding="utf-8")

        with pytest.raises(ValueError, match="Unsupported file type"):
            DocumentParser.parse(str(f))

    def test_parse_nonexistent_file(self):
        with pytest.raises(FileNotFoundError):
            DocumentParser.parse("/nonexistent/path/file.txt")

    def test_supported_types(self):
        types = DocumentParser.supported_types()
        assert "txt" in types
        assert "md" in types
        assert "pdf" in types
        assert "docx" in types
        assert "png" in types
        assert "jpg" in types
        assert "jpeg" in types
        assert types == sorted(types)

    def test_parse_image_png(self, tmp_path):
        f = tmp_path / "test.png"
        _make_image(f)

        result = DocumentParser.parse(str(f))

        assert result.file_type == "png"
        assert result.page_count == 1
        assert "Hello" in result.text

    def test_parse_result_dataclass(self, tmp_path):
        content = "Simple text."
        f = tmp_path / "test.txt"
        f.write_text(content, encoding="utf-8")

        result = DocumentParser.parse(str(f))

        assert isinstance(result, ParseResult)
        assert result.char_count == len(content)

    def test_parse_txt_path_object(self, tmp_path):
        content = "Hello world"
        f = tmp_path / "test.txt"
        f.write_text(content, encoding="utf-8")

        # Also accepts Path objects
        result = DocumentParser.parse(f)

        assert result.text == content


class TestParseDocumentAsync:
    async def test_image_uses_vision_when_available(self, tmp_path):
        f = tmp_path / "chart.png"
        _make_image(f)
        llm = _FakeVisionLLM(result="Raise: AA, KK\nFold: 72o")

        result = await parse_document(str(f), llm=llm)

        assert result.file_type == "png"
        assert "Raise" in result.text
        assert len(llm.calls) == 1
        assert llm.calls[0]["mime_type"] == "image/png"

    async def test_image_falls_back_to_ocr_when_vision_unsupported(self, tmp_path):
        f = tmp_path / "img.png"
        _make_image(f)
        llm = _FakeVisionLLM(supports=False)

        result = await parse_document(str(f), llm=llm)

        assert result.file_type == "png"
        assert "Hello" in result.text
        assert llm.calls == []

    async def test_image_falls_back_to_ocr_when_vision_raises(self, tmp_path):
        f = tmp_path / "img.png"
        _make_image(f)
        llm = _FakeVisionLLM(raises=RuntimeError("API down"))

        result = await parse_document(str(f), llm=llm)

        assert result.file_type == "png"
        assert "Hello" in result.text
        assert len(llm.calls) == 1

    async def test_image_falls_back_to_ocr_when_vision_returns_empty(self, tmp_path):
        f = tmp_path / "img.png"
        _make_image(f)
        llm = _FakeVisionLLM(result="   ")

        result = await parse_document(str(f), llm=llm)

        assert "Hello" in result.text

    async def test_non_image_ignores_llm(self, tmp_path):
        f = tmp_path / "doc.txt"
        f.write_text("plain text", encoding="utf-8")
        llm = _FakeVisionLLM()

        result = await parse_document(str(f), llm=llm)

        assert result.text == "plain text"
        assert llm.calls == []

    async def test_image_without_llm_uses_ocr(self, tmp_path):
        f = tmp_path / "img.png"
        _make_image(f)

        result = await parse_document(str(f), llm=None)

        assert "Hello" in result.text


class TestUpscaleForVision:
    def _png_bytes(self, size: tuple[int, int]) -> bytes:
        from PIL import Image

        img = Image.new("RGB", size, color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def test_small_image_is_upscaled(self):
        from PIL import Image

        original = self._png_bytes((480, 480))
        upscaled, mime = _upscale_for_vision(original, "png")

        with Image.open(io.BytesIO(upscaled)) as img:
            assert max(img.size) >= VISION_MIN_LONG_EDGE
        assert mime == "image/png"

    def test_large_image_is_returned_as_is(self):
        original = self._png_bytes((2000, 1200))
        result, mime = _upscale_for_vision(original, "png")

        assert result == original
        assert mime == "image/png"

    def test_jpeg_small_is_upscaled_to_png(self):
        from PIL import Image

        img = Image.new("RGB", (300, 300), color="white")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        upscaled, mime = _upscale_for_vision(buf.getvalue(), "jpg")

        with Image.open(io.BytesIO(upscaled)) as out:
            assert max(out.size) >= VISION_MIN_LONG_EDGE
        assert mime == "image/png"
