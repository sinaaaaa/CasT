-- Additive: reset + first touch time on attempts; soft-archive flags.
ALTER TABLE "LevelAttempt" ADD COLUMN IF NOT EXISTS "resetCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LevelAttempt" ADD COLUMN IF NOT EXISTS "firstRobotTouchAt" TIMESTAMP(3);

ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Level" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "StudentProfile_isArchived_idx" ON "StudentProfile"("isArchived");
CREATE INDEX IF NOT EXISTS "Level_isArchived_idx" ON "Level"("isArchived");
