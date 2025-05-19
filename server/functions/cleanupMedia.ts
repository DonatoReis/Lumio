// Edge Function: cleanupMedia.ts
// Scheduled cleanup task for removing expired media files
// This function runs on Supabase Edge Functions platform on a schedule

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.4.0';

// Constants
const BUCKET_NAME = 'encrypted_media';
const BATCH_SIZE = 100; // Number of records to process in each batch

// Type definitions for tracking cleanup results
interface CleanupResult {
  success: boolean;
  totalProcessed: number;
  deletedFromStorage: number;
  deletedFromDatabase: number;
  errors: string[];
  startTime: string;
  endTime: string;
  executionTimeMs: number;
}

// Type definition for expired media records
interface ExpiredMediaRecord {
  id: string;
  storage_path: string;
  conversation_id: string;
  created_at: string;
  expires_at: string;
}

// Serve HTTP requests
serve(async (req: Request) => {
  // CORS headers
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  });

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  const startTime = new Date();
  const result: CleanupResult = {
    success: false,
    totalProcessed: 0,
    deletedFromStorage: 0,
    deletedFromDatabase: 0,
    errors: [],
    startTime: startTime.toISOString(),
    endTime: '',
    executionTimeMs: 0
  };

  try {
    // Create Supabase client with service role key (from environment)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the request is authorized if not coming from a scheduler
    // This is additional security for manual invocation
    if (req.method === 'POST' || req.method === 'GET') {
      const authHeader = req.headers.get('Authorization') || '';
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const { data: { user }, error: authError } = await supabase.auth.getUser(
          authHeader.split(' ')[1]
        );
        
        if (authError || !user) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized access' }),
            { headers, status: 401 }
          );
        }
      }
    }

    // Check if the encrypted_media bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      throw new Error(`Storage error: ${bucketsError.message}`);
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);
    if (!bucketExists) {
      // No bucket to clean up
      result.success = true;
      result.endTime = new Date().toISOString();
      result.executionTimeMs = new Date().getTime() - startTime.getTime();
      
      return new Response(
        JSON.stringify(result),
        { headers, status: 200 }
      );
    }

    // Get current date for comparison with expires_at
    const now = new Date().toISOString();
    let hasMoreRecords = true;
    let lastProcessedId: string | null = null;
    
    // Process in batches to avoid timeouts and memory issues
    while (hasMoreRecords) {
      // Query for expired media records
      let query = supabase
        .from('messages')
        .select('id, storage_path, conversation_id, created_at, expires_at')
        .not('storage_path', 'is', null)
        .lt('expires_at', now)
        .order('id', { ascending: true })
        .limit(BATCH_SIZE);
      
      // Continue from last processed ID if available
      if (lastProcessedId) {
        query = query.gt('id', lastProcessedId);
      }
      
      const { data: expiredMedia, error: queryError } = await query;
      
      if (queryError) {
        result.errors.push(`Query error: ${queryError.message}`);
        continue; // Try to proceed with next steps even if query fails
      }
      
      // Check if we have more records after this batch
      hasMoreRecords = expiredMedia.length === BATCH_SIZE;
      
      // If no expired media, we're done
      if (!expiredMedia || expiredMedia.length === 0) {
        break;
      }
      
      // Update tracking
      result.totalProcessed += expiredMedia.length;
      
      // Process each expired media record
      for (const record of expiredMedia as ExpiredMediaRecord[]) {
        lastProcessedId = record.id;
        
        // Skip records without storage path
        if (!record.storage_path) {
          continue;
        }
        
        try {
          // Delete file from storage
          const { error: deleteStorageError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([record.storage_path]);
          
          if (deleteStorageError) {
            result.errors.push(`Storage delete error for ${record.id}: ${deleteStorageError.message}`);
          } else {
            result.deletedFromStorage++;
          }
          
          // Delete message record from database
          const { error: deleteDbError } = await supabase
            .from('messages')
            .delete()
            .eq('id', record.id);
          
          if (deleteDbError) {
            result.errors.push(`Database delete error for ${record.id}: ${deleteDbError.message}`);
          } else {
            result.deletedFromDatabase++;
          }
        } catch (recordError) {
          result.errors.push(`Error processing record ${record.id}: ${
            recordError instanceof Error ? recordError.message : 'Unknown error'
          }`);
        }
      }
      
      // Small delay to avoid rate limiting
      if (hasMoreRecords) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Update final result
    result.success = true;
    
  } catch (error) {
    console.error('Error in cleanup process:', error);
    result.success = false;
    result.errors.push(`Global error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Complete timing information
    const endTime = new Date();
    result.endTime = endTime.toISOString();
    result.executionTimeMs = endTime.getTime() - startTime.getTime();
    
    try {
      // Log results to database for auditing
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('maintenance_logs')
          .insert({
            operation: 'media_cleanup',
            result: result.success ? 'success' : 'error',
            details: {
              totalProcessed: result.totalProcessed,
              deletedFromStorage: result.deletedFromStorage,
              deletedFromDatabase: result.deletedFromDatabase,
              errors: result.errors.slice(0, 10), // Limit number of errors in log
              executionTimeMs: result.executionTimeMs
            },
            created_at: new Date().toISOString()
          })
          .select();
      }
    } catch (logError) {
      console.error('Failed to log cleanup results:', logError);
    }
  }

  // Return cleanup results
  return new Response(
    JSON.stringify(result),
    { headers, status: result.success ? 200 : 500 }
  );
});

