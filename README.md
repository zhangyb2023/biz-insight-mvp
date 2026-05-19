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
- `/llm-trace`：LLM 调试台，查看 prompt 版本、输入、原始输出和解析结果，也可基于历史输入试跑提示词
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

## 发布 SOP

当前正式站点运行在 PM2 托管的生产模式下。日常开发和正式发布建议分开进行。

### 1. 家里开发机：开发调试

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
npm run dev
```

如果家里同时维护生产预览和开发预览，建议使用：

- `3000`：生产预览
- `3001`：开发预览

公司 WSL 展示机建议只保留 `3000`，不要在公司 WSL 上直接开发。

### 2. 家里开发机：发布前检查

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
./node_modules/.bin/tsc --noEmit
npm run build
```

### 3. 家里开发机：提交到 GitHub

```bash
git status --short
git add .
git commit -m "描述本次改动"
git push
```

### 4. 公司 WSL：拉取并发布

公司 WSL 只作为展示环境，代码来源以 GitHub 为准。

```bash
cd ~/biz-insight-mvp
git pull
npm install
./node_modules/.bin/tsc --noEmit
npm run build
node ./node_modules/pm2/bin/pm2 restart biz-insight
```

### 5. 发布后验证

```bash
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:3000/workbench
curl -I http://127.0.0.1:3000/insights
curl -I http://127.0.0.1:3000/health
curl -I http://127.0.0.1:3000/briefing
```

建议至少手动检查以下页面：

- `/`
- `/workbench`
- `/insights`
- `/health`
- `/briefing`
- `/llm-trace`

如果 `/insights` 返回 500，但 `npm run build` 成功，优先重新执行公司 WSL 的发布流程，确保 `.next` 生产构建产物完整。

### 6. 数据与密钥迁移原则

GitHub 只保存代码和文档，不保存运行密钥。

公司 WSL 首次部署或数据迁移时，需要单独复制：

- `.env.local`
- `db/sqlite.db`
- `data/companies.json`

复制数据库前，先确认没有正在运行的抓取任务。

## 小白操作指南

这部分按最简单的方式说明日常怎么开发、怎么发布、怎么查看状态。

### 先记住两个地址

- `3000`：生产环境。正式给别人看的网站，用这个地址。
- `3001`：可选开发环境。只有家里开发机需要边改边看时才需要。

你维护的是同一套代码，不是两套代码。

公司 WSL 展示机只保留 `3000` 即可，不需要启动 `3001`。

### 1. 先看当前状态

查看 PM2 环境是否在运行：

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
node /home/openclaw-ubuntu-zyb/biz-insight-mvp/node_modules/pm2/bin/pm2 list
```

查看端口是否在监听：

```bash
ss -ltnp | grep -E ':3000|:3001' || true
```

本机检查网页是否能打开。公司 WSL 只需要检查 `3000`：

```bash
curl -I http://127.0.0.1:3000
```

如果家里开发机启用了 `3001`，再额外检查：

```bash
curl -I http://127.0.0.1:3001
```

### 2. 家里开发时怎么用

如果家里开发环境 `3001` 没开，先启动它：

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
node /home/openclaw-ubuntu-zyb/biz-insight-mvp/node_modules/pm2/bin/pm2 restart biz-insight-dev
```

然后访问：

- `http://你的服务器IP:3001`

接下来你就可以：

- 改代码
- 刷新 `3001`
- 直接看修改后的页面效果

说明：

- 你改代码时，`3001` 会跟着变
- 这时候 `3000` 不会变，所以正式网站还是稳定的

### 3. 开发完成后，怎么发布到正式环境

当你在家里验证没问题后，先执行下面这套：

1. 进入项目目录

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
```

2. 先做类型检查

```bash
./node_modules/.bin/tsc --noEmit
```

3. 再做生产构建

```bash
npm run build
```

4. 重启正式环境

```bash
node /home/openclaw-ubuntu-zyb/biz-insight-mvp/node_modules/pm2/bin/pm2 restart biz-insight
```

5. 检查正式环境

```bash
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:3000/insights
curl -I http://127.0.0.1:3000/health
```

然后访问：

- `http://你的服务器IP:3000`

