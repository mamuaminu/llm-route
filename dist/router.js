"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeAndChat = routeAndChat;
const storage_1 = require("./storage");
const openai_1 = require("./adapters/openai");
const anthropic_1 = require("./adapters/anthropic");
const gemini_1 = require("./adapters/gemini");
async function routeAndChat(req) {
    const models = storage_1.storage.getModels().filter(m => m.enabled);
    if (models.length === 0)
        throw new Error('No models enabled');
    const { prompt, goal = 'answer', maxTokens = 2048, temperature = 0.7, streaming = false, preferredProvider } = req;
    // Check cache first
    const cached = storage_1.storage.getCache(prompt);
    if (cached) {
        const model = models[0]; // approximate
        return {
            model: 'cached',
            provider: 'cache',
            response: cached.response,
            usage: { inputTokens: 0, outputTokens: 0, costUSD: 0, latencyMs: 0 },
            routing: { mode: 'auto', candidates: [], chosenReason: 'Cache hit' },
        };
    }
    // Score and rank models
    const scored = models.map(m => ({
        model: m,
        score: scoreModel(m, goal, preferredProvider),
        reason: scoreReason(m, goal, preferredProvider),
    })).sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, 3).map(s => s.model.id);
    const chosen = scored[0];
    const model = chosen.model;
    const start = Date.now();
    let response;
    let inputTokens = 0;
    let outputTokens = 0;
    try {
        const apiKeys = req.apiKeys || {};
        switch (model.provider) {
            case 'openai':
                response = await (0, openai_1.chatWithOpenAI)(model, prompt, { maxTokens, temperature, streaming, apiKey: apiKeys.openai });
                break;
            case 'anthropic':
                response = await (0, anthropic_1.chatWithAnthropic)(model, prompt, { maxTokens, temperature, streaming, apiKey: apiKeys.anthropic });
                break;
            case 'gemini':
                response = await (0, gemini_1.chatWithGemini)(model, prompt, { maxTokens, temperature, streaming, apiKey: apiKeys.gemini });
                break;
            default:
                throw new Error(`Provider ${model.provider} not supported`);
        }
    }
    catch (err) {
        // Fallback to next model
        if (scored.length > 1) {
            const fallback = scored[1];
            try {
                const apiKeys = req.apiKeys || {};
                switch (fallback.model.provider) {
                    case 'openai':
                        response = await (0, openai_1.chatWithOpenAI)(fallback.model, prompt, { maxTokens, temperature, streaming, apiKey: apiKeys.openai });
                        break;
                    case 'anthropic':
                        response = await (0, anthropic_1.chatWithAnthropic)(fallback.model, prompt, { maxTokens, temperature, streaming, apiKey: apiKeys.anthropic });
                        break;
                    case 'gemini':
                        response = await (0, gemini_1.chatWithGemini)(fallback.model, prompt, { maxTokens, temperature, streaming, apiKey: apiKeys.gemini });
                        break;
                    default:
                        throw new Error('No fallback available');
                }
            }
            catch {
                throw err;
            }
        }
        else {
            throw err;
        }
    }
    const latencyMs = Date.now() - start;
    // Estimate tokens (rough: ~4 chars per token)
    inputTokens = Math.ceil(prompt.length / 4);
    outputTokens = Math.ceil(response.length / 4);
    const costUSD = (inputTokens / 1000) * model.costPer1KInput + (outputTokens / 1000) * model.costPer1KOutput;
    // Log analytics
    const entry = {
        timestamp: new Date().toISOString(),
        provider: model.provider,
        model: model.id,
        mode: goal,
        inputTokens,
        outputTokens,
        costUSD: Math.round(costUSD * 10000) / 10000,
        latencyMs,
        promptLength: prompt.length,
        responseLength: response.length,
    };
    storage_1.storage.addAnalytics(entry);
    // Cache result
    storage_1.storage.setCache(prompt, response, costUSD);
    return {
        model: model.id,
        provider: model.provider,
        response,
        usage: { inputTokens, outputTokens, costUSD: Math.round(costUSD * 10000) / 10000, latencyMs },
        routing: { mode: goal, candidates, chosenReason: chosen.reason },
    };
}
function scoreModel(model, goal, preferredProvider) {
    let score = 50;
    // Provider preference
    if (preferredProvider && model.provider === preferredProvider) {
        score += 30;
    }
    // Goal-based scoring
    if (model.strengths.includes(goal))
        score += 40;
    if (goal === 'fast' || goal === 'answer') {
        // Prefer cheap + fast
        score += (1 / model.costPer1KInput) * 5;
        score -= model.avgLatencyMs / 500;
    }
    if (goal === 'code') {
        if (model.strengths.includes('code'))
            score += 50;
    }
    if (goal === 'reasoning') {
        if (model.strengths.includes('reasoning'))
            score += 50;
        if (model.strengths.includes('smart'))
            score += 30;
    }
    if (goal === 'cheap') {
        score += (0.01 / model.costPer1KInput) * 100;
    }
    if (goal === 'creative') {
        if (model.strengths.includes('creative'))
            score += 40;
    }
    // Penalize high cost
    score -= model.costPer1KInput * 100;
    return score;
}
function scoreReason(model, goal, preferredProvider) {
    const reasons = [];
    if (model.strengths.includes(goal))
        reasons.push(`strong at ${goal}`);
    if (preferredProvider && model.provider === preferredProvider)
        reasons.push(`preferred provider`);
    if (goal === 'cheap' || model.costPer1KInput < 0.001)
        reasons.push(`cheapest option`);
    if (goal === 'fast' || goal === 'answer')
        reasons.push(`low latency`);
    if (goal === 'code' && model.strengths.includes('code'))
        reasons.push('best for code');
    return reasons.join(', ') || 'best overall match';
}
