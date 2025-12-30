-- Migracja: Tabele zarządzania produkcją (Dashboard szefa, stany maszyn, materiały, operatorzy)
-- Data: 2025-12-26
-- Autor: Cascade
-- Wersja: 1.0

-- ============================================
-- 1. Stany maszyn (MachineStatus)
-- ============================================

CREATE TABLE IF NOT EXISTS public."MachineStatus" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workStationId" INTEGER REFERENCES "WorkStation"(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ok',
  "statusReason" TEXT,
  notes TEXT,
  "lastUpdate" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "MachineStatus_status_check" CHECK (status IN ('ok', 'warning', 'down', 'maintenance'))
);

CREATE INDEX IF NOT EXISTS "MachineStatus_workStationId_idx" 
  ON public."MachineStatus" USING btree ("workStationId");

CREATE INDEX IF NOT EXISTS "MachineStatus_status_idx" 
  ON public."MachineStatus" USING btree (status);

COMMENT ON TABLE public."MachineStatus" IS 'Historia i aktualny stan maszyn (awarie, konserwacje)';
COMMENT ON COLUMN public."MachineStatus".status IS 'Status: ok, warning, down, maintenance';
COMMENT ON COLUMN public."MachineStatus"."statusReason" IS 'Powód zmiany statusu (np. awaria silnika)';

-- ============================================
-- 2. Umiejętności operatorów (OperatorSkill)
-- ============================================

CREATE TABLE IF NOT EXISTS public."OperatorSkill" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "operatorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "workCenterType" VARCHAR(50) NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  "certifiedAt" TIMESTAMP WITH TIME ZONE,
  "certifiedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "OperatorSkill_level_check" CHECK (level BETWEEN 1 AND 5),
  CONSTRAINT "OperatorSkill_unique" UNIQUE ("operatorId", "workCenterType")
);

CREATE INDEX IF NOT EXISTS "OperatorSkill_operatorId_idx" 
  ON public."OperatorSkill" USING btree ("operatorId");

CREATE INDEX IF NOT EXISTS "OperatorSkill_workCenterType_idx" 
  ON public."OperatorSkill" USING btree ("workCenterType");

COMMENT ON TABLE public."OperatorSkill" IS 'Umiejętności operatorów - kto może pracować na jakim typie gniazda';
COMMENT ON COLUMN public."OperatorSkill".level IS 'Poziom umiejętności: 1=początkujący, 5=ekspert';
COMMENT ON COLUMN public."OperatorSkill"."workCenterType" IS 'Typ gniazda: laser_co2, uv_print, cnc, assembly itp.';

-- ============================================
-- 3. Przypisania operatorów (OperatorAssignment)
-- ============================================

CREATE TABLE IF NOT EXISTS public."OperatorAssignment" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "operatorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "roomId" INTEGER NOT NULL REFERENCES "ProductionRoom"(id) ON DELETE CASCADE,
  "workStationId" INTEGER REFERENCES "WorkStation"(id) ON DELETE SET NULL,
  "fromTime" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "toTime" TIMESTAMP WITH TIME ZONE,
  "assignedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  reason TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "OperatorAssignment_operatorId_idx" 
  ON public."OperatorAssignment" USING btree ("operatorId");

CREATE INDEX IF NOT EXISTS "OperatorAssignment_roomId_idx" 
  ON public."OperatorAssignment" USING btree ("roomId");

CREATE INDEX IF NOT EXISTS "OperatorAssignment_active_idx" 
  ON public."OperatorAssignment" USING btree ("operatorId") 
  WHERE "toTime" IS NULL;

COMMENT ON TABLE public."OperatorAssignment" IS 'Historia i aktualne przypisania operatorów do pokoi/stanowisk';
COMMENT ON COLUMN public."OperatorAssignment"."toTime" IS 'NULL = aktywne przypisanie';
COMMENT ON COLUMN public."OperatorAssignment".reason IS 'Powód przeniesienia (np. zator w UV)';

-- ============================================
-- 4. Stany magazynowe półproduktów (MaterialStock)
-- ============================================

CREATE TABLE IF NOT EXISTS public."MaterialStock" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "materialCode" VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'szt',
  "minThreshold" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "maxThreshold" DECIMAL(10,2),
  "autoOrderEnabled" BOOLEAN DEFAULT false,
  "autoOrderQuantity" DECIMAL(10,2),
  "supplierId" TEXT,
  "lastUpdated" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "MaterialStock_code_unique" UNIQUE ("materialCode"),
  CONSTRAINT "MaterialStock_quantity_check" CHECK (quantity >= 0)
);

CREATE INDEX IF NOT EXISTS "MaterialStock_code_idx" 
  ON public."MaterialStock" USING btree ("materialCode");

CREATE INDEX IF NOT EXISTS "MaterialStock_shortage_idx" 
  ON public."MaterialStock" USING btree (quantity, "minThreshold") 
  WHERE quantity < "minThreshold";

