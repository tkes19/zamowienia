-- Migracja: Słownik typów operacji produkcyjnych
-- Data: 2025-12-11
-- Autor: Cascade

CREATE TABLE IF NOT EXISTS public."OperationType" (
  id serial PRIMARY KEY,
  code varchar(50) NOT NULL,
  name varchar(100) NOT NULL,
  description text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationType_code_unique" UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS "OperationType_code_idx"
  ON public."OperationType" USING btree (code);

CREATE INDEX IF NOT EXISTS "OperationType_isActive_idx"
  ON public."OperationType" USING btree ("isActive");

-- Funkcja i trigger do automatycznej aktualizacji updatedAt
CREATE OR REPLACE FUNCTION public.update_operation_type_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "OperationType_updated_at_trigger" ON public."OperationType";
CREATE TRIGGER "OperationType_updated_at_trigger"
    BEFORE UPDATE ON public."OperationType"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_operation_type_updated_at();

-- Dane startowe na podstawie dotychczasowej stałej OPERATION_TYPES w admin/admin.js
INSERT INTO public."OperationType" (code, name, description, "isActive")
VALUES
  ('solvent', 'Solvent', 'Druk solventowy', true),
  ('laser_co2', 'Laser CO2', 'Grawerowanie / cięcie laserem CO2', true),
  ('laser_fiber', 'Laser Fiber', 'Grawerowanie / cięcie laserem fiber', true),
  ('uv_print', 'Druk UV', 'Druk UV na płaskich powierzchniach', true),
  ('sublimation', 'Sublimacja', 'Druk sublimacyjny', true),
  ('assembly', 'Montaż', 'Montaż elementów / podzespołów', true),
  ('packing', 'Pakowanie', 'Pakowanie produktów', true),
  ('quality_check', 'Kontrola jakości', 'Kontrola jakości po produkcji', true),
  ('graphic_design', 'Projekt graficzny', 'Prace graficzne / przygotowanie plików', true),
  ('cnc', 'CNC', 'Obróbka CNC', true),
  ('engraving', 'Grawerowanie', 'Grawerowanie (różne technologie)', true),
  ('other', 'Inne', 'Inny typ operacji', true)
ON CONFLICT (code) DO NOTHING;
