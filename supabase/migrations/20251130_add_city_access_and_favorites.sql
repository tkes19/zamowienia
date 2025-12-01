-- Migracja: Dodanie przypisań miejscowości i ulubionych
-- Data: 2025-11-30
-- Autor: Cascade

-- ============================================
-- 1. Tabela przypisań miejscowości do użytkowników
-- ============================================

CREATE TABLE IF NOT EXISTS public."UserCityAccess" (
  id serial NOT NULL,
  "userId" text NOT NULL,
  "cityName" text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "assignedBy" text NULL,
  "notes" text NULL,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCityAccess_pkey" PRIMARY KEY (id),
  CONSTRAINT "UserCityAccess_userId_fkey" FOREIGN KEY ("userId") 
    REFERENCES "User" (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "UserCityAccess_assignedBy_fkey" FOREIGN KEY ("assignedBy") 
    REFERENCES "User" (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "UserCityAccess_userId_cityName_unique" UNIQUE ("userId", "cityName")
) TABLESPACE pg_default;

-- Indeksy dla szybkiego wyszukiwania
CREATE INDEX IF NOT EXISTS "UserCityAccess_userId_idx" 
  ON public."UserCityAccess" USING btree ("userId") TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "UserCityAccess_cityName_idx" 
  ON public."UserCityAccess" USING btree ("cityName") TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "UserCityAccess_isActive_idx" 
  ON public."UserCityAccess" USING btree ("isActive") TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "UserCityAccess_createdAt_idx" 
  ON public."UserCityAccess" USING btree ("createdAt" DESC) TABLESPACE pg_default;

-- ============================================
-- 2. Tabela audytu zmian w przypisaniach miejscowości
-- ============================================

CREATE TABLE IF NOT EXISTS public."UserCityAccessLog" (
  id serial NOT NULL,
  "userCityAccessId" integer NULL,
  "targetUserId" text NOT NULL,
  "actorId" text NOT NULL,
  action text NOT NULL,
  "cityName" text NULL,
  "oldValue" jsonb NULL,
  "newValue" jsonb NULL,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserCityAccessLog_pkey" PRIMARY KEY (id),
  CONSTRAINT "UserCityAccessLog_actorId_fkey" FOREIGN KEY ("actorId") 
    REFERENCES "User" (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT "UserCityAccessLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") 
    REFERENCES "User" (id) ON UPDATE CASCADE ON DELETE SET NULL
) TABLESPACE pg_default;

-- Indeksy dla audytu
CREATE INDEX IF NOT EXISTS "UserCityAccessLog_targetUserId_idx" 
  ON public."UserCityAccessLog" USING btree ("targetUserId") TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "UserCityAccessLog_actorId_idx" 
  ON public."UserCityAccessLog" USING btree ("actorId") TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "UserCityAccessLog_createdAt_idx" 
  ON public."UserCityAccessLog" USING btree ("createdAt" DESC) TABLESPACE pg_default;

-- ============================================
-- 3. Tabela ulubionych pozycji użytkownika
-- ============================================

CREATE TABLE IF NOT EXISTS public."UserFavorites" (
  id serial NOT NULL,
  "userId" text NOT NULL,
  type text NOT NULL CHECK (type IN ('city', 'ki_object')),
  "itemId" text NOT NULL,
  "displayName" text NOT NULL,
  metadata jsonb NULL,
  "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFavorites_pkey" PRIMARY KEY (id),
  CONSTRAINT "UserFavorites_userId_fkey" FOREIGN KEY ("userId") 
    REFERENCES "User" (id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "UserFavorites_userId_type_itemId_unique" UNIQUE ("userId", "type", "itemId")
) TABLESPACE pg_default;

-- Indeksy dla ulubionych
CREATE INDEX IF NOT EXISTS "UserFavorites_userId_idx" 
  ON public."UserFavorites" USING btree ("userId", "type") TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "UserFavorites_type_idx" 
  ON public."UserFavorites" USING btree ("type") TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS "UserFavorites_createdAt_idx" 
  ON public."UserFavorites" USING btree ("createdAt" DESC) TABLESPACE pg_default;

-- ============================================
-- 4. Funkcja do automatycznej aktualizacji updatedAt
-- ============================================

CREATE OR REPLACE FUNCTION public.update_user_city_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "UserCityAccess_updated_at_trigger"
    BEFORE UPDATE ON public."UserCityAccess"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_city_access_updated_at();

-- ============================================
-- 5. Komentarze do dokumentacji
-- ============================================

COMMENT ON TABLE public."UserCityAccess" IS 'Przypisania miejscowości do użytkowników (handlowców)';
COMMENT ON COLUMN public."UserCityAccess"."userId" IS 'ID użytkownika (handlowca)';
COMMENT ON COLUMN public."UserCityAccess"."cityName" IS 'Nazwa miejscowości';
COMMENT ON COLUMN public."UserCityAccess"."isActive" IS 'Czy przypisanie jest aktywne';
COMMENT ON COLUMN public."UserCityAccess"."assignedBy" IS 'Kto przypisał miejscowość (ADMIN/SALES_DEPT)';
COMMENT ON COLUMN public."UserCityAccess"."notes" IS 'Notatki do przypisania';

COMMENT ON TABLE public."UserCityAccessLog" IS 'Tabela audytu zmian w przypisaniach miejscowości';
COMMENT ON COLUMN public."UserCityAccessLog"."targetUserId" IS 'ID użytkownika, którego dotyczy zmiana';
COMMENT ON COLUMN public."UserCityAccessLog"."actorId" IS 'ID użytkownika, który wykonał akcję';
COMMENT ON COLUMN public."UserCityAccessLog".action IS 'Typ akcji: CREATE, UPDATE, DELETE, DEACTIVATE, REACTIVATE';
COMMENT ON COLUMN public."UserCityAccessLog"."oldValue" IS 'Stan przypisania przed zmianą (JSON)';
COMMENT ON COLUMN public."UserCityAccessLog"."newValue" IS 'Stan przypisania po zmianie (JSON)';

COMMENT ON TABLE public."UserFavorites" IS 'Ulubione pozycje użytkownika (miejscowości i obiekty KI)';
COMMENT ON COLUMN public."UserFavorites"."userId" IS 'ID użytkownika';
COMMENT ON COLUMN public."UserFavorites".type IS 'Typ ulubionej pozycji: city lub ki_object';
COMMENT ON COLUMN public."UserFavorites"."itemId" IS 'ID pozycji (nazwa miejscowości lub ID obiektu)';
COMMENT ON COLUMN public."UserFavorites"."displayName" IS 'Przyjazna nazwa do wyświetlania';
COMMENT ON COLUMN public."UserFavorites".metadata IS 'Dodatkowe dane (JSON)';

-- ============================================
-- 6. Dane testowe (opcjonalnie)
-- ============================================

-- Przykładowe przypisania dla testów (można zakomentować w produkcji)
INSERT INTO public."UserCityAccess" ("userId", "cityName", "assignedBy", "notes")
SELECT 
  u.id,
  city,
  (SELECT id FROM "User" WHERE role = 'ADMIN' LIMIT 1),
  'Przypisanie testowe'
FROM "User" u, 
unnest(ARRAY['Warszawa', 'Kraków', 'Gdańsk', 'Wrocław', 'Poznań']) AS city
WHERE u.role = 'SALES_REP'
LIMIT 15;

-- Przykładowe ulubione (można zakomentować w produkcji)
INSERT INTO public."UserFavorites" ("userId", type, "itemId", "displayName", metadata)
SELECT 
  u.id,
  'city',
  city,
  city,
  '{"projectCount": 10}'
FROM "User" u, 
unnest(ARRAY['Warszawa', 'Kraków']) AS city
WHERE u.role = 'SALES_REP'
LIMIT 6;

-- ============================================
-- Koniec migracji
-- ============================================
