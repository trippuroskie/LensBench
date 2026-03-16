# LensBench – Agent Guide

LensBench is a **benchmarking tool for OCR pipelines**. Users evaluate vision/LLM models (via OpenRouter) on receipt images with configurable prompts and ground-truth JSON, and compare accuracy, inference time, cost, and throughput.

## Stack

- **Frontend:** React 19, TypeScript, Vite
- **API:** OpenRouter (vision/chat completions); requires `OPENROUTER_API_KEY` (or `API_KEY`) in `.env.local`
- **Storage:** localStorage for prompts, results, and custom model configs; IndexedDB for receipt images and base64 data

## Key Concepts

- **Prompts** – OCR instructions; versioned and stored in state.
- **Receipts** – Images plus ground-truth JSON used to compute extraction accuracy.
- **Models** – Built-in list in `constants.tsx` + `types.ts`; users can add custom OpenRouter model IDs via the Benchmark UI (stored in `customModels`).
- **Benchmark** – Runs a selected set of (prompt × model × receipt), calls OpenRouter per task, then records accuracy, inference time, cost, tokens.
- **Results / Leaderboard** – Results are per-run; Leaderboard aggregates by model and supports ranking by accuracy, inference time, cost, or tokens/sec.

## Project Layout

- `App.tsx` – Root state (view, receipts, prompts, customModels, results), batch run logic, persistence.
- `types.ts` – `ViewState`, `ModelId`, `BenchmarkResult`, `BenchmarkMetrics`, `Receipt`, `Prompt`, `CustomModel`.
- `constants.tsx` – `MODEL_CONFIGS` (name, pricing, color), `SYSTEM_PROMPT_PREFIX`, default ground-truth template.
- `services/openrouter.ts` – `OpenRouterService`: `runOCR(modelId, prompt, imageBase64, mimeType)`, `refinePrompt(...)`.
- `utils/evaluator.ts` – `calculateAccuracy(actualJson, groundTruthJson)`, token estimation, JSON path helpers.
- `components/` – `Sidebar`, `Dashboard`, `PromptManager`, `ReceiptManager`, `BenchmarkRunner`, `ResultsHistory`, `Leaderboard`.

## Conventions

- **Views:** Controlled by `ViewState` in `App.tsx`; sidebar drives `setView`. Adding a view = new `ViewState` + nav item in `Sidebar` + branch in `App.tsx`.
- **Models:** To add a built-in model: add entry in `types.ts` `ModelIdValues`, then a config in `constants.tsx` `MODEL_CONFIGS`. Custom models need no code change (UI only).
- **Env:** Use `OPENROUTER_API_KEY` or `API_KEY`; see `.env.example` for a template. Do not commit secrets.

## Run Locally

```bash
npm install
# Set OPENROUTER_API_KEY in .env.local
npm run dev
```

Build: `npm run build`. Preview: `npm run preview`.
