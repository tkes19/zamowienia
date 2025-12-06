const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Wczytaj zmienne środowiskowe z backend/.env
dotenv.config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w pliku .env (backend/.env)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Ścieżka do pliku XML z Accessa (SOURCE 3/Produkty.xml względem katalogu backend)
  const xmlPath = path.join(__dirname, '..', 'SOURCE 3', 'Produkty.xml');

  if (!fs.existsSync(xmlPath)) {
    console.error('Nie znaleziono pliku XML:', xmlPath);
    process.exit(1);
  }

  console.log('Czytam dane z XML:', xmlPath);
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');

  // Proste wyciągnięcie wartości z tagów <Identyfikator>...</Identyfikator>
  const accessIdentifiers = new Set();
  const regex = /<Identyfikator>([^<]+)<\/Identyfikator>/g;
  let match;

  while ((match = regex.exec(xmlContent)) !== null) {
    const id = match[1].trim();
    if (id) {
      accessIdentifiers.add(id);
    }
  }

  console.log(`Znaleziono ${accessIdentifiers.size} identyfikatorów w danych z Accessa.`);

  // Pobierz wszystkie identyfikatory z tabeli Product w Supabase
  console.log('Pobieram identyfikatory z tabeli "Product" w Supabase...');
  const { data, error } = await supabase
    .from('Product')
    .select('identifier');

  if (error) {
    console.error('Błąd pobierania danych z Supabase:', error);
    process.exit(1);
  }

  const supabaseIdentifiers = new Set(
    (data || [])
      .map((row) => (row.identifier || '').trim())
      .filter((id) => id.length > 0)
  );

  console.log(`Znaleziono ${supabaseIdentifiers.size} identyfikatorów w Supabase (Product).`);

  // Wyznacz brakujące identyfikatory (są w Accessie, nie ma ich w Supabase)
  const missing = [];
  for (const id of accessIdentifiers) {
    if (!supabaseIdentifiers.has(id)) {
      missing.push(id);
    }
  }

  missing.sort();

  console.log('\nBrakujące identyfikatory w Supabase (występują w Accessie, brak w Product):');
  console.log('Łącznie:', missing.length);
  if (missing.length === 0) {
    console.log('(brak)');
  } else {
    for (const id of missing) {
      console.log('-', id);
    }
  }

  console.log('\nGotowe.');
}

main().catch((err) => {
  console.error('Nieoczekiwany błąd skryptu:', err);
  process.exit(1);
});
