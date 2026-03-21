/**
 * Crawl Protection Module - Anti-blocking/Rate-limiting Layer
 * 
 * === 入口 ===
 * import { defaultCrawlProtectionConfig, ... } from '@/lib/crawl/crawlProtection';
 * 
 * === 默认参数 ===
 * {
 *   domainConcurrency: 1,       // 同域名并发请求数
 *   domainDelayMinMs: 3000,     // 请求间隔随机下限 (ms)
 *   domainDelayMaxMs: 8000,     // 请求间隔随机上限 (ms)
 *   maxRetryCount: 3,           // 最大重试次数
 *   retryDelayBaseMs: 1000,    // 重试基础延迟，指数退避 2^retryCount
 *   skipRecentHours: 24,       // 24小时内跳过重复抓取
 *   enableRobotsCheck: true     // 是否检查 robots.txt
 * }
 * 
 * === skipRecentHours 与 24h cache TTL 的关系 ===
 * - skipRecentHours: 保护层逻辑，检查 "最近 24h 内是否 fetch 过？"
 *   - 如果是，且 < skipRecentHours，返回 fromCache=true，不发起实际请求
 * - cacheMaxAgeHours: 原有业务层 cache TTL，控制 "cached 数据是否仍有效？"
 *   - 如果是，返回 cache 但标记为 stale
 * - 两者为并行关系，都基于 fetchedAt 时间戳判断，共享缓存文件
 * 
 * === 当前最小实现边界 ===
 * ✓ domain 并发控制 (单进程内存 Map)
 * ✓ 请求间隔随机延迟
 * ✓ 失败重试 + 指数退避
 * ✓ 近期 URL 跳过
 * ✓ robots.txt 基础解析
 * ✓ 增强日志 (domain/status_code/retry_count/blocked_suspected/fetched_at)
 * 
 * === 留给 Codex 的后续收口项 ===
 * - logs 持久化 (当前仅返回，需存库)
 * - 多进程/多实例状态共享 (当前用内存 Map)
 * - robots.txt 的 Crawl-delay 支持
 * - 动态配置暴露 (UI/API)
 * - blocked_suspected 告警机制
 */

export type CrawlProtectionConfig = {
  domainConcurrency: number;
  domainDelayMinMs: number;
  domainDelayMaxMs: number;
  maxRetryCount: number;
  retryDelayBaseMs: number;
  skipRecentHours: number;
  enableRobotsCheck: boolean;
};

export const defaultCrawlProtectionConfig: CrawlProtectionConfig = {
  domainConcurrency: 1,
  domainDelayMinMs: 3000,
  domainDelayMaxMs: 8000,
  maxRetryCount: 3,
  retryDelayBaseMs: 1000,
  skipRecentHours: 24,
  enableRobotsCheck: true
};

export type CrawlLogEntry = {
  domain: string;
  url: string;
  status_code: number;
  retry_count: number;
  blocked_suspected: boolean;
  fetched_at: string;
  error?: string;
};

const domainLastRequestTime: Map<string, number> = new Map();
const domainCurrentCount: Map<string, number> = new Map();
const robotsCache: Map<string, { rules: Set<string>; cachedAt: number }> = new Map();
const ROBOTS_CACHE_TTL = 3600000;

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase();
  } catch {
    return "";
  }
}

export async function waitForDomainConcurrency(domain: string, config: CrawlProtectionConfig): Promise<void> {
  const current = domainCurrentCount.get(domain) || 0;
  if (current >= config.domainConcurrency) {
    const waitMs = 500 + Math.random() * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    await waitForDomainConcurrency(domain, config);
    return;
  }
  domainCurrentCount.set(domain, current + 1);
}

export function releaseDomainConcurrency(domain: string): void {
  const current = domainCurrentCount.get(domain) || 0;
  if (current > 0) {
    domainCurrentCount.set(domain, current - 1);
  }
}

