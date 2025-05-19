-- BizConnect Fix Storage RLS Policies Script (Permission-Safe Version)
-- This script creates the profile_images bucket for profile image uploads,
-- but AVOIDS direct modification of RLS policies to prevent permission errors.
-- It provides instructions on how to properly configure the required policies
-- through the Supabase dashboard instead.

-- IMPORTANT: The original script failed with "ERROR: 42501: must be owner of table objects"
-- because regular users don't have ownership permissions on system tables like storage.objects.

-- Part 1: Create or update the profile_images bucket
-- This part should work with regular permissions
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

-- Part 2: Verify the current status of bucket and policies
-- These SELECT statements check the current configuration without modifying anything

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
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;

-- Part 3: INSTRUCTIONS FOR CONFIGURING RLS POLICIES MANUALLY
/*
PERMISSION ERROR EXPLANATION:
----------------------------
The error "ERROR: 42501: must be owner of table objects" occurs because:
1. The storage.objects table is owned by a system role, not your regular database user
2. RLS policies can only be managed by the table owner or superusers
3. The SQL Editor in Supabase dashboard often uses a restricted role with limited permissions

SOLUTION OPTIONS:
---------------
Option 1: Use Supabase Dashboard (RECOMMENDED)
  1. Log in to your Supabase dashboard
  2. Navigate to Storage > Policies
  3. Select the 'profile_images' bucket
  4. Create the following policies:

  POLICY 1: Allow public read access to all files in profile_images
    - Name: "profile_images_public_select"
    - Operation: SELECT
    - Using expression: bucket_id = 'profile_images'

  POLICY 2: Allow authenticated users to upload to their own folder
    - Name: "profile_images_auth_insert"
    - Operation: INSERT
    - Using expression: bucket_id = 'profile_images' 
                         AND auth.role() = 'authenticated'
                         AND (split_part(name, '/', 1)) = auth.uid()::text

  POLICY 3: Allow users to update only their own files
    - Name: "profile_images_auth_update"
    - Operation: UPDATE
    - Using expression: bucket_id = 'profile_images'
                         AND auth.role() = 'authenticated'
                         AND (split_part(name, '/', 1)) = auth.uid()::text

  POLICY 4: Allow users to delete only their own files
    - Name: "profile_images_auth_delete"
    - Operation: DELETE
    - Using expression: bucket_id = 'profile_images'
                         AND auth.role() = 'authenticated'
                         AND (split_part(name, '/', 1)) = auth.uid()::text

Option 2: Use Service Role Key
  To execute the original script with the necessary permissions:
  1. In Supabase dashboard, go to Project Settings > API
  2. Use the "service_role" key instead of the "anon" key
  3. Connect to your database using this key
  4. Run the original fix_storage_rls_compatible.sql script
  
  CAUTION: The service_role key has admin privileges and should be used carefully!

Option 3: Direct Database Access
  If you have direct PostgreSQL access with superuser privileges:
  1. Connect using psql or another PostgreSQL client with elevated permissions
  2. Run the original script as a superuser or the table owner

VERIFYING CONFIGURATION:
----------------------
After configuring the policies, you can run the query in Part 2 of this script
to verify that all policies are properly set up.
*/

-- Part 4: Testing Guidance
/*
TESTING FILE UPLOADS:
-------------------
1. Ensure your application is using the correct path format:
   - Path format should be: {user_id}/{filename}
   - Example: "550e8400-e29b-41d4-a716-446655440000/profile.jpg"

2. Common issues to check:
   - Authentication: Ensure the user is properly authenticated
   - Path format: Check if the file path correctly starts with the user's UUID
   - Permissions: Confirm the policies are correctly applied
   - Bucket access: Verify the bucket exists and is public
*/

