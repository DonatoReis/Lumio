-- ============================================================================
-- MIGRATION: USER PLANS SYSTEM
-- ============================================================================
-- Este arquivo contém a migração para o sistema de planos de usuários, incluindo:
-- 1. Criação do enum feature_key_enum
-- 2. Função para atualização automática de timestamps
-- 3. Criação das tabelas: plans, features, plan_features, user_plans, user_features
-- 4. Configuração de RLS (Row Level Security)
-- 5. Funções de gerenciamento de features e planos
-- 6. Inserção de dados iniciais (seed)
-- ============================================================================

-- Transação para garantir atomicidade
BEGIN;

-- ============================================================================
-- 1. CRIAÇÃO DO ENUM FEATURE_KEY_ENUM
-- ============================================================================

-- Criar tipo enum para chaves de funcionalidades
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feature_key_enum') THEN
        CREATE TYPE feature_key_enum AS ENUM (
            'prospecting_ai',  -- IA para prospecção
            'bots',            -- Bots automatizados
            'crm_sync',        -- Sincronização com CRM
            'analytics_plus',  -- Análises avançadas
            'priority_support' -- Suporte prioritário
        );
    END IF;
END
$$;

-- ============================================================================
-- 2. FUNÇÃO PARA ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMPS
-- ============================================================================

-- Função para atualizar automaticamente o campo updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. CRIAÇÃO DAS TABELAS
-- ============================================================================

-- Tabela de planos
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    stripe_price_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para atualizar timestamp automaticamente
CREATE TRIGGER set_timestamp_plans
BEFORE UPDATE ON plans
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Tabela de funcionalidades
CREATE TABLE IF NOT EXISTS features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key feature_key_enum NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para atualizar timestamp automaticamente
CREATE TRIGGER set_timestamp_features
BEFORE UPDATE ON features
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Tabela de associação entre planos e funcionalidades
CREATE TABLE IF NOT EXISTS plan_features (
    plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    feature_key feature_key_enum NOT NULL,
    PRIMARY KEY (plan_id, feature_key),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para plan_features
CREATE INDEX IF NOT EXISTS idx_plan_features_plan_id ON plan_features(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_features_feature_key ON plan_features(feature_key);

-- Tabela de planos de usuários
CREATE TABLE IF NOT EXISTS user_plans (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_date TIMESTAMPTZ,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, plan_id)
);

-- Trigger para atualizar timestamp automaticamente
CREATE TRIGGER set_timestamp_user_plans
BEFORE UPDATE ON user_plans
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Índices para user_plans
CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_status ON user_plans(status);

-- Tabela de funcionalidades de usuários
CREATE TABLE IF NOT EXISTS user_features (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_key feature_key_enum NOT NULL,
    source TEXT NOT NULL DEFAULT 'plan', -- 'plan' ou 'custom' (adicionado manualmente)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, feature_key)
);

-- Índices para user_features
CREATE INDEX IF NOT EXISTS idx_user_features_user_id ON user_features(user_id);
CREATE INDEX IF NOT EXISTS idx_user_features_feature_key ON user_features(feature_key);

-- Tabela para armazenar eventos do Stripe processados (idempotência)
CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY, -- event_id do Stripe
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID REFERENCES auth.users(id),
    type TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para atualizar timestamp automaticamente
