import json
from pathlib import Path


INPUT_FILE = Path("data/processed/raw_pages.jsonl")
OUTPUT_FILE = Path("data/processed/chunks.jsonl")


CHUNK_SIZE = 800
OVERLAP = 150


def chunk_text(text):

    chunks = []

    start = 0

    while start < len(text):

        end = start + CHUNK_SIZE

        chunk = text[start:end]

        chunks.append(chunk)

        start = end - OVERLAP

    return chunks



OUTPUT_FILE.parent.mkdir(
    parents=True,
    exist_ok=True
)


all_chunks = []


with open(INPUT_FILE, encoding="utf-8") as f:

    for line in f:

        page = json.loads(line)

        chunks = chunk_text(page["text"])


        for i, chunk in enumerate(chunks):

            all_chunks.append(
                {
                    "book": page["book"],
                    "page": page["page"],
                    "chunk_id": i,
                    "text": chunk
                }
            )



with open(
    OUTPUT_FILE,
    "w",
    encoding="utf-8"
) as f:

    for item in all_chunks:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False
            )
            + "\n"
        )


print("Pages processed:", len(all_chunks))
print("Saved:", OUTPUT_FILE)