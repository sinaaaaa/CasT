-- Additive migration: ECD stealth assessment results (does not alter existing tables' data).
-- Run manually: psql $DATABASE_URL -f prisma/migrations/add_stealth_assessment_result.sql

CREATE TABLE IF NOT EXISTS "StealthAssessmentResult" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "levelId" TEXT NOT NULL,
  "assessmentVersion" TEXT NOT NULL DEFAULT 'v1',
  "overallScore" INTEGER NOT NULL,
  "overallMastery" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 70,
  "taskType" TEXT NOT NULL,
  "constructScores" JSONB NOT NULL,
  "evidence" JSONB NOT NULL,
  "routeAnalysis" JSONB,
  "teacherSummary" JSONB NOT NULL,
  "recommendations" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StealthAssessmentResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StealthAssessmentResult_attemptId_key"
  ON "StealthAssessmentResult"("attemptId");

CREATE INDEX IF NOT EXISTS "StealthAssessmentResult_studentId_levelId_idx"
  ON "StealthAssessmentResult"("studentId", "levelId");

CREATE INDEX IF NOT EXISTS "StealthAssessmentResult_levelId_idx"
  ON "StealthAssessmentResult"("levelId");

CREATE INDEX IF NOT EXISTS "StealthAssessmentResult_assessmentVersion_idx"
  ON "StealthAssessmentResult"("assessmentVersion");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StealthAssessmentResult_attemptId_fkey'
  ) THEN
    ALTER TABLE "StealthAssessmentResult"
      ADD CONSTRAINT "StealthAssessmentResult_attemptId_fkey"
      FOREIGN KEY ("attemptId") REFERENCES "LevelAttempt"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
