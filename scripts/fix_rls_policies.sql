-- Script de Análise e Correção de Políticas RLS do BizConnect
-- Este script identifica e corrige problemas comuns em políticas RLS,
-- incluindo problemas de recursão infinita e permissões inadequadas.

-- ============================================================
-- PARTE 1: DIAGNÓSTICO DAS POLÍTICAS RLS EXISTENTES
-- ============================================================

-- Ver todas as políticas RLS existentes
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM
    pg_policies
ORDER BY
    schemaname, tablename, policyname;

-- Ver todas as tabelas com RLS habilitado
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM
    pg_tables
WHERE
    schemaname = 'public' AND rowsecurity = true
ORDER BY
    tablename;

-- ============================================================
-- PARTE 2: AUDITORIA E CORREÇÃO DE POLÍTICAS RLS
-- ============================================================

-- CORREÇÃO PARA TABELA CONVERSATIONS
-- 1. Verificar políticas existentes
DO $$
BEGIN
    RAISE NOTICE 'Verificando políticas RLS para tabela conversations...';
    
    -- Verificar se RLS está habilitado
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'conversations' AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS está habilitado para tabela conversations';
    ELSE
        RAISE NOTICE 'RLS NÃO está habilitado para tabela conversations';
        
        -- Habilitar RLS
        ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS foi habilitado para tabela conversations';
    END IF;
    
    -- Verificar política de INSERT
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversations' AND cmd = 'INSERT'
    ) THEN
        RAISE NOTICE 'Política INSERT já existe para tabela conversations';
    ELSE
        RAISE NOTICE 'Nenhuma política INSERT encontrada para tabela conversations';
        
        -- Criar política INSERT
        CREATE POLICY "conversations_insert_policy" ON public.conversations
        FOR INSERT TO authenticated
        WITH CHECK (true);
        
        RAISE NOTICE 'Política INSERT criada para tabela conversations';
    END IF;
    
    -- Verificar política de SELECT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversations' AND cmd = 'SELECT'
    ) THEN
        -- Criar política SELECT
        CREATE POLICY "conversations_select_policy" ON public.conversations
        FOR SELECT TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM conversation_participants
                WHERE conversation_participants.conversation_id = conversations.id 
                AND conversation_participants.user_id = auth.uid()
            )
        );
        
        RAISE NOTICE 'Política SELECT criada para tabela conversations';
    END IF;
    
    -- Verificar política UPDATE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversations' AND cmd = 'UPDATE'
    ) THEN
        -- Criar política UPDATE
        CREATE POLICY "conversations_update_policy" ON public.conversations
        FOR UPDATE TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM conversation_participants
                WHERE conversation_participants.conversation_id = conversations.id 
                AND conversation_participants.user_id = auth.uid()
            )
        );
        
        RAISE NOTICE 'Política UPDATE criada para tabela conversations';
    END IF;
END $$;

-- CORREÇÃO PARA TABELA CONVERSATION_PARTICIPANTS
DO $$
BEGIN
    RAISE NOTICE 'Verificando políticas RLS para tabela conversation_participants...';
    
    -- Verificar se RLS está habilitado
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'conversation_participants' AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS está habilitado para tabela conversation_participants';
    ELSE
        RAISE NOTICE 'RLS NÃO está habilitado para tabela conversation_participants';
        
        -- Habilitar RLS
        ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS foi habilitado para tabela conversation_participants';
    END IF;
    
    -- Verificar política de INSERT
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversation_participants' AND cmd = 'INSERT'
    ) THEN
        RAISE NOTICE 'Política INSERT já existe para tabela conversation_participants';
    ELSE
        RAISE NOTICE 'Nenhuma política INSERT encontrada para tabela conversation_participants';
        
        -- Criar política INSERT permissiva
        CREATE POLICY "conversation_participants_insert_policy" ON public.conversation_participants
        FOR INSERT TO authenticated
        WITH CHECK (true);
        
        RAISE NOTICE 'Política INSERT criada para tabela conversation_participants';
    END IF;
    
    -- Verificar política de SELECT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversation_participants' AND cmd = 'SELECT'
    ) THEN
        -- Criar política SELECT que permite acesso a participantes de conversas que o usuário está
        CREATE POLICY "conversation_participants_select_policy" ON public.conversation_participants
        FOR SELECT TO authenticated
        USING (
            -- O usuário pode ver sua própria participação
            user_id = auth.uid()
            OR
            -- O usuário pode ver participantes de conversas das quais ele participa
            EXISTS (
                SELECT 1 FROM conversation_participants my_participation
                WHERE my_participation.conversation_id = conversation_participants.conversation_id
                AND my_participation.user_id = auth.uid()
            )
        );
        
        RAISE NOTICE 'Política SELECT criada para tabela conversation_participants';
    END IF;
    
    -- Verificar política DELETE (para permitir deixar uma conversa)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'conversation_participants' AND cmd = 'DELETE'
    ) THEN
        -- Criar política DELETE que permite apenas remover a própria participação
        CREATE POLICY "conversation_participants_delete_policy" ON public.conversation_participants
        FOR DELETE TO authenticated
        USING (
            user_id = auth.uid()
        );
        
        RAISE NOTICE 'Política DELETE criada para tabela conversation_participants';
    END IF;
