const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkPaths() {
  console.log('=== Sprawdzanie ścieżek produkcyjnych ===');
  const { data: paths, error: pathsError } = await supabase
    .from('ProductionPath')
    .select('*')
    .eq('isActive', true);
    
  if (pathsError) {
    console.error('Błąd ścieżek:', pathsError);
    return;
  }
  
  console.log(`Znaleziono ${paths.length} ścieżek produkcyjnych:`);
  paths.forEach(p => {
    console.log(`- ID: ${p.id}, Kod: ${p.code}, Nazwa: ${p.name}, Operacji: ${(p.operations || []).length}`);
  });
  
  console.log('\n=== Sprawdzanie produktów i ich ścieżek ===');
  const { data: products, error: prodError } = await supabase
    .from('Product')
    .select('id, code, name, productionPath')
    .limit(10);
    
  if (prodError) {
    console.error('Błąd produktów:', prodError);
    return;
  }
  
  console.log(`Znaleziono ${products.length} produktów:`);
  products.forEach(p => {
    const path = p.productionPath || 'BRAK';
    console.log(`- Kod: ${p.code}, Ścieżka: ${path}`);
  });
  
  console.log('\n=== Sprawdzanie ostatnich ProductionOrder ===');
  const { data: orders, error: ordersError } = await supabase
    .from('ProductionOrder')
    .select('id, ordernumber, productid, productionpathexpression, status')
    .limit(5);
    
  if (ordersError) {
    console.error('Błąd zleceń:', ordersError);
    return;
  }
  
  console.log(`Znaleziono ${orders.length} zleceń produkcyjnych:`);
  orders.forEach(o => {
    console.log(`- Zlecenie: ${o.ordernumber}, Produkt: ${o.productid}, Ścieżka: ${o.productionpathexpression}, Status: ${o.status}`);
  });
  
  console.log('\n=== Sprawdzanie ostatnich ProductionWorkOrder ===');
  const { data: workOrders, error: workError } = await supabase
    .from('ProductionWorkOrder')
    .select('id, workordernumber, orderid, status')
    .limit(5);
    
  if (workError) {
    console.error('Błąd zleceń roboczych:', workError);
    return;
  }
  
  console.log(`Znaleziono ${workOrders.length} zleceń roboczych:`);
  workOrders.forEach(w => {
    console.log(`- Zlecenie: ${w.workordernumber}, Zamówienie: ${w.orderid}, Status: ${w.status}`);
  });
}

checkPaths()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Błąd:', err);
    process.exit(1);
  });
