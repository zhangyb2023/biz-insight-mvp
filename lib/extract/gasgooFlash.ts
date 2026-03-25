import * as cheerio from "cheerio";

export type GasgooFlashItem = {
  title: string;
  url: string;
  publishDate: string;
  content: string;
};

export type ParseGasgooFlashResult = {
  items: GasgooFlashItem[];
  pageKind: "list";
};

export function parseGasgooFlashPage(html: string, baseUrl: string = "https://auto.gasgoo.com"): ParseGasgooFlashResult {
  const $ = cheerio.load(html);
  const items: GasgooFlashItem[] = [];

  $("#flashList li").each((_, element) => {
    const root = $(element);
    
    const titleEl = root.find("b a").first();
    const title = titleEl.text().trim();
    const url = titleEl.attr("href") || "";
    
    const dateDiv = root.find(".quInfo div").first().text().trim();
    
    const contentSpan = root.find(".quCon span").first();
    const content = contentSpan.text().trim();
    
    if (title && content) {
      items.push({
        title,
        url: url.startsWith("http") ? url : baseUrl + url,
        publishDate: dateDiv,
        content
      });
    }
  });

  return {
    items,
    pageKind: "list"
  };
}

export function isGasgooFlashPage(url: string): boolean {
  return /auto\.gasgoo\.com\/newsflash\/flashnews/.test(url);
}