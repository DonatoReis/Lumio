-- Notification System Migration Script
-- BizConnect AI Nexus
-- Created: 2025-05-17

-- Create notification frequency enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'notification_frequency'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE notification_frequency AS ENUM ('instant', 'daily', 'weekly');
  END IF;
END
$$;

-- Create notification status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'notification_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');
  END IF;
END
$$;

-- Create notification priority enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'notification_priority'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'critical');
  END IF;
END
$$;

-- Table: notification_channels
CREATE TABLE IF NOT EXISTS public.notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    requires_subscription BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment to notification_channels table
COMMENT ON TABLE public.notification_channels IS 'Stores available notification channels (email, push, in-app, etc.)';

-- Insert default notification channels
INSERT INTO public.notification_channels (name, description, icon, is_active, requires_subscription)
VALUES 
    ('email', 'Email notifications', 'mail', TRUE, FALSE),
    ('push', 'Browser push notifications', 'bell', TRUE, TRUE),
    ('in-app', 'In-app notifications', 'message-square', TRUE, FALSE),
    ('sms', 'SMS text messages', 'smartphone', FALSE, TRUE)
ON CONFLICT (name) DO NOTHING;

-- Table: notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.notification_channels(id) ON DELETE CASCADE,
    frequency notification_frequency DEFAULT 'instant',
    notify_types JSONB DEFAULT '{"system": true, "security": true, "messages": true, "mentions": true, "teams": true}',
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, channel_id)
);

-- Add comment to notification_preferences table
COMMENT ON TABLE public.notification_preferences IS 'Stores user preferences for each notification channel';

-- Create index on notification_preferences user_id
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences (user_id);

-- Table: scheduled_reminders
CREATE TABLE IF NOT EXISTS public.scheduled_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    run_at TIMESTAMPTZ NOT NULL,
    status notification_status DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    channels JSONB DEFAULT '["in-app"]'::jsonb,
    priority notification_priority DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment to scheduled_reminders table
COMMENT ON TABLE public.scheduled_reminders IS 'Stores scheduled notifications and reminders to be sent in the future';

-- Create index on scheduled_reminders run_at and status
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_run_at_status 
ON public.scheduled_reminders (run_at, status);

-- Create index on scheduled_reminders user_id
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_user_id 
ON public.scheduled_reminders (user_id);

-- Table: notification_logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    title TEXT,
    body TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    is_encrypted BOOLEAN DEFAULT FALSE,
    priority notification_priority DEFAULT 'normal',
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    status notification_status DEFAULT 'sent',
    error_msg TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment to notification_logs table
COMMENT ON TABLE public.notification_logs IS 'Logs all notification activities for auditing and monitoring';

-- Create index on notification_logs user_id
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id 
ON public.notification_logs (user_id);

-- Create index on notification_logs is_read status
CREATE INDEX IF NOT EXISTS idx_notification_logs_is_read 
ON public.notification_logs (is_read, delivered_at DESC);

-- Create index on notification_logs notification_type
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification_type 
ON public.notification_logs (notification_type);

-- Create trigger to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to all tables
-- Guarded trigger for notification_channels updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_notification_channels_updated_at'
      AND tgrelid = 'public.notification_channels'::regclass
  ) THEN
    CREATE TRIGGER update_notification_channels_updated_at
      BEFORE UPDATE ON public.notification_channels
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END
$$;

-- Guarded trigger for notification_preferences updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_notification_preferences_updated_at'
      AND tgrelid = 'public.notification_preferences'::regclass
  ) THEN
    CREATE TRIGGER update_notification_preferences_updated_at
      BEFORE UPDATE ON public.notification_preferences
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END
$$;

-- Guarded trigger for scheduled_reminders updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_scheduled_reminders_updated_at'
      AND tgrelid = 'public.scheduled_reminders'::regclass
  ) THEN
    CREATE TRIGGER update_scheduled_reminders_updated_at
      BEFORE UPDATE ON public.scheduled_reminders
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END
$$;

-- Security: RLS Policies

-- Enable RLS on all tables
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- notification_channels policies (viewable by all authenticated users)
CREATE POLICY "notification_channels:select:all" ON public.notification_channels
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only service_role can insert, update or delete notification channels
CREATE POLICY "notification_channels:insert:service_role" ON public.notification_channels
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "notification_channels:update:service_role" ON public.notification_channels
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "notification_channels:delete:service_role" ON public.notification_channels
    FOR DELETE USING (auth.role() = 'service_role');

-- notification_preferences policies (users can only manage their own preferences)
CREATE POLICY "notification_preferences:select:own" ON public.notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notification_preferences:insert:own" ON public.notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_preferences:update:own" ON public.notification_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notification_preferences:delete:own" ON public.notification_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Additionally allow service_role to manage all notification preferences
CREATE POLICY "notification_preferences:all:service_role" ON public.notification_preferences
    USING (auth.role() = 'service_role');

