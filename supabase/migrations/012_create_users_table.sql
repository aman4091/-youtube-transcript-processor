-- Migration 012: Create users table for multi-user authentication
-- Simple username/password authentication system

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Insert default admin user (password: admin123)
-- Password hash: bcrypt hash of 'admin123'
INSERT INTO users (id, username, password_hash, display_name)
VALUES (
  '00000000-0000-0000-0000-000000000001'::UUID,
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIIVQ9h9UXGP8wPnTHDsY9nQzJ0qZuO',
  'Admin User'
) ON CONFLICT (username) DO NOTHING;

COMMENT ON TABLE users IS 'User accounts for multi-user system - each user has isolated workspace';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password (cost 10)';
