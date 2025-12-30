const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testFullStats() {
  console.log('=== Testing complete stats endpoint logic ===');
  
  try {
    // Test all queries exactly as in the endpoint
    const { data: orders, error: ordersError } = await supabase
      .from('ProductionOrder')
      .select('status, quantity, completedquantity, createdat, actualenddate');
    
    if (ordersError) {
      console.error('Orders query failed:', ordersError);
      return;
    }
    console.log(`Orders: ${orders?.length || 0}`);

    const { data: operations, error: opsError } = await supabase
      .from('ProductionOperation')
      .select('status, operatorid, starttime, endtime');

    if (opsError) {
      console.error('Operations query failed:', opsError);
      return;
    }
    console.log(`Operations: ${operations?.length || 0}`);

    // Test the new queries
    const { data: rooms, error: roomsError } = await supabase
      .from('ProductionRoom')
      .select('id')
      .eq('isActive', true);
    
    if (roomsError) {
      console.error('Rooms query failed:', roomsError);
      return;
    }
    console.log(`Active rooms: ${rooms?.length || 0}`);
    
    const { data: workCenters, error: centersError } = await supabase
      .from('WorkCenter')
      .select('id')
      .eq('isActive', true);
    
    if (centersError) {
      console.error('WorkCenters query failed:', centersError);
      return;
    }
    console.log(`Active work centers: ${workCenters?.length || 0}`);
    
    const { data: workStations, error: stationsError } = await supabase
      .from('WorkStation')
      .select('id, status')
      .eq('isActive', true);
    
    if (stationsError) {
      console.error('WorkStations query failed:', stationsError);
      return;
    }
    console.log(`Active work stations: ${workStations?.length || 0}`);
    
    // Build the stats object exactly as the endpoint does
    const stats = {
      rooms: rooms?.length || 0,
      workCenters: workCenters?.length || 0,
      workStations: workStations?.length || 0,
      workStationsByStatus: {
        available: workStations?.filter(ws => ws.status === 'available').length || 0,
        in_use: workStations?.filter(ws => ws.status === 'in_use').length || 0,
        maintenance: workStations?.filter(ws => ws.status === 'maintenance').length || 0,
        breakdown: workStations?.filter(ws => ws.status === 'breakdown').length || 0
      },
      totalOrders: orders?.length || 0,
      completedOrders: orders?.filter(o => o.status === 'COMPLETED').length || 0,
      inProgressOrders: orders?.filter(o => o.status === 'IN_PROGRESS').length || 0,
      totalOperations: operations?.length || 0,
      activeOperations: operations?.filter(o => o.status === 'active').length || 0,
      completedOperations: operations?.filter(o => o.status === 'completed').length || 0
    };
    
    console.log('\n=== Final stats object ===');
    console.log(JSON.stringify(stats, null, 2));
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testFullStats().catch(console.error);
