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
const MAX_LOG = 50;
const DRY_RUN = process.argv.includes('--dry-run');

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

async function loadSupabaseProducts() {
  const { data, error } = await supabase
    .from('Product')
    .select('id, identifier, productionPath');

  if (error) {
    console.error('❌ Błąd pobierania produktów z Supabase:', error);
    process.exit(1);
  }

  const map = new Map();
  for (const row of data || []) {
    if (!row.identifier) continue;
    map.set(row.identifier.trim(), {
      id: row.id,
      productionPath: normalize(row.productionPath),
    });
  }
  return map;
}

async function main() {
  console.log('=== Aktualizacja productionPath na podstawie Access (Sciezka) ===');
  console.log(DRY_RUN ? 'Tryb DRY-RUN – brak zapisów do bazy.' : 'Tryb AKTYWNY – wartości zostaną nadpisane.');

  const accessMap = loadAccessProductionPaths();
  console.log(`Access: znaleziono ${accessMap.size} produktów z polami Identyfikator + Sciezka.`);

  const supabaseMap = await loadSupabaseProducts();
  console.log(`Supabase: znaleziono ${supabaseMap.size} produktów z polami identifier + productionPath.`);

  const updates = [];
  const missingInSupabase = [];

  for (const [identifier, accessPathRaw] of accessMap.entries()) {
    const accessPath = normalize(accessPathRaw);
    if (!supabaseMap.has(identifier)) {
      missingInSupabase.push(identifier);
      continue;
    }
    const { id, productionPath: supaPath } = supabaseMap.get(identifier);
    if (accessPath !== supaPath) {
      updates.push({ id, identifier, accessPath });
    }
  }

  console.log(`\nPlanowane aktualizacje: ${updates.length}`);
  if (updates.length > 0) {
    updates.slice(0, MAX_LOG).forEach(item => {
      console.log(`- ${item.identifier}: nowa ścieżka "${item.accessPath}"`);
    });
    if (updates.length > MAX_LOG) {
      console.log(`… i jeszcze ${updates.length - MAX_LOG} kolejnych pozycji`);
    }
  }

  if (missingInSupabase.length > 0) {
    console.log(`\nIdentyfikatory z Access bez odpowiednika w Supabase (${missingInSupabase.length}):`);
    missingInSupabase.slice(0, MAX_LOG).forEach(id => console.log('-', id));
    if (missingInSupabase.length > MAX_LOG) {
      console.log(`… i jeszcze ${missingInSupabase.length - MAX_LOG} kolejnych pozycji`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDRY-RUN zakończony – brak zapisów.');
    return;
  }

  let success = 0;
  let failure = 0;

  for (const item of updates) {
    const { error } = await supabase
      .from('Product')
      .update({ productionPath: item.accessPath })
      .eq('id', item.id);

    if (error) {
      failure += 1;
      console.error(`❌ Nie udało się zaktualizować ${item.identifier}:`, error.message);
    } else {
      success += 1;
    }
  }

  console.log('\n=== Podsumowanie zapisów ===');
  console.log(`Udane aktualizacje: ${success}`);
  console.log(`Nieudane aktualizacje: ${failure}`);
}

main().catch(err => {
  console.error('Nieoczekiwany błąd podczas aktualizacji:', err);
  process.exit(1);
});
