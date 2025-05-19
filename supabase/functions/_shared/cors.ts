
export const corsHeaders = {
  "Access-Control-Allow-Origin": "http://192.168.0.88:8080",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-csrf-token",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400" // 24 hours caching for preflight
};
