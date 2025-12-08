-- Migracja: ProductionLog + UserRoleAssignment (Panel Produkcyjny)
-- Data: 2025-12-06
-- Autor: Cascade

-- ============================================
-- 1. Dodanie nowych ról do enum UserRole
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'GRAPHIC_DESIGNER'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'GRAPHIC_DESIGNER';
  END IF;

  -- Dodajemy też GRAPHICS jeśli brakuje (występuje w danych userów)
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'GRAPHICS'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'GRAPHICS';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'PRODUCTION_MANAGER'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'PRODUCTION_MANAGER';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'OPERATOR'
  ) THEN
    ALTER TYPE public."UserRole" ADD VALUE 'OPERATOR';
  END IF;
END$$;

-- ============================================
-- 2. Tabela UserRoleAssignment (wielorole)
-- ============================================

CREATE TABLE IF NOT EXISTS public."UserRoleAssignment" (
  id serial PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  role public."UserRole" NOT NULL,
  "assignedBy" text REFERENCES "User"(id) ON DELETE SET NULL,
  "assignedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRoleAssignment_user_role_unique" UNIQUE ("userId", role)
);

CREATE INDEX IF NOT EXISTS "UserRoleAssignment_userId_idx"
  ON public."UserRoleAssignment"("userId");

-- ============================================
-- 3. Migracja danych z User.role do UserRoleAssignment
-- ============================================

-- UWAGA: Ze względu na ograniczenie PostgreSQL (błąd 55P04), nie można użyć nowej wartości ENUM
-- w tej samej transakcji, w której została dodana.
-- Wykonaj tę część DOPIERO PO zatwierdzeniu zmian w ENUM (np. w osobnej migracji lub osobnym zapytaniu).

/*
INSERT INTO public."UserRoleAssignment" ("userId", role, "assignedAt")
SELECT u.id,
       u.role::public."UserRole",
       COALESCE(u."createdAt", NOW())
FROM public."User" u
WHERE u.role IN ('ADMIN','SALES_REP','WAREHOUSE','SALES_DEPT','PRODUCTION','GRAPHICS','NEW_USER','CLIENT')
ON CONFLICT ("userId", role) DO NOTHING;
*/

-- ============================================
-- 4. Tabela ProductionLog (audyt zmian produkcyjnych)
-- ============================================

CREATE TABLE IF NOT EXISTS public."ProductionLog" (
  id serial PRIMARY KEY,
  "productionOrderId" integer REFERENCES public."ProductionOrder"(id) ON DELETE CASCADE,
  action varchar(50) NOT NULL,
  "previousStatus" varchar(20),
  "newStatus" varchar(20),
  "userId" text REFERENCES public."User"(id) ON DELETE SET NULL,
  notes text,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProductionLog_order_idx"
  ON public."ProductionLog"("productionOrderId");

CREATE INDEX IF NOT EXISTS "ProductionLog_createdAt_idx"
  ON public."ProductionLog"("createdAt" DESC);

-- ============================================
-- 5. Komentarze dokumentacyjne
-- ============================================

COMMENT ON TABLE public."UserRoleAssignment" IS 'Przypisania wielu ról do użytkowników (wielorole).';
COMMENT ON COLUMN public."UserRoleAssignment"."userId" IS 'Użytkownik, któremu nadano rolę.';
COMMENT ON COLUMN public."UserRoleAssignment"."assignedBy" IS 'Użytkownik (np. ADMIN), który nadał rolę.';

COMMENT ON TABLE public."ProductionLog" IS 'Log zmian statusów i akcji na zleceniach produkcyjnych.';
COMMENT ON COLUMN public."ProductionLog"."productionOrderId" IS 'Powiązane zlecenie produkcyjne.';
COMMENT ON COLUMN public."ProductionLog".action IS 'Typ akcji: created, started, paused, completed, cancelled, operation_started itp.';

-- ============================================
-- Koniec migracji
-- ============================================
