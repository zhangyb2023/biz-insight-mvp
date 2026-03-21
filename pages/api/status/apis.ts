import type { NextApiRequest, NextApiResponse } from "next";
import { getAllApiStatus } from "@/lib/api/apiStatus";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const status = await getAllApiStatus();
    res.status(200).json({ apis: status, checkedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}
