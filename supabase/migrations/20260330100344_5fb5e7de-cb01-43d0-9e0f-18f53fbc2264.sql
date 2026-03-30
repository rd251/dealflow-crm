-- Migrate existing data from old to new statuses
UPDATE salgsmuligheter SET status = 'Behov avklart' WHERE status = 'Ny mulighet';
UPDATE salgsmuligheter SET status = 'Løsning presentert' WHERE status = 'Demo gjennomført';
UPDATE salgsmuligheter SET status = 'Beslutning' WHERE status = 'Forhandling';
