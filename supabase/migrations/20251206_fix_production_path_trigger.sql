-- Naprawa triggera updatedAt dla ProductionPath
-- Problem: trigger szuka kolumny "updatedAt" (camelCase), ale tabela ma "updatedat" (lowercase)

-- Usuń stary trigger
DROP TRIGGER IF EXISTS "ProductionPath_updated_at_trigger" ON public."ProductionPath";

-- Usuń starą funkcję
DROP FUNCTION IF EXISTS public.update_production_path_updated_at();

-- Utwórz nową funkcję z poprawną nazwą kolumny (lowercase)
CREATE OR REPLACE FUNCTION public.update_production_path_updatedat()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Utwórz nowy trigger
CREATE TRIGGER "ProductionPath_updatedat_trigger"
    BEFORE UPDATE ON public."ProductionPath"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_production_path_updatedat();

-- Analogicznie dla ProductionOrder
DROP TRIGGER IF EXISTS "ProductionOrder_updated_at_trigger" ON public."ProductionOrder";
DROP FUNCTION IF EXISTS public.update_production_order_updated_at();

CREATE OR REPLACE FUNCTION public.update_production_order_updatedat()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProductionOrder_updatedat_trigger"
    BEFORE UPDATE ON public."ProductionOrder"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_production_order_updatedat();

-- Analogicznie dla ProductionOperation
DROP TRIGGER IF EXISTS "ProductionOperation_updated_at_trigger" ON public."ProductionOperation";
DROP FUNCTION IF EXISTS public.update_production_operation_updated_at();

CREATE OR REPLACE FUNCTION public.update_production_operation_updatedat()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedat = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProductionOperation_updatedat_trigger"
    BEFORE UPDATE ON public."ProductionOperation"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_production_operation_updatedat();
