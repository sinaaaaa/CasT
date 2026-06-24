-- Link teacher copies to the platform default they replace (one customization per teacher per source item).
ALTER TABLE "Level" ADD COLUMN IF NOT EXISTS "customizedFromLevelId" TEXT;

ALTER TABLE "Level"
  ADD CONSTRAINT "Level_customizedFromLevelId_fkey"
  FOREIGN KEY ("customizedFromLevelId") REFERENCES "Level"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Level_customizedFromLevelId_idx" ON "Level"("customizedFromLevelId");

CREATE UNIQUE INDEX IF NOT EXISTS "Level_ownerTeacherId_customizedFromLevelId_key"
  ON "Level"("ownerTeacherId", "customizedFromLevelId")
  WHERE "customizedFromLevelId" IS NOT NULL AND "ownerTeacherId" IS NOT NULL;

-- Backfill existing *_copy teacher items created before customizedFromLevelId existed.
UPDATE "Level" AS copy
SET "customizedFromLevelId" = source.id
FROM "Level" AS source
WHERE copy."ownerTeacherId" IS NOT NULL
  AND source."ownerTeacherId" IS NULL
  AND copy."customizedFromLevelId" IS NULL
  AND copy."levelKey" LIKE source."levelKey" || '_copy%';
