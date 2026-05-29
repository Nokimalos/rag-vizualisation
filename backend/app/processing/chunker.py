import re
from dataclasses import dataclass

import numpy as np

from app.models.schemas import ChunkingStrategy


@dataclass
class Chunk:
    text: str
    index: int
    start_char: int
    end_char: int


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a)
    vb = np.array(b)
    dot = np.dot(va, vb)
    norm = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(dot / norm) if norm > 0 else 0.0


def _is_header_line(line: str) -> bool:
    """Detect section headers: ALL CAPS, markdown #, or lines ending with :"""
    stripped = line.strip()
    if not stripped or len(stripped) < 3:
        return False
    alpha = [c for c in stripped if c.isalpha()]
    if alpha and sum(1 for c in alpha if c.isupper()) / len(alpha) > 0.7:
        return True
    if stripped.startswith('#'):
        return True
    return False


def _split_into_sentences(text: str) -> list[str]:
    """Split text into sentences, respecting section headers."""
    lines = text.split('\n')
    sentences = []
    current = ""

    for line in lines:
        stripped = line.strip()

        if not stripped:
            # Blank line: flush current
            if current.strip():
                sentences.append(current.strip())
                current = ""
            continue

        if _is_header_line(stripped):
            # Section header: flush previous, start new
            if current.strip():
                sentences.append(current.strip())
            sentences.append(stripped)
            current = ""
        elif stripped.startswith(('●', '•', '-', '*', '–')) or re.match(r'^\d+[\.\)]', stripped):
            # Bullet point: flush previous, add as own sentence
            if current.strip():
                sentences.append(current.strip())
                current = ""
            sentences.append(stripped)
        else:
            # Regular line: accumulate
            if current:
                current += "\n" + stripped
            else:
                current = stripped

    if current.strip():
        sentences.append(current.strip())

    return sentences


