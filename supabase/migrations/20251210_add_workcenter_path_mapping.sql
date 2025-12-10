-- Migracja: Mapowanie ścieżek do gniazd produkcyjnych
-- Data: 2025-12-10
-- Cel: Dynamiczne przypisywanie kodów ścieżek do WorkCenter (gniazd)

CREATE TABLE IF NOT EXISTS public."WorkCenterPathMapping" (
  id serial PRIMARY KEY,
  workCenterId integer NOT NULL REFERENCES public."WorkCenter"(id) ON DELETE CASCADE,
  pathCode varchar(20) NOT NULL,
  -- Kod ścieżki, np. '1', '2', '3', '5.1'
  
  isActive boolean NOT NULL DEFAULT true,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "WorkCenterPathMapping_unique" UNIQUE (workCenterId, pathCode)
);

CREATE INDEX IF NOT EXISTS "WorkCenterPathMapping_workCenterId_idx"
  ON public."WorkCenterPathMapping" USING btree (workCenterId);

CREATE INDEX IF NOT EXISTS "WorkCenterPathMapping_pathCode_idx"
  ON public."WorkCenterPathMapping" USING btree (pathCode);

CREATE INDEX IF NOT EXISTS "WorkCenterPathMapping_isActive_idx"
  ON public."WorkCenterPathMapping" USING btree (isActive);

-- Komentarze
COMMENT ON TABLE public."WorkCenterPathMapping" IS 'Mapowanie kodów ścieżek produkcyjnych do gniazd (WorkCenter). Używane w Kanbanie do filtrowania produktów.';
COMMENT ON COLUMN public."WorkCenterPathMapping".workCenterId IS 'ID gniazda produkcyjnego (WorkCenter).';
COMMENT ON COLUMN public."WorkCenterPathMapping".pathCode IS 'Kod ścieżki (np. 1, 2, 3, 5.1). Produkty z tym kodem będą widoczne w Kanbanie dla tego gniazda.';
COMMENT ON COLUMN public."WorkCenterPathMapping".isActive IS 'Czy mapowanie jest aktywne. Można wyłączyć bez usuwania.';
