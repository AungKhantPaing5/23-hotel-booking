-- Resolve any existing duplicate pending/paid deposits before applying. Never delete paid records blindly.
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_active_deposit
  ON payments(booking_id) WHERE payment_type='booking_deposit' AND status IN ('pending','paid');
