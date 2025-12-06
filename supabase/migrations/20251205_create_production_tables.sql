-- Migracja: Tabele produkcyjne (Faza 1)
-- Data: 2025-12-05
-- Autor: Cascade

-- ============================================
-- 1. Pokoje produkcyjne
-- ============================================

CREATE TABLE IF NOT EXISTS public."ProductionRoom" (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  code varchar(20) NOT NULL,
  area decimal(8,2),
  description text,
  "supervisorId" text REFERENCES "User"(id) ON DELETE SET NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductionRoom_code_unique" UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS "ProductionRoom_isActive_idx" 
  ON public."ProductionRoom" USING btree ("isActive");

CREATE INDEX IF NOT EXISTS "ProductionRoom_code_idx" 
  ON public."ProductionRoom" USING btree (code);

-- ============================================
-- 2. Gniazda produkcyjne (WorkCenter)
-- ============================================

CREATE TABLE IF NOT EXISTS public."WorkCenter" (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  code varchar(20) NOT NULL,
  "roomId" integer REFERENCES "ProductionRoom"(id) ON DELETE SET NULL,
  type varchar(50) NOT NULL,
  description text,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkCenter_code_unique" UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS "WorkCenter_roomId_idx" 
  ON public."WorkCenter" USING btree ("roomId");

CREATE INDEX IF NOT EXISTS "WorkCenter_isActive_idx" 
  ON public."WorkCenter" USING btree ("isActive");

CREATE INDEX IF NOT EXISTS "WorkCenter_type_idx" 
  ON public."WorkCenter" USING btree (type);

-- ============================================
-- 3. Stanowiska robocze / Maszyny
-- ============================================

CREATE TABLE IF NOT EXISTS public."WorkStation" (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  code varchar(20) NOT NULL,
  "workCenterId" integer REFERENCES "WorkCenter"(id) ON DELETE SET NULL,
  type varchar(50) NOT NULL,
  manufacturer varchar(100),
  model varchar(100),
  status varchar(20) NOT NULL DEFAULT 'available',
  capabilities jsonb,
  "currentOperatorId" text REFERENCES "User"(id) ON DELETE SET NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkStation_code_unique" UNIQUE (code),
  CONSTRAINT "WorkStation_status_check" CHECK (status IN ('available', 'in_use', 'maintenance', 'breakdown'))
);

CREATE INDEX IF NOT EXISTS "WorkStation_workCenterId_idx" 
  ON public."WorkStation" USING btree ("workCenterId");

CREATE INDEX IF NOT EXISTS "WorkStation_status_idx" 
  ON public."WorkStation" USING btree (status);

CREATE INDEX IF NOT EXISTS "WorkStation_isActive_idx" 
  ON public."WorkStation" USING btree ("isActive");

-- ============================================
-- 4. Triggery do automatycznej aktualizacji updatedAt
-- ============================================

CREATE OR REPLACE FUNCTION public.update_production_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_work_center_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_work_station_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ProductionRoom_updated_at_trigger" ON public."ProductionRoom";
CREATE TRIGGER "ProductionRoom_updated_at_trigger"
    BEFORE UPDATE ON public."ProductionRoom"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_production_room_updated_at();

DROP TRIGGER IF EXISTS "WorkCenter_updated_at_trigger" ON public."WorkCenter";
CREATE TRIGGER "WorkCenter_updated_at_trigger"
    BEFORE UPDATE ON public."WorkCenter"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_work_center_updated_at();

DROP TRIGGER IF EXISTS "WorkStation_updated_at_trigger" ON public."WorkStation";
CREATE TRIGGER "WorkStation_updated_at_trigger"
    BEFORE UPDATE ON public."WorkStation"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_work_station_updated_at();

-- ============================================
-- 5. Komentarze dokumentacyjne
-- ============================================

COMMENT ON TABLE public."ProductionRoom" IS 'Pokoje produkcyjne (fizyczne pomieszczenia)';
COMMENT ON COLUMN public."ProductionRoom".code IS 'Unikalny kod pokoju, np. LASER-1';
COMMENT ON COLUMN public."ProductionRoom".area IS 'Powierzchnia w metrach kwadratowych';
COMMENT ON COLUMN public."ProductionRoom"."supervisorId" IS 'Nadzorca pokoju (User.id)';

COMMENT ON TABLE public."WorkCenter" IS 'Gniazda produkcyjne (logiczne grupy maszyn)';
COMMENT ON COLUMN public."WorkCenter".type IS 'Typ gniazda: laser_co2, laser_fiber, uv_print, cnc, cutting, assembly';
COMMENT ON COLUMN public."WorkCenter"."roomId" IS 'Pokój, w którym znajduje się gniazdo';

COMMENT ON TABLE public."WorkStation" IS 'Stanowiska robocze / maszyny';
COMMENT ON COLUMN public."WorkStation".status IS 'Status: available, in_use, maintenance, breakdown';
COMMENT ON COLUMN public."WorkStation".capabilities IS 'Możliwości maszyny (JSON): materiały, max rozmiar, itp.';
COMMENT ON COLUMN public."WorkStation"."currentOperatorId" IS 'Aktualny operator (jeśli in_use)';

-- ============================================
-- 6. Przykładowe dane (opcjonalne, do testów)
-- ============================================

-- Pokoje
INSERT INTO public."ProductionRoom" (name, code, area, description, "isActive")
VALUES 
  ('Laser CO2', 'LASER-1', 45.00, 'Główny pokój laserów CO2 do grawerowania', true),
  ('Laser Fiber', 'LASER-2', 30.00, 'Pokój laserów fiber do metalu', true),
  ('Druk UV', 'UV-PRINT', 25.00, 'Pokój drukarek UV', true)
ON CONFLICT (code) DO NOTHING;

-- Gniazda
INSERT INTO public."WorkCenter" (name, code, "roomId", type, description, "isActive")
SELECT 
  'Gniazdo Laser CO2', 'WC-LASER-CO2', pr.id, 'laser_co2', 'Grawerowanie laserowe CO2', true
FROM public."ProductionRoom" pr WHERE pr.code = 'LASER-1'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public."WorkCenter" (name, code, "roomId", type, description, "isActive")
SELECT 
  'Gniazdo Druk UV', 'WC-UV-PRINT', pr.id, 'uv_print', 'Druk UV na płaskich powierzchniach', true
FROM public."ProductionRoom" pr WHERE pr.code = 'UV-PRINT'
ON CONFLICT (code) DO NOTHING;

-- Maszyny
INSERT INTO public."WorkStation" (name, code, "workCenterId", type, manufacturer, model, status, "isActive")
SELECT 
  'Laser CO2 #1', 'LASER-CO2-01', wc.id, 'laser_co2', 'Trotec', 'Speedy 360', 'available', true
FROM public."WorkCenter" wc WHERE wc.code = 'WC-LASER-CO2'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public."WorkStation" (name, code, "workCenterId", type, manufacturer, model, status, "isActive")
SELECT 
  'Laser CO2 #2', 'LASER-CO2-02', wc.id, 'laser_co2', 'Trotec', 'Speedy 400', 'available', true
FROM public."WorkCenter" wc WHERE wc.code = 'WC-LASER-CO2'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public."WorkStation" (name, code, "workCenterId", type, manufacturer, model, status, "isActive")
SELECT 
  'Drukarka UV #1', 'UV-PRINT-01', wc.id, 'uv_print', 'Roland', 'VersaUV LEF2-300', 'available', true
FROM public."WorkCenter" wc WHERE wc.code = 'WC-UV-PRINT'
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- Koniec migracji
-- ============================================
