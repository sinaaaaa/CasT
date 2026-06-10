-- Run before `prisma db push` after removing DRAG_VISIT_OBJECTS from schema.
-- Converts any levels still using the old enum value to DRAG_ACTIONS + visitObjectSequence.

UPDATE "Level"
SET
  "levelType" = 'DRAG_ACTIONS',
  "config" = jsonb_set(
    COALESCE("config"::jsonb, '{}'::jsonb),
    '{visitObjectSequence}',
    'true'::jsonb,
    true
  )
WHERE "levelType" = 'DRAG_VISIT_OBJECTS';
