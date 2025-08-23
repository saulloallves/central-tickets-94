import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Sparkles, Shield, Zap } from 'lucide-react';

const Auth = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nomeCompleto: '',
    telefone: ''
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading) {
      navigate('/admin');
    }
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await signIn(loginData.email, loginData.password);
    if (!error) {
      navigate('/admin');
    }

    setIsSubmitting(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupData.password !== signupData.confirmPassword) {
      return;
    }

    setIsSubmitting(true);

    const { error } = await signUp(signupData.email, signupData.password, {
      nome_completo: signupData.nomeCompleto,
      telefone: signupData.telefone
    });

    if (!error) {
      // Reset form
      setSignupData({
        email: '',
        password: '',
        confirmPassword: '',
        nomeCompleto: '',
        telefone: ''
      });
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
              <h1 className="text-2xl font-bold text-white">HelpDesk AI</h1>
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
              <span className="text-xl font-bold">HelpDesk AI</span>
            </div>
            <CardTitle className="text-2xl font-bold">Bem-vindo</CardTitle>
            <CardDescription>Acesse sua conta ou crie uma nova</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white">
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-white">
                  Cadastrar
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
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Equipe Interna:</strong> Após o cadastro, você poderá solicitar acesso a uma equipe específica.
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
                    <Label htmlFor="signup-phone">Telefone</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={signupData.telefone}
                      onChange={(e) => setSignupData({ ...signupData, telefone: e.target.value })}
                      className="h-11"
                    />
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
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
