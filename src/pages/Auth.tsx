import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Sparkles, Shield, Zap, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { translateAuthError } from '@/lib/auth-error-messages';

const Auth = () => {
  const { user, signIn, signUp, resetPassword, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPendingApproval, setShowPendingApproval] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Form states
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nomeCompleto: '',
    role: '',
    equipeId: ''
  });

  // Buscar equipes disponíveis 
  const { data: equipes, isLoading: equipesLoading, error: equipesError } = useQuery({
    queryKey: ['equipes-for-signup'],
    queryFn: async () => {
      console.log('Buscando equipes para signup...');
      const { data, error } = await supabase
        .from('equipes')
        .select('id, nome, descricao')
        .eq('ativo', true)
        .order('nome');
      
      if (error) {
        console.error('Erro ao buscar equipes:', error);
        throw error;
      }
      console.log('Equipes encontradas:', data);
      return data || [];
    }
  });
  const [franqueadoData, setFranqueadoData] = useState({ phone: '', password: '' });

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading) {
      console.log('🔐 Auth page: User is authenticated, checking redirect...');
      
      // Add a small delay to allow role fetching to complete
      const checkUserRole = async () => {
        try {
          // Wait a bit for roles to load
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const { data: roles, error } = await supabase
            .from('user_roles')
            .select('role, approved')
            .eq('user_id', user.id);
          
          if (error) throw error;
          
          const userRoles = roles?.filter(r => r.approved).map(r => r.role) || [];
          console.log('🔐 Auth page: User roles found:', userRoles);
          
          // Check if user has any active roles
          if (userRoles.length === 0) {
            // Check if it's a franqueado by email
            if (user.email) {
              const { data: franqueadoData } = await supabase
                .from('franqueados')
                .select('id')
                .eq('email', user.email)
                .maybeSingle();
              
              if (franqueadoData) {
                console.log('🔐 Auth page: Redirecting franqueado to dashboard');
                navigate('/franqueado/dashboard');
                return;
              }
            }
            
            // Fallback to localStorage if no roles found
            const lastLoginOrigin = localStorage.getItem('last_login_origin');
            console.log('🔐 Auth page: No roles, using fallback:', lastLoginOrigin);
            
            if (lastLoginOrigin === 'franqueado') {
              navigate('/franqueado/dashboard');
            } else {
              // Check for pending access before redirecting to admin
              const { data: pendingRequest } = await supabase
                .from('internal_access_requests')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'pending')
                .maybeSingle();
              
              if (pendingRequest) {
                console.log('🔐 Auth page: User has pending access, showing pending approval');
                setShowPendingApproval(true);
                return;
              }
              
              navigate('/admin');
            }
            return;
          }
          
          // Redirect based on roles
          if (userRoles.includes('franqueado' as any)) {
            console.log('🔐 Auth page: Redirecting franqueado to dashboard');
            navigate('/franqueado/dashboard');
          } else {
            console.log('🔐 Auth page: Redirecting admin/collaborator to dashboard');
            navigate('/admin');
          }
        } catch (error) {
          console.error('🔐 Auth page: Error checking roles:', error);
          // Fallback usando localStorage
          const lastLoginOrigin = localStorage.getItem('last_login_origin');
          console.log('🔐 Auth page: Error fallback to:', lastLoginOrigin);
          
          if (lastLoginOrigin === 'franqueado') {
            navigate('/franqueado/dashboard');
          } else {
            navigate('/admin');
          }
        }
      };
      
      checkUserRole();
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Marcar como login interno
    localStorage.setItem('last_login_origin', 'interno');

    const { error } = await signIn(loginData.email, loginData.password);
    if (!error) {
      navigate('/admin');
    }

    setIsSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupData.password !== signupData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive"
      });
      return;
    }

    if (!signupData.role) {
      toast({
        title: "Erro",
        description: "Selecione um tipo de usuário",
        variant: "destructive"
      });
      return;
    }

    if (!signupData.equipeId) {
      toast({
        title: "Erro", 
        description: "Selecione uma equipe",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signUp(signupData.email, signupData.password, {
        nome_completo: signupData.nomeCompleto,
        role: signupData.role,
        equipe_id: signupData.equipeId
      });

      if (!error) {
        // Sempre mostrar tela de confirmação se não houve erro
        setShowEmailConfirmation(true);
        
        // Reset form
        setSignupData({
          email: '',
          password: '',
          confirmPassword: '',
          nomeCompleto: '',
          role: '',
          equipeId: ''
        });
      }
    } catch (catchError) {
      console.error('Erro inesperado no cadastro:', catchError);
      toast({
        title: "Erro inesperado",
        description: "Tente novamente em alguns momentos",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFranqueadoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Chamar a Edge Function para validar franqueado
      const { data, error } = await supabase.functions.invoke('franqueado-login', {
        body: {
          phone: franqueadoData.phone,
          password: franqueadoData.password
        }
      });

      if (error) {
        throw error;
      }

      if (data?.email) {
        // Marcar como login de franqueado
        localStorage.setItem('last_login_origin', 'franqueado');
        
        // Fazer login normal com o email retornado
        const { error: loginError } = await signIn(data.email, franqueadoData.password);
        if (!loginError) {
          toast({
            title: "Login realizado",
            description: "Bem-vindo ao sistema de franqueados!"
          });
          navigate('/franqueado/dashboard');
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: translateAuthError(error),
        variant: "destructive"
      });
    }

    setIsSubmitting(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast({
        title: "Erro",
        description: "Digite seu email para redefinir a senha",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    const { error } = await resetPassword(resetEmail);
    
    if (!error) {
      setShowForgotPassword(false);
      setResetEmail('');
    }
    
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent mx-auto"></div>
          <p className="mt-4 text-white/80 font-medium">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  // Tela de confirmação de email
  if (showEmailConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Card className="w-full max-w-md shadow-lg border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold">Central de Tickets</span>
            </div>
            <CardTitle className="text-2xl font-bold text-primary">Confirme seu Email</CardTitle>
            <CardDescription>Enviamos um link de confirmação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-primary/10 flex items-center justify-center">
                <ClipboardList className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Verifique seu Email</h3>
                <p className="text-muted-foreground">
                  Enviamos um link de confirmação para seu email. 
                  Clique no link para confirmar sua conta e prosseguir.
                </p>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Importante:</strong> 
                  <br />• Verifique sua caixa de entrada (e spam)
                  <br />• Clique no link de confirmação recebido
                  <br />• Após confirmar, sua solicitação será analisada
                </p>
              </div>
            </div>
            <Button 
              variant="outline"
              onClick={() => setShowEmailConfirmation(false)} 
              className="w-full h-11"
            >
              Voltar ao Cadastro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de solicitação em análise
  if (showPendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Card className="w-full max-w-md shadow-lg border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold">Central de Tickets</span>
            </div>
            <CardTitle className="text-2xl font-bold text-primary">Solicitação em Análise!</CardTitle>
            <CardDescription>Sua solicitação está sendo avaliada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-primary/10 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Aguardando Aprovação</h3>
                <p className="text-muted-foreground">
                  Email confirmado com sucesso! Sua solicitação foi enviada para o supervisor da equipe selecionada. 
                  Em breve você receberá uma confirmação sobre o acesso ao sistema.
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-300">
                  <strong>Status da Solicitação:</strong> 
                  <br />✓ Email confirmado
                  <br />⏳ Aguardando aprovação do supervisor
                  <br />📧 Você receberá notificação da decisão
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setShowPendingApproval(false)} 
              className="w-full h-11 bg-gradient-primary hover:opacity-90"
            >
              Voltar ao Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de esqueceu a senha
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <Card className="w-full max-w-md shadow-lg border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold">Central de Tickets</span>
            </div>
            <CardTitle className="text-2xl font-bold text-primary">Redefinir Senha</CardTitle>
            <CardDescription>Digite seu email para receber o link de redefinição</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full h-11 bg-gradient-primary hover:opacity-90"
              >
                {isSubmitting ? "Enviando..." : "Enviar Link de Redefinição"}
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Voltar ao login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-hero">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Central de Tickets</h1>
              <p className="text-white/60 text-sm">Gestão Inteligente de Tickets</p>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold text-white mb-6 leading-tight">
            Transforme seu<br />
            suporte com IA
          </h2>
          
          <p className="text-xl text-white/80 mb-8 leading-relaxed">
            Sistema completo de gestão de tickets com inteligência artificial,
            integração WhatsApp e análise avançada de dados.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-white/90">
              <Sparkles className="h-5 w-5 text-primary-glow" />
              <span>Respostas automáticas com IA</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <Shield className="h-5 w-5 text-primary-glow" />
              <span>Controle avançado de permissões</span>
            </div>
            <div className="flex items-center gap-3 text-white/90">
              <Zap className="h-5 w-5 text-primary-glow" />
              <span>Integração WhatsApp Z-API</span>
            </div>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-white animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-24 h-24 rounded-full bg-white animate-pulse animation-delay-1000"></div>
          <div className="absolute top-1/2 right-20 w-16 h-16 rounded-full bg-white animate-pulse animation-delay-2000"></div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md shadow-lg border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-6">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold">Central de Tickets</span>
            </div>
            <CardTitle className="text-2xl font-bold">Bem-vindo</CardTitle>
            <CardDescription>Acesse sua conta ou crie uma nova</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="login" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white">
                  Cadastrar
                </TabsTrigger>
                <TabsTrigger value="franqueado" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white">
                  Franqueado
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 shadow-glow" disabled={isSubmitting}>
                    {isSubmitting ? 'Entrando...' : 'Entrar no Sistema'}
                  </Button>
                </form>
                
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Sistema de Aprovação:</strong> {signupData.role === 'colaborador' ? 'Após escolher sua equipe, um supervisor aprovará seu acesso.' : 'Após o cadastro, você poderá solicitar acesso a uma equipe específica.'}
                  </p>
                </div>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome Completo</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Seu nome completo"
                      value={signupData.nomeCompleto}
                      onChange={(e) => setSignupData({ ...signupData, nomeCompleto: e.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-role">Tipo de Usuário</Label>
                    <Select
                      value={signupData.role}
                      onValueChange={(value) => setSignupData({ ...signupData, role: value, equipeId: '' })}
                      required
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecione seu papel no sistema" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="colaborador">Colaborador Interno</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="diretoria">Diretor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-equipe">Equipe</Label>
                    {equipesLoading ? (
                      <div className="h-11 flex items-center justify-center border rounded-md">
                        <span className="text-sm text-muted-foreground">Carregando equipes...</span>
                      </div>
                    ) : equipesError ? (
                      <div className="h-11 flex items-center justify-center border rounded-md bg-destructive/10">
                        <span className="text-sm text-destructive">Erro ao carregar equipes</span>
                      </div>
                    ) : (
                      <Select
                        value={signupData.equipeId}
                        onValueChange={(value) => setSignupData({ ...signupData, equipeId: value })}
                        required
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione sua equipe" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {equipes && equipes.length > 0 ? (
                            equipes.map((equipe) => (
                              <SelectItem key={equipe.id} value={equipe.id}>
                                {equipe.nome}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-teams" disabled>
                              Nenhuma equipe disponível
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Sua solicitação será enviada para aprovação do supervisor da equipe.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 shadow-glow" disabled={isSubmitting}>
                    {isSubmitting ? 'Cadastrando...' : 'Criar Conta'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="franqueado" className="space-y-4">
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Área Franqueados:</strong> Use seu telefone e senha do sistema para acessar.
                  </p>
                </div>
                <form onSubmit={handleFranqueadoLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="franqueado-phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="franqueado-phone"
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={franqueadoData.phone}
                        onChange={(e) => setFranqueadoData({ ...franqueadoData, phone: e.target.value })}
                        className="h-11 pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="franqueado-password">Senha do Sistema</Label>
                    <Input
                      id="franqueado-password"
                      type="password"
                      placeholder="••••••••"
                      value={franqueadoData.password}
                      onChange={(e) => setFranqueadoData({ ...franqueadoData, password: e.target.value })}
                      className="h-11"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 shadow-glow" disabled={isSubmitting}>
                    {isSubmitting ? 'Entrando...' : 'Acessar Área do Franqueado'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Ensure proper default export for dynamic imports
export default Auth;
