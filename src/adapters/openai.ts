"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithOpenAI = chatWithOpenAI;
const openai_1 = require("openai");
async function chatWithOpenAI(model, prompt, opts) {
    const apiKey = opts.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey)
        throw new Error('OPENAI_API_KEY not set');
    const client = new openai_1.default({ apiKey });
    const res = await client.chat.completions.create({
        model: model.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
    });
    return res.choices[0]?.message?.content || '';
}
