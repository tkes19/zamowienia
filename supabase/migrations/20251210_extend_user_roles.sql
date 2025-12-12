-- ============================================
-- Migracja: Rozszerzenie ról użytkowników (MES-compliant)
-- Data: 2025-12-10
-- Opis: Dodaje brakujące role produkcyjne do enum UserRole
--       oraz tworzy tabelę UserRoleAssignment dla wieloról
-- ============================================

--- UWAGA: migracja została zastosowana ręcznie w Supabase (2025-12-10).
--        Poniższa treść jest zakomentowana i pozostawiona wyłącznie jako dokumentacja.
/*
-- 1. Rozszerzenie enum UserRole o brakujące role produkcyjne
-- PostgreSQL wymaga ALTER TYPE ... ADD VALUE dla każdej nowej wartości

-- Sprawdź czy wartości już istnieją przed dodaniem
DO $$
BEGIN
    -- Dodaj OPERATOR jeśli nie istnieje
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'OPERATOR' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')) THEN
        ALTER TYPE "UserRole" ADD VALUE 'OPERATOR';
    END IF;
END$$;

DO $$
BEGIN
    -- Dodaj PRODUCTION_MANAGER jeśli nie istnieje
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PRODUCTION_MANAGER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')) THEN
        ALTER TYPE "UserRole" ADD VALUE 'PRODUCTION_MANAGER';
    END IF;
END$$;

DO $$
BEGIN
    -- Dodaj GRAPHIC_DESIGNER jeśli nie istnieje (ujednolicenie z GRAPHICS)
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GRAPHIC_DESIGNER' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserRole')) THEN
        ALTER TYPE "UserRole" ADD VALUE 'GRAPHIC_DESIGNER';
    END IF;
END$$;

-- 2. Tabela UserRoleAssignment - wielorole użytkowników
-- Pozwala przypisać wiele ról do jednego użytkownika (np. OPERATOR + GRAPHIC_DESIGNER)

CREATE TABLE IF NOT EXISTS "UserRoleAssignment" (
    id SERIAL PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    role TEXT NOT NULL,  -- używamy TEXT zamiast enum dla elastyczności
    "assignedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
    "assignedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE ("userId", role)
);

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_user_role_assignment_user ON "UserRoleAssignment"("userId");
CREATE INDEX IF NOT EXISTS idx_user_role_assignment_role ON "UserRoleAssignment"(role);
CREATE INDEX IF NOT EXISTS idx_user_role_assignment_active ON "UserRoleAssignment"("isActive") WHERE "isActive" = TRUE;

-- Komentarze dokumentacyjne
COMMENT ON TABLE "UserRoleAssignment" IS 'Przypisania wieloról do użytkowników (MES-compliant). Użytkownik może mieć wiele aktywnych ról jednocześnie.';
COMMENT ON COLUMN "UserRoleAssignment"."userId" IS 'ID użytkownika';
COMMENT ON COLUMN "UserRoleAssignment".role IS 'Nazwa roli (ADMIN, SALES_REP, SALES_DEPT, WAREHOUSE, PRODUCTION, PRODUCTION_MANAGER, OPERATOR, GRAPHIC_DESIGNER, GRAPHICS, CLIENT, NEW_USER)';
COMMENT ON COLUMN "UserRoleAssignment"."assignedBy" IS 'ID użytkownika, który przypisał rolę (zazwyczaj ADMIN)';
COMMENT ON COLUMN "UserRoleAssignment"."assignedAt" IS 'Data i czas przypisania roli';
COMMENT ON COLUMN "UserRoleAssignment"."isActive" IS 'Czy przypisanie jest aktywne (soft delete)';

-- 3. Migracja danych - dla każdego istniejącego User utwórz UserRoleAssignment
-- z jego aktualną rolą (User.role)
INSERT INTO "UserRoleAssignment" ("userId", role, "assignedAt", "isActive")
SELECT id, role::TEXT, COALESCE("createdAt", NOW()), TRUE
FROM "User"
WHERE role IS NOT NULL
ON CONFLICT ("userId", role) DO NOTHING;

-- 4. Tabela audytu zmian ról (opcjonalna, ale zgodna z MES best practices)
CREATE TABLE IF NOT EXISTS "UserRoleAssignmentLog" (
    id SERIAL PRIMARY KEY,
    "assignmentId" INTEGER REFERENCES "UserRoleAssignment"(id) ON DELETE SET NULL,
    "userId" TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,  -- 'ASSIGNED', 'REVOKED', 'ACTIVATED', 'DEACTIVATED'
    "changedBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
    "changedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_role_log_user ON "UserRoleAssignmentLog"("userId");
CREATE INDEX IF NOT EXISTS idx_user_role_log_changed_at ON "UserRoleAssignmentLog"("changedAt");

COMMENT ON TABLE "UserRoleAssignmentLog" IS 'Audyt zmian przypisań ról użytkowników';

-- 5. RLS dla UserRoleAssignment (tylko ADMIN może zarządzać)
ALTER TABLE "UserRoleAssignment" ENABLE ROW LEVEL SECURITY;

-- Policy: każdy zalogowany może widzieć swoje role
CREATE POLICY "Users can view own roles" ON "UserRoleAssignment"
    FOR SELECT USING (
        "userId" = auth.uid()::TEXT
        OR auth.jwt()->>'role' = 'ADMIN'
    );

-- Policy: tylko ADMIN może modyfikować role
CREATE POLICY "Only admins can manage roles" ON "UserRoleAssignment"
    FOR ALL USING (
        auth.jwt()->>'role' = 'ADMIN'
    );

-- 6. Funkcja pomocnicza: sprawdź czy user ma daną rolę
CREATE OR REPLACE FUNCTION user_has_role(p_user_id TEXT, p_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM "UserRoleAssignment"
        WHERE "userId" = p_user_id
        AND role = p_role
        AND "isActive" = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Funkcja pomocnicza: pobierz wszystkie aktywne role użytkownika
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id TEXT)
RETURNS TEXT[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT role FROM "UserRoleAssignment"
        WHERE "userId" = p_user_id
        AND "isActive" = TRUE
        ORDER BY role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_has_role IS 'Sprawdza czy użytkownik ma przypisaną i aktywną daną rolę';
COMMENT ON FUNCTION get_user_roles IS 'Zwraca tablicę wszystkich aktywnych ról użytkownika';
*/
