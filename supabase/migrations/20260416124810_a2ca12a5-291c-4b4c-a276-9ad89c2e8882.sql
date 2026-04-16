-- Delete duplicates: keep the oldest row per (ekstern_id, ekstern_provider)
DELETE FROM aktiviteter
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY ekstern_id, ekstern_provider
      ORDER BY created_at ASC
    ) as rn
    FROM aktiviteter
    WHERE ekstern_id IS NOT NULL AND ekstern_provider IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_aktiviteter_ekstern_unique
  ON aktiviteter (ekstern_id, ekstern_provider)
  WHERE ekstern_id IS NOT NULL AND ekstern_provider IS NOT NULL;