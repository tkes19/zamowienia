-- Dodanie kolumny productionroomid do tabeli User (typ INTEGER, zgodny z ProductionRoom.id)
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "productionroomid" INTEGER REFERENCES "ProductionRoom"("id");

-- Opcjonalnie: dodanie indeksu dla szybszego wyszukiwania
CREATE INDEX IF NOT EXISTS "idx_user_productionroomid" ON "User"("productionroomid");

COMMENT ON COLUMN "User"."productionroomid" IS 'ID pokoju produkcyjnego, do którego przypisany jest użytkownik (dla filtracji zleceń)';
