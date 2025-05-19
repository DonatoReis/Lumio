-- Migration file: 20250516000000_connected_devices.sql
-- Description: Creates a table to track user's connected devices with security policies

-- =============================================
-- Table Definition: connected_devices
-- =============================================
-- This table stores information about devices that have accessed user accounts
-- including device details, location, and access timestamps
CREATE TABLE IF NOT EXISTS connected_devices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  os text,
  browser text,
  location text,
  ip_address text,
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- Ensure each device is unique per user
  unique (user_id, device_id)
);

-- =============================================
-- Indexes for Performance Optimization
-- =============================================
-- Index on user_id for faster queries when fetching a user's devices
CREATE INDEX IF NOT EXISTS idx_connected_devices_user_id ON connected_devices (user_id);

-- Index on device_id for faster lookups when updating a specific device
CREATE INDEX IF NOT EXISTS idx_connected_devices_device_id ON connected_devices (device_id);

-- =============================================
-- Row Level Security Policies
-- =============================================
-- Enable row level security to restrict access to rows
alter table connected_devices enable row level security;

-- Policy: Users can only see and manage their own devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'connected_devices'
      AND policyname = 'Devices are self-owned'
  ) THEN
    CREATE POLICY "Devices are self-owned"
      ON connected_devices
      FOR ALL  -- This policy applies to all operations (SELECT, INSERT, UPDATE, DELETE)
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Add a comment to the table for documentation
comment on table connected_devices is 'Stores information about devices that have accessed user accounts, including device details and access timestamps';

