-- JEDNOKRATOWA MIGRACJA - WYKONAJ CAŁY BLOK NARAZ

-- Backup
CREATE TABLE IF NOT EXISTS product_backup AS SELECT * FROM "Product";

-- Usuń stare typy jeśli istnieją
DROP TYPE IF EXISTS productcategorynew CASCADE;
DROP TYPE IF EXISTS "ProductCategory" CASCADE;

-- Nowy typ enum (małe litery żeby uniknąć problemów)
CREATE TYPE productcategorynew AS ENUM (
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

-- Dodaj nową kolumnę
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS new_category productcategorynew;

-- Mapuj dane
UPDATE "Product" SET new_category = 
  CASE 
    WHEN category::text = 'LOCATION_BASED' THEN 'MAGNESY'::productcategorynew
    WHEN category::text = 'CLIENT_CUSTOM' THEN 'BRELOKI'::productcategorynew
    WHEN category::text = 'NAME_BASED' THEN 'DLUGOPISY'::productcategorynew
    WHEN category::text = 'HASLA' THEN 'TEKSTYLIA'::productcategorynew
    WHEN category::text = 'OKOLICZNOSCIOWE' THEN 'UPOMINKI_BIZNESOWE'::productcategorynew
    ELSE 'MAGNESY'::productcategorynew
  END;

-- Usuń starą kolumnę
ALTER TABLE "Product" DROP COLUMN IF EXISTS category;

-- Zmień nazwę nowej kolumny
ALTER TABLE "Product" RENAME COLUMN new_category TO category;

-- Zmień nazwę typu
ALTER TYPE productcategorynew RENAME TO "ProductCategory";

-- NOT NULL constraint
ALTER TABLE "Product" ALTER COLUMN category SET NOT NULL;

-- Sprawdzenie
SELECT 'MIGRACJA ZAKOŃCZONA!' as status;
SELECT category, count(*) as count FROM "Product" GROUP BY category ORDER BY category;
SELECT identifier, category FROM "Product" ORDER BY identifier;
