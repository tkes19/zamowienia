-- Migracja: Presety terminów dostawy zamówień (OrderDeliveryPreset)
-- Data: 2025-12-10
-- Autor: Cascade

-- ============================================
-- 1. Tabela OrderDeliveryPreset
-- ============================================

CREATE TABLE IF NOT EXISTS public."OrderDeliveryPreset" (
  id serial PRIMARY KEY,
  label text NOT NULL,
  "offsetDays" integer NOT NULL,
  "isDefault" boolean NOT NULL DEFAULT false,
  "isActive" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OrderDeliveryPreset_active_idx"
  ON public."OrderDeliveryPreset"("isActive")
  WHERE "isActive" = true;

CREATE INDEX IF NOT EXISTS "OrderDeliveryPreset_sort_idx"
  ON public."OrderDeliveryPreset"("sortOrder", "offsetDays");

-- ============================================
-- 2. Domyślne presety SLA dla zakładu produkcyjnego
-- ============================================

-- Ekspres (2 dni)
INSERT INTO public."OrderDeliveryPreset" (label, "offsetDays", "isDefault", "isActive", "sortOrder")
SELECT 'Ekspres (2 dni)', 2, false, true, 10
WHERE NOT EXISTS (
  SELECT 1 FROM public."OrderDeliveryPreset" WHERE "offsetDays" = 2 AND label = 'Ekspres (2 dni)'
);

-- Standard (5 dni) – domyślny
INSERT INTO public."OrderDeliveryPreset" (label, "offsetDays", "isDefault", "isActive", "sortOrder")
SELECT 'Standard (5 dni)', 5, true, true, 20
WHERE NOT EXISTS (
  SELECT 1 FROM public."OrderDeliveryPreset" WHERE "offsetDays" = 5 AND label = 'Standard (5 dni)'
);

-- Duże nakłady (10 dni)
INSERT INTO public."OrderDeliveryPreset" (label, "offsetDays", "isDefault", "isActive", "sortOrder")
SELECT 'Duże nakłady (10 dni)', 10, false, true, 30
WHERE NOT EXISTS (
  SELECT 1 FROM public."OrderDeliveryPreset" WHERE "offsetDays" = 10 AND label = 'Duże nakłady (10 dni)'
);

-- ============================================
-- 3. Komentarze dokumentacyjne
-- ============================================

COMMENT ON TABLE public."OrderDeliveryPreset" IS 'Konfigurowalne presety terminów dostawy zamówień (SLA) dla formularza zamówień.';
COMMENT ON COLUMN public."OrderDeliveryPreset".label IS 'Etykieta widoczna w formularzu, np. Standard (5 dni).';
COMMENT ON COLUMN public."OrderDeliveryPreset"."offsetDays" IS 'Liczba dni kalendarzowych od dziś, używana do wyliczenia daty dostawy.';
COMMENT ON COLUMN public."OrderDeliveryPreset"."isDefault" IS 'Czy preset jest domyślny (ustawiany automatycznie po wejściu w formularz).';
COMMENT ON COLUMN public."OrderDeliveryPreset"."isActive" IS 'Czy preset jest aktywny i widoczny w formularzu.';
COMMENT ON COLUMN public."OrderDeliveryPreset"."sortOrder" IS 'Kolejność wyświetlania presetów w formularzu (niższa wartość = wyżej).';
