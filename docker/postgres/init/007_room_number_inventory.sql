BEGIN;
LOCK TABLE rooms,bookings IN ACCESS EXCLUSIVE MODE;
CREATE TABLE IF NOT EXISTS room_units (
  room_number text PRIMARY KEY CHECK(room_number=upper(trim(room_number)) AND room_number ~ '^[A-Z0-9][A-Z0-9 -]{0,14}$'),
  room_id uuid NOT NULL REFERENCES rooms(id),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(room_id,room_number)
);
-- Normalize and preserve historical assigned rooms. Conflicting historical ownership
-- intentionally aborts the migration for review instead of silently losing data.
UPDATE bookings SET assigned_room_number=upper(trim(assigned_room_number)) WHERE assigned_room_number IS NOT NULL;
INSERT INTO room_units(room_number,room_id)
  SELECT DISTINCT assigned_room_number,room_id FROM bookings WHERE assigned_room_number IS NOT NULL
  ON CONFLICT(room_id,room_number) DO NOTHING;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlapping_active_stays;
DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_room_number_fk FOREIGN KEY(room_id,assigned_room_number) REFERENCES room_units(room_id,room_number);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='bookings'::regclass AND conname='bookings_no_overlapping_numbered_stays') THEN
  ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlapping_numbered_stays
    EXCLUDE USING gist (assigned_room_number WITH =, daterange(check_in,check_out,'[)') WITH &&)
    WHERE (assigned_room_number IS NOT NULL AND status IN ('pending','confirmed','checked_in'));
  END IF;
END $$;
CREATE OR REPLACE FUNCTION guard_room_inventory_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('pending','confirmed','checked_in') THEN
    PERFORM id FROM rooms WHERE id=NEW.room_id FOR UPDATE;
    IF NEW.assigned_room_number IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM room_units WHERE room_id=NEW.room_id AND room_number=NEW.assigned_room_number AND is_active
    ) THEN RAISE EXCEPTION 'ROOM_NUMBER_NOT_AVAILABLE' USING ERRCODE='23514'; END IF;
    IF TG_OP='INSERT' AND NEW.assigned_room_number IS NULL THEN
      RAISE EXCEPTION 'ROOM_NUMBER_REQUIRED' USING ERRCODE='23514';
    END IF;
    -- Legacy requests without a number still hold their room type until assigned/cancelled.
    IF EXISTS (SELECT 1 FROM bookings b WHERE b.id<>NEW.id AND b.room_id=NEW.room_id
      AND b.status IN ('pending','confirmed','checked_in')
      AND daterange(b.check_in,b.check_out,'[)') && daterange(NEW.check_in,NEW.check_out,'[)')
      AND (b.assigned_room_number IS NULL OR NEW.assigned_room_number IS NULL))
    THEN RAISE EXCEPTION 'LEGACY_BOOKING_HOLDS_ROOM_TYPE' USING ERRCODE='23P01'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS booking_room_inventory_guard ON bookings;
CREATE TRIGGER booking_room_inventory_guard BEFORE INSERT OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION guard_room_inventory_booking();
CREATE OR REPLACE FUNCTION guard_room_unit_removal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_active AND NOT NEW.is_active AND EXISTS (SELECT 1 FROM bookings WHERE room_id=OLD.room_id AND assigned_room_number=OLD.room_number AND status IN ('pending','confirmed','checked_in'))
  THEN RAISE EXCEPTION 'ROOM_HAS_ACTIVE_BOOKINGS' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS room_unit_removal_guard ON room_units;
CREATE TRIGGER room_unit_removal_guard BEFORE UPDATE ON room_units FOR EACH ROW EXECUTE FUNCTION guard_room_unit_removal();
COMMIT;
