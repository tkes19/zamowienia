const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRoomsAPI() {
  console.log('=== Testing /api/production/rooms endpoint ===');
  
  // Test the exact query from the endpoint
  const { data: rooms, error } = await supabase
    .from('ProductionRoom')
    .select(`
        id, 
        name, 
        code, 
        "isActive",
        workCenters:WorkCenter(id, name, code)
    `)
    .eq('isActive', true)
    .order('name');
  
  if (error) {
    console.error('Rooms API error:', error);
    return;
  }
  
  console.log(`Found ${rooms.length} rooms`);
  rooms.forEach(room => {
    console.log(`\n${room.name} (${room.code}):`);
    console.log(`  - Work centers count: ${room.workCenters ? room.workCenters.length : 0}`);
    if (room.workCenters && room.workCenters.length > 0) {
      console.log(`  - Work centers:`, room.workCenters.map(wc => wc.name));
    }
  });
}

testRoomsAPI().catch(console.error);
