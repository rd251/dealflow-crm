
-- Move records on old statuses
UPDATE salgsmuligheter SET status = 'Løsning presentert' WHERE status IN ('Tilbud sendt', 'Beslutning', 'Demo gjennomført', 'Forhandling', 'Ny mulighet');

-- Drop default before type swap
ALTER TABLE salgsmuligheter ALTER COLUMN status DROP DEFAULT;

-- Rename old enum
ALTER TYPE salgsmulighet_status RENAME TO salgsmulighet_status_old;

-- Create new enum with only the valid values
CREATE TYPE salgsmulighet_status AS ENUM (
  'Møte booket',
  'Behov avklart',
  'Løsning presentert',
  'Kontrakt sendt',
  'Vunnet',
  'Tapt'
);

-- Convert column to new enum
ALTER TABLE salgsmuligheter
  ALTER COLUMN status TYPE salgsmulighet_status USING status::text::salgsmulighet_status;

-- Re-add default
ALTER TABLE salgsmuligheter ALTER COLUMN status SET DEFAULT 'Møte booket'::salgsmulighet_status;

-- Drop old enum
DROP TYPE salgsmulighet_status_old;