CREATE TRIGGER set_timestamp_stripe_events
BEFORE UPDATE ON stripe_events
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Índices para stripe_events
CREATE INDEX IF NOT EXISTS idx_stripe_events_user_id ON stripe_events(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(type);

-- ============================================================================
-- 4. CONFIGURAÇÃO DE RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Ativar RLS em todas as tabelas
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- Políticas para tabela plans
-- Permitir SELECT para todos (plans são públicos)
CREATE POLICY "Plans são visíveis para todos" ON plans
    FOR SELECT USING (true);

-- Permitir INSERT/UPDATE/DELETE apenas para admins
CREATE POLICY "Plans só podem ser alterados por admins" ON plans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Políticas para tabela features
-- Permitir SELECT para todos (features são públicas)
CREATE POLICY "Features são visíveis para todos" ON features
    FOR SELECT USING (true);

-- Permitir INSERT/UPDATE/DELETE apenas para admins
CREATE POLICY "Features só podem ser alteradas por admins" ON features
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Políticas para tabela plan_features
-- Permitir SELECT para todos (associações são públicas)
CREATE POLICY "Plan features são visíveis para todos" ON plan_features
    FOR SELECT USING (true);

-- Permitir INSERT/UPDATE/DELETE apenas para admins
CREATE POLICY "Plan features só podem ser alteradas por admins" ON plan_features
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Políticas para tabela user_plans
-- Permitir SELECT apenas para o próprio usuário
CREATE POLICY "User plans só são visíveis para o próprio usuário" ON user_plans
    FOR SELECT USING (auth.uid() = user_id);

-- Permitir UPDATE apenas para o próprio usuário ou admins
CREATE POLICY "User plans podem ser atualizados pelo próprio usuário ou admins" ON user_plans
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Permitir DELETE apenas para o próprio usuário ou admins
CREATE POLICY "User plans podem ser removidos pelo próprio usuário ou admins" ON user_plans
    FOR DELETE USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Permitir INSERT apenas pelo sistema (via service role) ou admins
CREATE POLICY "Insert em user_plans só pelo sistema ou admins" ON user_plans
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Políticas para tabela user_features
-- Permitir SELECT apenas para o próprio usuário
CREATE POLICY "User features só são visíveis para o próprio usuário" ON user_features
    FOR SELECT USING (auth.uid() = user_id);

-- Permitir UPDATE apenas para o próprio usuário (apenas features custom) ou admins
CREATE POLICY "User features podem ser atualizadas pelo próprio usuário (custom) ou admins" ON user_features
    FOR UPDATE USING (
        (auth.uid() = user_id AND source = 'custom') OR 
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Permitir DELETE apenas para o próprio usuário (apenas features custom) ou admins
CREATE POLICY "User features podem ser removidas pelo próprio usuário (custom) ou admins" ON user_features
    FOR DELETE USING (
        (auth.uid() = user_id AND source = 'custom') OR 
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Permitir INSERT apenas para features 'custom' pelo próprio usuário ou admins
CREATE POLICY "Insert de features custom pelo próprio usuário" ON user_features
    FOR INSERT WITH CHECK (
        (source = 'custom' AND auth.uid() = user_id) OR
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Políticas para tabela stripe_events
-- Permitir SELECT apenas para admins
CREATE POLICY "Stripe events só são visíveis para admins" ON stripe_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Permitir INSERT/UPDATE/DELETE apenas para service role (não via cliente)
CREATE POLICY "Stripe events só podem ser alterados pelo sistema" ON stripe_events
    FOR ALL USING (false)
    WITH CHECK (false);

-- ============================================================================
-- 5. FUNÇÕES DE GERENCIAMENTO DE FEATURES E PLANOS
-- ============================================================================

-- Função para adicionar uma feature a todos os usuários de um plano específico
CREATE OR REPLACE FUNCTION add_feature_to_plan(plan_id_param UUID, feature_key_param feature_key_enum)
RETURNS void
SECURITY DEFINER -- Executa com privilégios do criador (serviço)
AS $$
BEGIN
    -- Adicionar feature ao plano
    INSERT INTO plan_features (plan_id, feature_key)
    VALUES (plan_id_param, feature_key_param)
    ON CONFLICT (plan_id, feature_key) DO NOTHING;

    -- Adicionar feature a todos os usuários com este plano
    INSERT INTO user_features (user_id, feature_key, source)
    SELECT up.user_id, feature_key_param, 'plan'
    FROM user_plans up
    WHERE up.plan_id = plan_id_param
    AND up.status = 'active'
    ON CONFLICT (user_id, feature_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Função para sincronizar features de um usuário com base no seu plano ativo
CREATE OR REPLACE FUNCTION sync_user_features(user_id_param UUID)
RETURNS void
SECURITY DEFINER -- Executa com privilégios do criador (serviço)
AS $$
BEGIN
    -- Usar lock para evitar race conditions
    LOCK TABLE user_features IN ROW EXCLUSIVE MODE;
    
    -- Remover features que vieram de planos
    DELETE FROM user_features
    WHERE user_id = user_id_param
    AND source = 'plan';

    -- Adicionar features do plano ativo
    INSERT INTO user_features (user_id, feature_key, source)
    SELECT up.user_id, pf.feature_key, 'plan'
    FROM user_plans up
    JOIN plan_features pf ON up.plan_id = pf.plan_id
    WHERE up.user_id = user_id_param
    AND up.status = 'active'
    ON CONFLICT (user_id, feature_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Função para notificar clientes sobre atualizações de features via websockets
CREATE OR REPLACE FUNCTION notify_feature_update()
RETURNS TRIGGER
SECURITY DEFINER -- Executa com privilégios do criador (serviço)
AS $$
BEGIN
    PERFORM pg_notify(
        'feature_updates',
        json_build_object(
            'user_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
            'feature_key', CASE WHEN TG_OP = 'DELETE' THEN OLD.feature_key ELSE NEW.feature_key END,
            'operation', TG_OP
        )::text
    );
    
    -- No caso de DELETE, retornamos OLD, nos outros casos retornamos NEW
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para notificar mudanças nas features do usuário
CREATE TRIGGER user_features_notify
AFTER INSERT OR UPDATE OR DELETE ON user_features
FOR EACH ROW EXECUTE FUNCTION notify_feature_update();

-- ============================================================================
-- 6. INSERÇÃO DE DADOS INICIAIS (SEED)
-- ============================================================================

-- Inserir planos padrão
DO $$
DECLARE
    basic_id UUID;
    pro_id UUID;
    enterprise_id UUID;
BEGIN
    -- Inserir plano básico e capturar o ID
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Básico', 'price_basic')
    ON CONFLICT (stripe_price_id) DO NOTHING
    RETURNING id INTO basic_id;
    
    -- Se houver conflito e não inserir, buscar o ID existente
    IF basic_id IS NULL THEN
        SELECT id INTO basic_id FROM plans WHERE stripe_price_id = 'price_basic';
    END IF;

    -- Inserir plano Pro e capturar o ID
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Pro', 'price_pro')
    ON CONFLICT (stripe_price_id) DO NOTHING
    RETURNING id INTO pro_id;
    
    -- Se houver conflito e não inserir, buscar o ID existente
    IF pro_id IS NULL THEN
        SELECT id INTO pro_id FROM plans WHERE stripe_price_id = 'price_pro';
    END IF;

    -- Inserir plano Enterprise e capturar o ID
    INSERT INTO plans (name, stripe_price_id) 
    VALUES ('Enterprise', 'price_enterprise')
    ON CONFLICT (stripe_price_id) DO NOTHING
    RETURNING id INTO enterprise_id;
    
    -- Se houver conflito e não inserir, buscar o ID existente
    IF enterprise_id IS NULL THEN
        SELECT id INTO enterprise_id FROM plans WHERE stripe_price_id = 'price_enterprise';
    END IF;

    -- Inserir features
    INSERT INTO features (feature_key, description) VALUES
        ('prospecting_ai', 'Inteligência artificial para prospecção de clientes'),
        ('bots', 'Bots automatizados para interação com clientes'),
        ('crm_sync', 'Sincronização com sistemas de CRM'),
        ('analytics_plus', 'Análises avançadas e métricas de negócio'),
        ('priority_support', 'Suporte prioritário 24/7')
    ON CONFLICT (feature_key) DO NOTHING;

    -- Associar features aos planos
    -- Plano Básico
    INSERT INTO plan_features (plan_id, feature_key) VALUES
        (basic_id, 'prospecting_ai')
    ON CONFLICT (plan_id, feature_key) DO NOTHING;

    -- Plano Pro
    INSERT INTO plan_features (plan_id, feature_key) VALUES
        (pro_id, 'prospecting_ai'),
        (pro_id, 'bots'),
        (pro_id, 'crm_sync')
    ON CONFLICT (plan_id, feature_key) DO NOTHING;

    -- Plano Enterprise
    INSERT INTO plan_features (plan_id, feature_key) VALUES
        (enterprise_id, 'prospecting_ai'),
        (enterprise_id, 'bots'),
        (enterprise_id, 'crm_sync'),
        (enterprise_id, 'analytics_plus'),
        (enterprise_id, 'priority_support')
    ON CONFLICT (plan_id, feature_key) DO NOTHING;
END
$$;

-- Finalize a transação
COMMIT;
