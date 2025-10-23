// Supabase Edge Function: auth-login
// Authenticates user with username and password
// Returns user object on success

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Helper function to hash password using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper function to verify password
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find user by username
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, display_name')
      .eq('username', username)
      .single();

    if (error || !user) {
      throw new Error('Invalid username or password');
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }

    // Return user data (without password hash)
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('Login error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
