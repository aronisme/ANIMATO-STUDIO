
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { CreatorConcept, ContentIdea, ScriptData, Language, VoiceName, AIModel } from "../types";

export const geminiService = {
  async generateIdeas(apiKey: string, concept: CreatorConcept, model: string): Promise<ContentIdea[]> {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Generate 6 content ideas for a video based on:
    Type: ${concept.type}, Style: ${concept.style}, Platform: ${concept.platform}.
    Topic: ${concept.customTopic || 'Trending'}.
    Return JSON array: [{title, hook, duration, viralScore, monetizationSafe}]`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hook: { type: Type.STRING },
              duration: { type: Type.STRING },
              viralScore: { type: Type.STRING },
              monetizationSafe: { type: Type.BOOLEAN },
            },
            required: ['title', 'hook', 'duration', 'viralScore', 'monetizationSafe']
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  },

  async generateScript(apiKey: string, concept: CreatorConcept, idea: ContentIdea, model: string): Promise<ScriptData> {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Write a video script for "${idea.title}". 
    Tone: ${concept.tone}, Platform: ${concept.platform}. Language: ${concept.language}.
    Return JSON: { "fullText": "...", "estimatedDurationSeconds": number, "segments": [{ "startTime", "endTime", "narrativeLine", "prompt" }] }`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullText: { type: Type.STRING },
            estimatedDurationSeconds: { type: Type.NUMBER },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  narrativeLine: { type: Type.STRING },
                  prompt: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    const data = JSON.parse(response.text || "{}");
    return {
      text: data.fullText,
      estimatedDuration: data.estimatedDurationSeconds,
      segments: data.segments
    };
  },

  async generateVoicePreview(apiKey: string, voice: VoiceName, language: Language): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });
    const sampleText = language === Language.INDONESIAN 
      ? "Halo, ini contoh suara saya." 
      : "Hello, this is my voice sample.";
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: sampleText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  },

  async generateVoiceOver(apiKey: string, text: string, voice: VoiceName): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  },

  async syncVisualPromptsWithAudio(apiKey: string, audioBase64: string, scriptText: string, concept: CreatorConcept): Promise<ScriptData> {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Sync the script "${scriptText}" into precise segments based on the audio narration.
    For each segment, generate a visual prompt. 
    MANDATORY: Every prompt must start with: "Style: ${concept.style}, high quality, cinematic."
    Return JSON: { "fullText": "${scriptText}", "estimatedDurationSeconds": number, "segments": [{ "startTime", "endTime", "narrativeLine", "prompt" }] }`;

    const response = await ai.models.generateContent({
      model: AIModel.FLASH_3,
      contents: {
        parts: [
          { inlineData: { data: audioBase64, mimeType: 'audio/pcm;rate=24000' } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fullText: { type: Type.STRING },
            estimatedDurationSeconds: { type: Type.NUMBER },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  narrativeLine: { type: Type.STRING },
                  prompt: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });
    const data = JSON.parse(response.text || "{}");
    return {
      text: data.fullText,
      estimatedDuration: data.estimatedDurationSeconds,
      segments: data.segments
    };
  },

  async generateFootagePreview(apiKey: string, prompt: string, style: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });
    const finalPrompt = `[Style: ${style}] ${prompt}. Highly detailed, clean aesthetic.`;
    const response = await ai.models.generateContent({
      model: AIModel.IMAGE_PRO_3,
      contents: { parts: [{ text: finalPrompt }] },
      config: {
        imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
      }
    });
    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart?.inlineData) return `data:image/png;base64,${imagePart.inlineData.data}`;
    throw new Error("Gagal generate visual. Pastikan API Key/Project Anda aktif.");
  }
};
