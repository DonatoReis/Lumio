-- Migration: Add push subscription support
-- Created: 2025-05-21

-- Table: user_push_subscriptions
CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "push_subscriptions:insert:service_role" ON public.user_push_subscriptions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "push_subscriptions:update:service_role" ON public.user_push_subscriptions
  FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "push_subscriptions:delete:service_role" ON public.user_push_subscriptions
  FOR DELETE USING (auth.role() = 'service_role');
CREATE POLICY "push_subscriptions:select:own" ON public.user_push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

