from pathlib import Path
import json
import re
import hashlib

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


PROJECT_ROOT = Path(__file__).resolve().parents[2]

OCR_ROOT = PROJECT_ROOT / "public" / "ocr" / "books"

OUTPUT_DIR = PROJECT_ROOT / "ai" / "data" / "vector_db"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

INDEX_PATH = OUTPUT_DIR / "nctb_ocr.index"
CHUNKS_PATH = OUTPUT_DIR / "nctb_ocr_chunks.jsonl"


TEXT_KEYS = {
    "text",
    "ocr_text",
    "page_text",
    "full_text",
    "content",
    "page_content",
    "extracted_text",
    "raw_text",
    "passage",
    "body",
}


META_KEYS = {
    "page",
    "page_no",
    "page_number",
    "page_start",
    "page_end",
    "class",
    "class_level",
    "grade",
    "book",
    "book_id",
    "title",
}


def clean_text(text):
    text = str(text)

    text = text.replace("\x00", " ")

    text = re.sub(r"\s+", " ", text)

    return text.strip()


def good_text(text):
    text = clean_text(text)

    if len(text) < 100:
        return False

    words = re.findall(r"[A-Za-z]{2,}", text)

    if len(words) < 18:
        return False

    alpha = sum(c.isalpha() for c in text)

    if alpha / max(len(text), 1) < 0.40:
        return False

    return True


