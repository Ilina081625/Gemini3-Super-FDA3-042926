import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined in the environment.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export interface GeminiMessage {
  role: "user" | "model";
  parts: { text?: string; inlineData?: { mimeType: string; data: string } }[];
}

export type GeminiModel = 
  | "gemini-3-flash-preview" 
  | "gemini-3.1-pro-preview" 
  | "gemini-1.5-flash" // Some versions might still use this in the SDK
  | "gemini-1.5-pro";

export async function* streamGemini(
  prompt: string,
  model: string = "gemini-3-flash-preview",
  systemInstruction?: string,
  files?: { mimeType: string; data: string }[]
) {
  try {
    const parts: any[] = [{ text: prompt }];
    
    if (files) {
      files.forEach(f => {
        parts.push({
          inlineData: {
            mimeType: f.mimeType,
            data: f.data
          }
        });
      });
    }

    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) yield text;
    }
  } catch (error) {
    console.error("Gemini Stream Error:", error);
    throw error;
  }
}

export async function generateGemini(
  prompt: string,
  model: string = "gemini-3-flash-preview",
  systemInstruction?: string
) {
  const result = await ai.models.generateContent({
    model: model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { systemInstruction },
  });
  return result.text;
}
