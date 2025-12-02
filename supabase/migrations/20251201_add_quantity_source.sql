-- Dodaj kolumnę quantity_source do OrderItem
-- Określa źródło prawdy dla ilości: 'total' (suma) lub 'perProject' (ilości na projekt)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "quantitySource" text DEFAULT 'total';

-- Dodaj komentarz
COMMENT ON COLUMN "OrderItem"."quantitySource" IS 'Źródło prawdy dla ilości: total = suma była wprowadzona, perProject = ilości na projekt były wprowadzone';
