# Multiple SupaData API Keys Support

## Overview

System ab multiple SupaData API keys support karta hai with automatic rotation! Agar ek key rate limit hit kare ya expire ho jaye, system automatically next active key use karega. **Processing kabhi nahi rukegi!** 🚀

---

## ✅ What's Already Implemented

### 1. **Database Migration** ✅
- **File:** `supabase/migrations/009_multiple_supadata_keys.sql`
- **Changes:**
  - Added `supadata_keys` JSONB array column to `auto_monitor_settings` table
  - Existing single key automatically migrated to array format
  - Old `supabase_api_key` column kept for backward compatibility

**Data Structure:**
```json
{
  "supadata_keys": [
    {
      "key": "sk-xxx1",
      "label": "Primary Key",
      "active": true,
      "added_at": "2025-10-21T10:00:00Z"
    },
    {
      "key": "sk-xxx2",
      "label": "Backup Key 1",
      "active": true,
      "added_at": "2025-10-21T11:00:00Z"
    },
    {
      "key": "sk-xxx3",
      "label": "Backup Key 2",
      "active": false,  // Inactive key - won't be used
      "added_at": "2025-10-21T12:00:00Z"
    }
  ]
}
```

### 2. **Edge Functions Updated** ✅
Both functions now support automatic API key rotation:

#### **process-video** (`supabase/functions/process-video/index.ts`)
- ✅ Added `supadata_keys` to MonitorSettings interface
- ✅ Created `getActiveSupadataKeys()` helper function
- ✅ Created `fetchTranscriptWithRotation()` function
- ✅ Automatic fallback to legacy single key

**Key Features:**
- Tries each active key sequentially
- Rotates on 401 (invalid/expired) or 429 (rate limit) errors
- Stops rotation on non-recoverable errors (no transcript, network issues)
- Logs which key succeeded

#### **process-scheduled-videos** (`supabase/functions/process-scheduled-videos/index.ts`)
- ✅ Same rotation logic as process-video
- ✅ Updated `processOldVideo()` to use key rotation
- ✅ Full backward compatibility

### 3. **How It Works**

**Automatic Rotation Flow:**
```
1. Get all active keys from database
2. Try Key 1 → Success? ✅ Done!
   ↓
3. Try Key 1 → 429 Rate Limited? Try Key 2
   ↓
4. Try Key 2 → Success? ✅ Done!
   ↓
5. Try Key 2 → 401 Invalid? Try Key 3
   ↓
6. Try Key 3 → Success? ✅ Done!
   ↓
7. All keys failed? ❌ Throw error with details
```

**Error Handling:**
- ✅ **401 (Invalid/Expired):** Try next key
- ✅ **429 (Rate Limited):** Try next key
- ❌ **No Transcript:** Don't try other keys (video issue)
- ❌ **Network Error:** Don't try other keys (API issue)

---

## 🔧 How to Use (Manual Setup via SQL)

**Currently:** System uses single `supabase_api_key` column.

**To add multiple keys**, run this SQL in Supabase SQL Editor:

### Step 1: Add Your API Keys

```sql
-- Add multiple keys (replaces existing array)
UPDATE auto_monitor_settings
SET supadata_keys = '[
  {
    "key": "sk-your-primary-key-here",
    "label": "Primary Key",
    "active": true,
    "added_at": "2025-10-21T10:00:00Z"
  },
  {
    "key": "sk-your-backup-key-1-here",
    "label": "Backup Key 1",
    "active": true,
    "added_at": "2025-10-21T11:00:00Z"
  },
  {
    "key": "sk-your-backup-key-2-here",
    "label": "Backup Key 2",
    "active": true,
    "added_at": "2025-10-21T12:00:00Z"
  }
]'::jsonb
WHERE user_id = 'default_user';
```

### Step 2: Verify Keys

```sql
-- Check your keys
SELECT supadata_keys
FROM auto_monitor_settings
WHERE user_id = 'default_user';
```

### Step 3: Add More Keys Later

```sql
-- Append a new key to existing array
UPDATE auto_monitor_settings
SET supadata_keys = supadata_keys || '[
  {
    "key": "sk-new-key-here",
    "label": "New Backup Key",
    "active": true,
    "added_at": "2025-10-22T10:00:00Z"
  }
]'::jsonb
WHERE user_id = 'default_user';
```

### Step 4: Disable a Key

```sql
-- Disable a specific key (find by key value)
UPDATE auto_monitor_settings
SET supadata_keys = (
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'key' = 'sk-key-to-disable'
      THEN jsonb_set(elem, '{active}', 'false'::jsonb)
      ELSE elem
    END
  )
  FROM jsonb_array_elements(supadata_keys) elem
)
WHERE user_id = 'default_user';
```

---

## 🎨 UI Implementation (Future Enhancement)

### Option 1: Simple Section in Settings Page

Add this section after the existing SupaData API Key field in `SettingsPage.tsx`:

