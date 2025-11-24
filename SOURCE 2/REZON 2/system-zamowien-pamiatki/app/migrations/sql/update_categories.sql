-- Backup istniejących danych przed migracją
CREATE TABLE IF NOT EXISTS product_backup AS SELECT * FROM "Product";

-- Krok 1: Dodaj nowe wartości do enum ProductCategory
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'MAGNESY';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'BRELOKI';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'OTWIERACZE';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'CERAMIKA_I_SZKLO';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'DLUGOPISY';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'CZAPKI_I_NAKRYCIA_GLOWY';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'BRANSOLETKI';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'TEKSTYLIA';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'OZDOBY_DOMOWE';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'AKCESORIA_PODROZNE';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'DLA_DZIECI';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'ZAPALNICZKI_I_POPIELNICZKI';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'UPOMINKI_BIZNESOWE';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'ZESTAWY';

-- Krok 2: Migracja danych - mapowanie starych kategorii na nowe
UPDATE "Product" SET category = 'MAGNESY' WHERE category = 'LOCATION_BASED';
UPDATE "Product" SET category = 'BRELOKI' WHERE category = 'CLIENT_CUSTOM'; 
UPDATE "Product" SET category = 'DLUGOPISY' WHERE category = 'NAME_BASED';
UPDATE "Product" SET category = 'TEKSTYLIA' WHERE category = 'HASLA';
UPDATE "Product" SET category = 'UPOMINKI_BIZNESOWE' WHERE category = 'OKOLICZNOSCIOWE';

-- Sprawdzenie wyników migracji
SELECT category, count(*) as count FROM "Product" GROUP BY category ORDER BY category;
