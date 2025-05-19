
import { supabase } from '@/integrations/supabase/client';

/**
 * Tests connection to Supabase Storage
 */
export const testStorageConnection = async () => {
  try {
    // Simple call to check if we can connect to storage API
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Storage connection test failed:', error);
      return { success: false, error: error.message };
    }
    
    console.info('Storage connection test successful');
    return {
      success: true,
      buckets: data?.map(b => b.name) || []
    };
  } catch (err) {
    console.error('Storage connection test exception:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
};

/**
 * Ensures the required storage buckets exist
 */
export const ensureStorageBuckets = async () => {
  try {
    // First check connection
    const connectionTest = await testStorageConnection();
    if (!connectionTest.success) {
      return { 
        success: false, 
        error: `Storage connection failed: ${connectionTest.error}` 
      };
    }
    
    const requiredBuckets = ['profile_images'];
    const existingBuckets = connectionTest.buckets || [];
    
    // Create any missing buckets
    for (const bucketName of requiredBuckets) {
      if (!existingBuckets.includes(bucketName)) {
        console.log(`Creating missing bucket: ${bucketName}`);
        // First check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          return {
            success: false,
            error: 'Authentication required to create storage buckets'
          };
        }
        
        const { error } = await supabase.storage.createBucket(bucketName, {
          public: true, // Make bucket public so images are accessible
          fileSizeLimit: 5 * 1024 * 1024, // 5MB limit
        });
        
        if (error) {
          console.error(`Failed to create bucket ${bucketName}:`, error);
          
          // Check if this is likely a permissions error
          if (error.message?.includes('permission') || error.code === '42501') {
            return { 
              success: false, 
              error: `Permissions error creating bucket. Please use the Supabase dashboard to create the bucket manually. Details: ${error.message}`
            };
          }
          
          return { 
            success: false, 
            error: `Failed to create bucket ${bucketName}: ${error.message}`
          };
        }
        
        console.log(`Successfully created bucket: ${bucketName}`);
        
        // Note: We don't attempt to create RLS policies here as it will likely fail
        // due to permissions. This should be done manually through the Supabase dashboard
        // or by running the SQL script as a superuser.
        console.info(`The bucket was created, but you may need to configure RLS policies manually.`);
        console.info(`See storage_profile_images_setup.sql or README.md for instructions.`);
      }
    }
    
    return { success: true };
  } catch (err) {
    console.error('Error ensuring storage buckets:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
};