END $$;

-- CORREÇÃO PARA TABELA MEETINGS
DO $$
BEGIN
    RAISE NOTICE 'Verificando políticas RLS para tabela meetings...';
    
    -- Verificar se RLS está habilitado
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'meetings' AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS está habilitado para tabela meetings';
    ELSE
        RAISE NOTICE 'RLS NÃO está habilitado para tabela meetings';
        
        -- Habilitar RLS
        ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS foi habilitado para tabela meetings';
    END IF;
    
    -- Verificar política de SELECT
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'meetings' AND cmd = 'SELECT'
    ) THEN
        -- Dropar a política SELECT existente para recriar uma versão otimizada
        DROP POLICY IF EXISTS "meetings_access_policy" ON public.meetings;
        RAISE NOTICE 'Política SELECT existente removida para tabela meetings';
    END IF;
    
    -- Criar nova política SELECT otimizada
    CREATE POLICY "meetings_select_policy" ON public.meetings
    FOR SELECT TO authenticated
    USING (
        -- O usuário é o criador da reunião
        created_by = auth.uid()
        OR 
        -- O usuário é um participante da reunião
        EXISTS (
            SELECT 1 FROM meeting_participants
            WHERE meeting_participants.meeting_id = meetings.id
            AND meeting_participants.user_id = auth.uid()
        )
        OR
        -- O usuário é membro da equipe associada à reunião
        (
            team_id IS NOT NULL AND
            EXISTS (
                SELECT 1 FROM team_members
                WHERE team_members.team_id = meetings.team_id
                AND team_members.user_id = auth.uid()
            )
        )
    );
    RAISE NOTICE 'Política SELECT otimizada criada para tabela meetings';
    
    -- Verificar política de INSERT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'meetings' AND cmd = 'INSERT'
    ) THEN
        -- Criar política INSERT
        CREATE POLICY "meetings_insert_policy" ON public.meetings
        FOR INSERT TO authenticated
        WITH CHECK (
            -- O usuário só pode criar reuniões associadas a ele mesmo
            created_by = auth.uid()
            OR
            -- Ou associadas a equipes das quais é membro
            (
                team_id IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM team_members
                    WHERE team_members.team_id = meetings.team_id
                    AND team_members.user_id = auth.uid()
                )
            )
        );
        
        RAISE NOTICE 'Política INSERT criada para tabela meetings';
    END IF;
    
    -- Verificar política UPDATE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'meetings' AND cmd = 'UPDATE'
    ) THEN
        -- Criar política UPDATE
        CREATE POLICY "meetings_update_policy" ON public.meetings
        FOR UPDATE TO authenticated
        USING (
            -- Apenas o criador pode atualizar a reunião
            created_by = auth.uid()
            OR
            -- Ou um membro da equipe com a reunião associada
            (
                team_id IS NOT NULL AND
                EXISTS (
                    SELECT 1 FROM team_members
                    WHERE team_members.team_id = meetings.team_id
                    AND team_members.user_id = auth.uid()
                )
            )
        );
        
        RAISE NOTICE 'Política UPDATE criada para tabela meetings';
    END IF;
END $$;

-- ============================================================
-- PARTE 3: TESTES E CONFIRMAÇÃO DE POLÍTICAS
-- ============================================================

-- Listar todas as políticas atualizadas
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM
    pg_policies 
WHERE 
    tablename IN ('conversations', 'conversation_participants', 'meetings')
ORDER BY
    schemaname, tablename, policyname;

-- Exibir resumo das políticas por tabela
SELECT
    tablename,
    STRING_AGG(cmd || ' (' || policyname || ')', ', ') as policies,
    COUNT(*) as policy_count
FROM
    pg_policies
WHERE 
    schemaname = 'public' AND
    tablename IN ('conversations', 'conversation_participants', 'meetings')
GROUP BY
    tablename
ORDER BY
    tablename;

