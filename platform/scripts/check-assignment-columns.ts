import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'LevelStudentAssignment'
     ORDER BY 1`
  );
  console.log(
    "LevelStudentAssignment columns:",
    cols.map((c) => c.column_name).join(", ")
  );
  const hasOrder = cols.some((c) => c.column_name === "assignmentOrder");
  const hasActive = cols.some((c) => c.column_name === "isActive");
  console.log({ hasOrder, hasActive });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