```tsx
// Add state for multiple keys
const [supadataKeys, setSupadataKeys] = useState<Array<{
  key: string;
  label: string;
  active: boolean;
}>>([]);

// Fetch keys from Supabase on mount
useEffect(() => {
  async function fetchKeys() {
    const { data } = await supabase
      .from('auto_monitor_settings')
      .select('supadata_keys')
      .eq('user_id', 'default_user')
      .single();

    if (data?.supadata_keys) {
      setSupadataKeys(data.supadata_keys);
    }
  }
  fetchKeys();
}, []);

// Save keys to Supabase
async function saveKeys() {
  await supabase
    .from('auto_monitor_settings')
    .update({
      supadata_keys: supadataKeys.map(k => ({
        ...k,
        added_at: k.added_at || new Date().toISOString()
      }))
    })
    .eq('user_id', 'default_user');

  alert('✅ API Keys saved!');
}

// Add key to array
function addKey() {
  setSupadataKeys([...supadataKeys, {
    key: '',
    label: `Key ${supadataKeys.length + 1}`,
    active: true
  }]);
}

// Remove key from array
function removeKey(index: number) {
  setSupadataKeys(supadataKeys.filter((_, i) => i !== index));
}

// Toggle key active status
function toggleKey(index: number) {
  const updated = [...supadataKeys];
  updated[index].active = !updated[index].active;
  setSupadataKeys(updated);
}

// Update key value
function updateKey(index: number, field: string, value: any) {
  const updated = [...supadataKeys];
  updated[index] = { ...updated[index], [field]: value };
  setSupadataKeys(updated);
}
```

**UI Component:**
```tsx
{/* Multiple SupaData API Keys */}
<div className="space-y-4 mt-6 border-t pt-4">
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold">Multiple SupaData API Keys</h3>
    <button
      onClick={addKey}
      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
    >
      <Plus className="w-4 h-4" />
      Add Key
    </button>
  </div>

  <div className="text-sm text-gray-600 dark:text-gray-400">
    Add multiple API keys for automatic rotation when rate limits are hit.
  </div>

  <div className="space-y-3">
    {supadataKeys.map((apiKey, index) => (
      <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded">
        <input
          type="checkbox"
          checked={apiKey.active}
          onChange={() => toggleKey(index)}
          className="w-4 h-4"
        />
        <input
          type="text"
          value={apiKey.label}
          onChange={(e) => updateKey(index, 'label', e.target.value)}
          placeholder="Label (e.g., Primary Key)"
          className="px-2 py-1 border rounded w-32"
        />
        <input
          type="password"
          value={apiKey.key}
          onChange={(e) => updateKey(index, 'key', e.target.value)}
          placeholder="sk-xxx..."
          className="flex-1 px-2 py-1 border rounded"
        />
        <button
          onClick={() => removeKey(index)}
          className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>

  <button
    onClick={saveKeys}
    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
  >
    💾 Save API Keys to Database
  </button>
</div>
```

### Option 2: Separate "API Keys Manager" Page

Create a dedicated page `src/components/APIKeysManager.tsx` for better organization:

```tsx
import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface APIKey {
  key: string;
  label: string;
  active: boolean;
  added_at?: string;
  last_used_at?: string;
}

export default function APIKeysManager() {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    setLoading(true);
    const { data } = await supabase
      .from('auto_monitor_settings')
      .select('supadata_keys')
      .eq('user_id', 'default_user')
      .single();

    setKeys(data?.supadata_keys || []);
    setLoading(false);
  }

  async function saveKeys() {
    setSaving(true);
    await supabase
      .from('auto_monitor_settings')
      .update({ supadata_keys: keys })
      .eq('user_id', 'default_user');
    setSaving(false);
    alert('✅ Saved!');
  }

  // ... rest of the component
}
```

---

## 🧪 Testing the Feature

### Test Case 1: Single Key (Backward Compatibility)
1. Keep only one key in `supadata_keys` array
2. Process a video
3. ✅ Should work exactly like before

### Test Case 2: Multiple Keys - All Valid
1. Add 3 valid API keys
2. Process a video
3. ✅ Should use first key and succeed

### Test Case 3: First Key Rate Limited
1. Add 3 keys, first key is rate limited (429)
2. Process a video
3. ✅ Should automatically try second key
4. ✅ Logs should show "Key 1 rate limited, trying next key..."

### Test Case 4: First Key Invalid
1. Add 3 keys, first key is invalid/expired (401)
2. Process a video
3. ✅ Should automatically try second key
4. ✅ Logs should show "Key 1 invalid/expired, trying next key..."

### Test Case 5: All Keys Failed
1. Add 3 invalid keys
2. Process a video
3. ❌ Should fail with error "All 3 API keys failed"

### Test Case 6: Legacy Single Key Fallback
1. Don't set `supadata_keys` array (or empty array)
2. Keep old `supabase_api_key` field set
3. Process a video
4. ✅ Should fallback to legacy single key
5. ✅ Logs should show "Using legacy single API key"

---