### 4. 公司 WSL 怎么更新

公司 WSL 不直接改代码，只从 GitHub 更新：

```bash
cd ~/biz-insight-mvp
git pull
npm install
./node_modules/.bin/tsc --noEmit
npm run build
node ./node_modules/pm2/bin/pm2 restart biz-insight
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:3000/insights
```

### 5. 如果你暂时不开发了

家里开发机可以把开发环境停掉，省资源：

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
node /home/openclaw-ubuntu-zyb/biz-insight-mvp/node_modules/pm2/bin/pm2 stop biz-insight-dev
```

以后要继续开发，再启动：

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
node /home/openclaw-ubuntu-zyb/biz-insight-mvp/node_modules/pm2/bin/pm2 restart biz-insight-dev
```

### 6. 如果正式网站挂了

先检查状态：

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
node /home/openclaw-ubuntu-zyb/biz-insight-mvp/node_modules/pm2/bin/pm2 list
curl -I http://127.0.0.1:3000
```

如果只是正式环境异常，先重启正式环境：

```bash
node /home/openclaw-ubuntu-zyb/biz-insight-mvp/node_modules/pm2/bin/pm2 restart biz-insight
```

如果重启还不行，就重新发布一次：

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
./node_modules/.bin/tsc --noEmit
npm run build
node /home/openclaw-ubuntu-zyb/biz-insight-mvp/node_modules/pm2/bin/pm2 restart biz-insight
```

如果 `/insights` 报 500，优先重新构建并重启：

```bash
cd /home/openclaw-ubuntu-zyb/biz-insight-mvp
./node_modules/.bin/tsc --noEmit
npm run build
node /home/openclaw-ubuntu-zyb/biz-insight-mvp/node_modules/pm2/bin/pm2 restart biz-insight
curl -I http://127.0.0.1:3000/insights
```

### 7. 以后只需要记住这几句

- 公司展示：只看 `3000`
- 家里改代码看效果：可选看 `3001`
- 给别人看正式站：看 `3000`
- 发布到公司 WSL：`git pull -> tsc -> build -> restart biz-insight`

### 8. LLM 调试台怎么用

访问：

```text
http://你的服务器IP:3000/llm-trace
```

基本流程：

1. 先在下方历史记录里找一条真实 LLM 调用
2. 点击 `载入测试区`
3. 在上方修改 `System Prompt` 或 `User Prompt`
4. 点击 `试跑提示词`
5. 对比测试输出和原始输出

说明：

- 测试区会调用 DeepSeek，因此会消耗 API
- 测试区不会写入数据库
- 测试区不会覆盖正式报告
- 只有你确认新提示词稳定更好后，才考虑改正式 prompt

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
- 当前类型检查和生产构建已经通过，但仍需要保持每次发布前执行 `tsc` 和 `build`
- 部分站点策略仍需要持续维护，外部网站网络波动可能导致抓取失败
- 当前数据库结构演进仍偏 MVP 方式，后续需要正式迁移机制
- 当前核心编排文件承担职责较多，后续需要拆分治理
- LLM 与报告生成已有运行记录，但还需要进一步做白盒化页面，方便查看 prompt、输入、原始输出和证据链

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

### 2026-03-29

| 增强内容 | 说明 |
|---------|------|
| 增强 overview 页面 LLM 透明度 | 新增"LLM 分类阶段详解"章节，展示 Stage 1 分类 prompt（lib/crawl/llmClassifier.ts） |
| 新增"LLM 调试指南"章节 | 提供常见问题与解决方案、Prompt 优化检查清单、调试方法 |
| 展示完整 System Prompt | 在 overview 页面展示聚合洞察使用的完整 System Prompt（pages/api/insights/generate-brief.ts） |
| 展示报告阶段 Prompt | 展示商业洞察报告（report.ts）和 Markdown 报告的 prompt 设计 |
| Prompt 设计解析 | 说明每个 prompt 部分的作用，以及如果不写会怎样 |

### 增强文件

- `pages/overview.tsx` - 新增 LLM 分类详解、LLM 调试指南章节

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