def detect_class(source, meta):
    blob = (
        str(source)
        + " "
        + " ".join(str(v) for v in meta.values())
    ).lower()

    patterns = [
        r"class[\s_\-]*(6|7|8)\b",
        r"grade[\s_\-]*(6|7|8)\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, blob)

        if match:
            return int(match.group(1))

    return None


def detect_page(meta, source):
    for key in (
        "page",
        "page_no",
        "page_number",
        "page_start",
    ):
        value = meta.get(key)

        if value is not None:
            return value

    match = re.search(
        r"(?:page|p)[\s_\-]*(\d+)",
        str(source).lower()
    )

    if match:
        return int(match.group(1))

    return None


def walk_object(obj, source, inherited=None):
    inherited = dict(inherited or {})

    if isinstance(obj, dict):

        meta = inherited.copy()

        for key in META_KEYS:
            if key in obj and isinstance(
                obj[key],
                (str, int, float)
            ):
                meta[key] = obj[key]

        found_known_text = False

        for key in TEXT_KEYS:

            value = obj.get(key)

            if isinstance(value, str) and good_text(value):

                found_known_text = True

                yield {
                    "text": clean_text(value),
                    "source": str(source),
                    "meta": meta.copy(),
                }

        # Some OCR exports use unusual field names.
        # Accept long string fields if no known text key exists.
        if not found_known_text:

            for key, value in obj.items():

                if (
                    key not in META_KEYS
                    and isinstance(value, str)
                    and good_text(value)
                ):

                    yield {
                        "text": clean_text(value),
                        "source": str(source),
                        "meta": meta.copy(),
                    }

        for value in obj.values():

            if isinstance(value, (dict, list)):

                yield from walk_object(
                    value,
                    source,
                    meta,
                )

    elif isinstance(obj, list):

        for value in obj:

            yield from walk_object(
                value,
                source,
                inherited,
            )

    elif isinstance(obj, str):

        if good_text(obj):

            yield {
                "text": clean_text(obj),
                "source": str(source),
                "meta": inherited.copy(),
            }


def load_file(path):

    suffix = path.suffix.lower()

    try:

        if suffix == ".txt":

            text = path.read_text(
                encoding="utf-8",
                errors="ignore",
            )

            if good_text(text):

                yield {
                    "text": clean_text(text),
                    "source": str(path),
                    "meta": {},
                }

        elif suffix == ".json":

            with open(
                path,
                "r",
                encoding="utf-8",
                errors="ignore",
            ) as f:

                obj = json.load(f)

            yield from walk_object(
                obj,
                path,
            )

        elif suffix == ".jsonl":

            with open(
                path,
                "r",
                encoding="utf-8",
                errors="ignore",
            ) as f:

                for line in f:

                    line = line.strip()

                    if not line:
                        continue

                    try:
                        obj = json.loads(line)
                    except Exception:
                        continue

                    yield from walk_object(
                        obj,
                        path,
                    )

    except Exception as e:

        print(
            "Could not parse:",
            path,
            e,
        )


def chunk_text(text, max_words=180, overlap=35):

    words = text.split()

    if len(words) <= max_words:

        if len(words) >= 18:
            yield " ".join(words)

        return

    step = max_words - overlap

    for start in range(
        0,
        len(words),
        step,
    ):

        part = words[
            start:
            start + max_words
        ]

        if len(part) < 18:
            continue

        yield " ".join(part)

        if start + max_words >= len(words):
            break


print()
print("NCTB RAG INDEX BUILDER")
print("======================")
print("OCR root:", OCR_ROOT)
print()


if not OCR_ROOT.exists():

    raise SystemExit(
        f"OCR directory does not exist: {OCR_ROOT}"
    )


files = []

for extension in (
    "*.json",
    "*.jsonl",
    "*.txt",
):

    files.extend(
        OCR_ROOT.rglob(extension)
    )


print("OCR files found:", len(files))


records = []

seen_documents = set()


for path in files:

    for record in load_file(path):

        text = record["text"]

        key = hashlib.sha1(
            text.lower().encode(
                "utf-8",
                errors="ignore",
            )
        ).hexdigest()

        if key in seen_documents:
            continue

        seen_documents.add(key)

        record["class_level"] = detect_class(
            path,
            record["meta"],
        )

        record["page"] = detect_page(
            record["meta"],
            path,
        )

        try:
            record["source"] = str(
                path.relative_to(PROJECT_ROOT)
            )
        except Exception:
            record["source"] = str(path)

        records.append(record)


print(
    "Useful OCR text records:",
    len(records),
)


chunks = []

seen_chunks = set()


for record in records:

    for text_chunk in chunk_text(
        record["text"]
    ):

        fingerprint = hashlib.sha1(
            text_chunk.lower().encode(
                "utf-8",
                errors="ignore",
            )
        ).hexdigest()

        if fingerprint in seen_chunks:
            continue

        seen_chunks.add(fingerprint)

        chunks.append(
            {
                "chunk_id": len(chunks),
                "class_level": record[
                    "class_level"
                ],
                "page": record["page"],
                "source": record["source"],
                "text": text_chunk,
            }
        )


if not chunks:

    raise SystemExit(
        "ERROR: No useful OCR chunks were found."
    )


print("Chunks created:", len(chunks))


print()
print("Examples:")
print()


for item in chunks[:5]:

    print(
        "CLASS:",
        item["class_level"],
        "PAGE:",
        item["page"],
    )

    print(
        item["text"][:300]
    )

    print("-" * 70)


print()
print(
    "Loading embedding model..."
)


embedder = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2",
    device="cpu",
)


texts = [
    item["text"]
    for item in chunks
]


print(
    "Generating embeddings..."
)


vectors = embedder.encode(
    texts,
    batch_size=32,
    show_progress_bar=True,
    convert_to_numpy=True,
    normalize_embeddings=True,
)


vectors = np.asarray(
    vectors,
    dtype=np.float32,
)


dimension = vectors.shape[1]


index = faiss.IndexFlatIP(
    dimension
)


index.add(
    vectors
)


faiss.write_index(
    index,
    str(INDEX_PATH),
)


with open(
    CHUNKS_PATH,
    "w",
    encoding="utf-8",
) as f:

    for item in chunks:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False,
            )
            + "\n"
        )


print()
print("============================")
print("RAG INDEX BUILD COMPLETE")
print("============================")
print("Vectors:", index.ntotal)
print("Dimension:", dimension)
print("Index:", INDEX_PATH)
print("Metadata:", CHUNKS_PATH)