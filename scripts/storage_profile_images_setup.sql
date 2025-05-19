-- BizConnect Profile Images Storage Configuration
-- This script configures the profile_images bucket and its RLS policies
-- It can be run via the Supabase SQL Editor by a superuser or storage admin

-- PART 1: Create the profile_images bucket if it doesn't exist
DO $$
BEGIN
    BEGIN
        -- Create the bucket if it doesn't exist
        PERFORM storage.create_bucket('profile_images', 'User profile images');
        RAISE NOTICE 'Created profile_images bucket successfully';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Bucket profile_images already exists: %', SQLERRM;
    END;

    -- Ensure the bucket is set to public
    UPDATE storage.buckets
    SET public = TRUE
    WHERE name = 'profile_images';
    
    RAISE NOTICE 'Ensured profile_images bucket is set to public';
END $$;

-- PART 2: Configure RLS Policies for the storage.objects table
-- These policies control access to objects in the profile_images bucket

-- Policy 1: Allow public read access to all files in profile_images
DROP POLICY IF EXISTS "profile_images_public_select" ON storage.objects;
CREATE POLICY "profile_images_public_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile_images');

-- Policy 2: Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "profile_images_auth_insert" ON storage.objects;
CREATE POLICY "profile_images_auth_insert"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'profile_images' 
    AND auth.role() = 'authenticated'
    AND (split_part(name, '/', 1)) = auth.uid()::text
);

-- Policy 3: Allow users to update only their own files
DROP POLICY IF EXISTS "profile_images_auth_update" ON storage.objects;
CREATE POLICY "profile_images_auth_update"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'profile_images'
    AND auth.role() = 'authenticated'
    AND (split_part(name, '/', 1)) = auth.uid()::text
);

-- Policy 4: Allow users to delete only their own files
DROP POLICY IF EXISTS "profile_images_auth_delete" ON storage.objects;
CREATE POLICY "profile_images_auth_delete"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'profile_images'
    AND auth.role() = 'authenticated'
    AND (split_part(name, '/', 1)) = auth.uid()::text
);

-- PART 3: Verify setup
SELECT name, public FROM storage.buckets WHERE name = 'profile_images';

SELECT 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE 'profile_images%'
ORDER BY policyname;

-- IMPORTANT NOTES:
-- 1. This script must be run by a user with ownership permissions on the storage.objects table
--    (typically only the Postgres superuser or storage admin has these permissions)
-- 2. If you encounter "must be owner of table objects" errors, use the Supabase dashboard UI instead:
--    a. Go to Storage > Policies
--    b. Create each policy manually with the same conditions
-- 3. The AvatarUpload component expects files to be stored with path: ${user.id}/${filename}

