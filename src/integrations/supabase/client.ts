// This file contains the Supabase client configuration and helpers
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { debounce } from 'lodash';

// =========== CONFIGURATION ===========
const SUPABASE_URL = "https://cdsiyppfnffuksddfqhd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkc2l5cHBmbmZmdWtzZGRmcWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDU1MDYsImV4cCI6MjA2MjU4MTUwNn0.EidO-C8F1mg7yOVsvtDypJ8HuLCtxke9aUcDGvdtqJM";

// =========== NETWORK OPTIMIZATION SETTINGS ===========

// Request queue and concurrent request management
interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  priority: number;
  retryCount: number;
  addedAt: number;
}

// Global settings for request throttling
const settings = {
  MAX_CONCURRENT_REQUESTS: 6, // Browser typically limits to 6-8 connections per domain
  REQUEST_TIMEOUT_MS: 15000,  // 15 seconds timeout
  MAX_RETRIES: 3,             // Max retry attempts
  BASE_RETRY_DELAY: 1000,     // Start with 1 second delay
  REALTIME_REQUEST_PRIORITY: 10, // Higher priority for realtime connections
  HIGH_PRIORITY: 5,           // Priority for important requests
  NORMAL_PRIORITY: 0,         // Default priority
  LOW_PRIORITY: -5,           // Low priority for background operations
};

// Track active requests and queued requests
let activeRequests = 0;
const requestQueue: QueuedRequest[] = [];

// =========== NETWORK OPTIMIZATION FUNCTIONS ===========

// Handle request completion and process next in queue
const handleRequestComplete = () => {
  activeRequests = Math.max(0, activeRequests - 1);
  setTimeout(processNextQueuedRequest, 50); // Small delay to prevent flooding
};

// Process the next request in the queue
const processNextQueuedRequest = () => {
  if (requestQueue.length === 0 || activeRequests >= settings.MAX_CONCURRENT_REQUESTS) {
    return;
  }

  // Sort the queue by priority and timestamp (FIFO within same priority)
  requestQueue.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return a.addedAt - b.addedAt; // Then FIFO
  });

  // Get the highest priority request
  const nextRequest = requestQueue.shift();
  if (!nextRequest) return;

  activeRequests++;
  console.log(`[Supabase] Processing queued request (${activeRequests}/${settings.MAX_CONCURRENT_REQUESTS} active)`);

  // Execute with timeout
  const timeoutId = setTimeout(() => {
    console.warn('[Supabase] Request timeout - will be retried');
    handleRequestComplete();
    
    // Retry with backoff if not exceeded max retries
    if (nextRequest.retryCount < settings.MAX_RETRIES) {
      const retryDelay = settings.BASE_RETRY_DELAY * Math.pow(2, nextRequest.retryCount);
      nextRequest.retryCount++;
      
      console.info(`[Supabase] Retrying request (attempt ${nextRequest.retryCount}/${settings.MAX_RETRIES}) after ${retryDelay}ms`);
      
      setTimeout(() => {
        requestQueue.push(nextRequest);
        processNextQueuedRequest();
      }, retryDelay);
    } else {
      nextRequest.reject(new Error('Request timeout exceeded maximum retries'));
    }
  }, settings.REQUEST_TIMEOUT_MS);

  // Execute the request
  nextRequest.execute()
    .then(result => {
      clearTimeout(timeoutId);
      nextRequest.resolve(result);
      handleRequestComplete();
    })
    .catch(error => {
      clearTimeout(timeoutId);
      
      // Check if error is network-related and should be retried
      if (
        (error.message && (
          error.message.includes('ERR_INSUFFICIENT_RESOURCES') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError')
        )) && 
        nextRequest.retryCount < settings.MAX_RETRIES
      ) {
        // Retry with exponential backoff
        const retryDelay = settings.BASE_RETRY_DELAY * Math.pow(2, nextRequest.retryCount);
        nextRequest.retryCount++;
        
        console.warn(`[Supabase] Network error - retrying request (attempt ${nextRequest.retryCount}/${settings.MAX_RETRIES}) after ${retryDelay}ms`);
        console.warn(`[Supabase] Error details:`, error);
        
        setTimeout(() => {
          requestQueue.push(nextRequest);
          handleRequestComplete();
        }, retryDelay);
      } else {
        nextRequest.reject(error);
        handleRequestComplete();
      }
    });
};

