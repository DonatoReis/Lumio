-- Este é o SQL que deve ser executado no SQL Editor do Supabase:

-- Verifique a política RLS existente para conversations
SELECT * FROM pg_policies WHERE tablename = 'conversations';

-- Adicione uma política de INSERT que permita a usuários autenticados criar novas conversas
CREATE POLICY "allow_insert_conversations_for_auth_users" 
ON "public"."conversations"
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Em alguns casos, você também precisa habilitar RLS na tabela, se não estiver habilitado
ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;

-- Adicione também uma política para as conversation_participants
CREATE POLICY "allow_insert_conversation_participants_for_auth_users" 
ON "public"."conversation_participants"
FOR INSERT 
TO authenticated
WITH CHECK (true);

ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;
