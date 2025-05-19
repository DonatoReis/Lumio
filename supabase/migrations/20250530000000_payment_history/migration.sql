-- ============================================================================
-- MIGRATION: PAYMENT HISTORY SYSTEM
-- ============================================================================
-- Este arquivo contém a migração para o sistema de histórico de pagamentos, incluindo:
-- 1. Criação da tabela payment_history
-- 2. Configuração de índices
-- 3. Configuração de RLS (Row Level Security)
-- 4. Funções auxiliares
-- ============================================================================

-- Transação para garantir atomicidade
BEGIN;

-- ============================================================================
-- 1. CRIAÇÃO DA TABELA PAYMENT_HISTORY
-- ============================================================================

-- Tabela de histórico de pagamentos
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    payment_method TEXT NOT NULL,
    description TEXT,
    invoice_url TEXT,
    invoice_pdf_url TEXT,
    reference_period TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para atualizar timestamp automaticamente
CREATE TRIGGER set_timestamp_payment_history
BEFORE UPDATE ON payment_history
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- 2. CRIAÇÃO DE ÍNDICES
-- ============================================================================

-- Índices para payment_history
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_transaction_id ON payment_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON payment_history(created_at);

-- ============================================================================
-- 3. CONFIGURAÇÃO DE RLS (ROW LEVEL SECURITY)
-- ============================================================================

-- Ativar RLS na tabela payment_history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Políticas para tabela payment_history
-- Permitir SELECT apenas para o próprio usuário
CREATE POLICY "Payment history é visível apenas para o próprio usuário" ON payment_history
    FOR SELECT USING (auth.uid() = user_id);

-- Permitir INSERT apenas para o serviço (via service role, não para clientes)
CREATE POLICY "Insert de payment history apenas pelo sistema" ON payment_history
    FOR INSERT WITH CHECK (false);

-- Não permitir UPDATE/DELETE para ninguém via cliente
CREATE POLICY "Payment history não pode ser alterado ou excluído via cliente" ON payment_history
    FOR UPDATE USING (false);

CREATE POLICY "Payment history não pode ser excluído via cliente" ON payment_history
    FOR DELETE USING (false);

-- ============================================================================
-- 4. FUNÇÕES AUXILIARES
-- ============================================================================

-- Função para inserir um novo registro de pagamento
CREATE OR REPLACE FUNCTION add_payment_record(
    p_user_id UUID,
    p_transaction_id TEXT,
    p_amount DECIMAL,
    p_currency TEXT,
    p_status TEXT,
    p_payment_method TEXT,
    p_description TEXT DEFAULT NULL,
    p_invoice_url TEXT DEFAULT NULL,
    p_invoice_pdf_url TEXT DEFAULT NULL,
    p_reference_period TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER -- Executa com privilégios do criador (serviço)
AS $$
DECLARE
    payment_id UUID;
BEGIN
    INSERT INTO payment_history (
        user_id,
        transaction_id,
        amount,
        currency,
        status,
        payment_method,
        description,
        invoice_url,
        invoice_pdf_url,
        reference_period,
        metadata
    ) VALUES (
        p_user_id,
        p_transaction_id,
        p_amount,
        p_currency,
        p_status,
        p_payment_method,
        p_description,
        p_invoice_url,
        p_invoice_pdf_url,
        p_reference_period,
        p_metadata
    )
    RETURNING id INTO payment_id;
    
    RETURN payment_id;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar o status de um pagamento
CREATE OR REPLACE FUNCTION update_payment_status(
    p_transaction_id TEXT,
    p_status TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER -- Executa com privilégios do criador (serviço)
AS $$
BEGIN
    UPDATE payment_history
    SET 
        status = p_status,
        updated_at = now()
    WHERE 
        transaction_id = p_transaction_id;
        
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Finalize a transação
COMMIT;

