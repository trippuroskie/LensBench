
import { ModelId } from './types';

export const MODEL_CONFIGS = {
  [ModelId.GEMINI_FLASH]: {
    name: 'Gemini 3 Flash',
    inputPrice: 0.10 / 1_000_000,
    outputPrice: 0.40 / 1_000_000,
    color: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  [ModelId.GEMINI_PRO]: {
    name: 'Gemini 3 Pro',
    inputPrice: 1.25 / 1_000_000,
    outputPrice: 5.00 / 1_000_000,
    color: 'bg-purple-100 text-purple-700 border-purple-200'
  },
  [ModelId.GEMINI_FLASH_LITE]: {
    name: 'Gemini Flash Lite',
    inputPrice: 0.05 / 1_000_000,
    outputPrice: 0.20 / 1_000_000,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200'
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
