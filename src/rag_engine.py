from pathlib import Path
import json
import os
import sys
import urllib.request

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer


PROJECT_ROOT = Path(__file__).resolve().parents[2]

VECTOR_DIR = (
    PROJECT_ROOT
    / "ai"
    / "data"
    / "vector_db"
)

INDEX_PATH = (
    VECTOR_DIR
    / "nctb_ocr.index"
)

CHUNKS_PATH = (
    VECTOR_DIR
    / "nctb_ocr_chunks.jsonl"
)


OLLAMA_URL = os.getenv(
    "OLLAMA_CHAT_URL",
    "http://localhost:11434/api/chat",
)

OLLAMA_MODEL = os.getenv(
    "LOCAL_AI_MODEL",
    "qwen3:latest",
)


if not INDEX_PATH.exists():
    raise RuntimeError(
        "RAG index missing. Run build_rag_index_v2.py first."
    )


if not CHUNKS_PATH.exists():
    raise RuntimeError(
        "RAG metadata missing."
    )


print("Loading FAISS index...")

index = faiss.read_index(
    str(INDEX_PATH)
)


chunks = []

with open(
    CHUNKS_PATH,
    "r",
    encoding="utf-8",
) as f:

    for line in f:

        line = line.strip()

        if line:
            chunks.append(
                json.loads(line)
            )


print(
    f"Loaded {len(chunks)} textbook chunks."
)


print(
    "Loading embedding model..."
)

embedder = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2",
    device="cpu",
)


def retrieve(question, k=5):

    vector = embedder.encode(
        [question],
        convert_to_numpy=True,
        normalize_embeddings=True,
    )

    vector = np.asarray(
        vector,
        dtype=np.float32,
    )


    scores, ids = index.search(
        vector,
        min(k, len(chunks)),
    )


    results = []


    for score, idx in zip(
        scores[0],
        ids[0],
    ):

        if idx < 0:
            continue

        item = dict(
            chunks[int(idx)]
        )

        item["score"] = float(
            score
        )

        results.append(item)


    return results


def build_context(results):

    sections = []


    for number, item in enumerate(
        results,
        start=1,
    ):

        source = (
            f"class={item.get('class_level')}, "
            f"page={item.get('page')}, "
            f"file={item.get('source')}"
        )


        sections.append(
            f"[S{number}] {source}\n"
            f"{item['text']}"
        )


    return "\n\n".join(
        sections
    )


def answer_question(
    question,
    k=5,
):

    retrieved = retrieve(
        question,
        k=k,
    )


    context = build_context(
        retrieved
    )


    system_prompt = """
You are the NCTB Study Companion.

You answer questions using ONLY the supplied NCTB textbook sources.

Rules:
1. Do not use outside knowledge when the sources provide the answer.
2. Do not invent textbook facts.
3. If the answer cannot be found in the supplied sources, say:
   "I could not find this answer in the retrieved NCTB textbook passages."
4. Keep the answer suitable for a school student.
5. Cite the supporting source using [S1], [S2], etc.
6. Prefer a concise answer.
""".strip()


    user_prompt = f"""
NCTB TEXTBOOK SOURCES

{context}

QUESTION

{question}

Answer from the textbook sources and cite the source.
""".strip()


    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        "stream": False,
        "think": False,
        "options": {
            "temperature": 0.1
        },
    }


    body = json.dumps(
        payload
    ).encode("utf-8")


    request = urllib.request.Request(
        OLLAMA_URL,
        data=body,
        headers={
            "Content-Type":
            "application/json"
        },
        method="POST",
    )


    try:

        with urllib.request.urlopen(
            request,
            timeout=180,
        ) as response:

            result = json.loads(
                response
                .read()
                .decode("utf-8")
            )


    except Exception as e:

        raise RuntimeError(
            "Could not contact Ollama. "
            "Make sure Ollama is running. "
            f"Original error: {e}"
        )


    answer = (
        result
        .get("message", {})
        .get("content", "")
        .strip()
    )


    return {
        "question": question,
        "answer": answer,
        "sources": retrieved,
    }


def print_retrieval(question):

    results = retrieve(
        question,
        k=5,
    )


    print()
    print(
        "QUESTION:",
        question,
    )

    print()
    print(
        "TOP RETRIEVED PASSAGES"
    )

    print(
        "=" * 70
    )


    for number, item in enumerate(
        results,
        start=1,
    ):

        print()
        print(
            f"[S{number}] "
            f"score={item['score']:.4f}"
        )

        print(
            "class:",
            item.get("class_level"),
            "page:",
            item.get("page"),
        )

        print(
            "source:",
            item.get("source"),
        )

        print()

        print(
            item["text"][:700]
        )

        print(
            "-" * 70
        )


if __name__ == "__main__":

    question = " ".join(
        sys.argv[1:]
    ).strip()


    if not question:

        question = (
            "What does education "
            "help develop?"
        )


    print_retrieval(
        question
    )

    print()
    print(
        "GENERATING GROUNDED ANSWER..."
    )

    result = answer_question(
        question
    )

    print()
    print(
        "ANSWER:"
    )

    print(
        result["answer"]
    )