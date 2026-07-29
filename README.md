<div align="center">

# X Growth Cockpit

**A personal, local cockpit for growing on X (Twitter) as a founder — without paying for anything or configuring any API.**

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)
![Cost](https://img.shields.io/badge/cost-%240%2Fmo-success)
![Status](https://img.shields.io/badge/status-Phase%201%20MVP-brightgreen)

</div>

---

It targets the *real* bottleneck to audience growth — **consistency and replying** — instead of vanity analytics. Everything runs on your machine: no accounts, no cloud, no API keys, nothing to pay for.

> **On "virality":** this tool does **not** claim to make tweets go viral — that's an unprovable promise. It grades the *structure* you actually control (hook, specificity, readability) and helps you show up every day. Honest by design.

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Project structure](#project-structure)
- [Data & privacy](#data--privacy)
- [Configuration](#configuration)
- [Roadmap](#roadmap)
- [Philosophy](#philosophy)
- [License](#license)

## Features

| Feature | What it does |
|---------|--------------|
| 🧪 **Hook Lab** | Turn a raw thought into 8 structured tweet variants (Unpopular opinion, Contrarian, Listicle, …) and get an honest **0–100 structure score** with fix-it hints. |
| 🗓️ **Queue & Schedule** | Draft, edit, schedule, and track tweets through `draft → queued → posted`. No auto-posting — a clean copy-to-post workflow. |
| ⏰ **Today Dashboard** | One screen: what's **due now**, which accounts to **reply to**, and a daily **follower check-in** — with optional browser reminders. |
| 💬 **Reply Frameworks** | Track target accounts and generate fill-in-the-blank reply scaffolds — because early reach comes from replies, not broadcasts. |
| 📈 **Growth Tracker** | Log your follower count and see the trend on an inline chart, with day-over-day and 7-day deltas. |

## Tech stack

- **[Next.js 15](https://nextjs.org/)** (App Router) + **React 19** + **TypeScript** (strict)
- **`node:sqlite`** — Node 24's built-in SQLite (no native compilation, no external database)
- **Plain CSS** with design tokens (no UI framework)
- **Zero external services** — no API keys, no cloud, no telemetry

## Requirements

- **[Node.js 24+](https://nodejs.org/)** — required for the built-in `node:sqlite` module
- **npm** (ships with Node)

## Getting started

```bash
# 1. Clone
git clone <your-repo-url>
cd x-growth-cockpit

# 2. Install dependencies
npm install

# 3. Run the development server
npm run dev
```

Then open **[http://localhost:3000](http://localhost:3000)**.

The SQLite database is created automatically at `./data/cockpit.db` on first run — no setup required.

### Production build

```bash
npm run build   # compile an optimized production build
npm start       # serve it on http://localhost:3000
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Create an optimized production build |
| `npm start` | Serve the production build |

## Usage

A typical daily loop:

1. **Capture & craft** — In **Hook Lab**, dump a raw thought, generate variants, score the structure, and save the best one to your queue.
2. **Schedule** — In **Queue**, assign a posting time (or mark it posted after you paste it into X).
3. **Show up** — Open the **Today** dashboard: post what's due, run through your **reply targets**, and log your follower count.
4. **Reply well** — Use **Reply Frameworks** to write additive replies to the accounts your audience already follows.
5. **Track** — Watch your trend in **Growth** and learn which posts moved the needle.

> **Reminders note:** browser notifications fire only while the app tab is open (V1). Always-on reminders are planned for a later phase.

## Project structure

```
x-growth-cockpit/
├── app/                      # Next.js App Router
│   ├── page.tsx              # Today dashboard
│   ├── compose/              # Hook Lab
│   ├── queue/                # Queue & Schedule
│   ├── replies/              # Reply Frameworks
│   ├── growth/               # Growth Tracker
│   ├── api/                  # Route handlers (drafts, targets, growth, score, variants)
│   └── components/           # Nav, DraftCard, shared client helpers
├── lib/                      # Server/pure logic
│   ├── db.ts                 # SQLite connection + schema (node:sqlite)
│   ├── hooks.ts              # Hook template engine
│   ├── score.ts              # Structure-scoring engine
│   ├── replyFrameworks.ts    # Reply framework catalog
│   ├── dates.ts              # Shared date helpers
│   └── types.ts              # Shared TypeScript types
└── data/                     # Local SQLite database (gitignored)
```

## Data & privacy

- **100% local.** Your data lives in a single SQLite file at `./data/cockpit.db` and **never leaves your machine**.
- The database file is **gitignored** — it's never committed.
- **No accounts, no auth, no telemetry, no third-party calls.** Single-user by design.

## Configuration

No configuration is required — the app runs fully offline out of the box.

**Optional (future / Phase 2):** to upgrade the Hook Lab from template-based rewrites to real AI generation, copy `.env.local.example` to `.env.local` and add a key:

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

The AI layer is pluggable (Anthropic API **or** a local model) and is not needed for any current feature.

## Roadmap

- ✅ **Phase 1 — MVP (offline, $0):** Hook Lab, Queue, Today dashboard, Reply Frameworks, Growth Tracker.
- 🔜 **Phase 1.5 — Audience growth:** Idea Inbox (swipe file), Reply Sprints + log, streaks, and a learning loop that surfaces *your* top-performing posts.
- 🔮 **Phase 2 — AI:** voice-cloned generation and reply drafts (Anthropic or local Ollama).
- 🔮 **Phase 3+ :** always-on reminders; optional X API metrics auto-pull.

## Philosophy

Built on a few deliberate principles:

- **Honesty over hype** — grade structure, never fake a virality prediction.
- **Offline-first, zero cost** — no keys, no subscriptions, no lock-in.
- **The loop is the product** — compose → queue → remind → post → track → learn.
- **Consistency beats cleverness** — the tool exists to make you show up daily.

**Non-goals:** auto-posting, multi-user/auth, follower-buying or engagement-pod tooling, and any "guaranteed virality" claim.

## License

Personal project — all rights reserved. Not currently licensed for redistribution.

---

<div align="center">
<sub>Built to be used daily, not admired. Ship tweets, not features.</sub>
</div>
