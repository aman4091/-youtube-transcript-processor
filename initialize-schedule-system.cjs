// Initialize complete schedule system for user
const { createClient } = require('@supabase/supabase-js');

async function initializeSystem() {
  const supabaseUrl = 'https://oonugywfdtzrcrydmazk.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbnVneXdmZHR6cmNyeWRtYXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Nzc5MzgsImV4cCI6MjA3NjQ1MzkzOH0.bdZnEMe1TTF7eqjedzXkuC0geqK8DGRY5MOyjR3E9XQ';

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('🚀 Initializing Schedule System\n');
  console.log('═══════════════════════════════════════════\n');

  try {
    // Get user
    const { data: users } = await supabase
      .from('users')
      .select('id, username');

    const user = users?.find(u => u.username === 'aman4091');

    if (!user) {
      console.error('❌ User aman4091 not found!');
      return;
    }

    console.log(`✅ Found user: ${user.username} (${user.id})\n`);

    // Check if schedule_config exists
    console.log('🔍 Checking schedule_config...');
    const { data: existingConfig, error: configCheckError } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (configCheckError && configCheckError.code !== 'PGRST116') {
      console.error('❌ Error checking config:', configCheckError.message);
    }

    if (!existingConfig) {
      console.log('⚠️ No schedule_config found. Creating default config...');

      // Create default schedule_config
      const { error: insertError } = await supabase
        .from('schedule_config')
        .insert({
          user_id: user.id,
          source_channel_id: 'default',
          source_channel_name: 'Default Source',
          source_channel_url: 'https://youtube.com',
          system_status: 'active',
          system_start_date: new Date().toISOString().split('T')[0],
          target_channels: [
            {
              id: 'gyh_channel',
              name: 'GYH Channel',
              active: true,
            }
          ],
          videos_per_channel: 4,
        });

      if (insertError) {
        console.error('❌ Error creating config:', insertError.message);
        console.error('   Full error:', JSON.stringify(insertError, null, 2));
      } else {
        console.log('✅ Schedule config created');
      }
    } else {
      console.log('✅ Schedule config exists');
      console.log(`   Status: ${existingConfig.system_status}`);
      console.log(`   Target channels: ${existingConfig.target_channels?.length || 0}`);

      // Make sure it's active
      if (existingConfig.system_status !== 'active') {
        console.log('⚠️ Config is not active. Activating...');
        const { error: updateError } = await supabase
          .from('schedule_config')
          .update({ system_status: 'active' })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('❌ Error activating:', updateError.message);
        } else {
          console.log('✅ Config activated');
        }
      }
    }

    // Clear any old scheduled_videos
    console.log('\n🗑️ Clearing old scheduled videos...');
    const { error: deleteError, count } = await supabase
      .from('scheduled_videos')
      .delete({ count: 'exact' })
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('❌ Error deleting:', deleteError.message);
    } else {
      console.log(`✅ Deleted ${count || 0} old videos`);
    }

    // Generate fresh schedule
    console.log('\n📅 Generating fresh 7-day schedule...');
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-daily-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: user.id }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Schedule generated successfully!');
      console.log(`   Dates: ${result.dates_generated?.join(', ')}`);
      console.log(`   Total videos: ${result.total_videos}`);
    } else {
      console.error('❌ Schedule generation failed:', result.error);
    }

    console.log('\n═══════════════════════════════════════════');
    console.log('🎉 INITIALIZATION COMPLETE!\n');
    console.log('Schedule will auto-generate daily at 2 AM via GitHub workflow.');
    console.log('Always maintains 7 days ahead automatically.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

initializeSystem();
