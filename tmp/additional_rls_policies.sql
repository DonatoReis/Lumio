-- Script SQL para criar políticas RLS que permitam a inserção em conversations e conversation_participants

-- Adicione políticas específicas para a tabela conversation_participants
CREATE POLICY "allow_any_insert_conversation_participants" 
ON "public"."conversation_participants"
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Garanta que RLS está habilitado para a tabela
ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;

-- Verifique se há políticas SELECT e UPDATE para conversation_participants
SELECT * FROM pg_policies WHERE tablename = 'conversation_participants';

-- Crie políticas SELECT e UPDATE se não existirem
CREATE POLICY "allow_select_own_conversation_participants" 
ON "public"."conversation_participants"
FOR SELECT 
TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM conversation_participants cp 
  WHERE cp.conversation_id = conversation_participants.conversation_id 
  AND cp.user_id = auth.uid()
));

-- Uma política mais permissiva para INSERT em conversations
CREATE POLICY "allow_any_insert_conversations" 
ON "public"."conversations"
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Se já existir uma política com mesmo nome, use DROP e recrie
-- DROP POLICY IF EXISTS "allow_any_insert_conversations" ON "public"."conversations";
-- DROP POLICY IF EXISTS "allow_any_insert_conversation_participants" ON "public"."conversation_participants";
