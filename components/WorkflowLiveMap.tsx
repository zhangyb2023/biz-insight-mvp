type StepStatus = "idle" | "running" | "success" | "failed" | "fallback" | "skipped";

type Props = {
  currentStepKey?: string;
  stepStates?: Record<string, StepStatus>;
  compact?: boolean;
  nodeHrefMap?: Partial<Record<(typeof nodes)[number]["key"], string>>;
};

const nodes = [
  { key: "url_resolve", label: "1. URL 解析", tool: "source resolver", module: "lib/search/searchUrls.ts", x: 16, y: 20 },
  { key: "page_fetch", label: "2. 页面抓取", tool: "Playwright + Chromium", module: "lib/crawl/playwrightCrawl.ts", x: 154, y: 20 },
  { key: "html_capture", label: "3. HTML 获取", tool: "playwright page html", module: "lib/crawl/playwrightCrawl.ts", x: 292, y: 20 },
  { key: "clean_text", label: "4. 正文清洗", tool: "Readability + Cheerio", module: "lib/clean/cleanText.ts", x: 430, y: 20 },
  { key: "list_extract", label: "5. 列表提取", tool: "custom extractor", module: "lib/clean/cleanText.ts", x: 568, y: 20 },
  { key: "keyword_match", label: "6. 关键词匹配", tool: "rule matcher", module: "lib/clean/cleanText.ts", x: 16, y: 146 },
  { key: "llm_analysis", label: "7. LLM 分析", tool: "DeepSeek", module: "lib/analyze/deepSeek.ts", x: 154, y: 146 },
  { key: "json_structured", label: "8. JSON 结构化", tool: "schema shaping", module: "pages/api/learn/run.ts", x: 292, y: 146 },
  { key: "database_upsert", label: "9. 数据入库", tool: "SQLite repository", module: "lib/db/repository.ts", x: 430, y: 146 },
  { key: "aggregate_display", label: "10. 消费层", tool: "result access layer", module: "pages/jobs/[id].tsx", x: 568, y: 146 }
] as const;

const edges: Array<[string, string]> = [
  ["url_resolve", "page_fetch"],
  ["page_fetch", "html_capture"],
  ["html_capture", "clean_text"],
  ["clean_text", "list_extract"],
  ["list_extract", "keyword_match"],
  ["keyword_match", "llm_analysis"],
  ["llm_analysis", "json_structured"],
  ["json_structured", "database_upsert"],
  ["database_upsert", "aggregate_display"]
];

function styleFor(status: StepStatus, active: boolean) {
  if (active) return { fill: "#ecfeff", stroke: "#0f766e", strokeWidth: 2.5 };
  if (status === "success") return { fill: "#f0fdf4", stroke: "#16a34a", strokeWidth: 1.8 };
  if (status === "failed") return { fill: "#fef2f2", stroke: "#dc2626", strokeWidth: 1.8 };
  if (status === "fallback") return { fill: "#fff7ed", stroke: "#ea580c", strokeWidth: 1.8 };
  if (status === "running") return { fill: "#eff6ff", stroke: "#2563eb", strokeWidth: 2.2 };
  if (status === "skipped") return { fill: "#f8fafc", stroke: "#94a3b8", strokeWidth: 1.5 };
  return { fill: "#ffffff", stroke: "#cbd5e1", strokeWidth: 1.2 };
}

function centerFor(key: string) {
  const node = nodes.find((item) => item.key === key)!;
  return { x: node.x + 62, y: node.y + 24 };
}

export function WorkflowLiveMap({ currentStepKey, stepStates = {}, compact = false, nodeHrefMap = {} }: Props) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-slate-50 p-4">
      <svg viewBox={`0 0 700 ${compact ? 248 : 266}`} className="min-w-[700px]">
        <defs>
          <marker id="flow-arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
          </marker>
        </defs>
        {edges.map(([from, to]) => {
          const start = centerFor(from);
          const end = centerFor(to);
          return (
            <line
              key={`${from}-${to}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#94a3b8"
              strokeWidth="1.8"
              markerEnd="url(#flow-arrow)"
            />
          );
        })}
        {nodes.map((node) => {
          const styles = styleFor(stepStates[node.key] ?? "idle", currentStepKey === node.key);
          const href = nodeHrefMap[node.key];
          return (
            <g key={node.key}>
              {href ? (
                <a href={href}>
                  <rect x={node.x} y={node.y} width="124" height="54" rx="12" fill={styles.fill} stroke={styles.stroke} strokeWidth={styles.strokeWidth} />
                  <text x={node.x + 62} y={node.y + 17} textAnchor="middle" fontSize="10.8" fontWeight="700" fill="#0f172a">
                    {node.label}
                  </text>
                  <text x={node.x + 62} y={node.y + 31} textAnchor="middle" fontSize="8.8" fontWeight="500" fill="#475569">
                    {node.tool}
                  </text>
                  <text x={node.x + 62} y={node.y + 43} textAnchor="middle" fontSize="7.6" fontWeight="500" fill="#64748b">
                    {node.module}
                  </text>
                </a>
              ) : (
                <>
                  <rect x={node.x} y={node.y} width="124" height="54" rx="12" fill={styles.fill} stroke={styles.stroke} strokeWidth={styles.strokeWidth} />
                  <text x={node.x + 62} y={node.y + 17} textAnchor="middle" fontSize="10.8" fontWeight="700" fill="#0f172a">
                    {node.label}
                  </text>
                  <text x={node.x + 62} y={node.y + 31} textAnchor="middle" fontSize="8.8" fontWeight="500" fill="#475569">
                    {node.tool}
                  </text>
                  <text x={node.x + 62} y={node.y + 43} textAnchor="middle" fontSize="7.6" fontWeight="500" fill="#64748b">
                    {node.module}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
