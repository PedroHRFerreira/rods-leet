# AGENTS.md

@/home/pedro/.codex/RTK.md

## Rods SDK Defaults

Use rods-sdk defaults before reading large files, running noisy commands, or scanning the repository manually.

Detected stack: React TypeScript

1. Run `context_engine.search` with task-specific terms.
2. Read only relevant chunks with `context_engine.read`.
3. Use RTK for shell commands when it is available, especially for `git`, tests, logs, diffs, and broad searches.
4. Operate through the local harness/CLI, MCP tools, skills, and adapters. Direct provider calls are limited to explicitly enabled decision adapters such as Jev.
5. Fall back to local file reads only when the index is missing or stale.
6. If fallback local reads solved the task, run `context_engine.ingest` on the relevant file or directory before finishing.
7. If a card or link implies external dependencies, ask whether to proceed, only plan, or take another action before running Context Engine search.

## Reading Map

| Case                                     | Skill                                                             |
| ---------------------------------------- | ----------------------------------------------------------------- |
| repository context / file lookup         | `.ai/skills/context-search-first/SKILL.md`                        |
| architecture / boundaries                | `.ai/skills/architecture/SKILL.md`                                |
| feature spanning domain, UI, and routing | `.ai/skills/parallel-delivery/SKILL.md`                           |
| frontend / styles                        | `.ai/skills/architecture/SKILL.md`, `.ai/skills/quality/SKILL.md` |
| browser / responsive / visual validation | `.ai/skills/visual-check/SKILL.md`                                |
| durable project rule / convention        | `.ai/skills/rules-capture/SKILL.md`                               |
| quality / readiness                      | `.ai/skills/quality/SKILL.md`                                     |
| review / PR / commit                     | `.ai/skills/review/SKILL.md`                                      |

## Running The Framework

Prepare a consumer project:

```bash
pnpm exec rods init
pnpm exec rods adapter sync --target codex
```

By default, skills stay in `.ai/skills`. If Codex needs a physical projection in another directory, pass it explicitly:

```bash
pnpm exec rods adapter sync --target codex --codex-skills-dir .codex/skills
```

Register and index the project in Context Engine:

```bash
pnpm exec rods project add rods-leet .
pnpm exec rods ingest .
pnpm exec rods stats
```

Search indexed context:

```bash
pnpm exec rods search "search term"
pnpm exec rods read <chunkId>
```

## Governance

Project governance lives in `.ai/`.

- `.ai/constitution.md` contains stable rules.
- `.ai/skills/*/SKILL.md` contains skills used as the project source of truth.
- `.ai/adapters/` contains optional adapter notes for external tools.

## Project Context

- Runtime: Node.js 22 or newer. Use the existing npm lockfile.
- Frontend: React 19, TypeScript, Vite, React Router and Monaco.
- Server: Cloudflare Pages Functions BFF, Supabase Auth/PostgreSQL/Edge Functions, and an isolated executor.
- Product rules: `docs/product-rules.md`. Deployment procedure: `docs/deployment.md`. Historic environment status: `docs/deployment-status.md`; verify it against the running environment.
- Public content lives in `src/content`; private judge data lives in `judge` and must stay outside the browser bundle.
- Local UI: `npm run dev -- --port 5178 --strictPort`. Vite defaults to exploration mode; connected testing requires the BFF.
- Readiness checks: `npm run typecheck`, `npm run typecheck:bff`, `npm run lint`, `npm test`, `npm run build`, `npm run build:bff`, and `npm run test:e2e`.
- Baseline beta audit: `docs/beta-readiness-2026-09-30.md`.
