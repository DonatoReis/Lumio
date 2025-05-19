-- ============================================================================
-- MIGRATION: UPDATE PRICING PLANS
-- ============================================================================
-- Este arquivo contém a migração para atualizar os planos de preços, incluindo:
-- 1. Atualização dos planos existentes
-- 2. Adição de novos planos
-- 3. Atualização das features associadas aos planos
-- ============================================================================

-- Transação para garantir atomicidade
BEGIN;

-- ============================================================================
-- 1. ATUALIZAÇÃO DOS PLANOS EXISTENTES
-- ============================================================================

-- Limpar planos antigos e suas associações para reinserir
DELETE FROM plan_features;
DELETE FROM plans;

-- ============================================================================
-- 2. INSERÇÃO DOS NOVOS PLANOS
-- ============================================================================

-- Inserir planos com IDs determinísticos para facilitar referência
DO $$
DECLARE
    free_id UUID;
    pro_id UUID;
    business_id UUID;
    enterprise_id UUID;
BEGIN
    -- Inserir plano gratuito
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Free', 'price_free')
    RETURNING id INTO free_id;
    
    -- Inserir plano Pro
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Pro', 'price_pro')
    RETURNING id INTO pro_id;
    
    -- Inserir plano Business
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Business', 'price_business')
    RETURNING id INTO business_id;
    
    -- Inserir plano Enterprise
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Enterprise', 'price_enterprise')
    RETURNING id INTO enterprise_id;

    -- ============================================================================
    -- 3. ATUALIZAÇÃO DAS FEATURES E ASSOCIAÇÕES
    -- ============================================================================

    -- Garante que todas as features necessárias existem
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

    -- Associar features ao plano Free
    INSERT INTO plan_features (plan_id, feature_key)
    VALUES
        (free_id, 'mensagens_ilimitadas'),
        (free_id, 'chamadas_audio_video'),
        (free_id, 'grupos'),
        (free_id, 'marketplace');

    -- Associar features ao plano Pro
    INSERT INTO plan_features (plan_id, feature_key)
    VALUES
        (pro_id, 'mensagens_ilimitadas'),
        (pro_id, 'chamadas_audio_video'),
        (pro_id, 'grupos'),
        (pro_id, 'marketplace'),
        (pro_id, 'ia_prospeccao_avancada'),
        (pro_id, 'estatisticas_uso'),
        (pro_id, 'automacao_marketing');

    -- Associar features ao plano Business
    INSERT INTO plan_features (plan_id, feature_key)
    VALUES
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

    -- Associar features ao plano Enterprise
    INSERT INTO plan_features (plan_id, feature_key)
    VALUES
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
