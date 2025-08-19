import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, Sparkles, Shield, Zap, ArrowRight, CheckCircle } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/admin');
    }
  }, [user, loading, navigate]);

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
    <div className="min-h-screen bg-gradient-hero overflow-hidden">
      {/* Hero Section */}
      <div className="relative">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-white animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-24 h-24 rounded-full bg-white animate-pulse animation-delay-1000"></div>
          <div className="absolute top-1/2 right-20 w-16 h-16 rounded-full bg-white animate-pulse animation-delay-2000"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 py-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-glow">
                <ClipboardList className="h-8 w-8 text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-bold text-white">HelpDesk AI</h1>
                <p className="text-white/60">Gestão Inteligente de Tickets</p>
              </div>
            </div>

            {/* Hero content */}
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight animate-fade-in">
              O futuro do<br />
              <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                suporte ao cliente
              </span>
            </h2>
            
            <p className="text-xl text-white/80 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in animation-delay-200">
              Plataforma completa de gestão de tickets com inteligência artificial,
              integração WhatsApp, controle avançado de permissões e análise de dados em tempo real.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in animation-delay-400">
              <Button 
                onClick={() => navigate('/auth')}
                size="lg"
                className="h-14 px-8 bg-white text-primary hover:bg-white/90 shadow-lg font-semibold text-lg"
              >
                Acessar Sistema
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto animate-slide-up animation-delay-600">
              <Card className="border-0 bg-white/10 backdrop-blur-sm text-white hover:bg-white/15 transition-all duration-300 hover:scale-105">
                <CardHeader className="text-center pb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-glow/20 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-6 w-6 text-primary-glow" />
                  </div>
                  <CardTitle className="text-xl">Inteligência Artificial</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="text-white/70">
                    Respostas automáticas inteligentes e análise avançada de tickets com IA
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/10 backdrop-blur-sm text-white hover:bg-white/15 transition-all duration-300 hover:scale-105">
                <CardHeader className="text-center pb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-glow/20 flex items-center justify-center mx-auto mb-4">
                    <Shield className="h-6 w-6 text-primary-glow" />
                  </div>
                  <CardTitle className="text-xl">Controle Avançado</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="text-white/70">
                    Sistema completo de permissões e controle de acesso por equipes
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white/10 backdrop-blur-sm text-white hover:bg-white/15 transition-all duration-300 hover:scale-105">
                <CardHeader className="text-center pb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-glow/20 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-6 w-6 text-primary-glow" />
                  </div>
                  <CardTitle className="text-xl">Integração WhatsApp</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <CardDescription className="text-white/70">
                    Integração completa com Z-API para atendimento via WhatsApp
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            {/* Status indicators */}
            <div className="mt-16 flex flex-wrap justify-center gap-8 animate-fade-in animation-delay-800">
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-sm font-medium">Sistema de Autenticação</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-sm font-medium">Gestão de Equipes</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle className="h-5 w-5 text-yellow-400" />
                <span className="text-sm font-medium">Tickets em Desenvolvimento</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <CheckCircle className="h-5 w-5 text-yellow-400" />
                <span className="text-sm font-medium">IA em Implementação</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
