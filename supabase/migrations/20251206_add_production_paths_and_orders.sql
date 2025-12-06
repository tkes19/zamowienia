-- Migracja: Ścieżki i zlecenia produkcyjne (Faza 2)
-- Data: 2025-12-06
-- Autor: Cascade

-- ============================================
-- 1. Ścieżki produkcyjne (ProductionPath)
-- ============================================

CREATE TABLE IF NOT EXISTS public."ProductionPath" (
  id serial PRIMARY KEY,
  code varchar(50) NOT NULL,
  -- Kod ścieżki zgodny z obecnym nazewnictwem, np. '1', '2', '2.1', '5', '5.1', '5.2'

  name varchar(200) NOT NULL,
  -- Nazwa opisowa ścieżki, np. 'Solvent z żywicą', 'Laser drewno + pakowanie CO2'

  description text,

  operations jsonb NOT NULL,
  -- Lista kroków technologicznych w obrębie tej ścieżki.
  -- Każdy element to np. {
  --   "step": 1,
  --   "phase": "PREP" | "OP" | "PACK",
  --   "operationType": "solvent" | "laser_co2" | "uv_print" | ...,
  --   "workCenterType": "solvent" | "laser_co2" | "uv_print" | ...,
  --   "defaultWorkCenterCode": "WC-UV-PRINT" (opcjonalne),
  --   "estimatedTimeMin": 5 (opcjonalne)
  -- }

  "isActive" boolean NOT NULL DEFAULT true,

  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionPath_code_unique" UNIQUE (code)
);

-- Dla bezpieczeństwa (gdy tabela istniała wcześniej bez kolumny "isActive")
ALTER TABLE public."ProductionPath"
  ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "ProductionPath_isActive_idx"
  ON public."ProductionPath" USING btree ("isActive");

-- ============================================
-- 2. Zlecenia produkcyjne (ProductionOrder)
-- ============================================

