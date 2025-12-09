-- Migracja: ProductionWorkOrder + PrintAudit + powiązanie z ProductionOrder
-- Data: 2025-12-08
-- Autor: Cascade

-- ============================================
-- 1. Zlecenia produkcyjne dla pokoi produkcyjnych: ProductionWorkOrder
-- ============================================

CREATE TABLE IF NOT EXISTS public."ProductionWorkOrder" (
  id serial PRIMARY KEY,

  "workOrderNumber" varchar(30) NOT NULL,
  -- Numer zlecenia produkcyjnego dla pokoju produkcyjnego (ProductionWorkOrder), np. 'PW-2025-0001'

  "sourceOrderId" text REFERENCES public."Order"(id) ON DELETE CASCADE,
  -- Zamówienie źródłowe

  "roomName" varchar(100) NOT NULL,
  -- Nazwa pokoju produkcyjnego (np. 'Laser CO2')

  status varchar(20) NOT NULL DEFAULT 'planned',
  -- planned, approved, in_progress, completed, cancelled

  priority integer NOT NULL DEFAULT 3,
  -- 1-urgent, 2-high, 3-normal, 4-low

  "plannedDate" timestamp,
  "actualDate" timestamp,

  notes text,

  "printedAt" timestamp,
  "printedBy" text REFERENCES public."User"(id) ON DELETE SET NULL,
  "templateVersion" varchar(10) DEFAULT '1.0',

  "createdBy" text REFERENCES public."User"(id) ON DELETE SET NULL,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductionWorkOrder_workOrderNumber_unique"
    UNIQUE ("workOrderNumber")
);

CREATE INDEX IF NOT EXISTS "ProductionWorkOrder_status_idx"
  ON public."ProductionWorkOrder" USING btree (status);

CREATE INDEX IF NOT EXISTS "ProductionWorkOrder_sourceOrderId_idx"
  ON public."ProductionWorkOrder" USING btree ("sourceOrderId");

-- ============================================
-- 2. Powiązanie ProductionOrder -> ProductionWorkOrder
-- ============================================

ALTER TABLE public."ProductionOrder"
  ADD COLUMN IF NOT EXISTS "workOrderId" integer
    REFERENCES public."ProductionWorkOrder"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "ProductionOrder_workOrderId_idx"
  ON public."ProductionOrder" USING btree ("workOrderId");

-- ============================================
-- 3. Trigger updatedAt dla ProductionWorkOrder
-- ============================================

CREATE OR REPLACE FUNCTION public.update_production_work_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ProductionWorkOrder_updated_at_trigger"
  ON public."ProductionWorkOrder";

CREATE TRIGGER "ProductionWorkOrder_updated_at_trigger"
  BEFORE UPDATE ON public."ProductionWorkOrder"
  FOR EACH ROW
  EXECUTE FUNCTION public.update_production_work_order_updated_at();

-- ============================================
-- 4. Tabela audytu druku: PrintAudit
-- ============================================

CREATE TABLE IF NOT EXISTS public."PrintAudit" (
  id serial PRIMARY KEY,

  documentType varchar(50) NOT NULL,
  -- 'production_work_order', 'graphics_task', 'packing_list', ...

  documentId text NOT NULL,
  -- ID dokumentu w jego tabeli źródłowej (np. ProductionWorkOrder.id jako tekst)

  "printedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "printedBy" text REFERENCES public."User"(id) ON DELETE SET NULL,

  "templateVersion" varchar(10) DEFAULT '1.0',
  "printCount" integer NOT NULL DEFAULT 1,

  "ipAddress" inet,
  "userAgent" text
);

CREATE INDEX IF NOT EXISTS "PrintAudit_document_idx"
  ON public."PrintAudit"(documentType, documentId);

CREATE INDEX IF NOT EXISTS "PrintAudit_printedAt_idx"
  ON public."PrintAudit"("printedAt" DESC);

-- ============================================
-- 5. Komentarze dokumentacyjne
-- ============================================

COMMENT ON TABLE public."ProductionWorkOrder"
  IS 'Zlecenia produkcyjne grupowane po pokojach (nagłówki dla wielu ProductionOrder).';

COMMENT ON COLUMN public."ProductionWorkOrder"."sourceOrderId"
  IS 'Zamówienie źródłowe (Order.id), z którego pochodzi grupa zleceń produkcyjnych dla pokoi produkcyjnych.';

COMMENT ON COLUMN public."ProductionWorkOrder"."workOrderNumber"
  IS 'Numer zlecenia produkcyjnego dla pokoju produkcyjnego (ProductionWorkOrder) używany na kartach produkcyjnych.';

COMMENT ON TABLE public."PrintAudit"
  IS 'Audyt wydruków dokumentów produkcyjnych (zlecenia produkcyjne dla pokoi, zadania graficzne, listy kompletacyjne).';
