import json
from pathlib import Path
import faiss
import pickle

from sentence_transformers import SentenceTransformer


INPUT_FILE = Path("data/processed/chunks.jsonl")

VECTOR_DB = Path("data/vector_db")


VECTOR_DB.mkdir(
    parents=True,
    exist_ok=True
)


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


print("Loading embedding model...")

model = SentenceTransformer(MODEL_NAME)


texts = []
metadata = []


with open(INPUT_FILE, encoding="utf-8") as f:

    for line in f:

        item = json.loads(line)

        texts.append(item["text"])

        metadata.append(item)



print("Chunks:", len(texts))


print("Creating embeddings...")


embeddings = model.encode(
    texts,
    show_progress_bar=True,
    normalize_embeddings=True
)


dimension = embeddings.shape[1]


index = faiss.IndexFlatIP(dimension)


index.add(
    embeddings
)


faiss.write_index(
    index,
    str(VECTOR_DB / "nctb.index")
)


with open(
    VECTOR_DB / "metadata.pkl",
    "wb"
) as f:

    pickle.dump(
        metadata,
        f
    )


print("Saved FAISS database")
print("Vectors:", index.ntotal)