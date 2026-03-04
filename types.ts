export const ModelIdValues = {
  GEMINI_FLASH_2: 'google/gemini-2.0-flash-001',
  GEMINI_2_5_FLASH: 'google/gemini-2.5-flash',
  GEMINI_2_5_PRO: 'google/gemini-2.5-pro',
  GEMINI_2_5_FLASH_LITE: 'google/gemini-2.5-flash-lite',
  GEMINI_2_5_FLASH_LITE_PREVIEW: 'google/gemini-2.5-flash-lite-preview-09-2025',
  GEMINI_3_FLASH_PREVIEW: 'google/gemini-3-flash-preview',
  GEMINI_3_PRO_PREVIEW: 'google/gemini-3-pro-preview',
  GPT_4O: 'openai/gpt-4o',
  CLAUDE_3_5_SONNET: 'anthropic/claude-3.5-sonnet'
} as const;

export type ModelId = string;
export const ModelId = ModelIdValues;

export interface CustomModel {
  id: string;
  name: string;
  inputPrice: number;
  outputPrice: number;
  color: string;
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
  modelId: string;
  receiptId: string;
  outputJson: string;
  timestamp: number;
  metrics: BenchmarkMetrics;
}

export type ViewState = 'dashboard' | 'prompts' | 'receipts' | 'benchmark' | 'results' | 'leaderboard' | 'models';