COMMENT ON TABLE public."MaterialStock" IS 'Stany magazynowe półproduktów i materiałów';
COMMENT ON COLUMN public."MaterialStock"."minThreshold" IS 'Próg minimalny - poniżej generuje alert';
COMMENT ON COLUMN public."MaterialStock"."autoOrderEnabled" IS 'Czy automatycznie sugerować zamówienie';

-- ============================================
-- 5. Powiązania produktów z materiałami (ProductMaterial)
-- ============================================

CREATE TABLE IF NOT EXISTS public."ProductMaterial" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "productId" TEXT NOT NULL,
  "materialId" UUID NOT NULL REFERENCES "MaterialStock"(id) ON DELETE CASCADE,
  "quantityPerUnit" DECIMAL(10,4) NOT NULL DEFAULT 1,
  notes TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "ProductMaterial_unique" UNIQUE ("productId", "materialId"),
  CONSTRAINT "ProductMaterial_quantity_check" CHECK ("quantityPerUnit" > 0)
);

CREATE INDEX IF NOT EXISTS "ProductMaterial_productId_idx" 
  ON public."ProductMaterial" USING btree ("productId");

CREATE INDEX IF NOT EXISTS "ProductMaterial_materialId_idx" 
  ON public."ProductMaterial" USING btree ("materialId");

COMMENT ON TABLE public."ProductMaterial" IS 'Powiązania produktów z wymaganymi materiałami';
COMMENT ON COLUMN public."ProductMaterial"."quantityPerUnit" IS 'Ile materiału potrzeba na 1 szt. produktu';

-- ============================================
-- 6. Historia zmian stanów magazynowych (MaterialStockLog)
-- ============================================

CREATE TABLE IF NOT EXISTS public."MaterialStockLog" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "materialId" UUID NOT NULL REFERENCES "MaterialStock"(id) ON DELETE CASCADE,
  "previousQuantity" DECIMAL(10,2) NOT NULL,
  "newQuantity" DECIMAL(10,2) NOT NULL,
  "changeType" VARCHAR(20) NOT NULL,
  "orderId" TEXT,
  notes TEXT,
  "changedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT "MaterialStockLog_changeType_check" CHECK ("changeType" IN ('receipt', 'issue', 'adjustment', 'return', 'scrap'))
);

CREATE INDEX IF NOT EXISTS "MaterialStockLog_materialId_idx" 
  ON public."MaterialStockLog" USING btree ("materialId");

CREATE INDEX IF NOT EXISTS "MaterialStockLog_createdAt_idx" 
  ON public."MaterialStockLog" USING btree ("createdAt");

COMMENT ON TABLE public."MaterialStockLog" IS 'Historia zmian stanów magazynowych';
COMMENT ON COLUMN public."MaterialStockLog"."changeType" IS 'Typ zmiany: receipt=przyjęcie, issue=wydanie, adjustment=korekta, return=zwrot, scrap=złom';

-- ============================================
-- 7. Rozszerzenie ProductionOrder o ryzyko
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ProductionOrder' AND column_name = 'riskLevel') THEN
    ALTER TABLE public."ProductionOrder" ADD COLUMN "riskLevel" VARCHAR(20) DEFAULT 'normal';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ProductionOrder' AND column_name = 'riskReason') THEN
    ALTER TABLE public."ProductionOrder" ADD COLUMN "riskReason" TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ProductionOrder' AND column_name = 'blockedByMachineId') THEN
    ALTER TABLE public."ProductionOrder" ADD COLUMN "blockedByMachineId" UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ProductionOrder' AND column_name = 'blockedByMaterialId') THEN
    ALTER TABLE public."ProductionOrder" ADD COLUMN "blockedByMaterialId" UUID;
  END IF;
END $$;

-- ============================================
-- 8. Triggery do automatycznej aktualizacji
-- ============================================

CREATE OR REPLACE FUNCTION public.update_operator_skill_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "OperatorSkill_updated_at_trigger" ON public."OperatorSkill";
CREATE TRIGGER "OperatorSkill_updated_at_trigger"
    BEFORE UPDATE ON public."OperatorSkill"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_operator_skill_updated_at();

CREATE OR REPLACE FUNCTION public.update_material_stock_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."lastUpdated" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "MaterialStock_updated_at_trigger" ON public."MaterialStock";
CREATE TRIGGER "MaterialStock_updated_at_trigger"
    BEFORE UPDATE ON public."MaterialStock"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_material_stock_updated_at();

-- ============================================
-- 9. Funkcja do logowania zmian stanów magazynowych
-- ============================================

