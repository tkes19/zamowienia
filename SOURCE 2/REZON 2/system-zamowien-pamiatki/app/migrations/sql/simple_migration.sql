-- PROSTA MIGRACJA KATEGORII - KROK PO KROKU
-- Wykonaj każdy blok osobno w Supabase SQL Editor

-- BLOK 1: Sprawdzenie obecnego stanu
SELECT 'BLOK 1: Obecny stan produktów' as status;
SELECT identifier, category FROM "Product" ORDER BY identifier;

-- BLOK 2: Tworzenie backupu
SELECT 'BLOK 2: Tworzenie backupu' as status;
DROP TABLE IF EXISTS product_backup;
CREATE TABLE product_backup AS SELECT * FROM "Product";
SELECT 'Backup utworzony - ' || count(*) || ' rekordów' as info FROM product_backup;

-- BLOK 3: Tworzenie nowego typu enum (wykonaj osobno)
SELECT 'BLOK 3: Tworzenie nowego typu' as status;
DROP TYPE IF EXISTS productcategorynew CASCADE;
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

-- BLOK 4: Dodanie nowej kolumny
SELECT 'BLOK 4: Dodanie nowej kolumny' as status;
ALTER TABLE "Product" DROP COLUMN IF EXISTS new_category;
ALTER TABLE "Product" ADD COLUMN new_category productcategorynew;

-- BLOK 5: Mapowanie danych
SELECT 'BLOK 5: Mapowanie starych kategorii na nowe' as status;
UPDATE "Product" SET new_category = 'MAGNESY'::productcategorynew WHERE category = 'LOCATION_BASED';
UPDATE "Product" SET new_category = 'BRELOKI'::productcategorynew WHERE category = 'CLIENT_CUSTOM';
UPDATE "Product" SET new_category = 'DLUGOPISY'::productcategorynew WHERE category = 'NAME_BASED';
UPDATE "Product" SET new_category = 'TEKSTYLIA'::productcategorynew WHERE category = 'HASLA';
UPDATE "Product" SET new_category = 'UPOMINKI_BIZNESOWE'::productcategorynew WHERE category = 'OKOLICZNOSCIOWE';

-- Sprawdzenie mapowania
SELECT 'Sprawdzenie mapowania:' as info;
SELECT 
  category as stara_kategoria,
  new_category as nowa_kategoria,
  count(*) as ilosc
FROM "Product" 
GROUP BY category, new_category 
ORDER BY category;

-- BLOK 6: Usunięcie starej kolumny
SELECT 'BLOK 6: Usunięcie starej kolumny' as status;
ALTER TABLE "Product" DROP COLUMN category;

-- BLOK 7: Zmiana nazwy nowej kolumny
SELECT 'BLOK 7: Zmiana nazwy kolumny' as status;
ALTER TABLE "Product" RENAME COLUMN new_category TO category;

-- BLOK 8: Usunięcie starego typu i zmiana nazwy nowego
SELECT 'BLOK 8: Finalizacja typów' as status;
DROP TYPE IF EXISTS "ProductCategory";
ALTER TYPE productcategorynew RENAME TO "ProductCategory";

-- BLOK 9: Ustawienie NOT NULL
SELECT 'BLOK 9: Ustawienie ograniczeń' as status;
ALTER TABLE "Product" ALTER COLUMN category SET NOT NULL;

-- BLOK 10: Finalne sprawdzenie
SELECT 'BLOK 10: MIGRACJA ZAKOŃCZONA!' as status;
SELECT 'Nowe kategorie:' as info;
SELECT category, count(*) as ilosc 
FROM "Product" 
GROUP BY category 
ORDER BY category;

SELECT 'Wszystkie produkty:' as info;
SELECT identifier, category FROM "Product" ORDER BY identifier;
