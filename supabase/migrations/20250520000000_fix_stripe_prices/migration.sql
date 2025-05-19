-- ============================================================================
-- MIGRATION: FIX STRIPE PRICE IDS
-- ============================================================================
-- Este arquivo contém a migração para corrigir os IDs de preço do Stripe nos planos
-- ============================================================================

-- Transação para garantir atomicidade
BEGIN;

-- ============================================================================
-- 1. VERIFICAR BILLING INTERVALS
-- ============================================================================

-- Primeiro, vamos verificar se já temos planos separados para mensal e anual
-- Se não tivermos, precisamos criar planos adicionais

DO $$
DECLARE
    monthly_plans_count INTEGER;
    yearly_plans_count INTEGER;
    need_separate_plans BOOLEAN;
BEGIN
    -- Contar planos que já têm "Monthly" ou "Yearly" no nome
    SELECT COUNT(*) INTO monthly_plans_count FROM plans WHERE name LIKE '%Monthly%';
    SELECT COUNT(*) INTO yearly_plans_count FROM plans WHERE name LIKE '%Yearly%' OR name LIKE '%Annual%';
    
    need_separate_plans := (monthly_plans_count = 0 AND yearly_plans_count = 0);
    
    IF need_separate_plans THEN
        RAISE NOTICE 'Precisamos criar planos separados para cobrança mensal e anual';
    ELSE
        RAISE NOTICE 'Planos separados para cobrança mensal e anual já existem';
    END IF;
END;
$$;

-- ============================================================================
-- 2. ATUALIZAR OS PRICE IDS DOS PLANOS EXISTENTES
-- ============================================================================

-- Se mantiver apenas um plano por tipo com todas as opções de billing:
-- Note que isso só funcionará se seu frontend lidar com a seleção do intervalo de cobrança corretamente

-- Atualizar o plano Pro - SUBSTITUA OS IDS PELOS CORRETOS DO SEU DASHBOARD STRIPE
UPDATE plans 
SET stripe_price_id = 'price_1PUAONAZd9kbeqgP6wk9QZvj' -- ID real do preço mensal Pro no Stripe
WHERE name = 'Pro';

-- Atualizar o plano Business - SUBSTITUA OS IDS PELOS CORRETOS DO SEU DASHBOARD STRIPE
UPDATE plans 
SET stripe_price_id = 'price_1PUAOYBZd9kbeqgPwLK7XJXW' -- ID real do preço mensal Business no Stripe
WHERE name = 'Business';

-- ============================================================================
-- 3. ALTERNATIVAMENTE: CRIAR PLANOS SEPARADOS PARA MENSAL E ANUAL
-- ============================================================================

-- Esta é uma alternativa mais robusta se quiser separar completamente os planos mensal e anual
-- Descomente e ajuste conforme necessário

/*
-- Primeiro, renomeie os planos existentes para indicar que são mensais
UPDATE plans SET name = 'Pro Monthly' WHERE name = 'Pro';
UPDATE plans SET name = 'Business Monthly' WHERE name = 'Business';

-- Agora, crie novos planos para a cobrança anual
DO $$
DECLARE
    pro_id UUID;
    business_id UUID;
    
    -- Features do plano Pro
    pro_features RECORD;
    
    -- Features do plano Business
    business_features RECORD;
BEGIN
    -- Buscar os IDs dos planos existentes
    SELECT id INTO pro_id FROM plans WHERE name = 'Pro Monthly';
    SELECT id INTO business_id FROM plans WHERE name = 'Business Monthly';
    
    -- Criar os planos anuais
    INSERT INTO plans (name, stripe_price_id)
    VALUES 
        ('Pro Annual', 'price_1PUAOtAsHdRBeqtP6wktQGxj'), -- SUBSTITUA PELO ID REAL DO PREÇO ANUAL PRO NO STRIPE
        ('Business Annual', 'price_1PUAPwCZd9kbeQBHlK7XHWX'); -- SUBSTITUA PELO ID REAL DO PREÇO ANUAL BUSINESS NO STRIPE
    
    -- Copiar as features do plano Pro mensal para o anual
    FOR pro_features IN 
        SELECT feature_key FROM plan_features WHERE plan_id = pro_id
    LOOP
        INSERT INTO plan_features (plan_id, feature_key)
        VALUES ((SELECT id FROM plans WHERE name = 'Pro Annual'), pro_features.feature_key);
    END LOOP;
    
    -- Copiar as features do plano Business mensal para o anual
    FOR business_features IN 
        SELECT feature_key FROM plan_features WHERE plan_id = business_id
    LOOP
        INSERT INTO plan_features (plan_id, feature_key)
        VALUES ((SELECT id FROM plans WHERE name = 'Business Annual'), business_features.feature_key);
    END LOOP;
END;
$$;
*/

-- ============================================================================
-- 4. REGISTRAR LOG DA ALTERAÇÃO
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Stripe price IDs atualizados com sucesso! Verifique se os IDs correspondem aos preços corretos no Stripe.';
END
$$;

-- Finalize a transação
COMMIT;
