
-- Dodaj brakujące kolumny do tabeli User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyName" TEXT;

-- Dodaj brakujące kolumny do tabeli Customer  
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "salesRepId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "zipCode" TEXT;

-- Dodaj brakujące kolumny do tabeli Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "identifier" TEXT UNIQUE;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "index" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE "Product" DROP COLUMN IF EXISTS "name";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "availability";

-- Dodaj klucz obcy dla salesRepId
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_salesRepId_fkey" 
  FOREIGN KEY ("salesRepId") REFERENCES "User"("id") ON DELETE SET NULL;
