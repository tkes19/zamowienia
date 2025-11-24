-- MIGRACJA KATEGORII PRODUKTÓW - DO WYKONANIA W SUPABASE SQL EDITOR
-- Krok 1: Sprawdzenie obecnego stanu
SELECT 'Obecne produkty i ich kategorie:' as info;
SELECT identifier, category FROM "Product" ORDER BY identifier;

-- Krok 2: Backup danych
DROP TABLE IF EXISTS product_backup;
CREATE TABLE product_backup AS SELECT * FROM "Product";
SELECT 'Utworzono backup tabeli Product' as info;

-- Krok 3: Utworzenie nowego typu enum z wszystkimi kategoriami
DROP TYPE IF EXISTS "ProductCategoryNew" CASCADE;
CREATE TYPE "ProductCategoryNew" AS ENUM (
  'MAGNESY',
  'BRELOKI', 
  'OTWIERACZE',
  'CERAMIKA_I_SZKLO',
  'DLUGOPISY',
  'CZAPKI_I_NAKRYCIA_GLOWY',
  'BRANSOLETKI',
  'TEKSTYLIA',
  'OZDOBY_DOMOWE',
  'AKCESORIA_PODROZNE',
  'DLA_DZIECI',
  'ZAPALNICZKI_I_POPIELNICZKI',
  'UPOMINKI_BIZNESOWE',
  'ZESTAWY'
);

-- Krok 4: Dodanie nowej kolumny z nowym typem
ALTER TABLE "Product" ADD COLUMN new_category "ProductCategoryNew";

-- Krok 5: Mapowanie starych kategorii na nowe
UPDATE "Product" SET new_category = 'MAGNESY'::ProductCategoryNew 
WHERE category = 'LOCATION_BASED';

UPDATE "Product" SET new_category = 'BRELOKI'::ProductCategoryNew 
WHERE category = 'CLIENT_CUSTOM';

UPDATE "Product" SET new_category = 'DLUGOPISY'::ProductCategoryNew 
WHERE category = 'NAME_BASED';

UPDATE "Product" SET new_category = 'TEKSTYLIA'::ProductCategoryNew 
WHERE category = 'HASLA';

UPDATE "Product" SET new_category = 'UPOMINKI_BIZNESOWE'::ProductCategoryNew 
WHERE category = 'OKOLICZNOSCIOWE';

-- Krok 6: Usunięcie starej kolumny i zmiana nazwy nowej
ALTER TABLE "Product" DROP COLUMN category;
ALTER TABLE "Product" RENAME COLUMN new_category TO category;

-- Krok 7: Usunięcie starego typu
DROP TYPE IF EXISTS "ProductCategory";

-- Krok 8: Zmiana nazwy nowego typu
ALTER TYPE "ProductCategoryNew" RENAME TO "ProductCategory";

-- Krok 9: Dodanie NOT NULL constraint
ALTER TABLE "Product" ALTER COLUMN category SET NOT NULL;

-- Krok 10: Sprawdzenie wyników
SELECT 'Migracja zakończona! Nowe kategorie:' as info;
SELECT category, count(*) as count 
FROM "Product" 
GROUP BY category 
ORDER BY category;

SELECT 'Wszystkie produkty po migracji:' as info;
SELECT identifier, category FROM "Product" ORDER BY identifier;
