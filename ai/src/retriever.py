import faiss
import pickle

from sentence_transformers import SentenceTransformer


INDEX_PATH = "data/vector_db/nctb.index"
META_PATH = "data/vector_db/metadata.pkl"


print("Loading database...")


index = faiss.read_index(
    INDEX_PATH
)


with open(
    META_PATH,
    "rb"
) as f:
    metadata = pickle.load(f)



model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2"
)



def search(query, top_k=3):

    query_embedding = model.encode(
        [query],
        normalize_embeddings=True
    )


    scores, ids = index.search(
        query_embedding,
        top_k
    )


    results = []


    for score, idx in zip(scores[0], ids[0]):

        results.append(
            {
                "score": float(score),
                "book": metadata[idx]["book"],
                "page": metadata[idx]["page"],
                "text": metadata[idx]["text"]
            }
        )


    return results



if __name__ == "__main__":

    question = "What does education help develop?"


    results = search(question)


    for r in results:

        print("\n---")
        print("Score:", r["score"])
        print("Book:", r["book"])
        print("Page:", r["page"])
        print(r["text"][:500])