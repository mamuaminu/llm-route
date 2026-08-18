# LLM Route — AI Model Routing API

> Automatically route prompts to the cheapest/fastest LLM for the job.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)

## What It Does

LLM Route is a smart routing API that accepts a prompt and a goal, then automatically selects the best LLM provider (OpenAI GPT-4o Mini, Claude 3.5 Haiku, Gemini 1.5 Flash, etc.) based on cost, speed, and capability match — and returns the response with full cost/latency analytics.

**Pain solved:** Indie hackers burning through $200/month on GPT-4o when GPT-4o Mini or Gemini Flash would do the same job for 10% of the cost.

## Features

- 🧠 **Smart Routing** — Scores models by goal (answer/code/reasoning/fast/creative) + cost + latency
- 🔄 **Automatic Fallback** — If primary model fails, routes to next best candidate
- 💰 **Cost Analytics** — Tracks every request's cost, latency, and provider breakdown
- 🔑 **API Key Auth** — Generate per-user API keys for multi-tenant/monetization
- 🎯 **Per-Request Goals** — `answer`, `code`, `reasoning`, `fast`, `creative`
- ⚙️ **Model Toggle** — Enable/disable specific providers in the dashboard
- 🗂️ **Response Caching** — 1-hour cache to avoid redundant API calls
- 📊 **Dashboard** — Real-time chat UI + cost analytics dashboard

## Quick Start

```bash
git clone https://github.com/mamuaminu/llm-route.git
cd llm-route
npm install
PORT=3000 ADMIN_PASSWORD=sakamoto2024 node dist/index.js
```

Open `http://localhost:3000` and log in with `sakamoto2024`.

## API Keys

Set your provider API keys as environment variables:

```bash
OPENAI_API_KEY=sk-...     # OpenAI
ANTHROPIC_API_KEY=sk-ant-...  # Anthropic
GEMINI_API_KEY=AIza...     # Google Gemini
```

Or pass them per-request:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Explain WebSockets",
    "goal": "answer",
    "apiKeys": {
      "openai": "sk-...",
      "anthropic": "sk-ant-...",
      "gemini": "AIza..."
    }
  }'
```

## API Reference

### `POST /chat`
Route and chat with the best model.

```json
{
  "prompt": "Your question or task",
  "goal": "answer | code | reasoning | fast | creative",
  "maxTokens": 2048,
  "temperature": 0.7,
  "streaming": false,
  "preferredProvider": "openai | anthropic | gemini",
  "apiKeys": {}
}
```

**Response:**
```json
{
  "model": "gpt-4o-mini",
  "provider": "openai",
  "response": "...",
  "usage": {
    "inputTokens": 142,
    "outputTokens": 89,
    "costUSD": 0.000069,
    "latencyMs": 820
  },
  "routing": {
    "mode": "answer",
    "candidates": ["gpt-4o-mini", "claude-3-5-haiku"],
    "chosenReason": "strong at answer, preferred provider"
  }
}
```

### `POST /chat/:provider`
Chat directly with a specific provider (bypass router).

### `GET /models`
List all models with cost/latency data.

### `PATCH /models/:id`
Toggle model enabled/disabled (admin).

### `GET /analytics?days=7`
Aggregate cost analytics.

### `POST /auth/login`
Get JWT token. Password: `ADMIN_PASSWORD` env var.

### `POST /auth/api-key`
Generate a user API key (admin).

## Revenue Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 100 reqs/day, 3 providers, dashboard |
| **Pro** | $9/mo | 5,000 reqs/day, all providers, API access, analytics |
| **Business** | $29/mo | Unlimited requests, priority routing, team seats, webhooks |

**Open-source:** Self-host free. Hosted SaaS for those who don't want to manage it.

## Architecture

```
src/
├── index.ts          # Express app + routes
├── router.ts         # Core routing logic (scoring + fallback)
├── storage.ts        # In-memory store (models, analytics, cache, keys)
├── types.ts          # TypeScript interfaces + default model configs
└── adapters/
    ├── openai.ts     # OpenAI GPT-4o / GPT-4o Mini
    ├── anthropic.ts  # Claude 3.5 Haiku / Sonnet
    └── gemini.ts     # Gemini 1.5 Flash / Pro
```

## Supported Models

| Model | Provider | Cost/1K In | Cost/1K Out | Latency |
|-------|----------|-----------|-------------|---------|
| GPT-4o Mini | OpenAI | $0.00015 | $0.0006 | ~800ms |
| GPT-4o | OpenAI | $0.0025 | $0.01 | ~2000ms |
| Claude 3.5 Haiku | Anthropic | $0.0008 | $0.004 | ~1000ms |
| Claude 3.5 Sonnet | Anthropic | $0.003 | $0.015 | ~2500ms |
| Gemini 1.5 Flash | Google | $0.000075 | $0.0003 | ~900ms |
| Gemini 1.5 Pro | Google | $0.00125 | $0.005 | ~3000ms |

## Deploy

```bash
# Railway / Render / Fly.io
PORT=3000 ADMIN_PASSWORD=your_secure_password \
OPENAI_API_KEY=sk-... \
ANTHROPIC_API_KEY=sk-ant-... \
GEMINI_API_KEY=AIza... \
node dist/index.js
```

## Next Steps

1. Add streaming support (`stream: true` → Server-Sent Events)
2. Add webhook notifications on cost threshold alerts
3. Add Stripe integration for SaaS billing
4. Add per-user request quotas and rate limiting
5. Add "always use cheapest" / "always use fastest" mode toggles

---

Built in one night by **Sakamoto** for **Muhammad Aminu Musa (El Matador)**.
