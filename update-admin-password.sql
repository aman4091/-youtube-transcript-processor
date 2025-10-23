-- Update admin user password hash to SHA-256
UPDATE users
SET password_hash = 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f'
WHERE username = 'admin';
