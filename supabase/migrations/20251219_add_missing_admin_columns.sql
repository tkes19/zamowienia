-- 20251219_add_missing_admin_columns.sql
-- Uzupełnia schemat Supabase o kolumny brakujące względem starego backendu:
-- 1) Customer.code
-- 2) ProductionLog.productionOperationId
-- 3) ProductionOperation.assignedUserId

-- 1. Customer.code (unikalne oznaczenie klienta)
ALTER TABLE public."Customer"
    ADD COLUMN IF NOT EXISTS "code" text;

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_code_idx"
    ON public."Customer"("code")
    WHERE "code" IS NOT NULL;

COMMENT ON COLUMN public."Customer"."code" IS 'Legacy client short code używany w panelu produkcyjnym.';

-- 2. ProductionLog.productionOperationId (powiązanie wpisu logu z konkretną operacją)
ALTER TABLE public."ProductionLog"
    ADD COLUMN IF NOT EXISTS "productionOperationId" integer
        REFERENCES public."ProductionOperation"(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "ProductionLog_operation_idx"
    ON public."ProductionLog"("productionOperationId");

COMMENT ON COLUMN public."ProductionLog"."productionOperationId" IS 'Opcjonalna referencja do ProductionOperation.';

-- 3. ProductionOperation.assignedUserId (użytkownik przypisany do operacji)
ALTER TABLE public."ProductionOperation"
    ADD COLUMN IF NOT EXISTS "assignedUserId" text
        REFERENCES public."User"(id)
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "ProductionOperation_assignedUser_idx"
    ON public."ProductionOperation"("assignedUserId");

COMMENT ON COLUMN public."ProductionOperation"."assignedUserId" IS 'Legacy pole z backendu – kto został przypisany do operacji.';
