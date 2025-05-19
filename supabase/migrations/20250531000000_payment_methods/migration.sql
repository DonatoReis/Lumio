-- ============================================================================
-- MIGRATION: PAYMENT METHODS SYSTEM
-- ============================================================================
-- Este arquivo contém a migração para o sistema de métodos de pagamento, incluindo:
-- 1. Criação do enum payment_type_enum
-- 2. Criação da tabela payment_methods
-- 3. Configuração de índices
-- 4. Configuração de RLS (Row Level Security)
-- 5. Funções auxiliares
-- ============================================================================

-- Transação para garantir atomicidade
BEGIN;

-- ============================================================================
-- 1. CRIAÇÃO DO ENUM PAYMENT_TYPE_ENUM
-- ============================================================================

-- Criar tipo enum para tipos de pagamento
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type_enum') THEN
        CREATE TYPE payment_type_enum AS ENUM (
            'card',           -- Cartão de crédito/débito
            'pix',            -- PIX
            'bank_transfer',  -- Transferência bancária
            'boleto'          -- Boleto bancário
        );
    END IF;
END
$$;

-- ============================================================================
-- 2. CRIAÇÃO DA TABELA PAYMENT_METHODS
-- ============================================================================

-- Tabela de métodos de pagamento
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_method_id TEXT NOT NULL,     -- ID do método de pagamento no Stripe
    payment_type payment_type_enum NOT NULL,
    last_four_digits TEXT,               -- Últimos 4 dígitos (para cartões)
    expiry_date TEXT,                    -- Data de expiração (para cartões)
    brand TEXT,                          -- Bandeira do cartão
    is_default BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB,                      -- Metadados adicionais
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para atualizar timestamp automaticamente
CREATE TRIGGER set_timestamp_payment_methods
BEFORE UPDATE ON payment_methods
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Restrição de unicidade para payment_method_id por usuário
ALTER TABLE payment_methods 
ADD CONSTRAINT unique_payment_method_per_user 
UNIQUE (user_id, payment_method_id);

-- ============================================================================
-- 3. CRIAÇÃO DE ÍNDICES
-- ============================================================================

-- Índices para payment_methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_payment_type ON payment_methods(payment_type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON payment_methods(is_default);

-- ============================================================================
-- 4. CONFIGURAÇÃO DE RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Ativar RLS na tabela payment_methods
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Políticas para tabela payment_methods
-- Permitir SELECT apenas para o próprio usuário
CREATE POLICY "Métodos de pagamento são visíveis apenas para o próprio usuário" ON payment_methods
    FOR SELECT USING (auth.uid() = user_id);

-- Permitir INSERT para o próprio usuário
CREATE POLICY "Usuários podem adicionar seus próprios métodos de pagamento" ON payment_methods
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Permitir UPDATE apenas para o próprio usuário
CREATE POLICY "Usuários podem atualizar seus próprios métodos de pagamento" ON payment_methods
    FOR UPDATE USING (auth.uid() = user_id);

-- Permitir DELETE apenas para o próprio usuário
CREATE POLICY "Usuários podem remover seus próprios métodos de pagamento" ON payment_methods
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 5. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para definir um método de pagamento como padrão, removendo o padrão de outros
CREATE OR REPLACE FUNCTION set_default_payment_method(p_user_id UUID, p_payment_method_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER -- Executa com privilégios do criador (serviço)
AS $$
BEGIN
    -- Remover o status padrão de todos os métodos de pagamento do usuário
    UPDATE payment_methods
    SET is_default = false
    WHERE user_id = p_user_id;
    
    -- Definir o método selecionado como padrão
    UPDATE payment_methods
    SET is_default = true
    WHERE id = p_payment_method_id AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Finalize a transação
COMMIT;

