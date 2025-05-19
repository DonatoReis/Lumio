-- Migration: Media Sharing Functionality
-- Description: Adds necessary schema changes to support end-to-end encrypted media sharing
-- Date: 2025-05-15

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add columns to messages table if they don't exist yet
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS encrypted_key TEXT,
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS thumbnail TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add comment to document the media columns
COMMENT ON COLUMN messages.type IS 'Message type: text, image, video, audio, document, file';
COMMENT ON COLUMN messages.storage_path IS 'Path to the encrypted file in Supabase Storage';
COMMENT ON COLUMN messages.encrypted_key IS 'Symmetrical encryption key, encrypted with the recipient''s public key';
COMMENT ON COLUMN messages.iv IS 'Initialization vector used for encryption';
COMMENT ON COLUMN messages.thumbnail IS 'Base64 encoded thumbnail for images and videos';
COMMENT ON COLUMN messages.expires_at IS 'Date when the media should be deleted';
COMMENT ON COLUMN messages.file_size IS 'Size of the file in bytes';

-- Create index for faster message type lookups
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);

-- Create index for faster expiry date lookups (for cleanup)
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at);

-- Create maintenance_logs table for tracking cleanup operations
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation VARCHAR(50) NOT NULL,
    result VARCHAR(20) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Add comments on maintenance_logs table
COMMENT ON TABLE maintenance_logs IS 'Logs for system maintenance operations like media cleanup';
COMMENT ON COLUMN maintenance_logs.operation IS 'Type of operation: media_cleanup, etc.';
COMMENT ON COLUMN maintenance_logs.result IS 'Result of operation: success, error, etc.';
COMMENT ON COLUMN maintenance_logs.details IS 'Detailed information about the operation';

-- Create index on maintenance_logs for faster querying
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_operation ON maintenance_logs(operation);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_created_at ON maintenance_logs(created_at);

-- RLS policies for messages table (media-related)
-- First, enable RLS if not already enabled
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy for selecting messages with media (allow if user is a participant in the conversation)
CREATE POLICY select_messages_media ON messages
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM conversation_participants 
            WHERE conversation_id = messages.conversation_id
        )
    );

-- Policy for inserting messages with media
CREATE POLICY insert_messages_media ON messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        auth.uid() IN (
            SELECT user_id FROM conversation_participants 
            WHERE conversation_id = messages.conversation_id
        )
    );

-- Create policies for maintenance_logs table
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Only allow service role and admins to insert maintenance logs
CREATE POLICY insert_maintenance_logs ON maintenance_logs
    FOR INSERT
    WITH CHECK (
        -- Allow service role (via Supabase Edge Functions)
        (auth.jwt() ->> 'role' = 'service_role') OR
        -- Or allow specific admin users (customize as needed)
        auth.uid() IN (SELECT id FROM admins)
    );

-- Only allow service role and admins to view maintenance logs
CREATE POLICY select_maintenance_logs ON maintenance_logs
    FOR SELECT
    USING (
        -- Allow service role (via Supabase Edge Functions)
        (auth.jwt() ->> 'role' = 'service_role') OR
        -- Or allow specific admin users (customize as needed)
        auth.uid() IN (SELECT id FROM admins)
    );

-- Create a minimal "admins" table if it doesn't exist
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bucket for encrypted media if the storage schema and tables exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'buckets'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM storage.buckets WHERE name = 'encrypted_media'
        ) THEN
            -- Create the bucket
            INSERT INTO storage.buckets (id, name, public, avif_autodetection)
            VALUES ('encrypted_media', 'encrypted_media', false, false);
        END IF;
        -- Only create policies if the storage.policies table exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'storage' AND table_name = 'policies'
        ) THEN
            -- Allow users to upload their own files
            INSERT INTO storage.policies (name, bucket_id, operation, definition)
            VALUES (
                'Users can upload their own media',
                'encrypted_media',
                'INSERT',
                format('(bucket_id = %L) AND (auth.uid() = (storage.foldername(name))[1]::uuid)', 'encrypted_media')::jsonb
            );
            -- Allow users to read files from conversations they're part of
            INSERT INTO storage.policies (name, bucket_id, operation, definition)
            VALUES (
                'Users can read media from their conversations',
                'encrypted_media',
                'SELECT',
                format('(bucket_id = %L) AND (auth.uid() IN (
                    SELECT user_id FROM conversation_participants
                    WHERE conversation_id = (storage.foldername(name))[1]
                ))', 'encrypted_media')::jsonb
            );
            -- Allow users to delete their own files
            INSERT INTO storage.policies (name, bucket_id, operation, definition)
            VALUES (
                'Users can delete their own media',
                'encrypted_media',
                'DELETE',
                format('(bucket_id = %L) AND ((storage.foldername(name))[2] = auth.uid()::text)', 'encrypted_media')::jsonb
            );
        END IF;
    END IF;
END
$$;

