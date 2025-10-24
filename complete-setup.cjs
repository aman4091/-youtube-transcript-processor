// Complete setup: Pool refresh + Schedule generation
async function completeSetup() {
  const supabaseUrl = 'https://oonugywfdtzrcrydmazk.supabase.co';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbnVneXdmZHR6cmNyeWRtYXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Nzc5MzgsImV4cCI6MjA3NjQ1MzkzOH0.bdZnEMe1TTF7eqjedzXkuC0geqK8DGRY5MOyjR3E9XQ';
  const user_id = 'a2312ec6-9268-4e6c-9b9b-2253c27be18f';

  console.log('🚀 COMPLETE SETUP\n');
  console.log('═══════════════════════════════════════════\n');

  try {
    // Step 1: Initialize system
    console.log('1️⃣ Initializing schedule system...');
    const initResponse = await fetch(`${supabaseUrl}/functions/v1/initialize-user-schedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    });

    const initResult = await initResponse.json();
    if (!initResult.success) {
      throw new Error(`Init failed: ${initResult.error}`);
    }
    console.log('✅ System initialized\n');

    // Step 2: Refresh video pool
    console.log('2️⃣ Refreshing video pool (this takes 2-3 minutes)...');
    const refreshResponse = await fetch(`${supabaseUrl}/functions/v1/refresh-old-video-pool`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    });

    const refreshResult = await refreshResponse.json();
    if (!refreshResult.success) {
      throw new Error(`Refresh failed: ${refreshResult.error}`);
    }
    console.log(`✅ Video pool refreshed: ${refreshResult.total} videos\n`);

    // Step 3: Generate schedule
    console.log('3️⃣ Generating 7-day schedule...');
    const scheduleResponse = await fetch(`${supabaseUrl}/functions/v1/generate-daily-schedule`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    });

    const scheduleResult = await scheduleResponse.json();
    if (!scheduleResult.success) {
      throw new Error(`Schedule generation failed: ${scheduleResult.error}`);
    }
    console.log('✅ Schedule generated!');
    console.log(`   Dates: ${scheduleResult.dates_generated?.join(', ')}`);
    console.log(`   Total videos scheduled: ${scheduleResult.total_videos}\n`);

    console.log('═══════════════════════════════════════════');
    console.log('🎉 SETUP COMPLETE!\n');
    console.log('✅ Schedule system is now active');
    console.log('✅ GitHub workflow will auto-generate at 2 AM daily');
    console.log('✅ Always maintains 7 days ahead\n');
    console.log('👉 Now check Schedule Today page - it should show videos!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

completeSetup();