export async function waitForDomainDelay(domain: string, config: CrawlProtectionConfig): Promise<void> {
  const lastTime = domainLastRequestTime.get(domain);
  const now = Date.now();
  
  if (lastTime) {
    const minDelay = config.domainDelayMinMs;
    const maxDelay = config.domainDelayMaxMs;
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    const elapsed = now - lastTime;
    
    if (elapsed < delay) {
      await new Promise((resolve) => setTimeout(resolve, delay - elapsed));
    }
  }
  
  domainLastRequestTime.set(domain, Date.now());
}

export function shouldSkipRecent(url: string, lastFetchedAt: string | null | undefined, config: CrawlProtectionConfig): boolean {
  if (!lastFetchedAt) return false;
  
  const fetchedAtMs = Date.parse(lastFetchedAt);
  if (!Number.isFinite(fetchedAtMs)) return false;
  
  const hoursSince = (Date.now() - fetchedAtMs) / (1000 * 60 * 60);
  return hoursSince < config.skipRecentHours;
}

export function isBlockedStatus(statusCode: number): boolean {
  return statusCode === 429 || statusCode === 403 || statusCode === 503;
}

export function isBlockedContent(html: string | undefined, statusCode: number): boolean {
  if (!html) return false;
  
  if (statusCode !== 200) return false;
  
  const lowerHtml = html.toLowerCase();
  const blockedKeywords = [
    "access denied",
    "access denied",
    "captcha",
    "challenge",
    "blocked",
    "rate limit",
    "too many requests",
    "please wait",
    "禁止访问",
    "访问受限",
    "请稍后再试",
    "验证码"
  ];
  
  return blockedKeywords.some((keyword) => lowerHtml.includes(keyword.toLowerCase()));
}

export function calculateRetryDelay(retryCount: number, baseMs: number, responseRetryAfter?: number): number {
  if (responseRetryAfter && responseRetryAfter > 0) {
    return responseRetryAfter * 1000;
  }
  
  return baseMs * Math.pow(2, retryCount);
}

export async function fetchRobotsTxt(domain: string): Promise<Set<string>> {
  const cached = robotsCache.get(domain);
  if (cached && Date.now() - cached.cachedAt < ROBOTS_CACHE_TTL) {
    return cached.rules;
  }
  
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BizInsightCrawler/1.0)"
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return new Set();
    }
    
    const text = await response.text();
    const disallowed = new Set<string>();
    
    const lines = text.split("\n");
    let userAgent = "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      const lowerLine = trimmed.toLowerCase();
      
      if (lowerLine.startsWith("user-agent:")) {
        userAgent = trimmed.substring(11).trim().toLowerCase();
      } else if (lowerLine.startsWith("disallow:") && userAgent === "*") {
        const path = trimmed.substring(9).trim();
        if (path) {
          disallowed.add(path);
        }
      }
    }
    
    robotsCache.set(domain, { rules: disallowed, cachedAt: Date.now() });
    return disallowed;
  } catch {
    return new Set();
  }
}

export function isAllowedByRobots(url: string, rules: Set<string>): boolean {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname || "/";
    
    for (const rule of rules) {
      if (rule === "/" || rule === "") {
        continue;
      }
      
      if (rule.endsWith("$")) {
        const exactPath = rule.slice(0, -1);
        if (path === exactPath) {
          return false;
        }
      } else if (path.startsWith(rule)) {
        return false;
      }
    }
    
    return true;
  } catch {
    return true;
  }
}

export function createCrawlLogEntry(params: {
  url: string;
  statusCode: number;
  retryCount: number;
  blockedSuspected: boolean;
  error?: string;
}): CrawlLogEntry {
  return {
    domain: extractDomain(params.url),
    url: params.url,
    status_code: params.statusCode,
    retry_count: params.retryCount,
    blocked_suspected: params.blockedSuspected,
    fetched_at: new Date().toISOString(),
    error: params.error
  };
}
