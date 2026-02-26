import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fivgondkrnshwzfmneud.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_VfJxyqWqEmwlPUFspXMU2g_n5h6YOEs'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
  console.log('Fetching doctors...');
  const { data: doctors, error: doctorsError } = await supabase.from('doctors').select('*');
  console.log('Doctors:', doctors?.length, 'Error:', doctorsError?.message || 'None');
  
  if (doctorsError) {
    console.error(doctorsError);
  } else {
    console.dir(doctors, { depth: null });
  }
}

testConnection();
