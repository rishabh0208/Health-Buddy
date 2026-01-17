import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({
  apiKey: process.env.API_KEY,
});

export async function generateGeminiResponse({
  prompt,
  chatHistory,
  systemMessage,
}) {
  // Create Gemini chat session
  const chatSession = genAI.chats.create({
    model: "gemini-2.0-flash",
    config: {
      systemInstruction: systemMessage,
    },
    history: chatHistory,
  });

  // Stream response
  const stream = await chatSession.sendMessageStream({
    message: prompt,
  });

  return stream; // async iterable
}


export async function generatePromptBasedResponse({ prompt }) {
  const response = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  return response;
}

