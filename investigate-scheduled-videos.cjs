// Deep investigation: Who owns the scheduled_videos?
const { createClient } = require('@supabase/supabase-js');

async function investigate() {
  const supabaseUrl = 'https://oonugywfdtzrcrydmazk.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbnVneXdmZHR6cmNyeWRtYXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Nzc5MzgsImV4cCI6MjA3NjQ1MzkzOH0.bdZnEMe1TTF7eqjedzXkuC0geqK8DGRY5MOyjR3E9XQ';

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('🔍 DEEP INVESTIGATION: Scheduled Videos\n');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // 1. Get current logged-in user
    const { data: users } = await supabase
      .from('users')
      .select('id, username');

    console.log('👥 USERS IN SYSTEM:');
    users?.forEach(u => console.log(`   ${u.username}: ${u.id}`));
    console.log('');

    // 2. Call debug-schedule for date 2025-10-24 for each user
    console.log('📅 CHECKING SCHEDULED VIDEOS FOR 2025-10-24:\n');

    for (const user of users || []) {
      console.log(`\n🔍 User: ${user.username} (${user.id})`);

      const response = await fetch(`${supabaseUrl}/functions/v1/debug-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, date: '2025-10-24' }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`   Total for this user: ${result.total_for_user}`);
        console.log(`   For date 2025-10-24: ${result.total_for_user_and_date}`);

        if (result.user_date_videos && result.user_date_videos.length > 0) {
          console.log('   Videos:');
          result.user_date_videos.forEach(v => {
            console.log(`      - ${v.target_channel_name}: ${v.video_title?.substring(0, 50)}...`);
          });
        }
      } else {
        console.log(`   ❌ Error: ${result.error}`);
      }
    }

    // 3. Check GitHub workflow config
    console.log('\n\n🤖 CHECKING GITHUB WORKFLOW:');
    console.log('   Looking for hardcoded user_id in workflow files...\n');

    // 4. Check schedule_config for all users
    console.log('⚙️ SCHEDULE CONFIGS:\n');

    for (const user of users || []) {
      const { data: config, error } = await supabase
        .from('schedule_config')
        .select('user_id, system_status, target_channels, last_schedule_generated_date')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.log(`   ${user.username}: ❌ No config found`);
      } else {
        console.log(`   ${user.username}:`);
        console.log(`      Status: ${config.system_status}`);
        console.log(`      Target channels: ${config.target_channels?.length || 0}`);
        console.log(`      Last generated: ${config.last_schedule_generated_date || 'never'}`);
      }
    }

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('📊 DIAGNOSIS:');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('If you see videos for "admin" or "default_user" but not for "aman4091",');
    console.log('then the GitHub Workflow is using a hardcoded user_id.\n');

    console.log('SOLUTIONS:');
    console.log('1. Disable GitHub Workflow');
    console.log('2. Update workflow to use correct user_id');
    console.log('3. Migrate existing scheduled_videos to correct user_id\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

investigate();
