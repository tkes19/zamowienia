
-- Dodaj brakujące kolumny dla czasowych znaczników
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Usuń ograniczenie NOT NULL z kolumny name w Product (bo dane mają tylko description)
ALTER TABLE "Product" ALTER COLUMN "name" DROP NOT NULL;
