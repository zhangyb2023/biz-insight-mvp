import path from "path";
import { fileURLToPath } from "url";

import { loadEnvConfig } from "@next/env";

import { runCrawlJob } from "@/lib/crawl/runCrawlJob";

loadEnvConfig(path.join(process.cwd()));

async function main() {
  const companyArg = process.argv.find((arg) => arg.startsWith("--company="))?.split("=")[1];
  const result = await runCrawlJob({ companyId: companyArg, triggerType: "manual" });
  console.log(JSON.stringify(result, null, 2));
}

const currentFilePath = fileURLToPath(import.meta.url);
const entryFilePath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (entryFilePath === currentFilePath) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
