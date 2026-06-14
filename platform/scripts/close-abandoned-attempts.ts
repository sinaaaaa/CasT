import { PrismaClient, AttemptStatus } from "@prisma/client";

const prisma = new PrismaClient();

/** Close open attempts that never received level-end (shows as Incomplete in dashboard). */
async function main() {
  const result = await prisma.levelAttempt.updateMany({
    where: { endedAt: null },
    data: { endedAt: new Date(), status: AttemptStatus.INCOMPLETE },
  });
  console.log(`Closed ${result.count} abandoned attempt(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
