-- BizConnect Fix Storage RLS Policies Script
-- This script fixes the Supabase Storage RLS policies for profile image uploads.
-- It ensures that users can upload, update, and delete their own profile images,
-- while making the images publicly readable.

-- Part 1: Diagnose current storage bucket and policies

-- List all storage buckets
SELECT name, owner, created_at, updated_at, public
FROM storage.buckets
ORDER BY name;

-- List all existing storage policies
SELECT
    id,
    name,
    bucket_id,
    operation,
    definition
FROM storage.policies
ORDER BY bucket_id, operation;

-- Part 2: Create or update the profile_images bucket

-- Check if the profile_images bucket exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'profile_images') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('profile_images', 'profile_images', TRUE);
        RAISE NOTICE 'Created profile_images bucket with public access';
    ELSE
        -- Ensure the bucket is public
        UPDATE storage.buckets
        SET public = TRUE
        WHERE name = 'profile_images' AND (public IS NULL OR public = FALSE);
        
        RAISE NOTICE 'profile_images bucket already exists, ensured public access';
    END IF;
END $$;

-- Part 3: Clean up existing policies to avoid conflicts

-- Remove any existing policies for the profile_images bucket
DO $$
BEGIN
    DELETE FROM storage.policies
    WHERE bucket_id = 'profile_images';
    
    RAISE NOTICE 'Removed existing policies for profile_images bucket';
END $$;

-- Part 4: Create proper RLS policies for the profile_images bucket

-- Policy 1: Allow users to read any file in the bucket (public read access)
-- This is handled by the bucket's public setting, but we'll add a policy for clarity
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
    'Public Read Access',
    'profile_images',
    'SELECT',
    '(bucket_id = ''profile_images'')'
);

-- Policy 2: Allow users to upload files only to their own folder
-- Path format expected: ${user.id}/${randomString}-${timestamp}.${fileExt}
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
    'User Upload to Own Folder',
    'profile_images',
    'INSERT',
    '(bucket_id = ''profile_images'' AND (storage.foldername(name))[1] = auth.uid()::text)'
);

-- Policy 3: Allow users to update only their own files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
    'User Update Own Files',
    'profile_images',
    'UPDATE',
    '(bucket_id = ''profile_images'' AND (storage.foldername(name))[1] = auth.uid()::text)'
);

-- Policy 4: Allow users to delete only their own files
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
    'User Delete Own Files',
    'profile_images',
    'DELETE',
    '(bucket_id = ''profile_images'' AND (storage.foldername(name))[1] = auth.uid()::text)'
);

-- Part 5: Verify the policies are correctly set up

-- List the updated policies for verification
SELECT
    id,
    name,
    bucket_id,
    operation,
    definition
FROM storage.policies
WHERE bucket_id = 'profile_images'
ORDER BY operation;

-- Show a summary of the bucket configuration
SELECT
    b.name AS bucket_name,
    b.public AS is_public,
    COUNT(p.id) AS policy_count,
    string_agg(p.operation, ', ') AS operations
FROM storage.buckets b
LEFT JOIN storage.policies p ON b.id = p.bucket_id
WHERE b.name = 'profile_images'
GROUP BY b.name, b.public;

-- Part 6: Test script for common user operations

-- The following is a diagnostic function to test if a user would have permission
-- for various operations on files in the profile_images bucket
-- This can help troubleshoot permission issues
CREATE OR REPLACE FUNCTION test_profile_image_permissions()
RETURNS TABLE (
    operation text,
    path text,
    has_permission boolean
)
LANGUAGE plpgsql
AS $$
DECLARE
    test_user_id uuid := auth.uid();
    test_file_path text;
    valid_path text;
    invalid_path text;
BEGIN
    -- Skip if no authenticated user
    IF test_user_id IS NULL THEN
        operation := 'ANY';
        path := 'N/A';
        has_permission := false;
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Create test paths
    valid_path := test_user_id || '/test-file.jpg';
    invalid_path := 'someone-else-id/test-file.jpg';
    
    -- Test SELECT permission (should be true for both paths since bucket is public)
    operation := 'SELECT';
    path := valid_path;
    has_permission := EXISTS (
        SELECT 1 FROM storage.buckets b
        WHERE b.name = 'profile_images'
        AND storage.policy_eval('SELECT', 'profile_images', valid_path)
    );
    RETURN NEXT;
    
    operation := 'SELECT';
    path := invalid_path;
    has_permission := EXISTS (
        SELECT 1 FROM storage.buckets b
        WHERE b.name = 'profile_images'
        AND storage.policy_eval('SELECT', 'profile_images', invalid_path)
    );
    RETURN NEXT;
    
    -- Test INSERT permission (should be true only for valid path)
    operation := 'INSERT';
    path := valid_path;
    has_permission := EXISTS (
        SELECT 1 FROM storage.buckets b
        WHERE b.name = 'profile_images'
        AND storage.policy_eval('INSERT', 'profile_images', valid_path)
    );
    RETURN NEXT;
    
    operation := 'INSERT';
    path := invalid_path;
    has_permission := EXISTS (
        SELECT 1 FROM storage.buckets b
        WHERE b.name = 'profile_images'
        AND storage.policy_eval('INSERT', 'profile_images', invalid_path)
    );
    RETURN NEXT;
    
    -- Test UPDATE permission (should be true only for valid path)
    operation := 'UPDATE';
    path := valid_path;
    has_permission := EXISTS (
        SELECT 1 FROM storage.buckets b
        WHERE b.name = 'profile_images'
        AND storage.policy_eval('UPDATE', 'profile_images', valid_path)
    );
    RETURN NEXT;
    
    operation := 'UPDATE';
    path := invalid_path;
    has_permission := EXISTS (
        SELECT 1 FROM storage.buckets b
        WHERE b.name = 'profile_images'
        AND storage.policy_eval('UPDATE', 'profile_images', invalid_path)
    );
    RETURN NEXT;
    
    -- Test DELETE permission (should be true only for valid path)
    operation := 'DELETE';
    path := valid_path;
    has_permission := EXISTS (
        SELECT 1 FROM storage.buckets b
        WHERE b.name = 'profile_images'
        AND storage.policy_eval('DELETE', 'profile_images', valid_path)
    );
    RETURN NEXT;
    
    operation := 'DELETE';
    path := invalid_path;
    has_permission := EXISTS (
        SELECT 1 FROM storage.buckets b
        WHERE b.name = 'profile_images'
        AND storage.policy_eval('DELETE', 'profile_images', invalid_path)
    );
    RETURN NEXT;
    
    RETURN;
END $$;

-- Run the test function (only works when run as an authenticated user)
SELECT * FROM test_profile_image_permissions();

-- Cleanup (optional, comment out to keep the test function)
-- DROP FUNCTION test_profile_image_permissions();