// Throttle queued requests to avoid overwhelming browser
const throttledRequest = <T>(
  requestFn: () => Promise<T>,
  priority: number = settings.NORMAL_PRIORITY
): Promise<T> => {
  return new Promise((resolve, reject) => {
    // If under the concurrent request limit, execute immediately
    if (activeRequests < settings.MAX_CONCURRENT_REQUESTS && requestQueue.length === 0) {
      activeRequests++;
      
      requestFn()
        .then(result => {
          resolve(result);
          handleRequestComplete();
        })
        .catch(error => {
          // Check if this is a network error that should be retried
          if (
            error.message && (
              error.message.includes('ERR_INSUFFICIENT_RESOURCES') ||
              error.message.includes('Failed to fetch') ||
              error.message.includes('NetworkError')
            )
          ) {
            console.warn(`[Supabase] Network error detected, queueing retry`, error);
            
            // Queue for retry
            requestQueue.push({
              execute: requestFn,
              resolve,
              reject,
              priority,
              retryCount: 1,
              addedAt: Date.now()
            });
            
            handleRequestComplete();
          } else {
            reject(error);
            handleRequestComplete();
          }
        });
    } else {
      // Queue the request
      requestQueue.push({
        execute: requestFn,
        resolve,
        reject,
        priority,
        retryCount: 0,
        addedAt: Date.now()
      });
      
      // Process the queue
      processNextQueuedRequest();
    }
  });
};

// Determine request priority based on URL and request type
const determineRequestPriority = (url: string): number => {
  // Realtime subscriptions get highest priority
  if (url.includes('/realtime')) {
    return settings.REALTIME_REQUEST_PRIORITY;
  }
  
  // Message loading gets high priority
  if (url.includes('messages')) {
    return settings.HIGH_PRIORITY;
  }
  
  // Default priority for everything else
  return settings.NORMAL_PRIORITY;
};

// Enhanced fetch function that limits concurrent connections
// and handles common network errors
const enhancedFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  return throttledRequest(() => {
    const request = fetch(input, {
      ...init,
      // Shorter timeout to avoid browser hanging
      signal: AbortSignal.timeout(settings.REQUEST_TIMEOUT_MS)
    });
    
    return request;
  }, determineRequestPriority(String(input)));
};

// =========== SUPABASE CLIENT CREATION ===========

// Create a single instance of the Supabase client
const createSupabaseClient = () => {
  if (typeof window === 'undefined') {
    console.warn("Supabase client initialized in a non-browser environment.");
    return null;
  }
  
  try {
    return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: localStorage
      },
      global: {
        // Add fetch customization to track and handle network errors better
        fetch: enhancedFetch
      }
    });
  } catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    return null;
  }
};

// Create and export the Supabase client
export const supabase: SupabaseClient<Database> | null = createSupabaseClient();

// =========== HELPER FUNCTIONS ===========

// Add a more robust connection test helper
export const testConnection = async () => {
  if (!supabase) {
    console.error("Supabase client is not initialized");
    return { success: false, error: "Supabase client is not initialized" };
  }
  
  try {
    // Try a simple query to test the connection
    console.log("Testing Supabase connection...");
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    
    // Check if the query executed successfully - even with no data
    if (!error) {
      console.log('Supabase connection test successful');
      return { success: true, error: null };
    } else {
      console.error('Supabase connection test failed:', error);
      return { success: false, error };
    }
  } catch (err) {
    console.error('Supabase connection test failed with exception:', err);
    return { success: false, error: err };
  }
};

