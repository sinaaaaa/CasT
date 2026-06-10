import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { exportItemsDataset } from "../src/lib/items-dataset";

const prisma = new PrismaClient();

async function main() {
  const dataset = await exportItemsDataset();
  const dir = join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = join(dir, `sparc-items-dataset-${stamp}.json`);
  writeFileSync(file, JSON.stringify(dataset, null, 2), "utf8");
  console.log(`Saved ${dataset.itemCount} items to ${file}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
