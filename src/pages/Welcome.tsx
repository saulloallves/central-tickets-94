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
import { Mail, Lock, Users, CheckCircle2, XCircle, Loader2, Sparkles, Shield } from "lucide-react";

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
    <div className="min-h-screen flex">
      {/* Hero Section - Desktop */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6bTAgMTBjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNC0xLjc5IDQtNCA0LTQtMS43OS00LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <Shield className="h-10 w-10 text-white" />
            <h1 className="text-3xl font-bold text-white">Sistema Central</h1>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Sparkles className="h-6 w-6 text-white/80 mt-1" />
              <div>
                <h2 className="text-4xl font-bold text-white mb-4">
                  Bem-vindo à sua nova jornada
                </h2>
                <p className="text-white/90 text-lg leading-relaxed">
                  Você foi convidado para fazer parte de nossa equipe. Configure sua conta em apenas alguns passos e comece a colaborar com o time.
                </p>
              </div>
            </div>

            <div className="mt-12 grid gap-4">
              <div className="flex items-center gap-3 text-white/80">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-sm font-bold">1</span>
                </div>
                <span>Verifique seu email pré-aprovado</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-sm font-bold">2</span>
                </div>
                <span>Crie uma senha segura</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-sm font-bold">3</span>
                </div>
                <span>Escolha sua equipe</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-white/60 text-sm relative z-10">
          © 2024 Central Ticket. Todos os direitos reservados.
        </p>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader className="space-y-1">
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">Sistema Central</h1>
            </div>
            <CardTitle className="text-2xl">Ative sua conta</CardTitle>
            <CardDescription>
              Configure sua senha e comece a usar o sistema
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleActivate} className="space-y-4">
              {/* Step 1: Email Verification */}
              <div className="space-y-2">
                <Label htmlFor="email">Email pré-aprovado</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={emailStatus === 'approved' || isVerifying}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerifyEmail}
                    disabled={!email || isVerifying || emailStatus === 'approved'}
                  >
                    {isVerifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verificar'
                    )}
                  </Button>
                </div>

                {isVerifying && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verificando email...</span>
                  </div>
                )}

                {emailStatus === 'approved' && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Email pré-aprovado!</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Agora configure sua senha e escolha sua equipe.
                    </p>
                  </div>
                )}

                {emailStatus === 'rejected' && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <XCircle className="h-5 w-5" />
                      <span className="font-medium">Email não autorizado</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      Este email não está na lista de pré-aprovados. Entre em contato com o administrador.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 2: Password & Team (only show after email approved) */}
              {emailStatus === 'approved' && (
                <>
                  <div className="h-px bg-border my-4"></div>

                  <div className="space-y-2">
                    <Label htmlFor="password">
                      <Lock className="inline h-4 w-4 mr-1" />
                      Nova senha
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {password && (
                      <div className="mt-2">
                        <div className="flex gap-1">
                          <div className={`h-1 flex-1 rounded transition-colors ${passwordStrength >= 1 ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                          <div className={`h-1 flex-1 rounded transition-colors ${passwordStrength >= 2 ? 'bg-yellow-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                          <div className={`h-1 flex-1 rounded transition-colors ${passwordStrength >= 3 ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {passwordStrength === 0 && 'Muito fraca'}
                          {passwordStrength === 1 && 'Fraca'}
                          {passwordStrength === 2 && 'Média'}
                          {passwordStrength === 3 && 'Forte ✓'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Digite a senha novamente"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    {confirmPassword && (
                      <p className={`text-xs ${password === confirmPassword ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {password === confirmPassword ? '✓ Senhas coincidem' : '✗ Senhas não coincidem'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="equipe">
                      <Users className="inline h-4 w-4 mr-1" />
                      Equipe
                    </Label>
                    <Select
                      value={selectedEquipe}
                      onValueChange={setSelectedEquipe}
                      disabled={loadingEquipes}
                    >
                      <SelectTrigger id="equipe">
                        <SelectValue placeholder="Selecione sua equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {equipes.map((equipe) => (
                          <SelectItem key={equipe.id} value={equipe.id}>
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{equipe.nome}</span>
                              {equipe.introducao && (
                                <span className="text-xs text-muted-foreground">{equipe.introducao}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isActivating || !password || !confirmPassword || !selectedEquipe || password !== confirmPassword}
                  >
                    {isActivating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Ativando conta...
                      </>
                    ) : (
                      'Ativar minha conta'
                    )}
                  </Button>
                </>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
