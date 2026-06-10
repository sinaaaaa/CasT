import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [levels, students, attempts] = await Promise.all([
    prisma.level.count(),
    prisma.studentProfile.count(),
    prisma.levelAttempt.count(),
  ]);
  const list = await prisma.level.findMany({
    select: { levelKey: true, name: true, orderIndex: true },
    orderBy: { orderIndex: "asc" },
  });
  console.log({ levels, students, attempts });
  console.log(list);
}

main()
  .finally(() => prisma.$disconnect());
