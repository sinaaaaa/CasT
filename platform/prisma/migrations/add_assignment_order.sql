ALTER TABLE "LevelStudentAssignment"
ADD COLUMN IF NOT EXISTS "assignmentOrder" INTEGER NOT NULL DEFAULT 0;

-- Backfill from catalog order for existing rows
UPDATE "LevelStudentAssignment" AS lsa
SET "assignmentOrder" = l."orderIndex"
FROM "Level" AS l
WHERE lsa."levelId" = l.id;
