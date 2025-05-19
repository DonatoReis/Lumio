-- BizConnect Fix Storage RLS Policies Script (Compatible Version)
-- This script fixes the Supabase Storage RLS policies for profile image uploads.
-- It ensures that users can upload, update, and delete their own profile images,
-- while making the images publicly readable.
-- This version avoids using storage.update_bucket() for better compatibility with older Supabase versions.

-- Part 1: Create or update the profile_images bucket
DO $$
BEGIN
    -- Create the profile_images bucket if it doesn't exist
    BEGIN
        PERFORM storage.create_bucket('profile_images', 'Profile images bucket');
        RAISE NOTICE 'Created profile_images bucket';
    EXCEPTION
        -- Bucket may already exist (error code P0002)
        WHEN others THEN
            RAISE NOTICE 'Bucket profile_images already exists: %', SQLERRM;
    END;
    
    -- Ensure the bucket is set to public (direct table update for compatibility)
    UPDATE storage.buckets
    SET public = TRUE
    WHERE name = 'profile_images';
    RAISE NOTICE 'Updated profile_images bucket to be public (direct table update)';
END $$;

-- Part 2: Drop existing RLS policies for the profile_images bucket
BEGIN;
    -- Drop any existing policies for this bucket to avoid conflicts
    DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
    DROP POLICY IF EXISTS "User Upload to Own Folder" ON storage.objects;
    DROP POLICY IF EXISTS "User Update Own Files" ON storage.objects;
    DROP POLICY IF EXISTS "User Delete Own Files" ON storage.objects;
    
    -- Additional cleanup for any other policies with similar names
    DROP POLICY IF EXISTS "profile_images_public_select" ON storage.objects;
    DROP POLICY IF EXISTS "profile_images_auth_insert" ON storage.objects;
    DROP POLICY IF EXISTS "profile_images_auth_update" ON storage.objects;
    DROP POLICY IF EXISTS "profile_images_auth_delete" ON storage.objects;
COMMIT;

-- Part 3: Create proper RLS policies for the profile_images bucket

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow users to read any file in the bucket (public read access)
CREATE POLICY "profile_images_public_select" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'profile_images');

-- Policy 2: Allow users to upload files only to their own folder
-- Path format expected: {user_id}/{randomString}-{timestamp}.{ext}
CREATE POLICY "profile_images_auth_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'profile_images'
        AND auth.role() = 'authenticated'
        AND (split_part(name, '/', 1)) = auth.uid()::text
    );

-- Policy 3: Allow users to update only their own files
CREATE POLICY "profile_images_auth_update" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'profile_images'
        AND auth.role() = 'authenticated'
        AND (split_part(name, '/', 1)) = auth.uid()::text
    );

-- Policy 4: Allow users to delete only their own files
CREATE POLICY "profile_images_auth_delete" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'profile_images'
        AND auth.role() = 'authenticated'
        AND (split_part(name, '/', 1)) = auth.uid()::text
    );

-- Part 4: Verify the policies are correctly set up

-- List all storage buckets
SELECT name, public, owner, created_at, updated_at
FROM storage.buckets
WHERE name = 'profile_images';

-- List all relevant policies for the storage.objects table
SELECT
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;

-- Notes for deployment:
-- 1. Execute this script in the Supabase SQL Editor
-- 2. Refresh your application and test profile image uploads
-- 3. For debugging permission issues, check the network requests and Supabase logs
-- 4. Ensure authenticated sessions are valid when testing
-- 5. This script is compatible with older Supabase versions as it avoids using storage.update_bucket()
