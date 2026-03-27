# Biz Insight MVP

这是一个面向商业洞察与竞品跟踪的本地化 MVP。当前版本已经具备来源管理、智能抓取、正文清洗、结构化分析、聚合展示和系统健康查看能力，适合内部演示、样本公司分析和链路验证。

当前项目的重点是：

- 先把整条业务链路跑通
- 先把页面和报告做到可看、可展示、可验证
- 先积累可复用的站点策略和抓取经验

当前项目不是生产级平台，仍以本地可运行、内部可用和可持续迭代为主。

## 当前可用能力

- 公司与来源维护：基于 `data/companies.json` 和 SQLite 来源表管理目标公司与来源 URL
- 单公司 / 多公司抓取：通过脚本或页面工作台触发抓取任务
- 多策略抓取：同时支持通用抓取和部分站点定制策略
- 正文清洗与日期提取：对抓取结果做正文抽取、列表条目提取和发布时间识别
- LLM 分析：对满足条件的内容进行摘要、分类和洞察生成
- 聚合展示：通过首页、洞察页、动态列表、简报页等模块查看结果
- 任务与健康监控：查看抓取批次、错误分组和系统状态

## 当前系统边界

- 这是一个商业洞察系统 MVP，不是生产级 SaaS 平台
- 当前默认面向本地运行和内部演示，不以多用户、多环境部署为目标
- 部分抓取策略属于站点定制逻辑，后续仍需要维护
- 当前以“链路可跑通、结果可展示”为优先，高于“架构完全整洁”
- 仓库目前存在已知工程问题，例如类型和构建层面的不一致，后续需要单独治理

## 目录结构

以下目录说明以当前仓库实际状态为准：

```text
biz-insight-mvp/
├─ README.md
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ .env.local
├─ /components
├─ /data
│  ├─ companies.json
│  ├─ raw_gasgoo_articles.json
│  ├─ raw_gasgoo_flash.json
│  └─ sample_sites.json
├─ /db
│  └─ sqlite.db
├─ /lib
│  ├─ /analyze
│  ├─ /api
│  ├─ /clean
│  ├─ /crawl
│  ├─ /db
│  ├─ /evaluate
│  ├─ /extract
│  ├─ /presentation
│  ├─ /search
│  ├─ /skill
│  ├─ evaluation.ts
│  ├─ format.ts
│  └─ types.ts
├─ /pages
│  ├─ index.tsx
│  ├─ overview.tsx
│  ├─ insights.tsx
│  ├─ workbench.tsx
│  ├─ health.tsx
│  ├─ console.tsx
│  ├─ list-all.tsx
│  ├─ briefing.tsx
│  ├─ briefing-simple.tsx
│  ├─ learn.tsx
│  ├─ sources.tsx
│  ├─ workflow-map.tsx
│  └─ ...
├─ /scripts
│  ├─ runCrawl.ts
│  ├─ benchFetchAndClean.ts
│  └─ verifySourceQuality.ts
└─ data.db
```

## 核心链路

项目当前的核心链路可以概括为：

1. 在 `data/companies.json` 中维护公司、官网、关键词和部分来源
2. `lib/db/repository.ts` 与 `lib/db/sqlite.ts` 同步公司、来源、任务和洞察数据
3. `scripts/runCrawl.ts` 调用 `lib/crawl/runCrawlJob.ts` 启动抓取任务
4. `lib/crawl/intelligentCrawl.ts`、`lib/crawl/playwrightCrawl.ts` 与 `lib/crawl/strategies/*` 执行抓取
5. `lib/clean/cleanText.ts` 做正文清洗、链接提取、条目抽取和日期识别
6. `lib/analyze/deepSeek.ts` 对符合条件的内容执行 LLM 洞察分析
7. 结果写入 SQLite，并通过页面层进行展示与排查

## 主要页面

当前页面层已经覆盖演示和日常查看所需的主要入口：

- `/`：首页，总览系统状态和功能模块
- `/overview`：系统总览与数据流说明
- `/insights`：商业洞察聚合页
- `/list-all`：动态信息列表
- `/workbench`：工作台，支持选公司执行抓取
- `/health`：系统健康度和错误分组
- `/console`：公司与来源维护
- `/briefing`：简报展示页
- `/briefing-simple`：简化简报页
- `/learn`：智能爬虫系统说明页
- `/sources`：来源查看页
- `/workflow-map`：工作流展示页

## 环境要求

- Node.js 18+
- npm
- Chromium for Playwright
- SQLite 文件存储

如果需要完整抓取与 LLM 分析，还需要以下外部能力中的一部分或全部：

