BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS auth_password_attempts (
  email text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION invalidate_password_sessions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.session_version=OLD.session_version+1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_password_session_version ON users;
CREATE TRIGGER users_password_session_version BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION invalidate_password_sessions();
COMMIT;
