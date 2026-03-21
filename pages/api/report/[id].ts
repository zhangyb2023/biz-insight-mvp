import fs from "fs/promises";
import path from "path";

import type { NextApiRequest, NextApiResponse } from "next";
import { chromium } from "playwright";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id || "");
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const outputDir = path.join(process.cwd(), "outputs", "pdf");
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${id}-${Date.now()}.pdf`);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/report/${id}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px"
      }
    });
    await page.close();
  } finally {
    await browser.close();
  }

  res.status(200).json({
    ok: true,
    path: outputPath
  });
}
