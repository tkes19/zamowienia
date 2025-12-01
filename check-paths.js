const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkProductionPaths() {
  try {
    const { data, error } = await supabase
      .from('Product')
      .select('identifier, productionPath')
      .not('productionPath', 'is', null)
      .limit(20);
    
    if (error) {
      console.error('Błąd:', error.message);
      return;
    }
    
    console.log('Ścieżki produkcyjne w bazie danych:');
    console.log('=====================================');
    data.forEach((row, index) => {
      console.log(`${index + 1}. ${row.identifier}: ${row.productionPath}`);
    });
    
    console.log('\nPodsumowanie:');
    console.log(`Liczba produktów ze ścieżką: ${data.length}`);
    
    // Grupowanie według ścieżek
    const grouped = {};
    data.forEach(row => {
      const path = row.productionPath || 'Brak ścieżki';
      if (!grouped[path]) grouped[path] = [];
      grouped[path].push(row.identifier);
    });
    
    console.log('\nGrupy produktów według ścieżek:');
    Object.entries(grouped).forEach(([path, products]) => {
      console.log(`\n"${path}":`);
      products.forEach(product => console.log(`  - ${product}`));
    });
    
  } catch (error) {
    console.error('Błąd:', error.message);
  }
}

checkProductionPaths();
