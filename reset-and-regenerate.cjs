// Reset schedule and regenerate fresh
const { createClient } = require('@supabase/supabase-js');

async function resetSchedule() {
  const supabaseUrl = 'https://oonugywfdtzrcrydmazk.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbnVneXdmZHR6cmNyeWRtYXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Nzc5MzgsImV4cCI6MjA3NjQ1MzkzOH0.bdZnEMe1TTF7eqjedzXkuC0geqK8DGRY5MOyjR3E9XQ';

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Try common user IDs from the system
    const possibleUserIds = [
      '00000000-0000-0000-0000-000000000001',
      'default_user',
    ];

    console.log('🔍 Trying user IDs:', possibleUserIds);

    let user_id = null;

    // Try each user ID until one works
    for (const testUserId of possibleUserIds) {
      console.log(`\n🧪 Testing user_id: ${testUserId}`);

      // Call debug-schedule to check if this user has data
      const debugResponse = await fetch(`${supabaseUrl}/functions/v1/debug-schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: testUserId, date: '2025-10-24' }),
      });

      const debugResult = await debugResponse.json();

      if (debugResult.success && debugResult.total_for_user > 0) {
        console.log(`✅ Found data for user: ${testUserId}`);
        console.log(`   Total videos: ${debugResult.total_for_user}`);
        user_id = testUserId;
        break;
      } else {
        console.log(`   No data for this user`);
      }
    }

    if (!user_id) {
      console.error('❌ No valid user_id found!');
      console.log('Please provide a valid user_id manually.');
      return;
    }

    // Now call reset-schedule function
    console.log('\\n🗑️ Calling reset-schedule function...');

    const response = await fetch(`${supabaseUrl}/functions/v1/reset-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id }),
    });

    const result = await response.json();

    console.log('\\n📋 Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`\\n✅ Success!`);
      console.log(`   Deleted: ${result.deleted} old videos`);
      console.log(`   New schedule:`, result.schedule);
    } else {
      console.error('❌ Failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetSchedule();
