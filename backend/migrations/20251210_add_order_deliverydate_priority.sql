-- 2025-12-10
-- Migracja: dodanie pól deliveryDate i priority do tabeli public."Order"
-- UWAGA: typy zgodne z aktualną bazą Supabase (timestamptz, integer)

ALTER TABLE public."Order"
  ADD COLUMN IF NOT EXISTS "deliveryDate" timestamptz;

ALTER TABLE public."Order"
  ADD COLUMN IF NOT EXISTS "priority" integer NOT NULL DEFAULT 3;
