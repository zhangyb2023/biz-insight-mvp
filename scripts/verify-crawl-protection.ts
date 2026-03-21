import { playwrightCrawl } from "@/lib/crawl/playwrightCrawl";
import { defaultCrawlProtectionConfig } from "@/lib/crawl/crawlProtection";

async function verify() {
  console.log("=== Crawl Protection Verification ===\n");
  console.log("Default config:", JSON.stringify(defaultCrawlProtectionConfig, null, 2));
  console.log("\n--- Test 1: Basic crawl (example.com) ---");
  const r1 = await playwrightCrawl(["https://example.com"], { concurrency: 1 });
  console.log("pages:", r1.pages.length);
  console.log("errors:", r1.errors.length);
  console.log("logs:", r1.logs.length);
  console.log("sample log:", JSON.stringify(r1.logs[0], null, 2));

  console.log("\n--- Test 2: Skip recent (immediate re-fetch) ---");
  const r2 = await playwrightCrawl(["https://example.com"], { concurrency: 1 });
  console.log("pages:", r2.pages.length);
  console.log("fromCache:", r2.pages[0]?.fromCache);
  console.log("logs:", r2.logs.length);

  console.log("\n--- Test 3: Invalid URL ---");
  const r3 = await playwrightCrawl(["https://this-domain-does-not-exist-12345.com"], { concurrency: 1 });
  console.log("pages:", r3.pages.length);
  console.log("errors:", r3.errors.length);
  console.log("error code:", r3.errors[0]?.code);

  console.log("\n--- Test 4: Multiple URLs ---");
  const r4 = await playwrightCrawl(["https://example.com", "https://httpbin.org/html"], { concurrency: 1 });
  console.log("pages:", r4.pages.length);
  console.log("errors:", r4.errors.length);
  console.log("logs count:", r4.logs.length);
  console.log("blocked_suspected values:", r4.logs.map(l => l.blocked_suspected));

  console.log("\n=== Verification Complete ===");
}

verify().catch(console.error);
