const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'supabase/functions/bulk-push-to-telegram/index.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Replace the date logic with video_ids logic
const newContent = content
  .replace(
    /\/\/ Get date from request body[\s\S]*?console\.log\(`📅 Date: \${date}`\);/,
    `// Get video IDs from request body
    const body = await req.json();
    const videoIds = body.video_ids;

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      throw new Error('video_ids array is required');
    }

    console.log(\`📹 Pushing \${videoIds.length} selected videos\`);`
  )
  .replace(
    /\/\/ Fetch all ready videos for the date[\s\S]*?\.order\('slot_number', \{ ascending: true \}\);/,
    `// Fetch selected videos by IDs
    const { data: videos, error } = await supabase
      .from('scheduled_videos')
      .select('*')
      .in('id', videoIds)
      .eq('status', 'ready')
      .order('target_channel_name', { ascending: true })
      .order('slot_number', { ascending: true });`
  );

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('✅ bulk-push-to-telegram updated!');