class Chunker:
    @staticmethod
    def chunk(
        text: str,
        strategy: ChunkingStrategy,
        chunk_size: int = 512,
        overlap: int = 50,
    ) -> list[Chunk]:
        if not text:
            return []

        if strategy == ChunkingStrategy.FIXED:
            return Chunker._fixed_chunk(text, chunk_size, overlap)
        elif strategy == ChunkingStrategy.RECURSIVE:
            return Chunker._recursive_chunk(text, chunk_size, overlap)
        elif strategy == ChunkingStrategy.SEMANTIC:
            # Semantic is now a real strategy, but needs an embedding function
            # passed separately via chunk_semantic(). Fallback to recursive here.
            return Chunker._recursive_chunk(text, chunk_size, overlap)
        else:
            raise ValueError(f"Unknown chunking strategy: {strategy}")

    @staticmethod
    def chunk_semantic(
        text: str,
        embeddings: list[list[float]],
        sentences: list[str],
        chunk_size: int = 1500,
        similarity_threshold: float = 0.5,
    ) -> list[Chunk]:
        """Semantic chunking: group consecutive sentences by semantic similarity.

        Args:
            text: the original document text
            embeddings: one embedding per sentence
            sentences: the sentences (same order as embeddings)
            chunk_size: max chunk size in characters
            similarity_threshold: below this similarity, we split
        """
        if len(sentences) <= 1:
            return [Chunk(text=text.strip(), index=0, start_char=0, end_char=len(text))]

        # Compute similarity between consecutive sentences
        similarities = []
        for i in range(len(embeddings) - 1):
            sim = _cosine_similarity(embeddings[i], embeddings[i + 1])
            similarities.append(sim)

        # Find split points: where similarity drops below threshold
        # Use adaptive threshold: percentile-based for the document
        if similarities:
            sorted_sims = sorted(similarities)
            # Split at the lowest 30% of similarities (adaptive to document)
            adaptive_threshold = sorted_sims[max(0, int(len(sorted_sims) * 0.3))]
            threshold = min(similarity_threshold, adaptive_threshold)
        else:
            threshold = similarity_threshold

        # Group sentences into chunks
        groups: list[list[str]] = [[sentences[0]]]
        current_size = len(sentences[0])

        for i in range(1, len(sentences)):
            sim = similarities[i - 1] if i - 1 < len(similarities) else 1.0
            sentence = sentences[i]

            # Split if: similarity is low OR chunk is getting too big
            should_split = sim < threshold or (current_size + len(sentence) > chunk_size)

            if should_split and current_size > 100:
                # Start new group
                groups.append([sentence])
                current_size = len(sentence)
            else:
                groups[-1].append(sentence)
                current_size += len(sentence) + 1

        # Convert groups to Chunks with position tracking
        chunks = []
        search_start = 0
        for i, group in enumerate(groups):
            chunk_text = "\n".join(group)
            if not chunk_text.strip():
                continue

            # Find position in original text
            pos = text.find(group[0], search_start)
            if pos == -1:
                pos = search_start

            # Find end position using last sentence in group
            last_sentence = group[-1]
            end_pos = text.find(last_sentence, pos)
            if end_pos == -1:
                end_pos = pos + len(chunk_text)
            else:
                end_pos = end_pos + len(last_sentence)

            chunks.append(Chunk(
                text=chunk_text,
                index=i,
                start_char=pos,
                end_char=end_pos,
            ))
            search_start = pos + 1

        return chunks

    @staticmethod
    def get_sentences(text: str) -> list[str]:
        """Public access to sentence splitting for the embedding step."""
        return _split_into_sentences(text)

    @staticmethod
    def chunk_hybrid(
        text: str,
        embeddings: list[list[float]],
        sentences: list[str],
        chunk_size: int = 1500,
        similarity_threshold: float = 0.5,
    ) -> list[Chunk]:
        """Hybrid chunking: structure-aware section detection + semantic grouping.

        1. Detect section headers (CAPS lines, markdown #, bullet starts)
        2. Force split at section boundaries
        3. Within sections, use semantic similarity to group content
        """
        if len(sentences) <= 1:
            return [Chunk(text=text.strip(), index=0, start_char=0, end_char=len(text))]

        # Step 1: detect which sentences are section headers
        def is_section_header(s: str) -> bool:
            stripped = s.strip()
            if not stripped:
                return False
            # ALL CAPS lines (at least 3 chars, mostly uppercase)
            if len(stripped) >= 3 and sum(1 for c in stripped if c.isupper()) / max(1, sum(1 for c in stripped if c.isalpha())) > 0.7:
                return True
            # Markdown headers
            if stripped.startswith('#'):
                return True
            return False

        # Step 2: compute consecutive similarities
        similarities = []
        for i in range(len(embeddings) - 1):
            sim = _cosine_similarity(embeddings[i], embeddings[i + 1])
            similarities.append(sim)

        # Adaptive threshold
        if similarities:
            sorted_sims = sorted(similarities)
            adaptive_threshold = sorted_sims[max(0, int(len(sorted_sims) * 0.3))]
            threshold = min(similarity_threshold, adaptive_threshold)
        else:
            threshold = similarity_threshold

        # Step 3: build groups — force split at headers, semantic split elsewhere
        groups: list[list[str]] = [[sentences[0]]]
        current_size = len(sentences[0])

        for i in range(1, len(sentences)):
            sentence = sentences[i]
            sim = similarities[i - 1] if i - 1 < len(similarities) else 1.0

            # Force split at section headers
            force_split = is_section_header(sentence)
            # Also split on low semantic similarity
            semantic_split = sim < threshold and current_size > 100
            # Also split on chunk size overflow
            size_split = current_size + len(sentence) > chunk_size

            if force_split or semantic_split or size_split:
                groups.append([sentence])
                current_size = len(sentence)
            else:
                groups[-1].append(sentence)
                current_size += len(sentence) + 1

        # Step 4: merge tiny header groups with their NEXT content
        # "FORMATION" (header) + next group (education details) = one chunk
        merged: list[list[str]] = []
        i = 0
        while i < len(groups):
            group = groups[i]
            group_text = "\n".join(group)

            # If this is a tiny header-only group and there's a next group, merge forward
            if len(group_text) < 80 and is_section_header(group[0]) and i + 1 < len(groups):
                merged.append(group + groups[i + 1])
                i += 2
            # If this is tiny non-header, merge with previous
            elif merged and len(group_text) < 50 and not is_section_header(group[0]):
                merged[-1].extend(group)
                i += 1
            else:
                merged.append(group)
                i += 1

        # Step 5: convert to Chunk objects
        chunks = []
        search_start = 0
        for i, group in enumerate(merged):
            chunk_text = "\n".join(group)
            if not chunk_text.strip():
                continue

            pos = text.find(group[0], search_start)
            if pos == -1:
                pos = search_start

            last_sentence = group[-1]
            end_pos = text.find(last_sentence, pos)
            if end_pos == -1:
                end_pos = pos + len(chunk_text)
            else:
                end_pos = end_pos + len(last_sentence)

            chunks.append(Chunk(
                text=chunk_text,
                index=i,
                start_char=pos,
                end_char=end_pos,
            ))
            search_start = pos + 1

        return chunks

    @staticmethod
    def _fixed_chunk(text: str, chunk_size: int, overlap: int) -> list[Chunk]:
        chunks: list[Chunk] = []
        start = 0
        index = 0

        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk_text = text[start:end]
            chunks.append(Chunk(
                text=chunk_text,
                index=index,
                start_char=start,
                end_char=end,
            ))
            index += 1

            if end == len(text):
                break

            start = end - overlap
            if start <= 0:
                start = end

        return chunks

    @staticmethod
    def _recursive_chunk(text: str, chunk_size: int, overlap: int) -> list[Chunk]:
        separators = ["\n\n", "\n", ". ", " "]
        raw_chunks = Chunker._split_recursive(text, chunk_size, separators)

        chunks: list[Chunk] = []
        index = 0
        search_start = 0

        for raw in raw_chunks:
            if not raw.strip():
                continue
            pos = text.find(raw, search_start)
            if pos == -1:
                pos = search_start

            end = pos + len(raw)
            chunks.append(Chunk(
                text=raw,
                index=index,
                start_char=pos,
                end_char=end,
            ))
            index += 1
            search_start = pos + 1

        return chunks

    @staticmethod
    def _split_recursive(text: str, chunk_size: int, separators: list[str]) -> list[str]:
        if len(text) <= chunk_size:
            return [text]

        if not separators:
            return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]

        sep = separators[0]
        remaining_seps = separators[1:]

        parts = text.split(sep)
        result: list[str] = []
        current = ""

        for part in parts:
            candidate = (current + sep + part) if current else part

            if len(candidate) <= chunk_size:
                current = candidate
            else:
                if current:
                    result.append(current)
                if len(part) > chunk_size:
                    sub_chunks = Chunker._split_recursive(part, chunk_size, remaining_seps)
                    result.extend(sub_chunks)
                    current = ""
                else:
                    current = part

        if current:
            result.append(current)

        return result
