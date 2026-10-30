BEGIN;
ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'support_staff';
CREATE TABLE IF NOT EXISTS support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES users(id),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  customer_read_id bigint NOT NULL DEFAULT 0,
  staff_read_id bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS support_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES support_conversations(id),
  sender_id uuid NOT NULL REFERENCES users(id),
  sender_is_staff boolean NOT NULL,
  client_message_id uuid NOT NULL,
  body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sender_id,client_message_id)
);
CREATE INDEX IF NOT EXISTS support_messages_thread_idx ON support_messages(conversation_id,id DESC);
CREATE INDEX IF NOT EXISTS support_messages_sender_idx ON support_messages(sender_id,created_at DESC);
CREATE INDEX IF NOT EXISTS support_conversations_activity_idx ON support_conversations(updated_at DESC);
COMMIT;
