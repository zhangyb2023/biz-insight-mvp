import { fetchAndClean } from "@/lib/skill/fetchAndClean";

async function main() {
  const company = process.argv[2] || "Benchmark";
  const keywords = (process.argv[3] || "news,product,合作").split(",").map((item) => item.trim()).filter(Boolean);
  const urls = process.argv.slice(4);

  if (!urls.length) {
    throw new Error("Usage: npm run bench -- <company> <comma-keywords> <url1> <url2> ...");
  }

  const startedAt = Date.now();
  const output = await fetchAndClean(company, urls, keywords, {
    concurrency: 3,
    timeoutMs: 30000,
    useCache: true
  });
  console.log(
    JSON.stringify(
      {
        elapsedMs: Date.now() - startedAt,
        ok: output.ok,
        stats: output.stats,
        errors: output.errors,
        count: output.results.length,
        results: output.results.map((item) => ({
          url: item.url,
          title: item.title,
          matched_keywords: item.matched_keywords,
          preview: item.clean_text.slice(0, 320),
          extracted_items: item.extracted_items?.slice(0, 3)
        }))
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
