# TRACE Framework Demo

Companion repository for the **Testing AI Agents: The TRACE Framework for Production Confidence** masterclass.

The central question: **is the agent good at helping customers?** Does the customer with a burst pipe get escalated immediately? Does the follow-up reference their actual conversation? Does the message arrive at the right time?

Every test in this repo is distilled from a production AI agent system. The code has been simplified for teaching — the production version has 823-line executors, 95 tools, and database-backed state machines. Here, the same patterns run in ~100 lines with in-memory tool logs.

## Quick Start

```bash
npm install
npm test          # Offline tests (no API key needed)
npm run test:all  # All tests (requires ANTHROPIC_API_KEY)
```

## Test Tiers

| Command | What it runs | API key? | Cost |
|---------|-------------|----------|------|
| `npm test` | Trust boundaries, sentinel, context contrast, enforcement | No | Free |
| `npm run test:replay` | Trace replay (fixtures → live model) | Yes | ~$0.01 |
| `npm run test:evals` | Property assertions + LLM judge + context comparison | Yes | ~$0.02 |
| `npm run test:all` | Everything | Yes | ~$0.03 |
| `npm run typecheck` | TypeScript type-check (`tsc --noEmit`) | No | Free |

## Structure

```
tests/
  01-trust-boundaries/       → T: Tool handler tests
  02-runtime-observability/  → R: Trace replay + sentinel (anomaly detection)
  03-adaptive-evals/         → A: Property assertions + LLM-as-judge
  04-context-engineering/    → C: Context comparison (Demo 3) + mock vs contract contrast
  05-enforcement/            → E: TCPA quiet hours, business hours

src/
  agent/                     → Simplified agent executor + tools
  observability/             → Sentinel (lightweight anomaly detection on traces)
  compliance/                → TCPA quiet hours (deterministic)
  scheduling/                → Business hours scheduling

fixtures/                    → Production traces (anonymized)
```

## The TRACE Framework

| Layer | What it tests | What it tells you about the service |
|-------|--------------|-------------|
| **T** — Trust Boundaries | What the agent does alone vs. what needs approval | Escalations reach the owner with actionable detail; follow-ups capture context |
| **R** — Runtime Observability | Every decision logged, traced, queryable | Real customer scenarios produce acceptable outcomes; anomalies are flagged automatically |
| **A** — Adaptive Evals | Continuous evaluation, not deployment gates | Customers don't get double-texted; emergencies get escalated; tone is right |
| **C** — Context Engineering | What the model sees at each decision point | The model has what it needs to make good decisions — most "model errors" are context errors |
| **E** — Enforcement | Rules that never become model decisions | Customers aren't contacted at 2am; scheduling respects business hours |

## Setup

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

## Model Upgrade Insurance

Your eval suite gets *more* valuable as models improve, not less. When you upgrade from one model generation to the next, run your fixtures against the new model:

```bash
npm run test:all   # same fixtures, new model — do your scenarios still pass?
```

Every fixture you add today validates every future model against your real-world failure modes. The model is the bitter lesson. The eval suite is the durable investment.

## License

MIT
