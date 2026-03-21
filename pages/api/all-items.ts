import type { NextApiHandler } from "next";
import { getAllInsightItems } from "@/lib/db/repository";

const handler: NextApiHandler = async (req, res) => {
  try {
    const items = getAllInsightItems();
    res.status(200).json({ items, totalCount: items.length });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
};

export default handler;
