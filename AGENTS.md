# AGENTS.md

## Commands

```bash
npm run dev                # dev server on port 3000 (uses .next-dev distDir)
npm run build              # production build to .next
npm run lint               # tsc --noEmit (no ESLint/Prettier)
npm run start              # production server on port 3000
npm run crawl              # crawl all companies (use --company=<id> for one)
npm run bench              # benchmark fetch + clean
npm run verify:source-quality  # audit source quality scores
```

Crawl a single company:
```bash
npm run crawl -- --company=huawei
```

## Architecture

- **Next.js 15 Pages Router** (not App Router). All pages under `pages/`, API routes under `pages/api/`.
- **Module alias**: `@/*` → `./*` (e.g. `@/lib/db/repository`).
- **TypeScript**: strict mode, `scripts/` directory is **excluded** from `tsconfig.json` — scripts run via `tsx` and have no type checking.
- **Tailwind CSS v3** with custom colors: `ink`, `moss`, `mint`, `sand`, `ember`.

## Database

- **SQLite** via `better-sqlite3`, path: `db/sqlite.db`.
- Schema is **auto-created and migrated** on first `getDb()` call in `lib/db/sqlite.ts` (columns are added via `ALTER TABLE` if missing — no migration framework).
- The `data/` directory holds JSON files (companies, test samples) separate from the SQLite DB.
- **Repository layer**: `lib/db/repository.ts` is the single data access file (~2200 lines). All DB reads/writes go through it.

## Crawl pipeline

1. `scripts/runCrawl.ts` calls `lib/crawl/runCrawlJob.ts`
2. `runCrawlJob.ts` orchestrates: resolve URLs → fetch (multiple strategies) → clean → LLM analyze → store
3. Crawl strategies: intelligent (default), Playwright, Firecrawl, Tavily+Jina. Strategy selection is in `lib/crawl/intelligentCrawl.ts`.
4. LLM analysis uses DeepSeek (`lib/analyze/deepSeek.ts`), with fallback logic when API key is absent.

## Env & config

- Env file: `.env.local` (gitignored). Template: `.env.example`.
- Scripts must explicitly call `loadEnvConfig` from `@next/env` — Next.js auto-loads env for pages/API, but not for `tsx` scripts.
- Key env vars: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`, `PLAYWRIGHT_HEADLESS`.

## Build directories

- Dev: `.next-dev/` (when `NODE_ENV=development`)
- Prod: `.next/` (when `NODE_ENV=production`)
- Controlled by `next.config.js` > `distDir`. Both are gitignored.

## PM2 deployment

- Config: `ecosystem.config.js`. App name: `biz-insight`.
- Start after build: `npm run build && npx pm2 restart biz-insight`.
- The README contains a detailed SOP for dev/prod deployment across two machines (home dev server and office WSL display machine).

## Business context

- **汽车电子商业洞察平台**，不是通用新闻爬虫。输出服务于**老板视角**（如 /briefing）和**专题/洞察视角**（如 /insights、/topics，以当前路由为准）。
- 分析框架围绕**六层方法论**：生态 → 市场 → 技术 → 产品 → 客户 → 行动。
- **重点公司/洞察对象**以 `data/companies.json` 为准，不要随意覆盖或重建该文件。

## Rules & boundaries

- **不要提交** `.env`、`.env.local`、`*.db`、`logs/`、API Key；数据库文件如 `db/sqlite.db` 必须保持 gitignored。
- **爬虫边界**：只抓取公开网页内容。不登录、不绕过验证码、不抓取受限内容。
- **修改以下模块前必须说明影响范围**：爬虫策略（`lib/crawl/`）、数据库结构（`lib/db/sqlite.ts`）、`lib/db/repository.ts`、DeepSeek prompt（`lib/analyze/`）、PDF/Markdown 导出、老板视角/专题视角页面。
- **每次修改后必须输出**：修改文件、修改原因、验证方式、风险、下一步建议。

## Conventions

- No linter, no formatter. The only quality gate is `tsc --noEmit`.
- Library code uses `@/lib/...` imports; scripts use `@/lib/...` via `tsconfig.json` paths (even though `scripts/` is excluded from type checking).
- `data/companies.json` is the source of truth for tracked companies; the repo layer syncs it into the SQLite `companies` table.
- Known engineering debt: the repo admits to type issues, large orchestration files, and MVP-level DB migration. Prefer preserving working crawl pipelines over large refactors.
