
export enum ModelId {
  GEMINI_FLASH = 'gemini-3-flash-preview',
  GEMINI_PRO = 'gemini-3-pro-preview',
  GEMINI_FLASH_LITE = 'gemini-flash-lite-latest'
}

export interface Receipt {
  id: string;
  name: string;
  imageUrl: string;
  base64: string;
  mimeType: string;
  groundTruthJson: string;
}

export interface Prompt {
  id: string;
  name: string;
  version: number;
  content: string;
  createdAt: number;
}

export interface BenchmarkMetrics {
  latencyMs: number;
  accuracy: number; // 0 to 1
  tokensUsed: number;
  costUsd: number;
  tokensPerSecond: number;
}

export interface BenchmarkResult {
  id: string;
  promptId: string;
  modelId: ModelId;
  receiptId: string;
  outputJson: string;
  timestamp: number;
  metrics: BenchmarkMetrics;
}

export type ViewState = 'dashboard' | 'prompts' | 'receipts' | 'benchmark' | 'results';
