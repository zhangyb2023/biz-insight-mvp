const TARGET_URLS = [
  "https://intelligentautomotive.huawei.com/",
  "https://intelligentautomotive.huawei.com/cn/solutions/",
  "https://intelligentautomotive.huawei.com/cn/news/"
];

async function main() {
  for (const url of TARGET_URLS) {
    console.log(`\n=== Fetching: ${url} ===`);
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow"
      });
      console.log("status:", response.status);
      console.log("finalUrl:", response.url);
      console.log("headers:");
      for (const key of ["content-type", "server", "location", "cache-control", "content-length"]) {
        console.log(`  ${key}:`, response.headers.get(key));
      }
    } catch (error) {
      console.log("status:", null);
      console.log("finalUrl:", null);
      console.log("error:", error);
    }
  }
}

main().catch((error) => {
  console.error("fatal:", error);
  process.exit(1);
});
