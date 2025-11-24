-- Add new columns to Product table
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "images" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "new" BOOLEAN DEFAULT false;

-- Create Inventory table if not exists
CREATE TABLE IF NOT EXISTS "Inventory" (
    "id" TEXT PRIMARY KEY,
    "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
    "stock" INTEGER DEFAULT 0,
    "stockReserved" INTEGER DEFAULT 0,
    "stockOptimal" INTEGER DEFAULT 0,
    "stockOrdered" INTEGER DEFAULT 0,
    "reorderPoint" INTEGER DEFAULT 0,
    "location" TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT now(),
    "createdAt" TIMESTAMPTZ DEFAULT now(),
    UNIQUE("productId", "location")
);
