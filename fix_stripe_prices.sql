-- Script to fix Stripe price IDs in the plans table
-- Run this in your Supabase SQL Editor

-- Start a transaction
BEGIN;

-- Update the Pro plan with the correct Stripe price ID
UPDATE plans 
SET stripe_price_id = 'price_pro_correct_id' -- REPLACE with actual Stripe price ID for Pro plan
WHERE name = 'Pro';

-- Update the Business plan with the correct Stripe price ID
UPDATE plans 
SET stripe_price_id = 'price_business_correct_id' -- REPLACE with actual Stripe price ID for Business plan
WHERE name = 'Business';

-- Verify the changes
SELECT id, name, stripe_price_id FROM plans WHERE name IN ('Pro', 'Business');

-- Commit the transaction
COMMIT;
