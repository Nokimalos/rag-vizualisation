"""Parse a codebase directory into chunks suitable for RAG.

Focuses on source code with business logic and documentation.
Aggressively filters out noise (tests, migrations, configs, build files)
to keep the vector store clean and retrieval accurate.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path

# Source code we want to index (business logic)
CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rs", ".rb",
    ".c", ".cpp", ".h", ".hpp", ".cs", ".swift", ".kt", ".scala",
    ".php", ".dart", ".vue", ".svelte",
}

# Documentation we always want
DOC_EXTENSIONS = {
    ".md", ".txt", ".rst", ".adoc",
}

# Skip these directories
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "env",
    ".next", "dist", "build", ".tox", ".mypy_cache", ".pytest_cache",
    "target", "vendor", ".gradle", ".idea", ".vscode", ".DS_Store",
    "coverage", ".nyc_output", "eggs",
    # Test directories
    "test", "tests", "__tests__", "spec", "specs",
    "test-fixtures", "fixtures", "__mocks__",
    # Generated / migration / seed data
    "migrations", "migration", "db",
    "generated", "auto-generated",
}

# Skip files matching these patterns
SKIP_FILE_PATTERNS = {
    # Config / build files (low RAG value)
    "package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json",
    "webpack.config.js", "vite.config.ts", "vite.config.js",
    "babel.config.js", ".babelrc", "jest.config.js", "jest.config.ts",
    "postcss.config.js", "tailwind.config.js", "tailwind.config.ts",
    ".eslintrc.js", ".eslintrc.json", ".prettierrc",
    "pom.xml", "build.gradle", "settings.gradle",
    "cargo.toml", "cargo.lock", "go.sum",
    "gemfile.lock", "poetry.lock", "pipfile.lock",
    "docker-compose.yml", "docker-compose.yaml",
    ".gitignore", ".dockerignore", ".env.example",
    # Generated / low-value
    "changelog.md", "license", "license.md",
}

# Skip files containing these in their path
SKIP_PATH_PATTERNS = [
    "/test/", "/tests/", "/__tests__/", "/spec/",
    "/fixtures/", "/__mocks__/",
    "/migration/", "/migrations/",
    ".test.", ".spec.", "_test.", "_spec.",
    ".min.js", ".min.css", ".map",
    "/seed/", "/seeds/",
]

MAX_FILE_SIZE = 200 * 1024  # 200KB
MAX_CHUNK_CHARS = 2000


@dataclass
class CodeChunk:
    text: str
    file_path: str
    language: str
    start_line: int
    end_line: int
    chunk_type: str
    metadata: dict = field(default_factory=dict)


EXT_TO_LANGUAGE = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".tsx": "typescript", ".jsx": "javascript", ".java": "java",
    ".go": "go", ".rs": "rust", ".rb": "ruby", ".c": "c",
    ".cpp": "cpp", ".h": "c", ".hpp": "cpp", ".cs": "csharp",
    ".swift": "swift", ".kt": "kotlin", ".scala": "scala",
    ".php": "php", ".dart": "dart",
    ".vue": "vue", ".svelte": "svelte",
    ".md": "markdown", ".txt": "text", ".rst": "rst", ".adoc": "asciidoc",
}


def _should_skip_dir(name: str) -> bool:
    return name.lower() in SKIP_DIRS or name.startswith(".")


def _should_skip_file(path: Path, rel_path: str) -> bool:
    name_lower = path.name.lower()

    # Skip by exact filename
    if name_lower in SKIP_FILE_PATTERNS:
        return True

    # Skip by path pattern
    rel_lower = rel_path.lower()
    for pattern in SKIP_PATH_PATTERNS:
        if pattern in rel_lower:
            return True

    # Skip SQL files (migrations, seeds — low RAG value)
    if path.suffix.lower() == ".sql":
        return True

    # Skip config files
    if path.suffix.lower() in {".yaml", ".yml", ".toml", ".json", ".xml", ".csv", ".env"}:
        return True

    return False


def _is_indexable(path: Path, rel_path: str) -> bool:
    ext = path.suffix.lower()
    if ext not in CODE_EXTENSIONS and ext not in DOC_EXTENSIONS:
        # Also index Dockerfile, Makefile
        if path.name.lower() not in {"dockerfile", "makefile"}:
            return False

    if path.stat().st_size > MAX_FILE_SIZE:
        return False

    if _should_skip_file(path, rel_path):
        return False

    return True


def _make_chunk_header(file_path: str, language: str, start_line: int | None = None, end_line: int | None = None) -> str:
    """Create a natural-language header for each chunk to improve retrieval."""
    header = f"File: {file_path} (language: {language})"
    if start_line and end_line:
        header += f" lines {start_line}-{end_line}"
    return header


def _split_file_into_chunks(content: str, file_path: str, language: str) -> list[CodeChunk]:
    lines = content.split("\n")

    if len(content) <= MAX_CHUNK_CHARS:
        header = _make_chunk_header(file_path, language)
        return [CodeChunk(
            text=f"{header}\n\n{content}",
            file_path=file_path,
            language=language,
            start_line=1,
            end_line=len(lines),
            chunk_type="file",
        )]

    chunks = []
    current_lines: list[str] = []
    current_start = 1
    current_size = 0

    for i, line in enumerate(lines, 1):
        current_lines.append(line)
        current_size += len(line) + 1

        is_boundary = (line.strip() == "" and current_size > MAX_CHUNK_CHARS // 2)
        is_overflow = (current_size >= MAX_CHUNK_CHARS)

        if is_boundary or is_overflow:
            chunk_text = "\n".join(current_lines)
            header = _make_chunk_header(file_path, language, current_start, i)
            chunks.append(CodeChunk(
                text=f"{header}\n\n{chunk_text}",
                file_path=file_path,
                language=language,
                start_line=current_start,
                end_line=i,
                chunk_type="section",
            ))
            current_lines = []
            current_start = i + 1
            current_size = 0

    if current_lines:
        end = current_start + len(current_lines) - 1
        chunk_text = "\n".join(current_lines)
        header = _make_chunk_header(file_path, language, current_start, end)
        chunks.append(CodeChunk(
            text=f"{header}\n\n{chunk_text}",
            file_path=file_path,
            language=language,
            start_line=current_start,
            end_line=end,
            chunk_type="section",
        ))

    return chunks


def parse_codebase(root_dir: str) -> list[CodeChunk]:
    root = Path(root_dir)
    if not root.is_dir():
        raise ValueError(f"Not a directory: {root_dir}")

    all_chunks: list[CodeChunk] = []
    skipped_files = 0

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not _should_skip_dir(d)]

        for fname in sorted(filenames):
            fpath = Path(dirpath) / fname
            rel_path = str(fpath.relative_to(root))

            if not _is_indexable(fpath, rel_path):
                skipped_files += 1
                continue

            ext = fpath.suffix.lower()
            language = EXT_TO_LANGUAGE.get(ext, "text")

            try:
                content = fpath.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue

            if not content.strip():
                continue

            chunks = _split_file_into_chunks(content, rel_path, language)
            all_chunks.extend(chunks)

    return all_chunks
