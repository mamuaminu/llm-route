"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const router_1 = require("./router");
const storage_1 = require("./storage");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'llm-route-secret-2024';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sakamoto2024';
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ─── Auth middleware ───────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
    const key = req.headers['x-api-key'];
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (key) {
        if (storage_1.storage.validateApiKey(key)) {
            storage_1.storage.incrementApiKeyUsage(key);
            req.authType = 'api-key';
            return next();
        }
        return res.status(401).json({ error: 'Invalid API key' });
    }
    if (token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.authType = 'jwt';
            return next();
        }
        catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }
    return res.status(401).json({ error: 'Missing x-api-key or Bearer token' });
}
function adminAuth(req, res, next) {
    const password = req.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid admin password' });
    }
    return next();
}
// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/auth/login', (req, res) => {
    const { password } = req.body;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Invalid password' });
    }
    const token = jsonwebtoken_1.default.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token });
});
app.post('/auth/api-key', adminAuth, (req, res) => {
    const { label } = req.body;
    const key = 'lkr_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const entry = storage_1.storage.addApiKey(key, label || 'Untitled');
    res.json({ apiKey: key, ...entry });
});
// ─── Core Chat Route ──────────────────────────────────────────────────────────
app.post('/chat', async (req, res) => {
    try {
        const body = req.body;
        if (!body.prompt)
            return res.status(400).json({ error: 'prompt is required' });
        const result = await (0, router_1.routeAndChat)(body);
        res.json(result);
    }
    catch (err) {
        console.error('Chat error:', err.message);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
});
// ─── Direct provider routes (bypass router) ────────────────────────────────────
app.post('/chat/:provider', async (req, res) => {
    try {
        const { provider } = req.params;
        const { prompt, model, apiKey, maxTokens = 2048, temperature = 0.7 } = req.body;
        if (!prompt)
            return res.status(400).json({ error: 'prompt is required' });
        const models = storage_1.storage.getModels();
        const modelConfig = models.find(m => m.id === model || m.provider === provider);
        if (!modelConfig)
            return res.status(404).json({ error: `Model for ${provider} not found` });
        let response = '';
        const apiKeys = { [provider]: apiKey };
        if (provider === 'openai') {
            const { chatWithOpenAI } = await Promise.resolve().then(() => __importStar(require('./adapters/openai')));
            response = await chatWithOpenAI(modelConfig, prompt, { maxTokens, temperature, streaming: false, apiKey });
        }
        else if (provider === 'anthropic') {
            const { chatWithAnthropic } = await Promise.resolve().then(() => __importStar(require('./adapters/anthropic')));
            response = await chatWithAnthropic(modelConfig, prompt, { maxTokens, temperature, streaming: false, apiKey });
        }
        else if (provider === 'gemini') {
            const { chatWithGemini } = await Promise.resolve().then(() => __importStar(require('./adapters/gemini')));
            response = await chatWithGemini(modelConfig, prompt, { maxTokens, temperature, streaming: false, apiKey });
        }
        else {
            return res.status(400).json({ error: 'Unknown provider' });
        }
        res.json({ model: modelConfig.id, provider, response });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ─── Models Routes ────────────────────────────────────────────────────────────
app.get('/models', (req, res) => {
    res.json(storage_1.storage.getModels());
});
app.patch('/models/:id', adminAuth, (req, res) => {
    const updated = storage_1.storage.updateModel(req.params.id, req.body);
    if (!updated)
        return res.status(404).json({ error: 'Model not found' });
    res.json(updated);
});
app.get('/models/:id', (req, res) => {
    const model = storage_1.storage.getModel(req.params.id);
    if (!model)
        return res.status(404).json({ error: 'Model not found' });
    res.json(model);
});
// ─── Analytics Routes ─────────────────────────────────────────────────────────
app.get('/analytics', (req, res) => {
    const days = parseInt(req.query.days) || 7;
    res.json(storage_1.storage.getAggregates(days));
});
app.get('/analytics/recent', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const entries = storage_1.storage.getAnalytics(7);
    res.json(entries.slice(-limit).reverse());
});
// ─── Cache Route ───────────────────────────────────────────────────────────────
app.delete('/cache', adminAuth, (req, res) => {
    storage_1.storage.clearCache();
    res.json({ ok: true });
});
// ─── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        models: storage_1.storage.getModels().filter(m => m.enabled).length,
        timestamp: new Date().toISOString(),
    });
});
// ─── Dashboard (serve static HTML) ───────────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile('/tmp/llm-route/dashboard/index.html');
});
app.listen(PORT, () => {
    console.log(`🚀 LLM Route running on http://localhost:${PORT}`);
    console.log(`   Admin password: ${ADMIN_PASSWORD}`);
    console.log(`   Models loaded: ${storage_1.storage.getModels().length}`);
});
