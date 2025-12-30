const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testStatsEndpoint() {
  console.log('=== Testing /api/production/stats endpoint data ===');
  
  try {
    // Test rooms count
    const { data: rooms, error: roomsError } = await supabase
      .from('ProductionRoom')
      .select('id')
      .eq('isActive', true);
    
    if (roomsError) {
      console.error('Rooms error:', roomsError);
      return;
    }
    console.log(`Active rooms: ${rooms?.length || 0}`);
    
    // Test work centers count
    const { data: workCenters, error: centersError } = await supabase
      .from('WorkCenter')
      .select('id')
      .eq('isActive', true);
    
    if (centersError) {
      console.error('WorkCenters error:', centersError);
      return;
    }
    console.log(`Active work centers: ${workCenters?.length || 0}`);
    
    // Test work stations count
    const { data: workStations, error: stationsError } = await supabase
      .from('WorkStation')
      .select('id, status')
      .eq('isActive', true);
    
    if (stationsError) {
      console.error('WorkStations error:', stationsError);
      return;
    }
    console.log(`Active work stations: ${workStations?.length || 0}`);
    console.log(`Available stations: ${workStations?.filter(ws => ws.status === 'available').length || 0}`);
    
    // Test orders
    const { data: orders, error: ordersError } = await supabase
      .from('ProductionOrder')
      .select('status, quantity, completedquantity, createdAt, completedAt');
    
    if (ordersError) {
      console.error('Orders error:', ordersError);
      return;
    }
    console.log(`Total orders: ${orders?.length || 0}`);
    
    // Test operations
    const { data: operations, error: opsError } = await supabase
      .from('ProductionOperation')
      .select('status, assignedUserId, startedAt, completedAt');
    
    if (opsError) {
      console.error('Operations error:', opsError);
      return;
    }
    console.log(`Total operations: ${operations?.length || 0}`);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testStatsEndpoint().catch(console.error);
