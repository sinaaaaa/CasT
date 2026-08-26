-- Teacher can re-queue a completed item for practice without erasing attempt history.
CREATE TABLE IF NOT EXISTS "LevelStudentReplayRequest" (
  "id" TEXT NOT NULL,
  "levelId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "requestedByTeacherId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LevelStudentReplayRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LevelStudentReplayRequest_levelId_studentId_key"
  ON "LevelStudentReplayRequest"("levelId", "studentId");

CREATE INDEX IF NOT EXISTS "LevelStudentReplayRequest_studentId_idx"
  ON "LevelStudentReplayRequest"("studentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LevelStudentReplayRequest_levelId_fkey'
  ) THEN
    ALTER TABLE "LevelStudentReplayRequest"
      ADD CONSTRAINT "LevelStudentReplayRequest_levelId_fkey"
      FOREIGN KEY ("levelId") REFERENCES "Level"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LevelStudentReplayRequest_studentId_fkey'
  ) THEN
    ALTER TABLE "LevelStudentReplayRequest"
      ADD CONSTRAINT "LevelStudentReplayRequest_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LevelStudentReplayRequest_requestedByTeacherId_fkey'
  ) THEN
    ALTER TABLE "LevelStudentReplayRequest"
      ADD CONSTRAINT "LevelStudentReplayRequest_requestedByTeacherId_fkey"
      FOREIGN KEY ("requestedByTeacherId") REFERENCES "TeacherProfile"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
