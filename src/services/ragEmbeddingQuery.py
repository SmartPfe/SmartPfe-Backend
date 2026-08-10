import json
import sys

from sentence_transformers import SentenceTransformer


def main():
    payload = json.load(sys.stdin)
    text = str(payload.get("text") or "").strip()
    model_name = str(
        payload.get("model")
        or "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )

    if not text:
        raise ValueError("Embedding text is required.")

    model = SentenceTransformer(model_name)
    embedding = model.encode([text], convert_to_numpy=True)[0].tolist()
    print(json.dumps({"dimension": len(embedding), "embedding": embedding}))


if __name__ == "__main__":
    main()
