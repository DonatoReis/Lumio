-- 2025-06-01: Add monthly and yearly Stripe price ID columns to plans

-- 1. Add monthly and yearly Stripe price ID columns
ALTER TABLE public.plans
  ADD COLUMN stripe_monthly_price_id TEXT,
  ADD COLUMN stripe_yearly_price_id TEXT;

-- 2. Backfill existing monthly price IDs
UPDATE public.plans
SET stripe_monthly_price_id = stripe_price_id;

-- 3. (Optional in future) Add unique constraints or NOT NULL as needed.

