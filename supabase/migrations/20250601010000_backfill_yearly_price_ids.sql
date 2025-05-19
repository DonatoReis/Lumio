-- 2025-06-01: Backfill annual Stripe price IDs for existing plans

-- 1. Backfill annual price IDs for existing plans
UPDATE public.plans
SET stripe_yearly_price_id = '{{PRO_YEARLY_PRICE_ID}}'
WHERE name = 'Pro';

UPDATE public.plans
SET stripe_yearly_price_id = '{{BUSINESS_YEARLY_PRICE_ID}}'
WHERE name = 'Business';

-- (Optional) If you have an annual price for Enterprise, backfill similarly:
-- UPDATE public.plans
-- SET stripe_yearly_price_id = '{{ENTERPRISE_YEARLY_PRICE_ID}}'
-- WHERE name = 'Enterprise';

