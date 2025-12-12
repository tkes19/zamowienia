-- Migracja: rozszerzenie OrderDeliveryPreset o tryb OFFSET/FIXED_DATE i pole fixedDate
-- Data: 2025-12-10
-- Autor: Cascade

-- ============================================
-- 1. Dodanie kolumn mode i fixedDate
-- ============================================

ALTER TABLE public."OrderDeliveryPreset"
  ADD COLUMN IF NOT EXISTS "mode" text NOT NULL DEFAULT 'OFFSET',
  ADD COLUMN IF NOT EXISTS "fixedDate" date;

-- Upewnij się, że wszystkie istniejące rekordy mają tryb OFFSET
UPDATE public."OrderDeliveryPreset"
SET "mode" = 'OFFSET'
WHERE "mode" IS NULL;

-- ============================================
-- 2. (Opcjonalnie) komentarze dokumentacyjne
-- ============================================

COMMENT ON COLUMN public."OrderDeliveryPreset"."mode" IS 'Tryb działania preset-u: OFFSET (od dzisiaj + offsetDays) lub FIXED_DATE (konkretna data).';
COMMENT ON COLUMN public."OrderDeliveryPreset"."fixedDate" IS 'Stała data kalendarzowa dla presetów typu FIXED_DATE (YYYY-MM-DD).';
