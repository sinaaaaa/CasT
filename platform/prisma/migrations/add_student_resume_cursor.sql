-- Student playlist bookmark: Play next after last finished item (pass or fail-continue).
ALTER TABLE "StudentProfile"
  ADD COLUMN IF NOT EXISTS "resumeLevelKey" TEXT,
  ADD COLUMN IF NOT EXISTS "resumeSlot" INTEGER;
