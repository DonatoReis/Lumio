-- Password history table to prevent reuse of passwords
CREATE TABLE IF NOT EXISTS public.password_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON public.password_history(user_id);

-- RLS policies for password_history table
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view password history
CREATE POLICY "Admins can view password history" 
  ON public.password_history FOR SELECT 
  USING (is_admin());

-- Security logs table for auditing security events
CREATE TABLE IF NOT EXISTS public.security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_event ON public.security_logs(event);
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON public.security_logs(timestamp);

-- RLS policies for security_logs table
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view all security logs
CREATE POLICY "Admins can view all security logs" 
  ON public.security_logs FOR SELECT 
  USING (is_admin());

-- Users can view their own security logs
CREATE POLICY "Users can view their own security logs" 
  ON public.security_logs FOR SELECT 
  USING (auth.uid() = user_id);

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user has admin role
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