// Test storage bucket access
export const testStorageConnection = async () => {
  if (!supabase) {
    console.error("Cannot test storage connection, Supabase client is not initialized");
    return { success: false, error: "Supabase client is not initialized" };
  }
  
  try {
    // Simple call to check if we can connect to storage API
    console.log("Testing Supabase storage connection...");
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

// Debug helper to identify RLS issues
export const debugRLS = async (userId?: string) => {
  if (!supabase) {
    console.error("Cannot debug RLS, Supabase client is not initialized");
    return { error: "Supabase client is not initialized" };
  }
  
  console.log("Debugging RLS policies...");
  
  try {
    // Test user authentication status
    const { data: { user } } = await supabase.auth.getUser();
    console.log("Current authenticated user:", user?.id || "Not authenticated");
    
    if (userId) {
      // Try to access information for a specific user
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (profileError) {
        console.error(`RLS test failed for profiles with user ${userId}:`, profileError);
      } else {
        console.log(`Successfully accessed profile for user ${userId}`);
      }
      
      // Test conversations access
      const { data: convData, error: convError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId);
        
      if (convError) {
        console.error(`RLS test failed for conversations with user ${userId}:`, convError);
      } else {
        console.log(`Successfully tested conversation access for user ${userId}`, 
                    convData?.length > 0 ? `Found ${convData.length} conversations` : "No conversations found");
      }
    }
    
    return {
      authenticated: !!user,
      userId: user?.id || null,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error("RLS debugging exception:", err);
    return { error: err instanceof Error ? err.message : 'Unknown error' };
  }
};

// Improved function to safely execute Supabase queries with better error handling and typing
export const safeQuery = async <T>(
  queryFn: () => any, // Accept any supabase query builder function
  errorContext: string
): Promise<{ data: T | null; error: any }> => {
  try {
    if (!supabase) {
      console.error(`Cannot execute query: ${errorContext} - Supabase client is not initialized`);
      return { data: null, error: new Error("Supabase client is not initialized") };
    }
    
    // Execute the query function
    const result = await queryFn();
    
    if (result.error) {
      console.error(`Error in ${errorContext}:`, result.error);
    }
    
    return result;
  } catch (err) {
    console.error(`Exception in ${errorContext}:`, err);
    return { 
      data: null, 
      error: err instanceof Error ? err : new Error(`Unknown error in ${errorContext}`) 
    };
  }
};

// Helper function to wrap standard Supabase queries
export const wrapQuery = <T>(query: Promise<any>): Promise<{ data: T | null; error: any }> => {
  return query;
};

// Enhanced version of safeQuery that uses throttling
export const throttledSafeQuery = async <T>(
  queryFn: () => any,
  errorContext: string,
  priority: number = settings.NORMAL_PRIORITY
): Promise<{ data: T | null; error: any }> => {
  try {
    if (!supabase) {
      console.error(`Cannot execute query: ${errorContext} - Supabase client is not initialized`);
      return { data: null, error: new Error("Supabase client is not initialized") };
    }
    
    // Execute the query function with throttling
    const result = await throttledRequest(() => queryFn(), priority);
    
    if (result.error) {
      console.error(`Error in ${errorContext}:`, result.error);
    }
    
    return result;
  } catch (err) {
    console.error(`Exception in ${errorContext}:`, err);
    return { 
      data: null, 
      error: err instanceof Error ? err : new Error(`Unknown error in ${errorContext}`) 
    };
  }
};

// Create a debounced version of safeQuery
export const debouncedSafeQuery = <T>(
  queryFn: () => any,
  errorContext: string,
  wait: number = 300,
  priority: number = settings.NORMAL_PRIORITY
) => {
  return debounce(
    () => throttledSafeQuery<T>(queryFn, errorContext, priority),
    wait
  );
};

// Function to optimize realtime subscriptions
export const optimizeRealtimeSubscription = (channel: any) => {
  // Store reference to original subscribe method
  const originalSubscribe = channel.subscribe;
  
  // Override with enhanced version that uses high priority
  channel.subscribe = function(callback: any) {
    return throttledRequest(
      () => originalSubscribe.call(channel, callback),
      settings.REALTIME_REQUEST_PRIORITY
    );
  };
  
  return channel;
};
