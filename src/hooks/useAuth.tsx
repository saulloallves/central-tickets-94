import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata?: any) => {
    const redirectUrl = `${window.location.origin}/`;
    
    console.log('🚀 Iniciando cadastro para:', email);
    console.log('📦 Metadata recebido:', metadata);
    
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome_completo: metadata?.nome_completo,
          ...metadata
        }
      }
    });

    if (error) {
      console.error('❌ Erro no Auth:', error);
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }

    console.log('✅ Conta criada no Supabase Auth:', authData.user?.id);

    // Se o usuário foi criado, processar dados adicionais
    if (authData.user) {
      try {
        console.log('📨 Chamando edge function para processamento adicional...');
        
        // Usar timeout para evitar travamento
        const processPromise = supabase.functions.invoke('colaborador-signup', {
          body: {
            userId: authData.user.id,
            email,
            ...metadata
          }
        });

        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        );

        const { data: result, error: processError } = await Promise.race([
          processPromise,
          timeoutPromise
        ]) as any;

        if (processError) {
          console.error('⚠️ Erro no processamento adicional:', processError);
          toast({
            title: "Conta criada com sucesso",
            description: "Email enviado! Complete dados adicionais depois.",
            variant: "default"
          });
        } else {
          console.log('✅ Processamento adicional concluído:', result);
          toast({
            title: "Cadastro realizado",
            description: result?.message || "Verifique seu email para confirmar a conta",
            variant: "default"
          });
        }
      } catch (procError) {
        console.error('⚠️ Falha no processamento adicional:', procError);
        toast({
          title: "Conta criada com sucesso",
          description: "Email enviado! Dados adicionais serão processados após confirmação.",
          variant: "default"
        });
      }
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Login realizado",
        description: "Bem-vindo ao sistema!"
      });
    }

    return { error };
  };

  const signOut = async () => {
    try {
      // Executar signOut do Supabase primeiro
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Erro no logout:', error);
      }
      
      // Limpar dados do localStorage
      localStorage.removeItem('last_login_origin');
      localStorage.clear();
      
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado do sistema"
      });
      
    } catch (error) {
      console.error('Erro durante logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      signUp,
      signIn,
      signOut,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};