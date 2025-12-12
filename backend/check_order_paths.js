const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkOrderPaths() {
    console.log('=== Sprawdzanie ścieżek dla zamówienia 2025/9/MŁU ===');
    
    // Znajdź zamówienie
    const { data: order } = await supabase
        .from('Order')
        .select('id')
        .eq('orderNumber', '2025/9/MŁU')
        .single();
    
    if (!order) {
        console.error('Nie znaleziono zamówienia');
        return;
    }
    
    // Pobierz pozycje zamówienia
    const { data: items } = await supabase
        .from('OrderItem')
        .select(`
            id, quantity,
            Product(id, name, code, productionPath)
        `)
        .eq('orderId', order.id);
    
    console.log('\nPozycje zamówienia:');
    const paths = new Map();
    
    items.forEach((item, i) => {
        const path = item.Product?.productionPath || 'BRAK';
        console.log(`\n${i+1}. ${item.Product?.name || 'BRAK'}`);
        console.log(`   Kod: ${item.Product?.code || 'BRAK'}`);
        console.log(`   Ilość: ${item.quantity}`);
        console.log(`   Ścieżka: ${path}`);
        
        if (!paths.has(path)) {
            paths.set(path, []);
        }
        paths.get(path).push(item);
    });
    
    console.log('\n\n=== Grupowanie według ścieżek ===');
    paths.forEach((items, path) => {
        console.log(`\nŚcieżka "${path}" (${items.length} pozycji):`);
        items.forEach(item => {
            console.log(`  - ${item.Product?.name} (${item.Product?.code})`);
        });
    });
    
    console.log(`\nLiczba unikalnych ścieżek: ${paths.size}`);
    console.log('Powinno powstać tyle ZP, ile unikalnych ścieżek.');
}

checkOrderPaths()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Błąd:', err);
        process.exit(1);
    });
