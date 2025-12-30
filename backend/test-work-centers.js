const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testWorkCenters() {
  console.log('Testing work-centers endpoint query...');
  
  // Test the exact query from the endpoint
  const { data, error } = await supabase
    .from('WorkCenter')
    .select(`
      *,
      room:ProductionRoom!roomId(id, name, code),
      type:WorkCenterType(id, name, code),
      workStations:WorkStation(id, name, code, status)
    `)
    .eq('isActive', true)
    .order('name');
  
  if (error) {
    console.error('Query error:', error);
    return;
  }
  
  console.log('WorkCenters found:', data?.length || 0);
  console.log('First WorkCenter:');
  console.log(JSON.stringify(data?.[0], null, 2));
  
  // Check if room data is properly nested
  if (data?.[0]) {
    const wc = data[0];
    console.log('\n--- Room data check ---');
    console.log('wc.room:', wc.room);
    console.log('typeof wc.room:', typeof wc.room);
    console.log('wc.room?.name:', wc.room?.name);
  }
}

testWorkCenters().catch(console.error);
