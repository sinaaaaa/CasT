-- Additive: soft-active direct student level assignments (preserve history).
ALTER TABLE "LevelStudentAssignment"
  ADD COLUMN IF NOT EXISTS "assignedByTeacherId" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "deactivatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LevelStudentAssignment_studentId_isActive_idx"
  ON "LevelStudentAssignment"("studentId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LevelStudentAssignment_assignedByTeacherId_fkey'
  ) THEN
    ALTER TABLE "LevelStudentAssignment"
      ADD CONSTRAINT "LevelStudentAssignment_assignedByTeacherId_fkey"
      FOREIGN KEY ("assignedByTeacherId") REFERENCES "TeacherProfile"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
