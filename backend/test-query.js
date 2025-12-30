const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testQuery() {
  console.log('Testing nested query...');
  
  // Test the exact query from the endpoint
  const { data, error } = await supabase
    .from('WorkStation')
    .select(`
      *,
      workCenter:WorkCenter!workCenterId(
        id, 
        name, 
        code,
        room:ProductionRoom!roomId(id, name, code)
      )
    `)
    .eq('isActive', true)
    .order('name');
  
  if (error) {
    console.error('Query error:', error);
    return;
  }
  
  console.log('WorkStations found:', data?.length || 0);
  console.log('First WorkStation:');
  console.log(JSON.stringify(data?.[0], null, 2));
  
  // Try a simpler query without nested room
  console.log('\n--- Testing simpler query ---');
  const { data: simple, error: simpleError } = await supabase
    .from('WorkStation')
    .select(`
      *,
      workCenter:WorkCenter!workCenterId(id, name, code, roomId)
    `)
    .eq('isActive', true)
    .limit(1);
  
  if (simpleError) {
    console.error('Simple query error:', simpleError);
  } else {
    console.log('Simple query result:');
    console.log(JSON.stringify(simple?.[0], null, 2));
    
    // Now query the room separately using the roomId
    if (simple?.[0]?.workCenter?.roomId) {
      console.log('\n--- Testing separate room query ---');
      const { data: room, error: roomError } = await supabase
        .from('ProductionRoom')
        .select('id, name, code')
        .eq('id', simple[0].workCenter.roomId)
        .single();
      
      if (roomError) {
        console.error('Room query error:', roomError);
      } else {
        console.log('Room data:', room);
      }
    }
  }
}

testQuery().catch(console.error);
