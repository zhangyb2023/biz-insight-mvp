# Biz Insight MVP

本项目是一个适合 Windows 10 本地开发的商业洞察 MVP，采用更短的链路：

- 公司列表和关键词维护在 `data/companies.json`
- URL 直接来自 JSON / Excel / 手动维护
- 抓取使用 `Playwright`
- 正文清洗使用 `cheerio`
- 存储使用 `SQLite` 文件
- 结构化摘要使用 `DeepSeek`
- 前端使用 `Next.js + Tailwind`
- PDF 使用 `Playwright`
- 可复用技能接口是 `lib/skill/fetchAndClean.ts`

## 为什么这是更稳的方案

- 不依赖外部搜索 API 作为核心路径，速度更可控
- 目标 URL 和关键词显式维护，调试简单
- SQLite 单文件，迁移和备份方便
- `fetchAndClean()` 可以直接复用到 OpenClaw 或其他 agent
- 页面层、抓取层、分析层职责明确

## 目录

```text
biz-insight-mvp/
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ README.md
├─ /data
│  ├─ companies.json
│  └─ crawl_cache/
├─ /db
│  └─ sqlite.db
├─ /lib
│  ├─ search/searchUrls.ts
│  ├─ crawl/playwrightCrawl.ts
│  ├─ clean/cleanText.ts
│  ├─ analyze/deepSeek.ts
│  ├─ skill/fetchAndClean.ts
│  └─ db/
├─ /scripts
│  └─ runCrawl.ts
├─ /pages
│  ├─ index.tsx
│  ├─ company/[id].tsx
│  ├─ report/[id].tsx
│  └─ api/report/[id].ts
├─ /components
└─ /outputs/pdf/
```

## 数据文件格式

`data/companies.json`

```json
[
  {
    "id": "vector",
    "name": "Vector",
    "website": "https://www.vector.com/cn/zh/",
    "keywords": ["AUTOSAR", "diagnostics"],
    "urls": [
      "https://www.vector.com/cn/zh/news/news/",
      "https://www.vector.com/cn/zh/products/solutions/"
    ]
  }
]
```

## fetchAndClean Skill

位置：

- [fetchAndClean.ts](/home/openclaw-ubuntu-zyb/biz-insight-mvp/lib/skill/fetchAndClean.ts)

接口：

```ts
fetchAndClean(companyName, urls, keywords)
```

返回：

```ts
type CleanedData = {
  url: string;
  company: string;
  title: string;
  clean_text: string;
  matched_keywords: string[];
  fetched_at: string;
};
```

这层不依赖 Next 页面，可以单独被：

- OpenClaw skill 调用
- 其他 agent 调用
- 后端脚本调用
- 洞察网站调用

## 本地运行

### 1. 安装依赖

```bash
npm install
npx playwright install chromium
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env.local` 并填写：

```env
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
APP_BASE_URL="http://localhost:3000"
PLAYWRIGHT_HEADLESS="true"
```

### 3. 运行一次抓取

抓所有公司：

```bash
npm run crawl
```

抓单个公司：

```bash
npm run crawl -- --company=i-soft
```

### 4. 启动 Dashboard

```bash
npm run dev
```

访问：

- `http://localhost:3000`
- `http://localhost:3000/company/i-soft`
- `http://localhost:3000/report/i-soft`

### 5. 导出 PDF

启动站点后调用：

```bash
curl http://localhost:3000/api/report/i-soft
```

PDF 会输出到：

- `outputs/pdf/`

## Windows 10 命令

```powershell
cd D:\path\to\biz-insight-mvp
npm install
npx playwright install chromium
copy .env.example .env.local
npm run crawl -- --company=i-soft
npm run dev
```

## 当前设计边界

- 目标 URL 由你维护，不依赖广域搜索
- 抓公开网页
- 支持 JS 渲染
- SQLite 为 MVP 默认存储
- 后续如需迁移 Postgres，可保留表结构迁移

## 后续扩展建议

1. 给 `playwrightCrawl` 增加 robots / rate limit 控制
2. 将 `cleanText` 增强为正文抽取模板
3. 将 `fetchAndClean` 包装成 OpenClaw skill 或 MCP tool
4. 对接 sitemap / RSS 自动发现新 URL
