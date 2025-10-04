import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useActivateAccount } from "@/hooks/useActivateAccount";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Lock, Users, CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";
import { SystemLogo } from "@/components/SystemLogo";
import { DottedSurface } from "@/components/welcome/DottedSurface";
import { MouseFollower } from "@/components/welcome/MouseFollower";
import { FloatingOrbs } from "@/components/welcome/FloatingOrbs";
import { StepProgress } from "@/components/welcome/StepProgress";

export default function Welcome() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { checkPreApproved, activateAccount } = useActivateAccount();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedEquipe, setSelectedEquipe] = useState("");
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'approved' | 'rejected'>('idle');

  // Buscar equipes ativas
  const { data: equipes = [], isLoading: loadingEquipes } = useQuery({
    queryKey: ['equipes-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipes')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Determinar step atual
  const getCurrentStep = (): number => {
    if (emailStatus !== 'approved') return 1;
    if (!password || !confirmPassword || password !== confirmPassword) return 2;
    if (!selectedEquipe) return 3;
    return 3;
  };

  const steps = [
    { number: 1, label: "Confirme seu e-mail pré-aprovado" },
    { number: 2, label: "Crie uma senha segura" },
    { number: 3, label: "Escolha sua equipe" },
  ];

  // Verificar força da senha
  const getPasswordStrength = (pwd: string): number => {
    if (pwd.length < 6) return 0;
    if (pwd.length < 8) return 1;
    
    let strength = 1;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    
    return Math.min(strength, 3);
  };

  const passwordStrength = getPasswordStrength(password);

  const handleVerifyEmail = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido.",
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);
    setEmailStatus('idle');

    try {
      const isPreApproved = await checkPreApproved(email);
      
      if (isPreApproved) {
        setEmailStatus('approved');
        toast({
          title: "Email pré-aprovado! ✅",
          description: "Agora configure sua senha e escolha sua equipe."
        });
      } else {
        setEmailStatus('rejected');
        toast({
          title: "Email não autorizado",
          description: "Este email não está na lista de pré-aprovados. Entre em contato com o administrador.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao verificar email:', error);
      toast({
        title: "Erro na verificação",
        description: "Ocorreu um erro ao verificar o email. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (password.length < 8) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter no mínimo 8 caracteres.",
        variant: "destructive"
      });
      return;
    }

    if (!/[A-Z]/.test(password)) {
      toast({
        title: "Senha fraca",
        description: "A senha deve conter pelo menos uma letra maiúscula.",
        variant: "destructive"
      });
      return;
    }

    if (!/[0-9]/.test(password)) {
      toast({
        title: "Senha fraca",
        description: "A senha deve conter pelo menos um número.",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "As senhas digitadas não são iguais.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedEquipe) {
      toast({
        title: "Selecione uma equipe",
        description: "Por favor, escolha a equipe que você fará parte.",
        variant: "destructive"
      });
      return;
    }

    setIsActivating(true);

    try {
      const { success, error } = await activateAccount(email, password, selectedEquipe);

      if (success) {
        toast({
          title: "Conta ativada com sucesso! 🎉",
          description: "Bem-vindo ao sistema!"
        });
        
        // Pequeno delay para mostrar o toast
        setTimeout(() => {
          navigate('/admin/dashboard');
        }, 1500);
      } else {
        toast({
          title: "Erro na ativação",
          description: error || "Não foi possível ativar a conta. Tente novamente.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Erro ao ativar conta:', error);
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro ao ativar sua conta.",
        variant: "destructive"
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-background">
      <MouseFollower />

      {/* Hero Section - Desktop */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/95 to-primary/80 p-12 flex-col justify-between relative overflow-hidden">
        <DottedSurface className="opacity-30" />
        <FloatingOrbs />
        
        {/* Scanline effect */}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_calc(100%_-_1px),rgba(255,255,255,0.05)_calc(100%_-_1px))] bg-[length:100%_4px] pointer-events-none" />
        
        <div className="relative z-10 animate-fade-in">
          <div className="flex items-center gap-4 mb-12 group cursor-pointer">
            <div className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              <SystemLogo />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">Sistema Central</h1>
              <p className="text-white/70 text-sm">Tecnologia em Gestão</p>
            </div>
          </div>
          
          <div className="space-y-8">
            <div className="flex items-start gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="mt-2">
                <Sparkles className="h-8 w-8 text-white/80 animate-pulse" />
              </div>
              <div>
                <h2 className="text-5xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
                  Bem-vindo(a) ao seu novo espaço de colaboração
                </h2>
                <p className="text-white/90 text-lg leading-relaxed">
                  Você foi convidado para integrar nossa equipe.<br />
                  Agora é só ativar sua conta em poucos passos para começar a participar:
                </p>
              </div>
            </div>

            <div className="mt-12 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <StepProgress currentStep={getCurrentStep()} steps={steps} />
              
              <div className="mt-6 p-5 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
                <p className="text-white/90 text-base">
                  <strong className="text-white">Pronto:</strong> já poderá acessar o sistema e colaborar com o time.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-white/60 text-sm relative z-10 animate-fade-in" style={{ animationDelay: '0.6s' }}>
          © 2024 Sistema Central. Tecnologia e Inovação.
        </p>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
        
        <Card className="w-full max-w-md shadow-elegant relative z-10 animate-scale-in border-primary/20">
          <CardHeader className="space-y-1">
            <div className="lg:hidden flex items-center gap-3 mb-6">
              <SystemLogo />
              <div>
                <h1 className="text-2xl font-bold">Sistema Central</h1>
                <p className="text-sm text-muted-foreground">Tecnologia em Gestão</p>
              </div>
            </div>
            <CardTitle className="text-3xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Ative sua conta
            </CardTitle>
            <CardDescription className="text-base">
              Configure sua senha e comece a usar o sistema
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleActivate} className="space-y-5">
              {/* Step 1: Email Verification */}
              <div className="space-y-3">
                <Label htmlFor="email" className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Email pré-aprovado
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={emailStatus === 'approved' || isVerifying}
                    className="flex-1 transition-all duration-300 focus:shadow-[0_0_20px_rgba(104,182,229,0.3)]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerifyEmail}
                    disabled={!email || isVerifying || emailStatus === 'approved'}
                    className="transition-all duration-300 hover:shadow-[0_0_15px_rgba(104,182,229,0.4)] hover:border-primary"
                  >
                    {isVerifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verificar'
                    )}
                  </Button>
                </div>

                {isVerifying && (
                  <div className="flex items-center gap-2 text-sm text-primary animate-fade-in p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verificando email...</span>
                  </div>
                )}

                {emailStatus === 'approved' && (
                  <div className="p-4 bg-primary/10 rounded-xl border border-primary/30 animate-scale-in shadow-[0_0_20px_rgba(104,182,229,0.2)]">
                    <div className="flex items-center gap-2 text-primary">
                      <CheckCircle2 className="h-5 w-5 animate-scale-in" />
                      <span className="font-semibold">Email pré-aprovado!</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Agora configure sua senha e escolha sua equipe.
                    </p>
                  </div>
                )}

                {emailStatus === 'rejected' && (
                  <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/30 animate-scale-in">
                    <div className="flex items-center gap-2 text-destructive">
                      <XCircle className="h-5 w-5" />
                      <span className="font-semibold">Email não autorizado</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Este email não está na lista de pré-aprovados. Entre em contato com o administrador.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 2: Password & Team (only show after email approved) */}
              {emailStatus === 'approved' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent my-6"></div>

                  <div className="space-y-3">
                    <Label htmlFor="password" className="text-base flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" />
                      Nova senha
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="transition-all duration-300 focus:shadow-[0_0_20px_rgba(104,182,229,0.3)]"
                    />
                    {password && (
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-1.5">
                          <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${passwordStrength >= 1 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-muted'}`} />
                          <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${passwordStrength >= 2 ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-muted'}`} />
                          <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${passwordStrength >= 3 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-muted'}`} />
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
                          {passwordStrength === 0 && 'Muito fraca'}
                          {passwordStrength === 1 && 'Fraca'}
                          {passwordStrength === 2 && 'Média'}
                          {passwordStrength === 3 && '✓ Forte'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="confirmPassword" className="text-base">Confirmar senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Digite a senha novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="transition-all duration-300 focus:shadow-[0_0_20px_rgba(104,182,229,0.3)]"
                    />
                    {confirmPassword && (
                      <p className={`text-sm font-medium transition-all duration-300 ${password === confirmPassword ? 'text-green-500' : 'text-destructive'}`}>
                        {password === confirmPassword ? '✓ Senhas coincidem' : '✗ Senhas não coincidem'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="equipe" className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Equipe
                    </Label>
                    <Select
                      value={selectedEquipe}
                      onValueChange={setSelectedEquipe}
                      disabled={loadingEquipes}
                    >
                      <SelectTrigger id="equipe" className="transition-all duration-300 focus:shadow-[0_0_20px_rgba(104,182,229,0.3)]">
                        <SelectValue placeholder="Selecione sua equipe" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {equipes.map((equipe) => (
                          <SelectItem key={equipe.id} value={equipe.id}>
                            {equipe.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold transition-all duration-300 hover:shadow-[0_0_30px_rgba(104,182,229,0.5)] hover:scale-[1.02]"
                    disabled={isActivating || !password || !confirmPassword || !selectedEquipe || password !== confirmPassword}
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Ativando conta...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Ativar minha conta
                      </>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
