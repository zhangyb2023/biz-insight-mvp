import type { CrawlPage } from "@/lib/types";

export type CrawlStrategy = {
  name: string;
  displayName: string;
  description: string;
  urlPatterns: RegExp[];
  crawl: (url: string, options?: CrawlStrategyOptions) => Promise<CrawlStrategyResult>;
};

export type CrawlStrategyOptions = {
  useCache?: boolean;
  forceRefresh?: boolean;
  pages?: number[];
};

export type CrawlStrategyResult = {
  success: boolean;
  page?: CrawlPage;
  extractedItems?: ExtractedItem[];
  error?: string;
};

export type ExtractedItem = {
  title: string;
  translatedTitle?: string;
  url?: string;
  date?: string;
  summary?: string;
  translatedSummary?: string;
  content?: string;
};

export type StrategyRegistry = {
  strategies: CrawlStrategy[];
  findStrategy: (url: string) => CrawlStrategy | null;
  getStrategiesForCompany: (companyId: string) => CrawlStrategy[];
};

export function createStrategyRegistry(strategies: CrawlStrategy[]): StrategyRegistry {
  return {
    strategies,
    findStrategy: (url: string) => {
      for (const strategy of strategies) {
        for (const pattern of strategy.urlPatterns) {
          if (pattern.test(url)) {
            return strategy;
          }
        }
      }
      return null;
    },
    getStrategiesForCompany: (companyId: string) => {
      return strategies;
    }
  };
}
