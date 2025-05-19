-- SQL a ser executado no SQL Editor do Supabase

-- Remover política existente (se necessário)
DROP POLICY IF EXISTS "meetings_access_policy" ON "public"."meetings";

-- Criar nova política mais permissiva
CREATE POLICY "meetings_access_policy"
ON "public"."meetings"
USING (
  -- Permitir acesso a reuniões criadas pelo usuário
  (auth.uid() = created_by)
  OR 
  -- Permitir acesso a reuniões onde o usuário é participante
  EXISTS (
    SELECT 1 FROM meeting_participants 
    WHERE meeting_id = meetings.id AND user_id = auth.uid()
  )
  OR
  -- Permitir acesso a reuniões da equipe do usuário
  EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = meetings.team_id AND user_id = auth.uid()
  )
);
