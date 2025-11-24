
-- Migration: Add new fields to Product table and create Inventory table
-- Date: 2024-09-02
-- Description: Adds slug, images, new fields to Product and creates Inventory table

-- 1. Add new columns to Product table
ALTER TABLE "Product" 
ADD COLUMN "slug" TEXT,
ADD COLUMN "images" JSONB,
ADD COLUMN "new" BOOLEAN NOT NULL DEFAULT false;

-- 2. Create Inventory table
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockReserved" INTEGER NOT NULL DEFAULT 0,
    "stockOptimal" INTEGER NOT NULL DEFAULT 0,
    "stockOrdered" INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- 3. Create foreign key relationship
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Create unique constraint
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_location_key" UNIQUE ("productId", "location");

-- 5. Create indexes for better performance
CREATE INDEX "Inventory_productId_idx" ON "Inventory"("productId");
CREATE INDEX "Inventory_location_idx" ON "Inventory"("location");
CREATE INDEX "Product_slug_idx" ON "Product"("slug");
CREATE INDEX "Product_new_idx" ON "Product"("new");

-- 6. Add comments
COMMENT ON COLUMN "Product"."slug" IS 'URL-friendly nazwa produktu';
COMMENT ON COLUMN "Product"."images" IS 'Array obrazów w formacie JSON';
COMMENT ON COLUMN "Product"."new" IS 'Czy produkt jest nowością';
COMMENT ON TABLE "Inventory" IS 'Tabela stanów magazynowych produktów';

-- 7. Optional: Add some sample inventory data
-- INSERT INTO "Inventory" ("id", "productId", "stock", "stockOptimal", "location") 
-- SELECT 
--   'inv_' || "id" || '_' || extract(epoch from now()),
--   "id",
--   0,
--   100,
--   'MAIN'
-- FROM "Product" 
-- WHERE "isActive" = true;

COMMIT;
