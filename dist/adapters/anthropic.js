"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithAnthropic = chatWithAnthropic;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
async function chatWithAnthropic(model, prompt, opts) {
    const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error('ANTHROPIC_API_KEY not set');
    const client = new sdk_1.default({ apiKey });
    const res = await client.messages.create({
        model: model.model,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        messages: [{ role: 'user', content: prompt }],
    });
    return res.content[0].type === 'text' ? res.content[0].text : '';
}
