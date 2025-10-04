import { supabase } from "@/integrations/supabase/client";

export const useActivateAccount = () => {
  const checkPreApproved = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .rpc('check_email_pre_approved', { email_check: email });

      if (error) {
        console.error('Erro ao verificar email pré-aprovado:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Erro ao verificar pré-aprovação:', error);
      return false;
    }
  };

  const activateAccount = async (
    email: string,
    password: string,
    equipeId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Login com senha temporária
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password: "first-access-temp-2024"
      });

      if (loginError) {
        console.error('Erro ao fazer login com senha temporária:', loginError);
        return { 
          success: false, 
          error: 'Não foi possível autenticar com a senha temporária.' 
        };
      }

      // 2. Atualizar senha do usuário
      const { error: passwordError } = await supabase.auth.updateUser({
        password: password
      });

      if (passwordError) {
        console.error('Erro ao atualizar senha:', passwordError);
        return { 
          success: false, 
          error: 'Não foi possível atualizar a senha.' 
        };
      }

      // 3. Obter ID do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { 
          success: false, 
          error: 'Usuário não encontrado após autenticação.' 
        };
      }

      // 4. Adicionar à equipe
      const { error: equipeError } = await supabase
        .from('equipe_members')
        .insert({
          equipe_id: equipeId,
          user_id: user.id,
          role: 'member',
          ativo: true
        });

      if (equipeError) {
        console.error('Erro ao adicionar à equipe:', equipeError);
        // Não falhar aqui, pois a conta já foi ativada
      }

      // 5. Atribuir role de colaborador
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'colaborador',
          approved: true
        })
        .select()
        .single();

      if (roleError) {
        console.error('Erro ao atribuir role:', roleError);
        // Não falhar aqui, pois a conta já foi ativada
      }

      // 6. Remover flag de usuário importado
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_imported_user: false })
        .eq('id', user.id);

      if (profileError) {
        console.error('Erro ao atualizar profile:', profileError);
        // Não falhar aqui, pois a conta já foi ativada
      }

      return { success: true };
    } catch (error: any) {
      console.error('Erro ao ativar conta:', error);
      return { 
        success: false, 
        error: error.message || 'Erro inesperado ao ativar conta.' 
      };
    }
  };

  return {
    checkPreApproved,
    activateAccount
  };
};
