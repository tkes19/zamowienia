-- Migracja: Dodanie roli CLIENT i tabeli audytu UserFolderAccessLog
-- Data: 2025-11-28
-- Autor: Cascade

-- ============================================
-- 1. Dodanie roli CLIENT do enum UserRole
-- ============================================
-- UWAGA: W PostgreSQL nie można bezpośrednio dodać wartości do ENUM.
-- Trzeba użyć ALTER TYPE ... ADD VALUE

ALTER TYPE public."UserRole" ADD VALUE IF NOT EXISTS 'CLIENT';

-- ============================================
-- 2. Utworzenie tabeli audytu UserFolderAccessLog
-- ============================================

CREATE TABLE IF NOT EXISTS public."UserFolderAccessLog" (
  id serial NOT NULL,
  "userFolderAccessId" integer NULL,
  "targetUserId" text NOT NULL,
  "actorId" text NOT NULL,
  action text NOT NULL,
  "folderName" text NULL,
  "oldValue" jsonb NULL,
  "newValue" jsonb NULL,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFolderAccessLog_pkey" PRIMARY KEY (id),
  CONSTRAINT "UserFolderAccessLog_actorId_fkey" FOREIGN KEY ("actorId") 
    REFERENCES "User" (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "UserFolderAccessLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") 
    REFERENCES "User" (id) ON UPDATE CASCADE ON DELETE SET NULL
) TABLESPACE pg_default;

-- Indeksy dla szybkiego wyszukiwania
CREATE INDEX IF NOT EXISTS "UserFolderAccessLog_targetUserId_idx" 
  ON public."UserFolderAccessLog" USING btree ("targetUserId") TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "UserFolderAccessLog_actorId_idx" 
  ON public."UserFolderAccessLog" USING btree ("actorId") TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "UserFolderAccessLog_createdAt_idx" 
  ON public."UserFolderAccessLog" USING btree ("createdAt" DESC) TABLESPACE pg_default;

-- ============================================
-- 3. Komentarze do dokumentacji
-- ============================================

COMMENT ON TABLE public."UserFolderAccessLog" IS 'Tabela audytu zmian w przypisaniach folderów KI (UserFolderAccess)';
COMMENT ON COLUMN public."UserFolderAccessLog"."targetUserId" IS 'ID użytkownika, którego dotyczy zmiana przypisania';
COMMENT ON COLUMN public."UserFolderAccessLog"."actorId" IS 'ID użytkownika (ADMIN/SALES_DEPT), który wykonał akcję';
COMMENT ON COLUMN public."UserFolderAccessLog".action IS 'Typ akcji: CREATE, UPDATE, DELETE, DEACTIVATE, REACTIVATE';
COMMENT ON COLUMN public."UserFolderAccessLog"."oldValue" IS 'Stan przypisania przed zmianą (JSON)';
COMMENT ON COLUMN public."UserFolderAccessLog"."newValue" IS 'Stan przypisania po zmianie (JSON)';

-- ============================================
-- Koniec migracji
-- ============================================
