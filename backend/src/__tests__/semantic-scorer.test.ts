import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  SemanticScorerService,
  SEMANTIC_MATCH_THRESHOLDS,
} from '../services/semantic-scorer.js';

describe('Semantic Scorer & Cosine Calibration Unit Tests', () => {
  it('correctly calculates cosine similarity between vectors', () => {
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    expect(cosineSimilarity(v1, v2)).toBe(1);

    const vOrthogonal = [0, 1, 0];
    expect(cosineSimilarity(v1, vOrthogonal)).toBe(0);

    const vOpposite = [-1, 0, 0];
    expect(cosineSimilarity(v1, vOpposite)).toBe(-1);

    const v45Deg = [1, 1, 0];
    // cos(45 deg) = 1 / sqrt(2) ~= 0.7071
    expect(cosineSimilarity(v1, v45Deg)).toBeCloseTo(0.7071, 3);
  });

  it('correctly classifies strong, partial, and missing semantic matches via batch embeddings', async () => {
    // Synthetic mock vectors representing high, moderate, and low semantic closeness
    const mockEmbeddings = [
      // Requirement 1: "Distributed stream processing with real-time analytics" (Dim 1)
      [1.0, 0.0, 0.0, 0.0],
      // Requirement 2: "Deep learning model evaluation and inference" (Dim 2)
      [0.0, 1.0, 0.0, 0.0],
      // Requirement 3: "Low-level Linux kernel C drivers" (Dim 3)
      [0.0, 0.0, 1.0, 0.0],

      // Bullet 1: "Architected Kafka & Flink stream processing pipelines" (Exact strong match to Req 1: sim = 1.0)
      [1.0, 0.0, 0.0, 0.0],
      // Bullet 2: "Trained PyTorch computer vision models" (Partial match to Req 2: cos 45 deg = 0.7071)
      [0.0, 0.7071, 0.0, 0.7071],
      // Bullet 3: "Led sprint retrospectives" (Dim 4: Orthogonal to all technical requirements)
      [0.0, 0.0, 0.0, 1.0],
    ];

    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          embeddings: mockEmbeddings.map((values) => ({ values })),
        }),
        { status: 200 }
      );
    };

    const service = new SemanticScorerService(mockFetch as any);

    const requirements = [
      'Distributed stream processing with real-time analytics',
      'Deep learning model evaluation and inference',
      'Low-level Linux kernel C drivers',
    ];

    const bullets = [
      { id: 'b1', text: 'Architected Kafka & Flink stream processing pipelines' },
      { id: 'b2', text: 'Trained PyTorch computer vision models' },
      { id: 'b3', text: 'Led sprint retrospectives' },
    ];

    const results = await service.matchRequirementsSemantically(requirements, bullets, 'mock-key');

    expect(results).toHaveLength(3);

    // Req 1 matches Bullet 1 strongly
    expect(results[0].requirement).toBe('Distributed stream processing with real-time analytics');
    expect(results[0].matchedBulletId).toBe('b1');
    expect(results[0].similarity).toBeGreaterThanOrEqual(SEMANTIC_MATCH_THRESHOLDS.STRONG);
    expect(results[0].matchType).toBe('strong_semantic');

    // Req 2 matches Bullet 2 partially
    expect(results[1].requirement).toBe('Deep learning model evaluation and inference');
    expect(results[1].matchedBulletId).toBe('b2');
    expect(results[1].similarity).toBeGreaterThanOrEqual(SEMANTIC_MATCH_THRESHOLDS.PARTIAL);
    expect(results[1].matchType).toBe('partial_semantic');

    // Req 3 has no close match in bullets
    expect(results[2].requirement).toBe('Low-level Linux kernel C drivers');
    expect(results[2].similarity).toBeLessThan(SEMANTIC_MATCH_THRESHOLDS.PARTIAL);
    expect(results[2].matchType).toBe('missing');
  });

  it('handles empty inputs and missing API keys gracefully without crashing', async () => {
    const service = new SemanticScorerService();
    const res = await service.matchRequirementsSemantically(['Requirement 1'], [], '');
    expect(res).toHaveLength(1);
    expect(res[0].matchType).toBe('missing');
    expect(res[0].similarity).toBe(0);
  });
});
