const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testEndpoints() {
  console.log('=== Testing /api/production/work-centers ===');
  
  const { data: centers, error: centersError } = await supabase
    .from('WorkCenter')
    .select(`
      *,
      room:ProductionRoom!roomId(id, name, code),
      type:WorkCenterType(id, name, code),
      workStations:WorkStation(id, name, code, status)
    `)
    .eq('isActive', true)
    .order('name');
  
  if (centersError) {
    console.error('WorkCenters error:', centersError);
    return;
  }
  
  console.log(`Found ${centers.length} work centers`);
  centers.forEach(wc => {
    console.log(`\n${wc.name}:`);
    console.log(`  - Room: ${wc.room ? wc.room.name : 'NULL'}`);
    console.log(`  - Room type: ${typeof wc.room}`);
    console.log(`  - Machines: ${wc.workStations ? wc.workStations.length : 0}`);
    if (wc.workStations && wc.workStations.length > 0) {
      console.log(`  - Machine list:`, wc.workStations.map(ws => ws.name));
    }
  });
}

testEndpoints().catch(console.error);
