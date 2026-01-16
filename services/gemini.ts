
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ModelId } from "../types";

export class GeminiOCRService {
  // Methods initialize their own GoogleGenAI instance using process.env.API_KEY
  // to ensure they always use the current environment configuration.

  async runOCR(
    modelId: ModelId,
    prompt: string,
    imageBase64: string,
    mimeType: string
  ): Promise<{ text: string; rawResponse: GenerateContentResponse; duration: number }> {
    const startTime = Date.now();
    // Initialize Gemini client within the method for a fresh instance
    const aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const response = await aiClient.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const duration = Date.now() - startTime;
    return {
      text: response.text || "{}",
      rawResponse: response,
      duration
    };
  }

  async refinePrompt(currentPrompt: string, groundTruth: string, actualOutput: string): Promise<string> {
    // Initialize Gemini client within the method
    const aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const refinementSystemPrompt = `You are a World-Class Prompt Engineer specializing in Vision LLM OCR pipelines. 
Your goal is to improve the accuracy of a prompt by analyzing a failure case.

You will be given:
1. The Current Prompt.
2. The Expected JSON (Ground Truth).
3. The Actual JSON (What the model produced).

Tasks:
- Identify why the actual output differed from the ground truth.
- Provide a brief diagnosis.
- Propose a refined prompt that is more explicit, handles edge cases better, or clarifies the JSON structure.

Return your response in Markdown with two sections:
### 🛠 Diagnosis
[Bullet points on what went wrong]

### 📝 Proposed Refinement
[The full text of the improved prompt]`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
CURRENT PROMPT:
${currentPrompt}

EXPECTED OUTPUT (GROUND TRUTH):
${groundTruth}

ACTUAL OUTPUT:
${actualOutput}
      `,
      config: {
        systemInstruction: refinementSystemPrompt,
        temperature: 0.7
      }
    });

    return response.text || "Could not generate refinement suggestions.";
  }
}
