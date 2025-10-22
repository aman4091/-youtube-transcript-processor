// Reset Oct 22 videos to pending status
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetOct22Videos() {
  console.log('🔍 Checking current status of Oct 22 videos...\n');

  // Check current status
  const { data: beforeData, error: beforeError } = await supabase
    .from('scheduled_videos')
    .select('status')
    .eq('schedule_date', '2025-10-22');

  if (beforeError) {
    console.error('❌ Error fetching videos:', beforeError);
    return;
  }

  console.log(`Total Oct 22 videos: ${beforeData.length}`);

  const statusCounts = beforeData.reduce((acc, video) => {
    acc[video.status] = (acc[video.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Status breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('\n🔄 Resetting all videos to pending...\n');

  // Reset to pending
  const { data: updateData, error: updateError } = await supabase
    .from('scheduled_videos')
    .update({
      status: 'pending',
      processing_started_at: null,
      processing_completed_at: null,
      processed_script_path: null,
      raw_transcript_path: null,
      error_message: null,
      retry_count: 0,
      chunk_results: null,
      completed_chunks: null,
      failed_chunks: null,
      total_chunks: null,
    })
    .eq('schedule_date', '2025-10-22')
    .select();

  if (updateError) {
    console.error('❌ Error updating videos:', updateError);
    return;
  }

  console.log(`✅ Successfully reset ${updateData.length} videos to pending status!`);

  // Verify
  const { data: afterData, error: afterError } = await supabase
    .from('scheduled_videos')
    .select('status')
    .eq('schedule_date', '2025-10-22');

  if (afterError) {
    console.error('❌ Error verifying:', afterError);
    return;
  }

  const afterStatusCounts = afterData.reduce((acc, video) => {
    acc[video.status] = (acc[video.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Final status:');
  Object.entries(afterStatusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
}

resetOct22Videos();
