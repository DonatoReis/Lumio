-- Migration: User Conversation Preferences
-- Description: Adds support for user-specific conversation preferences like soft deletion, archiving, and muting
-- Date: 2025-05-25

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the user_conversation_preferences table
CREATE TABLE IF NOT EXISTS user_conversation_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  messages_cleared_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);

-- Add comments for documentation
COMMENT ON TABLE user_conversation_preferences IS 'User-specific preferences for conversations, including soft deletion, archiving, and muting';
COMMENT ON COLUMN user_conversation_preferences.is_muted IS 'Whether the user has muted notifications for this conversation';
COMMENT ON COLUMN user_conversation_preferences.is_pinned IS 'Whether the user has pinned this conversation to the top of their list';
COMMENT ON COLUMN user_conversation_preferences.is_archived IS 'Whether the user has archived this conversation';
COMMENT ON COLUMN user_conversation_preferences.is_deleted IS 'Whether the user has deleted this conversation (soft deletion)';
COMMENT ON COLUMN user_conversation_preferences.messages_cleared_at IS 'Timestamp when the user cleared their messages; only messages after this time will be shown';

-- Add indices for performance
CREATE INDEX idx_user_conversation_preferences_user_id ON user_conversation_preferences(user_id);
CREATE INDEX idx_user_conversation_preferences_conversation_id ON user_conversation_preferences(conversation_id);
CREATE INDEX idx_user_conversation_preferences_is_deleted ON user_conversation_preferences(is_deleted);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger to user_conversation_preferences table
DROP TRIGGER IF EXISTS update_user_conversation_preferences_updated_at ON user_conversation_preferences;
CREATE TRIGGER update_user_conversation_preferences_updated_at
BEFORE UPDATE ON user_conversation_preferences
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable RLS on the user_conversation_preferences table
ALTER TABLE user_conversation_preferences ENABLE ROW LEVEL SECURITY;

-- Add RLS policies to ensure users can only see and modify their own preferences
DROP POLICY IF EXISTS "user_conversation_preferences:select:own" ON user_conversation_preferences;
CREATE POLICY "user_conversation_preferences:select:own" 
  ON user_conversation_preferences
  FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_conversation_preferences:insert:own" ON user_conversation_preferences;
CREATE POLICY "user_conversation_preferences:insert:own" 
  ON user_conversation_preferences
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_conversation_preferences:update:own" ON user_conversation_preferences;
CREATE POLICY "user_conversation_preferences:update:own" 
  ON user_conversation_preferences
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_conversation_preferences:delete:own" ON user_conversation_preferences;
CREATE POLICY "user_conversation_preferences:delete:own" 
  ON user_conversation_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create functions for common operations

