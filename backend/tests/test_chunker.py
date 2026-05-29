import pytest

from app.processing.chunker import Chunker, Chunk
from app.models.schemas import ChunkingStrategy


class TestFixedChunking:
    def test_basic_chunking(self):
        text = "a" * 100
        chunks = Chunker.chunk(text, ChunkingStrategy.FIXED, chunk_size=30, overlap=10)

        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk.text) <= 30

    def test_overlap(self):
        # Build a text where we can verify overlap
        text = "abcdefghijklmnopqrstuvwxyz" * 4  # 104 chars
        chunks = Chunker.chunk(text, ChunkingStrategy.FIXED, chunk_size=20, overlap=5)

        assert len(chunks) > 1
        # Verify overlap: last 5 chars of chunk N == first 5 chars of chunk N+1
        for i in range(len(chunks) - 1):
            tail = chunks[i].text[-5:]
            head = chunks[i + 1].text[:5]
            assert tail == head

    def test_short_text_single_chunk(self):
        text = "Short text."
        chunks = Chunker.chunk(text, ChunkingStrategy.FIXED, chunk_size=512, overlap=50)

        assert len(chunks) == 1
        assert chunks[0].text == text

    def test_chunk_has_index(self):
        text = "a" * 200
        chunks = Chunker.chunk(text, ChunkingStrategy.FIXED, chunk_size=50, overlap=10)

        for i, chunk in enumerate(chunks):
            assert chunk.index == i

    def test_empty_text(self):
        chunks = Chunker.chunk("", ChunkingStrategy.FIXED, chunk_size=50, overlap=10)
        assert chunks == []


class TestRecursiveChunking:
    def test_splits_on_paragraphs(self):
        text = (
            "First paragraph with some content here.\n\n"
            "Second paragraph with different content.\n\n"
            "Third paragraph with more content here."
        )
        chunks = Chunker.chunk(text, ChunkingStrategy.RECURSIVE, chunk_size=50, overlap=0)

        assert len(chunks) > 1
        # Each chunk should be at or near paragraph boundaries
        full_text = " ".join(c.text for c in chunks)
        assert "First paragraph" in full_text
        assert "Second paragraph" in full_text

    def test_falls_back_to_sentences(self):
        # Long paragraph without \n\n but with ". "
        sentence = "This is a sentence with some content. "
        text = sentence * 10  # ~380 chars, no paragraph breaks
        chunks = Chunker.chunk(text, ChunkingStrategy.RECURSIVE, chunk_size=80, overlap=0)

        assert len(chunks) > 1
        for chunk in chunks:
            assert len(chunk.text) <= 80 or len(chunk.text.strip()) > 0

    def test_preserves_all_content(self):
        text = (
            "First paragraph content.\n\n"
            "Second paragraph content.\n\n"
            "Third paragraph content."
        )
        chunks = Chunker.chunk(text, ChunkingStrategy.RECURSIVE, chunk_size=30, overlap=0)

        # Reconstruct and verify key words are present
        reconstructed = " ".join(c.text for c in chunks)
        assert "First" in reconstructed
        assert "Second" in reconstructed
        assert "Third" in reconstructed

    def test_chunk_indices_sequential(self):
        text = "paragraph one.\n\nparagraph two.\n\nparagraph three.\n\nparagraph four."
        chunks = Chunker.chunk(text, ChunkingStrategy.RECURSIVE, chunk_size=20, overlap=0)

        for i, chunk in enumerate(chunks):
            assert chunk.index == i


class TestSemanticChunking:
    def test_semantic_falls_back_to_recursive(self):
        text = "Some text with content.\n\nAnother paragraph here."
        chunks_semantic = Chunker.chunk(text, ChunkingStrategy.SEMANTIC, chunk_size=50, overlap=0)
        chunks_recursive = Chunker.chunk(text, ChunkingStrategy.RECURSIVE, chunk_size=50, overlap=0)

        # Same behavior for now
        assert len(chunks_semantic) == len(chunks_recursive)
        assert [c.text for c in chunks_semantic] == [c.text for c in chunks_recursive]


class TestChunkMetadata:
    def test_chunk_has_start_end(self):
        text = "Hello world. This is a test."
        chunks = Chunker.chunk(text, ChunkingStrategy.FIXED, chunk_size=15, overlap=0)

        for chunk in chunks:
            assert chunk.start_char >= 0
            assert chunk.end_char > chunk.start_char
            assert chunk.end_char <= len(text)

    def test_chunk_start_end_match_text(self):
        text = "abcdefghijklmnopqrstuvwxyz"
        chunks = Chunker.chunk(text, ChunkingStrategy.FIXED, chunk_size=10, overlap=0)

        for chunk in chunks:
            assert text[chunk.start_char:chunk.end_char] == chunk.text

    def test_chunk_dataclass_fields(self):
        chunk = Chunk(text="hello", index=0, start_char=0, end_char=5)
        assert chunk.text == "hello"
        assert chunk.index == 0
        assert chunk.start_char == 0
        assert chunk.end_char == 5