- `DEEPSEEK_API_KEY`
- `FIRECRAWL_API_KEY`
- `TAVILY_API_KEY`

## 环境变量

参考 `.env.example`，并在本地创建 `.env.local`。

常用环境变量示例：

```env
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
APP_BASE_URL="http://localhost:3000"
PLAYWRIGHT_HEADLESS="true"
FIRECRAWL_API_KEY=""
TAVILY_API_KEY=""
```

说明：

- 没有 `DEEPSEEK_API_KEY` 时，系统会走 fallback 分析逻辑
- 没有 `FIRECRAWL_API_KEY` 或 `TAVILY_API_KEY` 时，相关抓取能力会受限
- 本项目默认读取 `.env.local`

## 最短运行路径

### 1. 安装依赖

```bash
npm install
npx playwright install chromium
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

然后补充你当前实际可用的 API Key。

### 3. 启动页面

```bash
npm run dev
```

默认访问：

- `http://localhost:3000`

### 4. 执行一次抓取

抓所有公司：

```bash
npm run crawl
```

抓单个公司：

```bash
npm run crawl -- --company=i-soft
```

### 5. 常用检查命令

```bash
npm run lint
npm run build
npm run verify:source-quality
```

说明：

- `lint` 当前实际是 `tsc --noEmit`
- `build` 用于生产构建检查
- 某些命令在当前仓库状态下可能暴露已知工程问题

## 演示路径

如果你要用当前系统做一次稳定演示，建议固定以下路径：

1. 打开首页 `/`
2. 进入工作台 `/workbench`
3. 选择一个已验证过的公司执行抓取
4. 回到 `/insights` 查看最新洞察
5. 在 `/list-all` 查看明细
6. 在 `/health` 查看任务和错误状态

建议固定 2 到 3 家你已经验证过的样本公司，用于重复演示和回归对照。

## 数据与配置说明

- `data/companies.json`
  维护公司基础信息、官网、关键词和部分静态来源
- `db/sqlite.db`
  当前主数据库，保存来源、文档、洞察、任务和错误等信息
- `data/*.json`
  用于测试、样本或特定来源实验数据

建议定期备份以下文件：

- `db/sqlite.db`
- `data/companies.json`
- `.env.local`

## 当前已知问题

以下问题在当前仓库中已经存在，但不影响你基于已验证路径继续演示：

- README 之前版本与实际实现存在漂移，本次已按当前仓库状态更新
- 当前构建和类型系统存在已知问题，`npm run lint` 与 `npm run build` 可能失败
- 部分站点策略与公共类型定义尚未完全收口
- 当前数据库结构演进仍偏 MVP 方式，后续需要正式迁移机制
- 当前核心编排文件承担职责较多，后续需要拆分治理

这意味着当前项目更适合：

- 保持已验证链路稳定
- 先冻结可演示版本
- 逐步做低风险治理

而不适合：

- 在没有回归基线的前提下大范围重构核心链路

## 工程治理建议

当前阶段建议按以下顺序治理：

1. 先锁定主干可构建性
2. 再统一核心领域类型
3. 再补最小回归检查和 smoke test
4. 再引入正式 schema migration
5. 最后拆分核心编排逻辑

在此之前，建议优先保护已经跑通的链路，而不是追求大规模重构。

## 面向接手者的说明

如果你是未来的维护者，建议先做这几件事：

1. 先确认 `.env.local` 与 API Key 是否可用
2. 先确认 `db/sqlite.db` 是否存在且可读写
3. 先跑 `npm run dev`
4. 使用一个已验证过的公司做一次最小抓取验证
5. 只在确认演示链路仍然可用后，再考虑治理或重构

## 备注

这个仓库当前最重要的资产不是“代码是否最优雅”，而是“已经形成了一条可运行、可展示、可复用的商业洞察链路”。后续所有工程治理，都应该以保护这条链路为前提。

---

## 变更记录 (Changelog)

### 2026-03-27

| 修复内容 | 说明 |
|---------|------|
| 修复爬取任务未记录到crawl_jobs表 | 工作台爬取后，任务中心和系统健康度现在能正确显示爬取记录 |
| 移除copyright对summary的误判 | 正常新闻的summary中包含版权声明不再被错误标记为low优先级 |
| 增加generate-brief默认limit | 从50增加到200，确保聚合洞察能覆盖更多公司的数据 |
| 更新数据库备份 | 包含当日爬取的最新数据 |

### 修复文件

- `pages/api/strategy/crawl.ts` - 爬取任务记录
- `pages/insights.tsx` - copyright误判修复
- `pages/api/insights/generate-brief.ts` - limit参数调整