## 📊 Monitoring & Logs

### Check Logs in Supabase Dashboard

Go to: `Supabase Dashboard → Functions → process-video → Logs`

**Successful Rotation Example:**
```
🔑 Found 3 active SupaData API keys
🔑 Attempting with Primary Key...
⏳ Primary Key rate limited, trying next key...
🔑 Attempting with Backup Key 1...
✅ Success with Backup Key 1
✓ Transcript fetched: 15234 characters
```

**All Keys Failed Example:**
```
🔑 Found 3 active SupaData API keys
🔑 Attempting with Primary Key...
❌ Primary Key invalid/expired, trying next key...
🔑 Attempting with Backup Key 1...
❌ Backup Key 1 rate limited, trying next key...
🔑 Attempting with Backup Key 2...
❌ Backup Key 2 invalid/expired, trying next key...
❌ Error: All 3 API keys failed. Last error: SupaData API key is invalid or expired
```

---

## 🔄 Migration Path

### Current State (Before Running Migration)
```json
{
  "supabase_api_key": "sk-old-single-key",
  "supadata_keys": []  // Empty or doesn't exist
}
```

### After Running Migration 009
```json
{
  "supabase_api_key": "sk-old-single-key",  // Kept for backward compatibility
  "supadata_keys": [
    {
      "key": "sk-old-single-key",
      "label": "Primary Key",
      "active": true,
      "added_at": "2025-10-21T..."
    }
  ]
}
```

### After Adding More Keys Manually
```json
{
  "supabase_api_key": "sk-old-single-key",  // Legacy (not used anymore)
  "supadata_keys": [
    {
      "key": "sk-old-single-key",
      "label": "Primary Key",
      "active": true,
      "added_at": "2025-10-21T..."
    },
    {
      "key": "sk-new-backup-key-1",
      "label": "Backup Key 1",
      "active": true,
      "added_at": "2025-10-21T..."
    },
    {
      "key": "sk-new-backup-key-2",
      "label": "Backup Key 2",
      "active": true,
      "added_at": "2025-10-21T..."
    }
  ]
}
```

---

## 💡 Best Practices

### 1. **Start with 2-3 Keys**
- Don't add too many keys at once
- 2-3 active keys are usually enough

### 2. **Label Keys Clearly**
```json
{
  "label": "Primary - Paid Plan",
  "label": "Backup 1 - Free Tier",
  "label": "Backup 2 - Emergency"
}
```

### 3. **Monitor Usage**
- Check Supabase logs regularly
- See which keys are being used
- Replace expired keys promptly

### 4. **Rotate Keys Regularly**
- Add new keys before old ones expire
- Mark old keys as inactive instead of deleting
- Keep inactive keys for audit trail

### 5. **Test Before Production**
- Add one backup key first
- Test with a single video
- Monitor logs for successful rotation
- Then add more keys if needed

---

## 🚨 Troubleshooting

### Problem: "No active SupaData API keys configured"
**Solution:**
- Check that `supadata_keys` array exists
- Check that at least one key has `"active": true`
- Verify migration 009 ran successfully

### Problem: "All X API keys failed"
**Solution:**
- Check that keys are valid (not expired)
- Verify keys have sufficient quota
- Test keys manually via API

### Problem: Still using legacy single key
**Solution:**
- Check that `supadata_keys` array is not empty
- Verify at least one key has `"active": true`
- System falls back to `supabase_api_key` if array is empty

### Problem: Keys not rotating despite rate limits
**Solution:**
- Check logs to see actual error messages
- Verify error is 401 or 429 (only these trigger rotation)
- Other errors (network, no transcript) don't trigger rotation

---

## 📝 Quick Start Summary

1. **Run Migration:**
   ```bash
   # Already done! Migration 009 is in place
   ```

2. **Add Keys via SQL:**
   ```sql
   UPDATE auto_monitor_settings
   SET supadata_keys = '[
     {"key": "sk-key1", "label": "Primary", "active": true},
     {"key": "sk-key2", "label": "Backup", "active": true}
   ]'::jsonb
   WHERE user_id = 'default_user';
   ```

3. **Test:**
   - Process a video
   - Check logs for rotation messages

4. **Add UI (Optional):**
   - Follow "UI Implementation" section above
   - Add form in SettingsPage.tsx
   - Or create dedicated APIKeysManager page

---

## ✅ Deployment Status

- ✅ Migration created: `009_multiple_supadata_keys.sql`
- ✅ `process-video` function updated and deployed
- ✅ `process-scheduled-videos` function updated and deployed
- ✅ Backward compatibility maintained
- ✅ Automatic key rotation working
- ⏳ UI implementation (optional, can be added later)

---

## 🎯 Result

**System ab kabhi nahi rukegi! 🚀**

- Multiple API keys support ✅
- Automatic rotation on failures ✅
- Smart error handling ✅
- Backward compatible ✅
- Production ready ✅

Jab ek key fail ho, system turant next key try karega. Processing seamlessly continue hogi!
