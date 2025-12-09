require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    console.log('=== Sprawdzanie workOrderId w ProductionOrder ===\n');
    
    // Pobierz ostatnie 15 ProductionOrder
    const { data: orders, error } = await supabase
        .from('ProductionOrder')
        .select('id, ordernumber, "workOrderId", status, quantity')
        .order('id', { ascending: false })
        .limit(15);
    
    if (error) {
        console.error('Błąd:', error);
        return;
    }
    
    console.log('Ostatnie 15 ProductionOrder:');
    orders.forEach(o => {
        console.log(`  ID: ${o.id}, numer: ${o.ordernumber}, workOrderId: ${o.workOrderId ?? o['workOrderId'] ?? 'NULL'}, status: ${o.status}`);
    });
    
    // Policz ile ma workOrderId
    const withWO = orders.filter(o => o.workOrderId || o['workOrderId']);
    console.log(`\nZ workOrderId: ${withWO.length}/${orders.length}`);
    
    // Sprawdź ProductionWorkOrder
    const { data: workOrders, error: woError } = await supabase
        .from('ProductionWorkOrder')
        .select('id, workOrderNumber, roomName, status')
        .order('id', { ascending: false })
        .limit(5);
    
    if (woError) {
        console.error('Błąd WO:', woError);
        return;
    }
    
    console.log('\nOstatnie 5 ProductionWorkOrder:');
    workOrders.forEach(wo => {
        console.log(`  ID: ${wo.id}, numer: ${wo.workOrderNumber}, pokój: ${wo.roomName}`);
    });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
