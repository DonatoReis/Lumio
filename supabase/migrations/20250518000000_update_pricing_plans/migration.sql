-- ============================================================================
-- MIGRATION: UPDATE PRICING PLANS
-- ============================================================================
-- Este arquivo contém a migração para atualizar os planos de usuários, incluindo:
-- 1. Atualização do enum feature_key_enum
-- 2. Atualização dos planos disponíveis
-- 3. Atualização das features associadas a cada plano
-- ============================================================================

-- Transação para garantir atomicidade
BEGIN;

-- ============================================================================
-- 1. ATUALIZAÇÃO DO ENUM FEATURE_KEY_ENUM
-- ============================================================================

-- Adicionar novos valores ao enum feature_key_enum se não existirem
DO $$
BEGIN
    -- Verificar se os valores já existem no enum antes de adicionar
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'mensagens_ilimitadas' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'mensagens_ilimitadas';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'chamadas_audio_video' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'chamadas_audio_video';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'grupos' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'grupos';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'marketplace' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'marketplace';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ia_prospeccao_avancada' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'ia_prospeccao_avancada';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'estatisticas_uso' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'estatisticas_uso';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'automacao_marketing' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'automacao_marketing';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'bots_personalizados' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'bots_personalizados';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'integracao_crm' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'integracao_crm';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'apis_exclusivas' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'apis_exclusivas';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sla_dedicado' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'sla_dedicado';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'suporte_24_7' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'suporte_24_7';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'onboarding_personalizado' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'onboarding_personalizado';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'gerente_conta_dedicado' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'feature_key_enum')) THEN
        ALTER TYPE feature_key_enum ADD VALUE 'gerente_conta_dedicado';
    END IF;
END
$$;

-- ============================================================================
-- 2. ATUALIZAÇÃO DOS FEATURES
-- ============================================================================

-- Inserir ou atualizar features
INSERT INTO features (feature_key, description)
VALUES
    ('mensagens_ilimitadas', 'Mensagens ilimitadas'),
    ('chamadas_audio_video', 'Chamadas de áudio/vídeo'),
    ('grupos', 'Grupos'),
    ('marketplace', 'Marketplace'),
    ('ia_prospeccao_avancada', 'IA de prospecção avançada'),
    ('estatisticas_uso', 'Estatísticas de uso'),
    ('automacao_marketing', 'Automação de marketing'),
    ('bots_personalizados', 'Bots personalizados'),
    ('integracao_crm', 'Integração com CRM'),
    ('priority_support', 'Suporte prioritário'),
    ('apis_exclusivas', 'APIs exclusivas'),
    ('sla_dedicado', 'SLA dedicado'),
    ('suporte_24_7', 'Suporte 24/7'),
    ('onboarding_personalizado', 'Onboarding personalizado'),
    ('gerente_conta_dedicado', 'Gerente de conta dedicado')
ON CONFLICT (feature_key) DO UPDATE
SET description = EXCLUDED.description;

-- ============================================================================
-- 3. ATUALIZAÇÃO DOS PLANOS
-- ============================================================================

-- Remover todas as associações de planos/features existentes
DELETE FROM plan_features;

-- Remover planos existentes
DELETE FROM plans;

-- Inserir novos planos
DO $$
DECLARE
    free_id UUID;
    pro_id UUID;
    business_id UUID;
    enterprise_id UUID;
BEGIN
    -- Inserir plano Free e capturar o ID
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Free', 'price_free')
    RETURNING id INTO free_id;
    
    -- Inserir plano Pro e capturar o ID
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Pro', 'price_pro')
    RETURNING id INTO pro_id;
    
    -- Inserir plano Business e capturar o ID
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Business', 'price_business')
    RETURNING id INTO business_id;
    
    -- Inserir plano Enterprise e capturar o ID
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Enterprise', 'price_enterprise')
    RETURNING id INTO enterprise_id;
    
    -- Associar features aos planos
    -- Plano Free
    INSERT INTO plan_features (plan_id, feature_key) VALUES
        (free_id, 'mensagens_ilimitadas'),
        (free_id, 'chamadas_audio_video'),
        (free_id, 'grupos'),
        (free_id, 'marketplace');
    
    -- Plano Pro
    INSERT INTO plan_features (plan_id, feature_key) VALUES
        (pro_id, 'mensagens_ilimitadas'),
        (pro_id, 'chamadas_audio_video'),
        (pro_id, 'grupos'),
        (pro_id, 'marketplace'),
        (pro_id, 'ia_prospeccao_avancada'),
        (pro_id, 'estatisticas_uso'),
        (pro_id, 'automacao_marketing');
    
    -- Plano Business
    INSERT INTO plan_features (plan_id, feature_key) VALUES
        (business_id, 'mensagens_ilimitadas'),
        (business_id, 'chamadas_audio_video'),
        (business_id, 'grupos'),
        (business_id, 'marketplace'),
        (business_id, 'ia_prospeccao_avancada'),
        (business_id, 'estatisticas_uso'),
        (business_id, 'automacao_marketing'),
        (business_id, 'bots_personalizados'),
        (business_id, 'integracao_crm'),
        (business_id, 'priority_support'),
        (business_id, 'apis_exclusivas');
    
    -- Plano Enterprise
    INSERT INTO plan_features (plan_id, feature_key) VALUES
        (enterprise_id, 'mensagens_ilimitadas'),
        (enterprise_id, 'chamadas_audio_video'),
        (enterprise_id, 'grupos'),
        (enterprise_id, 'marketplace'),
        (enterprise_id, 'ia_prospeccao_avancada'),
        (enterprise_id, 'estatisticas_uso'),
        (enterprise_id, 'automacao_marketing'),
        (enterprise_id, 'bots_personalizados'),
        (enterprise_id, 'integracao_crm'),
        (enterprise_id, 'priority_support'),
        (enterprise_id, 'apis_exclusivas'),
        (enterprise_id, 'sla_dedicado'),
        (enterprise_id, 'suporte_24_7'),
        (enterprise_id, 'onboarding_personalizado'),
        (enterprise_id, 'gerente_conta_dedicado');
END
$$;

-- Finalize a transação
COMMIT;

