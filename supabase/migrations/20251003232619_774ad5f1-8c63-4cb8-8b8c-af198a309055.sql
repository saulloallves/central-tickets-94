-- Adicionar política RLS para permitir usuários se auto-adicionarem às equipes durante ativação
CREATE POLICY "Users can add themselves to equipes during activation"
ON equipe_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);