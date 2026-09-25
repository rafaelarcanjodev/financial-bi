import fs from "node:fs/promises";
import path from "node:path";
import type { MasterData } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "master.json");
const EXAMPLE_PATH = path.join(process.cwd(), "data", "master.example.json");

export async function loadMasterData(): Promise<MasterData> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    return JSON.parse(raw) as MasterData;
  } catch {
    const raw = await fs.readFile(EXAMPLE_PATH, "utf-8");
    return JSON.parse(raw) as MasterData;
  }
}
