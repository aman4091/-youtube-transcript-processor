// Check if system is ready for schedule generation
const { createClient } = require('@supabase/supabase-js');

async function checkReady() {
  const supabaseUrl = 'https://oonugywfdtzrcrydmazk.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbnVneXdmZHR6cmNyeWRtYXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Nzc5MzgsImV4cCI6MjA3NjQ1MzkzOH0.bdZnEMe1TTF7eqjedzXkuC0geqK8DGRY5MOyjR3E9XQ';

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    console.log('🔍 Checking system readiness for schedule generation...\n');

    // 1. Check users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username')
      .limit(5);

    if (usersError) {
      console.error('❌ Users error:', usersError.message);
    } else {
      console.log(`✅ Users found: ${users?.length || 0}`);
      users?.forEach(u => console.log(`   - ${u.username} (${u.id})`));
    }

    if (!users || users.length === 0) {
      console.log('\n⚠️ No users found! Please login first.\n');
      return;
    }

    const user_id = users[0].id;
    console.log(`\n📍 Using user: ${user_id}\n`);

    // 2. Check schedule_config
    const { data: config, error: configError } = await supabase
      .from('schedule_config')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (configError) {
      console.error('❌ Schedule config error:', configError.message);
      console.log('⚠️ Run Settings page to initialize config\n');
    } else {
      console.log('✅ Schedule config found');
      console.log(`   Status: ${config.system_status}`);
      console.log(`   Target channels: ${config.target_channels?.length || 0}`);
      config.target_channels?.forEach(ch => console.log(`     - ${ch.name} (${ch.active ? 'active' : 'inactive'})`));
    }

    // 3. Check video_pool_old
    const { data: oldVideos, count: oldCount } = await supabase
      .from('video_pool_old')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('status', 'active');

    console.log(`\n📹 Video pool old: ${oldCount || 0} active videos`);

    if ((oldCount || 0) < 10) {
      console.log('⚠️ Not enough videos! Run "Refresh Old Videos" in Settings\n');
    }

    // 4. Check video_pool_new
    const { data: newVideos, count: newCount } = await supabase
      .from('video_pool_new')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('status', 'active');

    console.log(`📹 Video pool new: ${newCount || 0} active videos`);

    // 5. Check auto_monitor_settings
    const { data: autoSettings, error: autoError } = await supabase
      .from('auto_monitor_settings')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (autoError) {
      console.error('\n❌ Auto monitor settings error:', autoError.message);
    } else {
      console.log('\n✅ Auto monitor settings found');
      console.log(`   Source channels: ${autoSettings.source_channels?.length || 0}`);
      autoSettings.source_channels?.forEach(ch => console.log(`     - ${ch.name}`));
      console.log(`   YouTube API key: ${autoSettings.youtube_api_key ? '✓ Set' : '✗ Not set'}`);
    }

    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════');

    const targetChannelsReady = config?.target_channels?.filter(ch => ch.active).length > 0;
    const oldVideosReady = (oldCount || 0) >= 10;
    const systemActive = config?.system_status === 'active';

    console.log(`Target Channels: ${targetChannelsReady ? '✅' : '❌'} ${config?.target_channels?.filter(ch => ch.active).length || 0} active`);
    console.log(`Old Videos Pool: ${oldVideosReady ? '✅' : '❌'} ${oldCount || 0} active videos`);
    console.log(`System Status:   ${systemActive ? '✅' : '❌'} ${config?.system_status || 'unknown'}`);

    if (targetChannelsReady && oldVideosReady && systemActive) {
      console.log('\n🎉 READY FOR SCHEDULE GENERATION!\n');
    } else {
      console.log('\n⚠️ SYSTEM NOT READY - Fix the issues above\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkReady();
