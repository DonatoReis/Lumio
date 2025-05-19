-- BizConnect Storage RLS Policies - Final Solution Script
-- This script provides a comprehensive solution for the profile image upload feature
-- by properly configuring the Supabase Storage bucket and RLS policies.
--
-- IMPORTANT: This script addresses two key components:
-- 1. Creating and configuring the profile_images bucket
-- 2. Setting up the correct RLS policies to allow users to upload/manage their images

-- Part 1: Create and configure the profile_images bucket
DO $$
BEGIN
    -- Create the profile_images bucket if it doesn't exist
    BEGIN
        PERFORM storage.create_bucket('profile_images', 'Profile images bucket for user avatars');
        RAISE NOTICE 'Created profile_images bucket';
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE 'Bucket profile_images already exists: %', SQLERRM;
    END;
    
    -- Ensure the bucket is set to public
    UPDATE storage.buckets
    SET public = TRUE
    WHERE name = 'profile_images';
    RAISE NOTICE 'Updated profile_images bucket to be public';
END $$;

-- Part 2: Verify the current status of bucket and policies
-- Check if the profile_images bucket exists and is public
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
    qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;

-- Part 3: Create RLS Policies (via SQL when permissions allow)
-- This section attempts to create policies directly via SQL
-- The policies will only be created if you have sufficient permissions
DO $$
BEGIN
    -- Try to create policies, will fail silently if permissions are insufficient
    BEGIN
        -- Policy 1: Allow public read access to all files in profile_images
        DROP POLICY IF EXISTS "profile_images_public_select" ON storage.objects;
        CREATE POLICY "profile_images_public_select"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'profile_images');
        RAISE NOTICE 'Created public read policy for profile_images bucket';
        
        -- Policy 2: Allow authenticated users to upload to their own folder
        DROP POLICY IF EXISTS "profile_images_auth_insert" ON storage.objects;
        CREATE POLICY "profile_images_auth_insert"
        ON storage.objects FOR INSERT
        WITH CHECK (
            bucket_id = 'profile_images' 
            AND auth.role() = 'authenticated'
            AND (split_part(name, '/', 1)) = auth.uid()::text
        );
        RAISE NOTICE 'Created insert policy for profile_images bucket';
        
        -- Policy 3: Allow users to update only their own files
        DROP POLICY IF EXISTS "profile_images_auth_

