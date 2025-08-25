import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useFranqueadoUnits } from "@/hooks/useFranqueadoUnits";
import { useUserEquipes } from "@/hooks/useUserEquipes";
import { useUserActivity } from "@/hooks/useUserActivity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, User, Calendar, Settings, Building2, MapPin, Users, Activity, Shield, Lock, Ticket, MessageSquare, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function FranqueadoProfile() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { units, loading: unitsLoading } = useFranqueadoUnits();
  const { userEquipes, loading: equipesLoading } = useUserEquipes();
  const { activity, loading: activityLoading } = useUserActivity();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: ""
  });

  const handlePasswordChange = async () => {
    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 8 caracteres",
        variant: "destructive"
      });
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erro", 
        description: "As senhas não coincidem",
        variant: "destructive"
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Senha alterada com sucesso"
      });

      setPasswordData({ newPassword: "", confirmPassword: "" });
    } catch (error) {
      console.error('Error changing password:', error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar a senha",
        variant: "destructive"
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e configurações de conta
          </p>
        </div>
        <ProfileSettingsDialog />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Pessoais
            </CardTitle>
            <CardDescription>
              Suas informações básicas do perfil
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-lg">
                  {profile?.nome_completo?.charAt(0)?.toUpperCase() ||
                   user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || 
                   user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-lg font-medium">
                  {profile?.nome_completo || user?.user_metadata?.display_name || 'Nome não informado'}
                </h3>
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Franqueado
                </Badge>
              </div>
              <ProfileSettingsDialog />
            </div>
          </CardContent>
        </Card>

        {/* Informações de Contato */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contato
            </CardTitle>
            <CardDescription>
              Informações de contato e comunicação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm text-muted-foreground">
                {user?.email || 'Não informado'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Telefone:</span>
              <span className="text-sm text-muted-foreground">
                {profile?.telefone || 'Não informado'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Minhas Unidades */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Minhas Unidades
            </CardTitle>
            <CardDescription>
              Unidades franqueadas sob sua gestão
            </CardDescription>
          </CardHeader>
          <CardContent>
            {unitsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : units.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {units.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {unit.grupo}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mr-1" />
                        {unit.cidade} - {unit.uf}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma unidade encontrada
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Informações da Conta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Informações da Conta
            </CardTitle>
            <CardDescription>
              Detalhes sobre sua conta no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Criada em:</span>
              <span className="text-sm text-muted-foreground">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'Não informado'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Último acesso:</span>
              <span className="text-sm text-muted-foreground">
                {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR') : 'Não informado'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Ativo
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Minhas Equipes Internas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Minhas Equipes Internas
            </CardTitle>
            <CardDescription>
              Equipes internas das quais você faz parte
            </CardDescription>
          </CardHeader>
          <CardContent>
            {equipesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : userEquipes.length > 0 ? (
              <div className="space-y-3">
                {userEquipes.map((equipe) => (
                  <div key={equipe.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{equipe.equipes.nome}</p>
                      <p className="text-xs text-muted-foreground capitalize">{equipe.role}</p>
                    </div>
                    {equipe.is_primary && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        Primária
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sem equipe interna</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações
            </CardTitle>
            <CardDescription>
              Personalize sua experiência no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Editar Perfil</p>
                <p className="text-xs text-muted-foreground">
                  Alterar nome, foto e informações de contato
                </p>
              </div>
              <ProfileSettingsDialog />
            </div>
            
            <div className="pt-4 border-t">
              <div className="space-y-1">
                <p className="text-sm font-medium">Suporte</p>
                <p className="text-xs text-muted-foreground">
                  Entre em contato conosco para ajuda
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Minha Atividade */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Minha Atividade
            </CardTitle>
            <CardDescription>
              Estatísticas de atendimento e atividade no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 border rounded-lg">
                    <Ticket className="h-8 w-8 text-primary mx-auto mb-2" />
                    <div className="text-2xl font-bold">{activity.ticketsAtendidos}</div>
                    <div className="text-sm text-muted-foreground">Tickets Atendidos</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <MessageSquare className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{activity.respostasEnviadas}</div>
                    <div className="text-sm text-muted-foreground">Respostas Enviadas</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <div className="text-2xl font-bold">{activity.ultimasInteracoes.length}</div>
                    <div className="text-sm text-muted-foreground">Interações Recentes</div>
                  </div>
                </div>

                {activity.ultimasInteracoes.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Últimos Atendimentos</h4>
                    <div className="space-y-2">
                      {activity.ultimasInteracoes.map((interacao, index) => (
                        <div key={index} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">#{interacao.codigo_ticket}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {interacao.mensagem_preview}
                              </p>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(interacao.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Segurança
            </CardTitle>
            <CardDescription>
              Altere sua senha e gerencie configurações de segurança
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Nova Senha
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Repita a nova senha"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={handlePasswordChange} 
                disabled={isChangingPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                variant="outline"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Alterando...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Alterar Senha
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}