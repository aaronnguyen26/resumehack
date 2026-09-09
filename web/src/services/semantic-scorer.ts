/**
 * SemanticAtsScorer — Embeddings-powered semantic similarity matcher for ATS scoring.
 *
 * Utilizes Google Gemini text-embedding-004 (or gemini-embedding-001) to compute
 * cosine similarity between resume bullets and job requirement phrases, catching
 * conceptual matches that static keyword dictionaries miss.
 */

export interface SemanticMatchResult {
  requirement: string;
  matchedBulletId?: string;
  matchedBulletText?: string;
  similarity: number;
  matchType: 'strong_semantic' | 'partial_semantic' | 'missing';
}

/**
 * Provisional Semantic Similarity Thresholds (text-embedding-004)
 * 
 * NOTE: These thresholds are provisional heuristics calibrated for short technical
 * phrases and bullet points. They are configurable per-request and subject to empirical
 * telemetry tuning as real application usage logs are collected.
 */
export const PROVISIONAL_SEMANTIC_MATCH_THRESHOLDS = {
  /**
   * Cosine similarity >= 0.75: Provisional strong semantic match.
   * Evaluated on technical concept equivalence (e.g., Kafka pipelines vs stream processing).
   */
  STRONG: 0.75,

  /**
   * Cosine similarity between 0.65 and 0.749: Provisional partial semantic match.
   * Represents adjacent or related competencies (e.g., frontend components vs full-stack).
   */
  PARTIAL: 0.65,
} as const;

export const SEMANTIC_MATCH_THRESHOLDS = PROVISIONAL_SEMANTIC_MATCH_THRESHOLDS;

/**
 * Computes cosine similarity between two normalized floating point vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return Number((dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))).toFixed(4));
}

export class SemanticScorerService {
  private customFetch?: typeof fetch;

  constructor(customFetch?: typeof fetch) {
    this.customFetch = customFetch;
  }

  /**
   * Batch embeds multiple text strings in a single HTTP request using text-embedding-004.
   */
  public async batchEmbedTexts(
    texts: string[],
    apiKey: string,
    model = 'text-embedding-004'
  ): Promise<number[][]> {
    if (texts.length === 0) return [];

    const fetchFn = this.customFetch || fetch;
    const cleanModel = model.replace(/^models\//, '').trim();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:batchEmbedContents`;

    const requests = texts.map((text) => ({
      model: `models/${cleanModel}`,
      content: {
        parts: [{ text: text.slice(0, 1000) }],
      },
    }));

    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`Gemini Embedding API error (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const embeddings = data?.embeddings;

    if (!Array.isArray(embeddings) || embeddings.length === 0) {
      throw new Error('Gemini Embedding API returned no vector embeddings');
    }

    return embeddings.map((e: any) => e.values || []);
  }

  /**
   * Matches job requirements against resume bullets using semantic embeddings.
   */
  public async matchRequirementsSemantically(
    requirements: string[],
    bullets: Array<{ id: string; text: string }>,
    apiKey: string,
    model = 'text-embedding-004'
  ): Promise<SemanticMatchResult[]> {
    if (requirements.length === 0 || bullets.length === 0 || !apiKey) {
      return requirements.map((r) => ({
        requirement: r,
        similarity: 0,
        matchType: 'missing',
      }));
    }

    // Combine into single batch: [ ...requirements, ...bullets ]
    const allTexts = [...requirements, ...bullets.map((b) => b.text)];
    const allVectors = await this.batchEmbedTexts(allTexts, apiKey, model);

    const reqVectors = allVectors.slice(0, requirements.length);
    const bulletVectors = allVectors.slice(requirements.length);

    const results: SemanticMatchResult[] = [];

    for (let rIdx = 0; rIdx < requirements.length; rIdx++) {
      const rText = requirements[rIdx];
      const rVec = reqVectors[rIdx];

      let bestSimilarity = 0;
      let bestBullet: { id: string; text: string } | undefined;

      for (let bIdx = 0; bIdx < bullets.length; bIdx++) {
        const bVec = bulletVectors[bIdx];
        const sim = cosineSimilarity(rVec, bVec);

        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          bestBullet = bullets[bIdx];
        }
      }

      let matchType: SemanticMatchResult['matchType'] = 'missing';
      if (bestSimilarity >= SEMANTIC_MATCH_THRESHOLDS.STRONG) {
        matchType = 'strong_semantic';
      } else if (bestSimilarity >= SEMANTIC_MATCH_THRESHOLDS.PARTIAL) {
        matchType = 'partial_semantic';
      }

      results.push({
        requirement: rText,
        matchedBulletId: bestBullet?.id,
        matchedBulletText: bestBullet?.text,
        similarity: bestSimilarity,
        matchType,
      });
    }

    return results;
  }
}
