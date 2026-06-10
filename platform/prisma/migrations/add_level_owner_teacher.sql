-- Per-teacher item ownership. null owner = platform-shared (intro, seed levels).
ALTER TABLE "Level" ADD COLUMN IF NOT EXISTS "ownerTeacherId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Level_ownerTeacherId_fkey'
  ) THEN
    ALTER TABLE "Level"
      ADD CONSTRAINT "Level_ownerTeacherId_fkey"
      FOREIGN KEY ("ownerTeacherId") REFERENCES "TeacherProfile"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Level_ownerTeacherId_idx" ON "Level"("ownerTeacherId");
