-- Assign a physical room to a guest during check-in. Safe to run more than once.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_room_number text;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_room_number_unique
  ON bookings(lower(assigned_room_number))
  WHERE assigned_room_number IS NOT NULL AND status = 'checked_in';