CREATE TABLE IF NOT EXISTS public."ProductionOrder" (
  id serial PRIMARY KEY,

  orderNumber varchar(30) NOT NULL,
  -- Numer zlecenia produkcyjnego, np. 'PROD-2025-0001'

  sourceOrderId text REFERENCES public."Order"(id) ON DELETE SET NULL,
  -- Zamówienie źródłowe (jeśli powstało z Order)

  sourceOrderItemId text REFERENCES public."OrderItem"(id) ON DELETE SET NULL,
  -- Konkretny wiersz zamówienia (produkt)

  productId text REFERENCES public."Product"(id) ON DELETE SET NULL,
  -- Produkt z zamówienia

  productionPathExpression text,
  -- Wyrażenie ścieżki zgodne z Twoim obecnym systemem, np. '2', '5%3', '5%3$2.1'

  branchCode varchar(50),
  -- Kod gałęzi przy złożonych ścieżkach (np. 'A', 'B') – opcjonalne, do rozbudowy

  quantity integer NOT NULL,
  completedQuantity integer NOT NULL DEFAULT 0,

  priority integer NOT NULL DEFAULT 3,
  -- 1-urgent, 2-high, 3-normal, 4-low

  status varchar(20) NOT NULL DEFAULT 'planned',
  -- planned, approved, in_progress, completed, cancelled, blocked

  plannedStartDate timestamp,
  plannedEndDate timestamp,
  actualStartDate timestamp,
  actualEndDate timestamp,

  assignedWorkCenterId integer REFERENCES public."WorkCenter"(id) ON DELETE SET NULL,
  assignedWorkStationId integer REFERENCES public."WorkStation"(id) ON DELETE SET NULL,

  productionPathId integer REFERENCES public."ProductionPath"(id) ON DELETE SET NULL,

  estimatedTime integer,
  -- szacowany całkowity czas w minutach

  productionNotes text,
  qualityStatus varchar(20) DEFAULT 'pending',
  -- pending, passed, failed, rework

  createdBy text REFERENCES public."User"(id) ON DELETE SET NULL,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductionOrder_orderNumber_unique"
  ON public."ProductionOrder" USING btree (orderNumber);

CREATE INDEX IF NOT EXISTS "ProductionOrder_status_idx"
  ON public."ProductionOrder" USING btree (status);

CREATE INDEX IF NOT EXISTS "ProductionOrder_sourceOrderId_idx"
  ON public."ProductionOrder" USING btree (sourceorderid);

-- ============================================
-- 3. Operacje technologiczne w zleceniu (ProductionOperation)
-- ============================================

CREATE TABLE IF NOT EXISTS public."ProductionOperation" (
  id serial PRIMARY KEY,

  productionOrderId integer NOT NULL
    REFERENCES public."ProductionOrder"(id) ON DELETE CASCADE,

  operationNumber integer NOT NULL,
  -- Kolejność operacji w danym zleceniu

  branchCode varchar(50),
  -- Gałąź przy złożonych ścieżkach (zgodna z branchCode w ProductionOrder)

  phase varchar(10) NOT NULL DEFAULT 'OP',
  -- PREP (przygotowanie), OP (operacja), PACK (pakowanie)

  operationType varchar(50) NOT NULL,
  -- Np. 'solvent', 'laser_co2', 'uv_print', 'assembly', 'packing_uv', 'packing_co2'

  workCenterId integer REFERENCES public."WorkCenter"(id) ON DELETE SET NULL,
  workStationId integer REFERENCES public."WorkStation"(id) ON DELETE SET NULL,

  operatorId text REFERENCES public."User"(id) ON DELETE SET NULL,

  status varchar(20) NOT NULL DEFAULT 'pending',
  -- pending, active, completed, failed, paused, blocked

  plannedTime integer,
  actualTime integer,

  startTime timestamp,
  endTime timestamp,

  parameters jsonb,
  -- np. {"power": "80%", "speed": "100mm/s"}

  qualityNotes text,
  outputQuantity integer NOT NULL DEFAULT 0,
  wasteQuantity integer NOT NULL DEFAULT 0,

  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionOperation_unique_in_order"
    UNIQUE (productionorderid, operationnumber, branchcode)
);

CREATE INDEX IF NOT EXISTS "ProductionOperation_status_idx"
  ON public."ProductionOperation" USING btree (status);

CREATE INDEX IF NOT EXISTS "ProductionOperation_order_idx"
  ON public."ProductionOperation" USING btree (productionorderid);

-- ============================================
-- 4. Triggery updatedAt
-- ============================================

CREATE OR REPLACE FUNCTION public.update_production_path_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_production_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_production_operation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ProductionPath_updated_at_trigger" ON public."ProductionPath";
CREATE TRIGGER "ProductionPath_updated_at_trigger"
    BEFORE UPDATE ON public."ProductionPath"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_production_path_updated_at();

DROP TRIGGER IF EXISTS "ProductionOrder_updated_at_trigger" ON public."ProductionOrder";
CREATE TRIGGER "ProductionOrder_updated_at_trigger"
    BEFORE UPDATE ON public."ProductionOrder"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_production_order_updated_at();

DROP TRIGGER IF EXISTS "ProductionOperation_updated_at_trigger" ON public."ProductionOperation";
CREATE TRIGGER "ProductionOperation_updated_at_trigger"
    BEFORE UPDATE ON public."ProductionOperation"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_production_operation_updated_at();

-- ============================================
-- 5. Komentarze dokumentacyjne
-- ============================================

COMMENT ON TABLE public."ProductionPath" IS 'Definicje atomowych ścieżek produkcyjnych (np. 2, 2.1, 5) z listą kroków technologicznych.';
COMMENT ON COLUMN public."ProductionPath".code IS 'Kod ścieżki zgodny z arkuszem technologicznym (np. 2, 2.1, 5).';

COMMENT ON TABLE public."ProductionOrder" IS 'Zlecenia produkcyjne powstałe z zamówień lub ręcznie.';
COMMENT ON COLUMN public."ProductionOrder".productionPathExpression IS 'Wyrażenie ścieżki (np. 2, 5%3, 5%3$2.1) używane do generowania operacji.';

COMMENT ON TABLE public."ProductionOperation" IS 'Pojedyncze operacje technologiczne w ramach zlecenia produkcyjnego.';
COMMENT ON COLUMN public."ProductionOperation".branchCode IS 'Kod gałęzi przy złożonych ścieżkach (np. równoległe ścieżki).';

-- ============================================
-- Koniec migracji
-- ============================================
