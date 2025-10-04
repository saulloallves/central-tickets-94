-- Migration: Add OneSignal support to push_subscriptions table

-- 1. Add new columns for OneSignal
ALTER TABLE push_subscriptions 
ADD COLUMN IF NOT EXISTS onesignal_player_id TEXT,
ADD COLUMN IF NOT EXISTS onesignal_tags JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS platform TEXT; -- 'web', 'ios', 'android'

-- 2. Drop old Web Push columns (we'll keep them for now for backwards compatibility)
-- ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS endpoint;
-- ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS p256dh;
-- ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS auth;

-- 3. Add unique constraint on user_id to allow upsert
-- First remove duplicates if any (keep the most recent)
DELETE FROM push_subscriptions a 
USING push_subscriptions b
WHERE a.id < b.id AND a.user_id = b.user_id;

-- Add the unique constraint
ALTER TABLE push_subscriptions 
ADD CONSTRAINT push_subscriptions_user_id_key UNIQUE (user_id);

-- 4. Create index on onesignal_player_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_onesignal_player_id 
ON push_subscriptions(onesignal_player_id) 
WHERE onesignal_player_id IS NOT NULL;

-- 5. Add updated_at trigger if not exists
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_push_subscriptions_updated_at();