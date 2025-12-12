const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Pobierz numer zamówienia z argumentu wiersza poleceń
const orderNumber = process.argv[2];

if (!orderNumber) {
    console.log('Użycie: node check_order_workorders.js <numer_zamówienia>');
    console.log('Przykład: node check_order_workorders.js 2025/9/MŁU');
    process.exit(1);
}

async function checkOrderWorkOrders() {
    console.log(`=== Sprawdzanie zleceń dla zamówienia ${orderNumber} ===`);
    
    // Znajdź zamówienie
    const { data: order, error: orderError } = await supabase
        .from('Order')
        .select('id, orderNumber, status')
        .eq('orderNumber', orderNumber)
        .single();
    
    if (orderError || !order) {
        console.error('Nie znaleziono zamówienia:', orderNumber);
        return;
    }
    
    console.log(`\nZnaleziono zamówienie: ID=${order.id}, status=${order.status}`);
    
    // Pobierz pozycje zamówienia
    const { data: items } = await supabase
        .from('OrderItem')
        .select(`
            id, quantity,
            Product(id, name, code, productionPath)
        `)
        .eq('orderId', order.id);
    
    console.log(`\nPozycje zamówienia (${items?.length || 0}):`);
    const paths = new Set();
    items?.forEach((item, i) => {
        const path = item.Product?.productionPath || 'BRAK';
        paths.add(path);
        console.log(`  ${i+1}. ${item.Product?.name || 'BRAK'} (${item.Product?.code})`);
        console.log(`      Ilość: ${item.quantity}, Ścieżka: ${path}`);
    });
    
    console.log(`\nUnikalne ścieżki produkcyjne: ${Array.from(paths).join(', ')}`);
    
    // Pobierz ProductionWorkOrder dla tego zamówienia
    const { data: workOrders, error: woError } = await supabase
        .from('ProductionWorkOrder')
        .select('id, workOrderNumber, roomName, status, "createdAt"')
        .eq('sourceOrderId', order.id)
        .order('workOrderNumber');
    
    if (woError) {
        console.error('Błąd pobierania zleceń:', woError);
        return;
    }
    
    console.log(`\nProductionWorkOrder dla zamówienia (${workOrders?.length || 0}):`);
    workOrders?.forEach((wo, i) => {
        console.log(`  ${i+1}. ${wo.workOrderNumber} - ${wo.roomName}`);
        console.log(`      ID: ${wo.id}, Status: ${wo.status}`);
        console.log(`      URL do druku: /api/production/work-orders/${wo.id}/print`);
    });
    
    if (workOrders && workOrders.length > 1) {
        console.log(`\n✅ To zamówienie ma ${workOrders.length} zlecenia produkcyjne - powinny otworzyć się ${workOrders.length} okienka/karty`);
    } else if (workOrders && workOrders.length === 1) {
        console.log(`\n⚠️ To zamówienie ma tylko 1 zlecenie produkcyjne - dlatego otwiera się tylko 1 PDF`);
    } else {
        console.log(`\n❌ To zamówienie nie ma żadnych zleceń produkcyjnych`);
        console.log(`   Status zamówienia: ${order.status}`);
        if (order.status !== 'APPROVED') {
            console.log(`   Zamówienie musi mieć status 'APPROVED' aby wygenerować zlecenia produkcyjne`);
        }
    }
}

checkOrderWorkOrders()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Błąd:', err);
        process.exit(1);
    });
