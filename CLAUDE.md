# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TRACE Framework Demo — companion repo for the "Testing AI Agents: The TRACE Framework for Production Confidence" masterclass. Simplified from a production AI agent system for teaching. TRACE layers: Trust Boundaries, Runtime Observability, Adaptive Evals, Context Engineering, Enforcement.

## Commands

```bash
npm install              # Install dependencies
npm test                 # Run offline tests (no API key needed)
npm run test:offline     # Same as npm test
npm run test:replay      # Trace replay tests (requires ANTHROPIC_API_KEY, ~$0.01)
npm run test:evals       # Property assertions + LLM judge (requires ANTHROPIC_API_KEY, ~$0.02)
npm run test:context     # Context engineering comparison (requires ANTHROPIC_API_KEY, ~$0.01)
npm run test:all         # Run all tests (requires ANTHROPIC_API_KEY, ~$0.03)
```

To run a single test file: `npx jest tests/01-trust-boundaries/tool-handler.test.ts`

## Environment Setup

Copy `.env.example` to `.env` and add `ANTHROPIC_API_KEY` for API-dependent tests. Offline tests (trust boundaries, enforcement, contract tests) need no key.

## Architecture

- **src/agent/executor.ts** — Agent executor: single-turn tool loop (max 5 turns) using Anthropic SDK. Entry point for trace replay.
- **src/agent/tools.ts** — 4 tools (escalate, schedule_followup, check_schedule, send_sms) with in-memory ToolLog for test assertions. Registry pattern via `Map<string, ToolDefinition>`.
- **src/agent/types.ts** — Core types: AgentResponse, TraceFixture, ToolDefinition, ToolCall, ToolLogEntry, ContactInfo, Message.
- **src/observability/sentinel.ts** — Lightweight anomaly detection: timeout spikes, response repetition, context bloat. Pure functions, no DB, no API.
- **src/compliance/quiet-hours.ts** — TCPA quiet hours enforcement (9pm-8am local time). Pure deterministic functions.
- **src/scheduling/business-hours.ts** — Business hours scheduling (7am-7pm, no Sunday before noon). Pure deterministic functions.
- **fixtures/** — Anonymized production traces as JSON (emergency-escalation, scheduled-followup, terse-opener) used for replay testing.

## Test Structure

Tests are organized by TRACE layer in numbered directories:

| Directory | TRACE Layer | API Key? | What It Tests |
|-----------|-------------|----------|---------------|
| `tests/01-trust-boundaries/` | Trust Boundaries | No | Tool handler input/output contracts |
| `tests/02-runtime-observability/` | Runtime Observability | Mixed | Trace replay (API) + sentinel anomaly detection (offline) |
| `tests/03-adaptive-evals/` | Adaptive Evals | Yes | Property assertions + LLM-as-judge |
| `tests/04-context-engineering/` | Context Engineering | Mixed | Context comparison (API) + mock vs contract contrast (offline) |
| `tests/05-enforcement/` | Enforcement | No | TCPA quiet hours, business hours scheduling |

Tests requiring API keys use conditional skipping: `const describeWithApi = hasApiKey ? describe : describe.skip`

## Key Patterns

- Tests answer "is the agent good at helping customers?" — does escalation reach the owner with actionable detail? does the follow-up reference the actual conversation? does the message arrive at the right time?
- Enforcement rules (compliance, scheduling) are pure functions with injectable `now` parameter for testability — never model decisions
- Tests assert on **properties** of agent output (escalated?, word count, topic relevance), never exact content
- `tests/04-context-engineering/contrast/` contains a deliberate anti-pattern (mock-chain) alongside the preferred approach (contract-test) for teaching purposes

## Tech Stack

- TypeScript (ES2022 target, CommonJS modules, strict mode), Jest 29 with ts-jest, @anthropic-ai/sdk
- No build step needed for development — ts-jest runs TypeScript directly
- No ESLint or Prettier configured

## Code Conventions

- Single quotes, trailing commas, kebab-case file names
- `type` aliases preferred over `interface` for domain types
- Every file has a block comment identifying its TRACE layer and purpose
