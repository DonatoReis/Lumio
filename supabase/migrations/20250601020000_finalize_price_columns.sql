-- 2025-06-01: Finalize price ID columns and drop deprecated column

-- 1. Enforce NOT NULL on the new price columns
ALTER TABLE public.plans
  ALTER COLUMN stripe_monthly_price_id SET NOT NULL,
  ALTER COLUMN stripe_yearly_price_id SET NOT NULL;

-- 2. Drop the old deprecated stripe_price_id column
ALTER TABLE public.plans
  DROP COLUMN stripe_price_id;

