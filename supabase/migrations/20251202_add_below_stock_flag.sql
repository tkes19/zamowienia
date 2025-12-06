-- Dodaj pola oznaczające pozycje poniżej stanu magazynowego
-- stockAtOrder: stan magazynu widziany w momencie składania zamówienia
-- belowStock: flaga czy ilość w pozycji przekraczała ten stan

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "stockAtOrder" integer;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "belowStock" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "OrderItem"."stockAtOrder" IS 'Stan magazynu produktu w momencie tworzenia zamówienia (widoczny dla handlowca).';
COMMENT ON COLUMN "OrderItem"."belowStock" IS 'Czy ilość w pozycji zamówienia była poniżej stanu magazynowego w momencie składania zamówienia.';
