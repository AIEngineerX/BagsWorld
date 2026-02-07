// EmbeddingService - Vector embedding generation for semantic memory search
// Uses OpenAI text-embedding-3-small (1536 dimensions) to match pgvector schema.
// Degrades gracefully when no OPENAI_API_KEY is set (memory storage still works,
// just without vector similarity search).

import { Service, type IAgentRuntime } from '../types/elizaos.js';

/** Embedding dimension matching the vector(1536) column in agent_memories */
export const EMBEDDING_DIMENSION = 1536;

const DEFAULT_MODEL = 'text-embedding-3-small';

export class EmbeddingService extends Service {
  static readonly serviceType = 'bags_embedding';

  readonly capabilityDescription = 'Vector embedding generation for semantic search';

  private apiKey: string | undefined;
  private model: string;
  private configured: boolean;

  constructor(runtime?: IAgentRuntime) {
    super(runtime);

    this.apiKey = runtime?.getSetting('OPENAI_API_KEY') as string || process.env.OPENAI_API_KEY;
    this.model = (runtime?.getSetting('EMBEDDING_MODEL') as string) || process.env.EMBEDDING_MODEL || DEFAULT_MODEL;
    this.configured = !!this.apiKey;
  }

  static async start(runtime: IAgentRuntime): Promise<EmbeddingService> {
    const service = new EmbeddingService(runtime);
    if (service.configured) {
      console.log(`[EmbeddingService] Ready (model: ${service.model})`);
    } else {
      console.warn('[EmbeddingService] No OPENAI_API_KEY - vector search disabled, memory storage still works');
    }
    return service;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /**
   * Generate a single embedding vector for the given text.
   * Returns null if the service is not configured.
   */
  async embed(text: string): Promise<number[] | null> {
    if (!this.configured) return null;

    const trimmed = text.trim();
    if (trimmed.length === 0) return null;

    const result = await this.callOpenAI([trimmed]);
    return result[0] ?? null;
  }

  /**
   * Generate embeddings for multiple texts in a single API call.
   * Returns an array of vectors (or nulls for failed items).
   * More efficient than calling embed() in a loop.
   */
  async embedBatch(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.configured) return texts.map(() => null);

    const trimmed = texts.map(t => t.trim());
    const nonEmpty = trimmed.filter(t => t.length > 0);

    if (nonEmpty.length === 0) return texts.map(() => null);

    // OpenAI embedding API supports batches up to 2048 inputs
    // We process in chunks of 100 to stay well within limits
    const BATCH_SIZE = 100;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < nonEmpty.length; i += BATCH_SIZE) {
      const chunk = nonEmpty.slice(i, i + BATCH_SIZE);
      const results = await this.callOpenAI(chunk);
      allEmbeddings.push(...results);
    }

    // Map back to original indices (empty strings get null)
    const results: (number[] | null)[] = [];
    let embIdx = 0;
    for (const t of trimmed) {
      if (t.length > 0) {
        results.push(allEmbeddings[embIdx] ?? null);
        embIdx++;
      } else {
        results.push(null);
      }
    }
    return results;
  }

  private async callOpenAI(inputs: string[]): Promise<number[][]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: inputs,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI Embedding API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[]; index: number }>;
        usage: { prompt_tokens: number; total_tokens: number };
      };

      // Sort by index to maintain input order
      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map(d => d.embedding);
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Singleton
let instance: EmbeddingService | null = null;

export function getEmbeddingService(runtime?: IAgentRuntime): EmbeddingService {
  if (runtime) {
    const service = runtime.getService<EmbeddingService>(EmbeddingService.serviceType);
    if (service) return service;
  }

  if (!instance) {
    instance = new EmbeddingService();
  }
  return instance;
}

export function resetEmbeddingService(): void {
  instance = null;
}

export default EmbeddingService;
