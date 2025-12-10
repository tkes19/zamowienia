const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('⚠️  Ustaw SUPABASE_URL oraz SUPABASE_SERVICE_ROLE_KEY w pliku backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ACCESS_XML_PATH = path.join(__dirname, '..', 'SOURCE 3', 'Produkty.xml');
const MAX_ITEMS_TO_PRINT = 50;

function normalize(value) {
  return (value ?? '').trim();
}

function extractTagValue(block, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = regex.exec(block);
  if (!match) return null;
  return normalize(match[1].replace(/\r?\n/g, ' '));
}

function loadAccessProductionPaths() {
  if (!fs.existsSync(ACCESS_XML_PATH)) {
    console.error('⚠️  Nie znaleziono pliku z Accessa:', ACCESS_XML_PATH);
    process.exit(1);
  }

  const xmlContent = fs.readFileSync(ACCESS_XML_PATH, 'utf8');
  const productRegex = /<Produkty>([\s\S]*?)<\/Produkty>/gi;
  const map = new Map();

  let match;
  while ((match = productRegex.exec(xmlContent)) !== null) {
    const block = match[1];
    const identifier = extractTagValue(block, 'Identyfikator');
    if (!identifier) continue;
    const pathValue = extractTagValue(block, 'Sciezka');
    map.set(identifier, pathValue || '');
  }

  return map;
}

async function loadSupabaseProductionPaths() {
  const { data, error } = await supabase.from('Product').select('identifier, productionPath');
  if (error) {
    console.error('❌ Błąd pobierania produktów z Supabase:', error);
    process.exit(1);
  }

  const map = new Map();
  for (const row of data || []) {
    if (!row.identifier) continue;
    map.set(row.identifier.trim(), normalize(row.productionPath));
  }
  return map;
}

function printSample(label, items) {
  if (items.length === 0) return;
  console.log(`\n${label} (max ${MAX_ITEMS_TO_PRINT}):`);
  items.slice(0, MAX_ITEMS_TO_PRINT).forEach(item => console.log('-', item));
  if (items.length > MAX_ITEMS_TO_PRINT) {
    console.log(`… i jeszcze ${items.length - MAX_ITEMS_TO_PRINT} kolejnych pozycji`);
  }
}

async function main() {
  console.log('=== Porównanie ścieżek produkcyjnych (Access vs Supabase) ===');
  const accessMap = loadAccessProductionPaths();
  console.log(`Access: ${accessMap.size} produktów z polami Identyfikator + Sciezka`);

  const supabaseMap = await loadSupabaseProductionPaths();
  console.log(`Supabase: ${supabaseMap.size} produktów z polami identifier + productionPath`);

  const missingInSupabase = [];
  const missingInAccess = [];
  const mismatchedPaths = [];

  for (const [identifier, accessPathRaw] of accessMap.entries()) {
    const accessPath = normalize(accessPathRaw);
    if (!supabaseMap.has(identifier)) {
      missingInSupabase.push(identifier);
      continue;
    }
    const supaPath = supabaseMap.get(identifier);
    if (accessPath !== supaPath) {
      mismatchedPaths.push({
        identifier,
        accessPath: accessPath || '(puste)',
        supabasePath: supaPath || '(puste)',
      });
    }
  }

  for (const identifier of supabaseMap.keys()) {
    if (!accessMap.has(identifier)) {
      missingInAccess.push(identifier);
    }
  }

  const status =
    (missingInSupabase.length > 0 ? 1 : 0) ||
    (missingInAccess.length > 0 ? 1 : 0) ||
    (mismatchedPaths.length > 0 ? 1 : 0);

  console.log('\n=== Podsumowanie ===');
  console.log(`Brakujące w Supabase: ${missingInSupabase.length}`);
  console.log(`Brakujące w Access: ${missingInAccess.length}`);
  console.log(`Różne wartości Sciezka vs productionPath: ${mismatchedPaths.length}`);

  printSample('Identyfikatory obecne w Access, brak w Supabase', missingInSupabase);
  printSample('Identyfikatory obecne w Supabase, brak w Access', missingInAccess);

  if (mismatchedPaths.length > 0) {
    console.log('\nPrzykłady niezgodnych ścieżek (max 50):');
    mismatchedPaths.slice(0, MAX_ITEMS_TO_PRINT).forEach(item => {
      console.log(
        `- ${item.identifier}: Access="${item.accessPath}" vs Supabase="${item.supabasePath}"`
      );
    });
    if (mismatchedPaths.length > MAX_ITEMS_TO_PRINT) {
      console.log(`… i jeszcze ${mismatchedPaths.length - MAX_ITEMS_TO_PRINT} kolejnych różnic`);
    }
  }

  if (status !== 0) {
    console.error('\n❌ Wykryto rozbieżności – sprawdź log powyżej.');
    process.exit(1);
  }

  console.log('\n✅ Ścieżki produkcyjne są zgodne.');
}

main().catch(err => {
  console.error('Nieoczekiwany błąd testu porównawczego:', err);
  process.exit(1);
});
