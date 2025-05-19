// Edge Function: uploadMedia.ts
// Handles secure encrypted media uploads to Supabase Storage
// This function runs on Supabase Edge Functions platform

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.4.0';

// Type definitions for request and response
interface UploadRequestPayload {
  // Data can be provided as base64 or as multipart form data
  base64Data?: string;
  fileName: string;
  mimeType: string;
  conversationId: string;
  // Additional metadata
  expiresAt?: string;
  fileSize?: number;
}

interface UploadResponsePayload {
  success: boolean;
  storagePath?: string;
  signedUrl?: string;
  error?: string;
  // Additional metadata
  expiresAt?: string;
  fileSize?: number;
}

// Constants
const BUCKET_NAME = 'encrypted_media';
const DEFAULT_EXPIRY_DAYS = 30;

// Serve HTTP requests
serve(async (req: Request) => {
  // CORS headers
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  });

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers, status: 405 }
    );
  }

  try {
    // Get request parameters
    let payload: UploadRequestPayload;
    let fileData: Uint8Array | null = null;
    const contentType = req.headers.get('content-type') || '';

    // Handle different content types
    if (contentType.includes('application/json')) {
      // Parse JSON payload
      payload = await req.json();
      
      // Validate base64 data is provided
      if (!payload.base64Data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing base64Data parameter' }),
          { headers, status: 400 }
        );
      }
      
      // Decode base64 to binary
      try {
        fileData = Uint8Array.from(atob(payload.base64Data), c => c.charCodeAt(0));
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid base64 data' }),
          { headers, status: 400 }
        );
      }
    } else if (contentType.includes('multipart/form-data')) {
      // Parse form data
      const formData = await req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return new Response(
          JSON.stringify({ success: false, error: 'No file provided in form data' }),
          { headers, status: 400 }
        );
      }
      
      // Get file as array buffer and convert to Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      fileData = new Uint8Array(arrayBuffer);
      
      // Get other form fields
      payload = {
        fileName: formData.get('fileName')?.toString() || file.name,
        mimeType: formData.get('mimeType')?.toString() || file.type,
        conversationId: formData.get('conversationId')?.toString() || '',
        expiresAt: formData.get('expiresAt')?.toString(),
        fileSize: file.size
      };
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported content type' }),
        { headers, status: 415 }
      );
    }

    // Validate required fields
    if (!payload.fileName || !payload.mimeType || !payload.conversationId || !fileData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { headers, status: 400 }
      );
    }

    // Create Supabase client with service role key (from environment)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { headers, status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the user from the request
    const authHeader = req.headers.get('Authorization') || '';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { headers, status: 401 }
      );
    }
    
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { headers, status: 401 }
      );
    }

    // Ensure the encrypted_media bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      return new Response(
        JSON.stringify({ success: false, error: `Storage error: ${bucketsError.message}` }),
        { headers, status: 500 }
      );
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      // Create the bucket if it doesn't exist
      const { error: createBucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,  // Private bucket, only accessible via signed URLs
        fileSizeLimit: 104857600  // 100MB limit
      });
      
      if (createBucketError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to create storage bucket: ${createBucketError.message}` }),
          { headers, status: 500 }
        );
      }
    }

    // Generate unique storage path
    const timestamp = new Date().getTime();
    const safeFileName = payload.fileName
      .replace(/[^a-zA-Z0-9-_.]/g, '_')  // Replace special chars with underscore
      .substring(0, 100);  // Limit length
    
    const storagePath = `${payload.conversationId}/${user.id}_${timestamp}_${safeFileName}`;

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileData, {
        contentType: 'application/octet-stream',  // Always use this for encrypted data
        cacheControl: '3600'  // 1 hour cache
      });
    
    if (uploadError) {
      return new Response(
        JSON.stringify({ success: false, error: `Upload failed: ${uploadError.message}` }),
        { headers, status: 500 }
      );
    }

    // Generate signed URL for later access
    const { data: { signedUrl }, error: signedUrlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600);  // 1 hour expiry for the URL
    
    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      // Continue even if signed URL creation fails
    }

    // Calculate expiry date if not provided
    const expiresAt = payload.expiresAt || calculateExpiryDate(DEFAULT_EXPIRY_DAYS);

    // Return success response with path and metadata
    const response: UploadResponsePayload = {
      success: true,
      storagePath,
      signedUrl,
      expiresAt,
      fileSize: payload.fileSize || fileData.byteLength
    };
    
    return new Response(JSON.stringify(response), { headers, status: 200 });
    
  } catch (error) {
    console.error('Error processing upload:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { headers, status: 500 }
    );
  }
});

/**
 * Calculate expiry date
 * @param days Number of days until expiry
 * @returns ISO date string
 */
function calculateExpiryDate(days: number = DEFAULT_EXPIRY_DAYS): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

