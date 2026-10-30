-- Keeps existing users and bookings intact. Pending old OTPs must be reissued.
ALTER TABLE auth_otps ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
UPDATE auth_otps SET used_at=now() WHERE email='' AND used_at IS NULL;