-- Function to mark a conversation as deleted for a specific user
CREATE OR REPLACE FUNCTION mark_conversation_deleted(
  p_conversation_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      is_deleted,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      TRUE,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in mark_conversation_deleted: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark messages as cleared for a specific user
CREATE OR REPLACE FUNCTION mark_messages_cleared(
  p_conversation_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET messages_cleared_at = NOW(), updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      messages_cleared_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in mark_messages_cleared: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set a conversation as archived for a specific user
CREATE OR REPLACE FUNCTION set_conversation_archived(
  p_conversation_id UUID,
  p_is_archived BOOLEAN,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET is_archived = p_is_archived, updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      is_archived,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      p_is_archived,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in set_conversation_archived: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set a conversation as pinned for a specific user
CREATE OR REPLACE FUNCTION set_conversation_pinned(
  p_conversation_id UUID,
  p_is_pinned BOOLEAN,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET is_pinned = p_is_pinned, updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      is_pinned,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      p_is_pinned,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in set_conversation_pinned: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set a conversation as muted for a specific user
CREATE OR REPLACE FUNCTION set_conversation_muted(
  p_conversation_id UUID,
  p_is_muted BOOLEAN,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET is_muted = p_is_muted, updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      is_muted,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      p_is_muted,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in set_conversation_muted: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a message is visible to a user
CREATE OR REPLACE FUNCTION is_message_visible_to_user(
  p_message_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_conversation_id UUID;
  v_message_created_at TIMESTAMP WITH TIME ZONE;
  v_user_id UUID;
  v_is_participant BOOLEAN;
  v_is_deleted BOOLEAN := FALSE;
  v_messages_cleared_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Get conversation_id and created_at for this message
  SELECT conversation_id, created_at 
  INTO v_conversation_id, v_message_created_at
  FROM messages
  WHERE id = p_message_id;
  
  IF v_conversation_id IS NULL THEN
    RETURN FALSE; -- Message doesn't exist
  END IF;
  
  -- Check if user is a participant in this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = v_conversation_id
    AND user_id = v_user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RETURN FALSE; -- User is not a participant
  END IF;
  
  -- Check user preferences for this conversation
  SELECT 
    is_deleted,
    messages_cleared_at
  INTO 
    v_is_deleted,
    v_messages_cleared_at
  FROM user_conversation_preferences
  WHERE conversation_id = v_conversation_id
  AND user_id = v_user_id;
  
  -- If conversation is deleted for this user, message is not visible
  IF v_is_deleted THEN
    RETURN FALSE;
  END IF;
  
  -- If messages were cleared, only show messages after that time
  IF v_messages_cleared_at IS NOT NULL AND v_message_created_at <= v_messages_cleared_at THEN
    RETURN FALSE;
  END IF;
  
  -- If we got here, the message is visible
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in is_message_visible_to_user: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to notify participants of conversation updates
CREATE OR REPLACE FUNCTION notify_conversation_update()
RETURNS TRIGGER AS $$
DECLARE
  participants RECORD;
BEGIN
  -- For INSERT and UPDATE operations
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Get all participants for this conversation
    FOR participants IN (
      SELECT user_id
      FROM conversation_participants
      WHERE conversation_id = NEW.conversation_id
    )
    LOOP
      -- If the participant has set up notification preferences, check them
      -- This would typically be used to filter notifications based on mute status, etc.
      PERFORM 1
      FROM user_conversation_preferences
      WHERE user_id = participants.user_id
      AND conversation_id = NEW.conversation_id
      AND is_muted = FALSE; -- Only notify if not muted
      
      -- If the participant should be notified, insert a notification record
      -- This assumes you have a notification system set up
      IF FOUND THEN
        -- For a first message in a conversation, special handling
        IF NOT EXISTS (
          SELECT 1 FROM messages 
          WHERE conversation_id = NEW.conversation_id 
          AND id != NEW.id
        ) THEN
          -- This is the first message in the conversation
          -- Insert a notification with a special type
          INSERT INTO notification_logs (
            user_id,
            channel,
            notification_type,
            title,
            body,
            payload
          ) VALUES (
            participants.user_id,
            'in-app',
            'new_conversation',
            'Nova conversa',
            SUBSTR(NEW.content, 1, 100),
            jsonb_build_object(
              'conversation_id', NEW.conversation_id,
              'message_id', NEW.id,
              'sender_id', NEW.sender_id
            )
          );
        ELSE
          -- This is a regular message
          INSERT INTO notification_logs (
            user_id,
            channel,
            notification_type,
            title,
            body,
            payload
          ) VALUES (
            participants.user_id,
            'in-app',
            'new_message',
            'Nova mensagem',
            SUBSTR(NEW.content, 1, 100),
            jsonb_build_object(
              'conversation_id', NEW.conversation_id,
              'message_id', NEW.id,
              'sender_id', NEW.sender_id
            )
          );
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  -- Return the appropriate record based on operation type
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the trigger on messages table
DROP TRIGGER IF EXISTS messages_notify_update ON messages;
CREATE TRIGGER messages_notify_update
AFTER INSERT OR UPDATE ON messages
FOR EACH ROW EXECUTE PROCEDURE notify_conversation_update();

-- Add RLS policies for messages table to respect user preferences
-- Only show messages from conversations that the user hasn't deleted
-- and respect message_cleared_at timestamp
DROP POLICY IF EXISTS "messages:select:visible" ON messages;
CREATE POLICY "messages:select:visible" ON messages
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM conversation_participants WHERE conversation_id = messages.conversation_id
  )
  AND
  NOT EXISTS (
    SELECT 1 FROM user_conversation_preferences
    WHERE user_id = auth.uid()
    AND conversation_id = messages.conversation_id
    AND is_deleted = TRUE
  )
  AND
  NOT EXISTS (
    SELECT 1 FROM user_conversation_preferences
    WHERE user_id = auth.uid()
    AND conversation_id = messages.conversation_id
    AND messages_cleared_at IS NOT NULL
    AND messages.created_at <= messages_cleared_at
  )
);

-- Add additional constraints to conversations table to ensure deterministic IDs
-- First create a trigger function to validate the conversation ID format
CREATE OR REPLACE FUNCTION validate_conversation_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if ID matches UUID format
  IF NEW.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid conversation ID format. Must be a valid UUID.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on conversations table
DROP TRIGGER IF EXISTS check_conversation_id ON conversations;
CREATE TRIGGER check_conversation_id
BEFORE INSERT ON conversations
FOR EACH ROW EXECUTE PROCEDURE validate_conversation_id();

-- Add a view for easy conversation access that includes user preference info
CREATE OR REPLACE VIEW user_conversations AS
SELECT 
  c.id,
  c.name,
  c.created_at,
  c.updated_at,
  c.last_message,
  c.last_message_time,
  p.user_id,
  COALESCE(up.is_muted, FALSE) as is_muted,
  COALESCE(up.is_pinned, FALSE) as is_pinned,
  COALESCE(up.is_archived, FALSE) as is_archived,
  COALESCE(up.is_deleted, FALSE) as is_deleted,
  up.messages_cleared_at
FROM 
  conversations c
JOIN 
  conversation_participants p ON c.id = p.conversation_id
LEFT JOIN 
  user_conversation_preferences up ON p.conversation_id = up.conversation_id AND p.user_id = up.user_id
WHERE 
  COALESCE(up.is_deleted, FALSE) = FALSE;

-- Add comment to the view
COMMENT ON VIEW user_conversations IS 'View of conversations for each user, including their preferences and filtering out deleted conversations';

