
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `You are a precise YouTube thumbnail editor. 
Your primary goal is to execute the user's request EXACTLY as stated. 
- If the user says "remove the background", ONLY remove the background and return the subject on a clean background (usually black or a simple studio setting if not specified).
- Do NOT add vibrant colors, bold text, or extra special effects unless specifically asked for.
- Maintain a 16:9 aspect ratio at all times.
- Be a literal tool: perform the requested transformation and nothing else.
- Your output must always be a high-quality 16:9 image.`;

export async function processThumbnailRequest(prompt: string, baseImageBase64?: string): Promise<string> {
  // Initialize GoogleGenAI with the API key directly from process.env.API_KEY as per instructions.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const parts: any[] = [
    { text: `${SYSTEM_INSTRUCTION}\n\nUser request: ${prompt}` }
  ];

  if (baseImageBase64) {
    // Strip metadata prefix if present
    const base64Data = baseImageBase64.split(',')[1] || baseImageBase64;
    parts.unshift({
      inlineData: {
        data: base64Data,
        mimeType: 'image/png'
      }
    });
  }

  try {
    // Generate image content using gemini-2.5-flash-image which supports 16:9 aspect ratio.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        }
      }
    });

    if (!response.candidates?.[0]?.content?.parts) {
      throw new Error("No image generated in the response.");
    }

    // Iterate through response parts to find the generated image as suggested in documentation.
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("Image part not found in model response.");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
