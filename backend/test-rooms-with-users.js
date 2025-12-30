const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRoomsWithUsers() {
  console.log('=== Testing rooms with users query ===');
  
  // Test with explicit foreign keys
  const { data: rooms, error } = await supabase
    .from('ProductionRoom')
    .select(`
        id, 
        name, 
        code, 
        "isActive",
        workCenters:WorkCenter(id, name, code),
        operators:UserProductionRoom!roomId(
            id,
            isPrimary,
            user:User!userId(id, name, email)
        )
    `)
    .eq('isActive', true)
    .order('name');
  
  if (error) {
    console.error('Query error:', error);
    return;
  }
  
  console.log(`Found ${rooms.length} rooms`);
  rooms.forEach(room => {
    console.log(`\n${room.name}:`);
    console.log(`  - Work centers: ${room.workCenters ? room.workCenters.length : 0}`);
    console.log(`  - Operators: ${room.operators ? room.operators.length : 0}`);
    if (room.operators && room.operators.length > 0) {
      room.operators.forEach(op => {
        console.log(`    * ${op.user.name} (${op.isPrimary ? 'Primary' : 'Secondary'})`);
      });
    }
  });
}

testRoomsWithUsers().catch(console.error);
