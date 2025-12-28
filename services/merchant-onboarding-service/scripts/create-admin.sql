-- Script to create admin user
-- Replace 'YourPassword123!' with the actual password you want to use
-- This SQL will need the password to be pre-hashed using bcrypt

-- Step 1: Generate bcrypt hash for password using Node.js:
-- node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourPassword123!', 12).then(hash => console.log(hash)).catch(err => console.error(err));"
-- 
-- Step 2: Replace <hashed_password> below with the hash from Step 1

INSERT INTO admins (
  email, 
  password, 
  name, 
  role, 
  is_active, 
  is_email_verified,
  created_at,
  updated_at
)
VALUES (
  'admin@nineteenpay.com', 
  '<hashed_password>', -- Replace with bcrypt hash from Step 1
  'Admin User', 
  'admin', 
  true, 
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Verify the admin was created
SELECT id, email, name, role, is_active, created_at FROM admins WHERE email = 'admin@nineteenpay.com';

