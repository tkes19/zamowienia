const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mapowanie starych kategorii na nowe - domyślne przyporządkowanie
const categoryMapping = {
  LOCATION_BASED: 'MAGNESY', // Produkty lokalizacyjne -> Magnesy (najpopularniejsze pamiątki lokalizacyjne)
  CLIENT_CUSTOM: 'BRELOKI', // Personalizowane dla klientów -> Breloki
  NAME_BASED: 'DLUGOPISY', // Imienne -> Długopisy (popularne personalizowane przedmioty)
  HASLA: 'TEKSTYLIA', // Hasła -> Tekstylia
  OKOLICZNOSCIOWE: 'UPOMINKI_BIZNESOWE', // Okolicznościowe -> Upominki biznesowe
};

async function migrateCategories() {
  try {
    console.log('🔄 Rozpoczynam migrację kategorii produktów...\n');

    // Pobranie wszystkich produktów
    const { data: products, error: fetchError } = await supabase
      .from('Product')
      .select('id, identifier, category');

    if (fetchError) {
      console.error('❌ Błąd przy pobieraniu produktów:', fetchError);
      return;
    }

    console.log(`📦 Znaleziono ${products.length} produktów do migracji\n`);

    // Migracja każdego produktu
    for (const product of products) {
      const newCategory = categoryMapping[product.category] || 'MAGNESY'; // domyślnie MAGNESY

      const { error: updateError } = await supabase
        .from('Product')
        .update({ category: newCategory })
        .eq('id', product.id);

      if (updateError) {
        console.error(`❌ Błąd przy aktualizacji produktu ${product.identifier}:`, updateError);
        continue;
      }

      console.log(`✅ ${product.identifier}: ${product.category} → ${newCategory}`);
    }

    console.log('\n🎉 Migracja kategorii zakończona pomyślnie!');

    // Sprawdzenie wyników
    const { data: updatedProducts } = await supabase.from('Product').select('category');

    const newCategories = [...new Set(updatedProducts.map(p => p.category))];
    console.log('\n📊 Nowe kategorie w bazie:');
    newCategories.forEach(cat => console.log(`- ${cat}`));
  } catch (e) {
    console.error('❌ Błąd podczas migracji:', e);
  }
}

migrateCategories();
