import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileSettingsDialog } from "@/components/profile/ProfileSettingsDialog";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useFranqueadoUnits } from "@/hooks/useFranqueadoUnits";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, User, Calendar, Settings, Building2, MapPin, Edit } from "lucide-react";

export default function FranqueadoProfile() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { units, loading: unitsLoading } = useFranqueadoUnits();

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
      </div>
    </div>
  );
}