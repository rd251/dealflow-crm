-- Add new enum values
ALTER TYPE salgsmulighet_status ADD VALUE IF NOT EXISTS 'Behov avklart';
ALTER TYPE salgsmulighet_status ADD VALUE IF NOT EXISTS 'Løsning presentert';
ALTER TYPE salgsmulighet_status ADD VALUE IF NOT EXISTS 'Beslutning';
