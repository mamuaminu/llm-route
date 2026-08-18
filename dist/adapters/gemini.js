"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithGemini = chatWithGemini;
const generative_ai_1 = require("@google/generative-ai");
async function chatWithGemini(model, prompt, opts) {
    const apiKey = opts.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey)
        throw new Error('GEMINI_API_KEY not set');
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model: model.model });
    const result = await genModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
}
