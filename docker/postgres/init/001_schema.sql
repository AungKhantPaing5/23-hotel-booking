CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN CREATE TYPE staff_role AS ENUM ('super_admin','manager','receptionist','order_staff','kitchen_staff','deals_staff','service_staff','accountant'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE booking_status AS ENUM ('pending','confirmed','rejected','cancelled','checked_in','checked_out'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending','paid','failed','cancelled','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending','accepted','rejected','processing','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE request_status AS ENUM ('open','in_progress','resolved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone text UNIQUE,
  password_hash text,
  full_name text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone text UNIQUE,
  full_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS staff_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role staff_role NOT NULL DEFAULT 'receptionist',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_otps (
  id bigserial PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL,
  code_hash text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_otps_phone_idx ON auth_otps(phone, created_at DESC);

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '', nightly_rate numeric(12,2) NOT NULL CHECK(nightly_rate>=0),
  capacity int NOT NULL DEFAULT 2 CHECK(capacity>0), features text[] NOT NULL DEFAULT '{}', image_url text,
  is_active boolean NOT NULL DEFAULT true, display_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code text NOT NULL UNIQUE DEFAULT ('23H-'||upper(substr(encode(gen_random_bytes(6),'hex'),1,10))),
  customer_id uuid NOT NULL REFERENCES profiles(user_id), room_id uuid NOT NULL REFERENCES rooms(id),
  check_in date NOT NULL, check_out date NOT NULL, guests int NOT NULL CHECK(guests>0),
  status booking_status NOT NULL DEFAULT 'pending', total_amount numeric(12,2) NOT NULL CHECK(total_amount>=0),
  currency text NOT NULL DEFAULT 'MMK', customer_note text NOT NULL DEFAULT '', staff_note text,
  assigned_room_number text,
  reviewed_by uuid REFERENCES users(id), reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(check_out>check_in)
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_room_number text;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_room_number_unique
  ON bookings(lower(assigned_room_number))
  WHERE assigned_room_number IS NOT NULL AND status = 'checked_in';
CREATE INDEX IF NOT EXISTS bookings_customer_idx ON bookings(customer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_room_dates_idx ON bookings(room_id,check_in,check_out);
DO $$ BEGIN
  ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlapping_active_stays
    EXCLUDE USING gist (room_id WITH =, daterange(check_in,check_out,'[)') WITH &&)
    WHERE (status IN ('pending','confirmed','checked_in'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'service', price numeric(12,2) NOT NULL DEFAULT 0 CHECK(price>=0),
  availability_note text NOT NULL DEFAULT 'Subject to availability', image_url text,
  is_active boolean NOT NULL DEFAULT true, display_order int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS service_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES profiles(user_id),
  service_id uuid NOT NULL REFERENCES services(id), booking_id uuid REFERENCES bookings(id),
  quantity int NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 20), status order_status NOT NULL DEFAULT 'pending',
  customer_note text NOT NULL DEFAULT '', staff_note text, assigned_to uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_orders_queue_idx ON service_orders(status,created_at DESC);
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), booking_id uuid NOT NULL REFERENCES bookings(id),
  customer_id uuid NOT NULL REFERENCES profiles(user_id), amount numeric(12,2) NOT NULL CHECK(amount>=0),
  currency text NOT NULL DEFAULT 'MMK', provider text NOT NULL DEFAULT 'disabled', provider_reference text, payment_type text NOT NULL DEFAULT 'booking_deposit',
  status payment_status NOT NULL DEFAULT 'pending', failure_reason text, paid_at timestamptz, refunded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id,created_at DESC);
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id text PRIMARY KEY, payment_id uuid NOT NULL REFERENCES payments(id), event_status text NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES profiles(user_id), booking_id uuid REFERENCES bookings(id),
  subject text NOT NULL, message text NOT NULL, status request_status NOT NULL DEFAULT 'open', assigned_to uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users(id), booking_id uuid REFERENCES bookings(id),
  channel text NOT NULL, template_key text NOT NULL, recipient text NOT NULL, status text NOT NULL,
  provider_message_id text, error_message text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL,
  entity_type text NOT NULL, entity_id uuid, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS bookings_updated_at ON bookings;
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS service_orders_updated_at ON service_orders;
CREATE TRIGGER service_orders_updated_at BEFORE UPDATE ON service_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS customer_requests_updated_at ON customer_requests;
CREATE TRIGGER customer_requests_updated_at BEFORE UPDATE ON customer_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO rooms(name,slug,description,nightly_rate,capacity,features,image_url,display_order) VALUES
('Deluxe King Room','deluxe-king','A calm, contemporary room with a king bed and considered essentials.',85000,2,ARRAY['King bed','Air conditioning','Wi-Fi','Private bathroom'],'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80',1),
('Executive Twin Room','executive-twin','A spacious twin room suited to friends, colleagues and flexible stays.',105000,2,ARRAY['Twin beds','Work desk','Air conditioning','Wi-Fi'],'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80',2),
('Residence Suite','residence-suite','An elevated suite with extra space for a longer or more relaxed stay.',165000,3,ARRAY['Suite living area','King bed','Wi-Fi','Mini refrigerator'],'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1200&q=80',3)
ON CONFLICT(slug) DO NOTHING;
INSERT INTO services(name,description,category,price,availability_note,display_order) VALUES
('Swimming Pool Access','Request access to the hotel swimming facilities.','Wellness',10000,'Confirm operating hours and availability with reception.',1),
('Room Service','Request food and drinks delivered to your room.','Kitchen',15000,'Menu and delivery time are confirmed by the service team.',2),
('Welcome Refreshment Deal','A welcome refreshment package for your stay.','Deals',12000,'Available subject to daily stock.',3),
('Airport Transfer Request','Request a transfer quotation for your arrival or departure.','Transport',0,'Final price depends on route and vehicle availability.',4)
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_active_deposit
  ON payments(booking_id) WHERE payment_type='booking_deposit' AND status IN ('pending','paid');
