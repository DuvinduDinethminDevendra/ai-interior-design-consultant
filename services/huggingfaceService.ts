// Temporary redirector service for Hugging Face integration.
// Right now it forwards calls to the existing Gemini service so you can
// switch imports without breaking the app. Later, replace the internals
// with real Hugging Face API calls (server-side) and keep this public contract.

import * as gemini from './geminiService';

export async function generateRedesignedImage(
  imageBase64: string,
  prompt: string,
  isRefinement: boolean = false
): Promise<string> {
  // TODO: implement real Hugging Face image generation server-side.
  // For now delegate to the gemini service so the app keeps working.
  return gemini.generateRedesignedImage(imageBase64, prompt, isRefinement);
}

export function initializeChat(style: string) {
  // TODO: implement real Hugging Face chat flow if desired.
  return gemini.initializeChat(style);
}

export default {
  generateRedesignedImage,
  initializeChat,
};