CREATE OR REPLACE FUNCTION public.log_material_stock_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.quantity != NEW.quantity THEN
        INSERT INTO public."MaterialStockLog" (
            "materialId", 
            "previousQuantity", 
            "newQuantity", 
            "changeType",
            "changedBy"
        ) VALUES (
            NEW.id,
            OLD.quantity,
            NEW.quantity,
            CASE 
                WHEN NEW.quantity > OLD.quantity THEN 'receipt'
                ELSE 'issue'
            END,
            NEW."updatedBy"
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "MaterialStock_log_change_trigger" ON public."MaterialStock";
CREATE TRIGGER "MaterialStock_log_change_trigger"
    AFTER UPDATE ON public."MaterialStock"
    FOR EACH ROW
    EXECUTE FUNCTION public.log_material_stock_change();

-- ============================================
-- 10. Widok aktualnych przypisań operatorów
-- ============================================

CREATE OR REPLACE VIEW public."CurrentOperatorAssignments" AS
SELECT 
    oa.id,
    oa."operatorId",
    u.name as "operatorName",
    u.email as "operatorEmail",
    oa."roomId",
    pr.name as "roomName",
    pr.code as "roomCode",
    oa."workStationId",
    ws.name as "workStationName",
    oa."fromTime",
    oa."assignedBy",
    ab.name as "assignedByName"
FROM public."OperatorAssignment" oa
JOIN public."User" u ON u.id = oa."operatorId"
JOIN public."ProductionRoom" pr ON pr.id = oa."roomId"
LEFT JOIN public."WorkStation" ws ON ws.id = oa."workStationId"
LEFT JOIN public."User" ab ON ab.id = oa."assignedBy"
WHERE oa."toTime" IS NULL;

COMMENT ON VIEW public."CurrentOperatorAssignments" IS 'Widok aktualnych (aktywnych) przypisań operatorów';

-- ============================================
-- 11. Widok braków materiałowych
-- ============================================

CREATE OR REPLACE VIEW public."MaterialShortages" AS
SELECT 
    ms.id,
    ms."materialCode",
    ms.name,
    ms.quantity,
    ms."minThreshold",
    ms.unit,
    (ms."minThreshold" - ms.quantity) as "shortageAmount",
    ms."autoOrderEnabled",
    ms."autoOrderQuantity",
    ms."lastUpdated"
FROM public."MaterialStock" ms
WHERE ms.quantity < ms."minThreshold"
  AND ms."isActive" = true
ORDER BY (ms."minThreshold" - ms.quantity) DESC;

COMMENT ON VIEW public."MaterialShortages" IS 'Widok materiałów poniżej progu minimalnego';

-- ============================================
-- 12. Widok aktualnych stanów maszyn
-- ============================================

CREATE OR REPLACE VIEW public."CurrentMachineStatus" AS
SELECT DISTINCT ON (ms."workStationId")
    ms.id,
    ms."workStationId",
    ws.name as "workStationName",
    ws.code as "workStationCode",
    wc.id as "workCenterId",
    wc.name as "workCenterName",
    pr.id as "roomId",
    pr.name as "roomName",
    ms.status,
    ms."statusReason",
    ms.notes,
    ms."lastUpdate",
    ms."updatedBy",
    u.name as "updatedByName"
FROM public."MachineStatus" ms
JOIN public."WorkStation" ws ON ws.id = ms."workStationId"
LEFT JOIN public."WorkCenter" wc ON wc.id = ws."workCenterId"
LEFT JOIN public."ProductionRoom" pr ON pr.id = wc."roomId"
LEFT JOIN public."User" u ON u.id = ms."updatedBy"
ORDER BY ms."workStationId", ms."lastUpdate" DESC;

COMMENT ON VIEW public."CurrentMachineStatus" IS 'Widok aktualnych stanów maszyn (ostatni wpis per maszyna)';

-- ============================================
-- 13. Przykładowe dane testowe
-- ============================================

-- Przykładowe materiały
INSERT INTO public."MaterialStock" ("materialCode", name, description, quantity, unit, "minThreshold", "autoOrderEnabled", "isActive")
VALUES 
  ('MAT-HDF-3MM', 'Płyta HDF 3mm', 'Płyta HDF do grawerowania laserowego', 50, 'szt', 20, true, true),
  ('MAT-AKRYL-3MM', 'Akryl przezroczysty 3mm', 'Akryl do cięcia laserowego', 30, 'szt', 15, true, true),
  ('MAT-MAGNES-50X70', 'Magnes 50x70mm', 'Magnes do produkcji magnesów pamiątkowych', 200, 'szt', 100, true, true),
  ('MAT-KUBEK-BIALY', 'Kubek ceramiczny biały', 'Kubek do nadruku sublimacyjnego', 100, 'szt', 50, false, true),
  ('MAT-BRELOK-METAL', 'Brelok metalowy', 'Brelok do grawerowania', 150, 'szt', 75, true, true)
ON CONFLICT ("materialCode") DO NOTHING;

-- Przykładowe umiejętności operatorów (zakładając że istnieją użytkownicy z rolą OPERATOR)
-- Te dane będą dodane ręcznie przez admina

-- ============================================
-- Koniec migracji
-- ============================================