-- scheduled_reminders policies (users can only see their own reminders)
CREATE POLICY "scheduled_reminders:select:own" ON public.scheduled_reminders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "scheduled_reminders:insert:own" ON public.scheduled_reminders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "scheduled_reminders:update:own" ON public.scheduled_reminders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "scheduled_reminders:delete:own" ON public.scheduled_reminders
    FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all reminders (needed for background processing)
CREATE POLICY "scheduled_reminders:all:service_role" ON public.scheduled_reminders
    USING (auth.role() = 'service_role');

-- notification_logs policies (users can only see their own logs)
CREATE POLICY "notification_logs:select:own" ON public.notification_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Only service_role can insert new logs (system generated)
CREATE POLICY "notification_logs:insert:service_role" ON public.notification_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Users can update their own logs (to mark as read)
DROP POLICY IF EXISTS "notification_logs:update:own" ON public.notification_logs;
CREATE POLICY "notification_logs:update:own" ON public.notification_logs
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Service role can update any log (for system processes)
CREATE POLICY "notification_logs:update:service_role" ON public.notification_logs
    FOR UPDATE USING (auth.role() = 'service_role');

-- Create SQL functions for notification management

-- Function to get user notification preferences
CREATE OR REPLACE FUNCTION get_user_notification_prefs(p_user_id UUID)
RETURNS TABLE (
    channel_id UUID,
    channel_name TEXT,
    frequency notification_frequency,
    notify_types JSONB,
    is_enabled BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        np.channel_id,
        nc.name as channel_name,
        np.frequency,
        np.notify_types,
        np.is_enabled
    FROM notification_preferences np
    JOIN notification_channels nc ON np.channel_id = nc.id
    WHERE np.user_id = p_user_id AND nc.is_active = true;
END;
$$;

-- Function to upsert notification preferences
CREATE OR REPLACE FUNCTION upsert_notification_pref(
    p_user_id UUID,
    p_channel_id UUID,
    p_settings JSONB
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_frequency notification_frequency;
    v_notify_types JSONB;
    v_is_enabled BOOLEAN;
    v_pref_id UUID;
BEGIN
    -- Extract values from settings
    v_frequency := (p_settings->>'frequency')::notification_frequency;
    v_notify_types := COALESCE(p_settings->'notify_types', '{}'::jsonb);
    v_is_enabled := COALESCE((p_settings->>'is_enabled')::boolean, TRUE);
    
    -- Upsert the preference
    INSERT INTO notification_preferences (
        user_id, channel_id, frequency, notify_types, is_enabled
    ) VALUES (
        p_user_id, p_channel_id, v_frequency, v_notify_types, v_is_enabled
    )
    ON CONFLICT (user_id, channel_id) DO UPDATE SET
        frequency = v_frequency,
        notify_types = v_notify_types,
        is_enabled = v_is_enabled,
        updated_at = NOW()
    RETURNING id INTO v_pref_id;
    
    RETURN v_pref_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user_id of the notification
    SELECT user_id INTO v_user_id FROM notification_logs
    WHERE id = p_notification_id;
    
    -- Only allow if the current user owns the notification
    IF v_user_id = auth.uid() THEN
        UPDATE notification_logs SET is_read = TRUE
        WHERE id = p_notification_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
    p_user_id UUID
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Only allow if the current user is marking their own notifications
    IF p_user_id = auth.uid() THEN
        UPDATE notification_logs SET is_read = TRUE
        WHERE user_id = p_user_id AND is_read = FALSE;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RETURN v_count;
    ELSE
        RETURN 0;
    END IF;
END;
$$;

-- Function to create a scheduled reminder
CREATE OR REPLACE FUNCTION schedule_reminder(
    p_user_id UUID,
    p_title TEXT,
    p_body TEXT,
    p_payload JSONB,
    p_run_at TIMESTAMPTZ,
    p_channels JSONB DEFAULT '["in-app"]'::jsonb,
    p_priority notification_priority DEFAULT 'normal'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_reminder_id UUID;
BEGIN
    -- Only allow if the current user is creating their own reminder
    -- or it's the service role
    IF p_user_id = auth.uid() OR auth.role() = 'service_role' THEN
        INSERT INTO scheduled_reminders (
            user_id, title, body, payload, run_at, channels, priority
        ) VALUES (
            p_user_id, p_title, p_body, p_payload, p_run_at, p_channels, p_priority
        )
        RETURNING id INTO v_reminder_id;
        
        RETURN v_reminder_id;
    ELSE
        RAISE EXCEPTION 'You can only schedule reminders for yourself';
    END IF;
END;
$$;

-- Create a view for notification metrics
CREATE OR REPLACE VIEW notification_metrics AS
SELECT
    DATE_TRUNC('hour', created_at) AS hour,
    channel,
    notification_type,
    priority,
    status,
    COUNT(*) AS total,
    SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count
FROM 
    notification_logs
GROUP BY 
    1, 2, 3, 4, 5;

