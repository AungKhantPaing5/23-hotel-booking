-- Distinguish new booking deposits from legacy full-amount payment attempts.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_type text;
UPDATE payments SET payment_type = 'booking_balance' WHERE payment_type IS NULL;
ALTER TABLE payments ALTER COLUMN payment_type SET DEFAULT 'booking_deposit';
ALTER TABLE payments ALTER COLUMN payment_type SET NOT NULL;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_type_check
  CHECK (payment_type IN ('booking_deposit','booking_balance','service_order'));
CREATE INDEX IF NOT EXISTS payments_type_status_idx ON payments(payment_type,status,created_at DESC);
