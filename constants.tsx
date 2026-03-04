
import { ModelId } from './types';

export const MODEL_CONFIGS = {
  [ModelId.GEMINI_FLASH_2]: {
    name: 'Gemini 2.0 Flash',
    inputPrice: 0.10 / 1_000_000,
    outputPrice: 0.40 / 1_000_000,
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  [ModelId.GEMINI_2_5_FLASH]: {
    name: 'Gemini 2.5 Flash',
    inputPrice: 0.10 / 1_000_000,
    outputPrice: 0.40 / 1_000_000,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200'
  },
  [ModelId.GEMINI_2_5_PRO]: {
    name: 'Gemini 2.5 Pro',
    inputPrice: 1.25 / 1_000_000,
    outputPrice: 5.00 / 1_000_000,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200'
  },
  [ModelId.GEMINI_2_5_FLASH_LITE]: {
    name: 'Gemini 2.5 Flash Lite',
    inputPrice: 0.075 / 1_000_000,
    outputPrice: 0.30 / 1_000_000,
    color: 'bg-sky-100 text-sky-700 border-sky-200'
  },
  [ModelId.GEMINI_2_5_FLASH_LITE_PREVIEW]: {
    name: 'Gemini 2.5 Lite Preview',
    inputPrice: 0.075 / 1_000_000,
    outputPrice: 0.30 / 1_000_000,
    color: 'bg-sky-50 text-sky-600 border-sky-200'
  },
  [ModelId.GEMINI_3_FLASH_PREVIEW]: {
    name: 'Gemini 3 Flash Preview',
    inputPrice: 0.10 / 1_000_000,
    outputPrice: 0.40 / 1_000_000,
    color: 'bg-violet-100 text-violet-700 border-violet-200'
  },
  [ModelId.GEMINI_3_PRO_PREVIEW]: {
    name: 'Gemini 3 Pro Preview',
    inputPrice: 1.25 / 1_000_000,
    outputPrice: 5.00 / 1_000_000,
    color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200'
  },
  [ModelId.GPT_4O]: {
    name: 'GPT-4o',
    inputPrice: 5.00 / 1_000_000,
    outputPrice: 15.00 / 1_000_000,
    color: 'bg-green-100 text-green-700 border-green-200'
  },
  [ModelId.CLAUDE_3_5_SONNET]: {
    name: 'Claude 3.5 Sonnet',
    inputPrice: 3.00 / 1_000_000,
    outputPrice: 15.00 / 1_000_000,
    color: 'bg-orange-100 text-orange-700 border-orange-200'
  }
};

export const DEFAULT_RECEIPT_GROUND_TRUTH = JSON.stringify({
  merchant: "Store Name",
  total: 0.00,
  date: "2024-01-01",
  currency: "USD",
  items: [
    { name: "Item 1", price: 0.00, qty: 1 }
  ]
}, null, 2);

export const SYSTEM_PROMPT_PREFIX = `You are an expert OCR system. Extract information from the image into structured JSON. 

CRITICAL: For EVERY field you extract, you MUST return an object containing both the "value" and a "confidence" score (a float between 0.0 and 1.0). 

Example format:
{
  "merchant": { "value": "Starbucks", "confidence": 0.98 },
  "total": { "value": 15.50, "confidence": 0.95 },
  "items": [
    { 
      "name": { "value": "Latte", "confidence": 0.99 },
      "price": { "value": 4.50, "confidence": 0.92 }
    }
  ]
}

If a value is unreadable, set value to null and confidence to 0.0.`;
