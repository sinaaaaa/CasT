import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { importItemsDataset } from "../src/lib/items-dataset";

const prisma = new PrismaClient();

function resolveBackupFile(arg?: string): string {
  if (arg) return arg;
  const dir = join(process.cwd(), "backups");
  const files = readdirSync(dir)
    .filter((f) => f.startsWith("sparc-items-dataset-") && f.endsWith(".json"))
    .sort()
    .reverse();
  if (files.length === 0) {
    throw new Error("No backup files in platform/backups/. Run: npm run db:backup-items");
  }
  return join(dir, files[0]!);
}

async function main() {
  const file = resolveBackupFile(process.argv[2]);
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const removeMissing = process.argv.includes("--replace");
  const result = await importItemsDataset(raw, { removeMissing });
  console.log(
    `Restored ${result.imported} items from ${file}${removeMissing ? " (removed items not in backup)" : ""}`
  );
  console.log(`Level keys: ${result.levelKeys.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
