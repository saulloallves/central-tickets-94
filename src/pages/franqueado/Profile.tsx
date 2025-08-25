import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, User, Calendar, Settings } from "lucide-react";

export default function FranqueadoProfile() {
  const { profile } = useProfile();
  const { user } = useAuth();

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
              <div>
                <h3 className="text-lg font-medium">
                  {profile?.nome_completo || user?.user_metadata?.display_name || 'Nome não informado'}
                </h3>
                <Badge variant="secondary">Franqueado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

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
          </CardContent>
        </Card>

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
          <CardContent>
            <ProfileSettingsDialog />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}