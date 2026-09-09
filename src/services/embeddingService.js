/**
 * Embedding Service — Pure Node.js query embedding via @xenova/transformers
 *
 * Replaces the Python bridge (ragEmbeddingQuery.py) with an in-process
 * ONNX Runtime embedding pipeline.  Uses the same model the Python script
 * used: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384-d).
 *
 * The model is loaded lazily on the first call and cached for the lifetime
 * of the process, so cold-start is ~2-4 s but subsequent calls are <50 ms.
 */

let pipelinePromise = null;

/**
 * Returns a singleton feature-extraction pipeline.
 * The dynamic import ensures compatibility with both CJS and ESM environments.
 */
const getPipeline = () => {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      // @xenova/transformers is ESM-only starting v3; v2 ships CJS compat
      const { pipeline } = await import("@xenova/transformers");
      console.info("[embedding] Loading sentence-transformers model into ONNX Runtime…");
      const extractor = await pipeline(
        "feature-extraction",
        "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
        { quantized: true }
      );
      console.info("[embedding] Model loaded — subsequent embeddings will be instant.");
      return extractor;
    })();
  }
  return pipelinePromise;
};

/**
 * Generate a 384-dimensional embedding vector for the given query text.
 *
 * @param {string} queryText — the text to embed
 * @param {string} [action="embed"] — label for logging
 * @returns {Promise<number[]>} 384-dimensional float array
 */
const generateQueryEmbedding = async (queryText, action = "embed") => {
  if (!queryText || typeof queryText !== "string" || !queryText.trim()) {
    throw new Error("Embedding text is required.");
  }

  const start = Date.now();
  const extractor = await getPipeline();

  // Run the model — pooling: 'mean' and normalize: true match what
  // SentenceTransformer.encode() does under the hood.
  const output = await extractor(queryText.trim(), {
    pooling: "mean",
    normalize: true,
  });

  const embedding = Array.from(output.data);
  console.info(
    `[embedding][${action}] Generated query embedding — dim=${embedding.length} durationMs=${Date.now() - start}`
  );

  if (embedding.length !== 384) {
    console.warn(
      `[embedding][${action}] WARNING: expected 384 dimensions, got ${embedding.length}`
    );
  }

  return embedding;
};

module.exports = { generateQueryEmbedding };
