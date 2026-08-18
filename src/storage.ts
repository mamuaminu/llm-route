"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = void 0;
const types_1 = require("./types");
class Storage {
    constructor() {
        this.models = new Map();
        this.analytics = [];
        this.apiKeys = new Map();
        this.cache = new Map();
        types_1.DEFAULT_MODELS.forEach(m => this.models.set(m.id, m));
    }
    // Models
    getModels() {
        return Array.from(this.models.values());
    }
    getModel(id) {
        return this.models.get(id);
    }
    updateModel(id, updates) {
        const model = this.models.get(id);
        if (!model)
            return undefined;
        const updated = { ...model, ...updates };
        this.models.set(id, updated);
        return updated;
    }
    // Analytics
    addAnalytics(entry) {
        this.analytics.push(entry);
        // Keep last 10000 entries
        if (this.analytics.length > 10000) {
            this.analytics = this.analytics.slice(-10000);
        }
    }
    getAnalytics(days = 7, apiKey) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return this.analytics.filter(e => {
            if (new Date(e.timestamp).getTime() < cutoff)
                return false;
            return true;
        });
    }
    getAggregates(days = 7) {
        const entries = this.getAnalytics(days);
        const byProvider = {};
        const byModel = {};
        let totalCost = 0;
        let totalRequests = entries.length;
        const dailyMap = {};
        entries.forEach(e => {
            totalCost += e.costUSD;
            if (!byProvider[e.provider])
                byProvider[e.provider] = { requests: 0, cost: 0 };
            byProvider[e.provider].requests++;
            byProvider[e.provider].cost += e.costUSD;
            if (!byModel[e.model])
                byModel[e.model] = { requests: 0, cost: 0 };
            byModel[e.model].requests++;
            byModel[e.model].cost += e.costUSD;
            const date = e.timestamp.split('T')[0];
            dailyMap[date] = (dailyMap[date] || 0) + e.costUSD;
        });
        const dailyCosts = Object.entries(dailyMap)
            .map(([date, cost]) => ({ date, cost: Math.round(cost * 10000) / 10000 }))
            .sort((a, b) => a.date.localeCompare(b.date));
        return { totalCost: Math.round(totalCost * 10000) / 10000, totalRequests, byProvider, byModel, dailyCosts };
    }
    // API Keys
    validateApiKey(key) {
        return this.apiKeys.has(key);
    }
    addApiKey(key, label) {
        const entry = { key, label, createdAt: new Date().toISOString(), requestsToday: 0 };
        this.apiKeys.set(key, entry);
        return entry;
    }
    getApiKey(key) {
        return this.apiKeys.get(key);
    }
    incrementApiKeyUsage(key) {
        const entry = this.apiKeys.get(key);
        if (entry)
            entry.requestsToday++;
    }
    // Cache
    getCache(prompt) {
        const hash = this.hashPrompt(prompt);
        const cached = this.cache.get(hash);
        if (!cached)
            return undefined;
        // Cache expires after 1 hour
        if (Date.now() - cached.timestamp > 3600000) {
            this.cache.delete(hash);
            return undefined;
        }
        return cached;
    }
    setCache(prompt, response, costUSD) {
        const hash = this.hashPrompt(prompt);
        this.cache.set(hash, { response, costUSD, timestamp: Date.now() });
    }
    hashPrompt(prompt) {
        // Simple hash for cache key
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString(16);
    }
    clearCache() {
        this.cache.clear();
    }
}
exports.storage = new Storage();
