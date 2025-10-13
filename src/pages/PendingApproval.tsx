import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Clock, Shield, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useInternalAccessRequests } from '@/hooks/useInternalAccessRequests';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export const PendingApproval = () => {
  const { user, signOut } = useAuth();
  const { userRequest, loading } = useInternalAccessRequests();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent mx-auto"></div>
          <p className="mt-4 text-white/80 font-medium">Verificando status...</p>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

  const handleRefreshStatus = () => {
    console.log('🔄 [PendingApproval] Forcing roles refresh...');
    
    // Disparar evento de atualização de roles
    window.dispatchEvent(new Event('roles-updated'));
    
    // Aguardar 1 segundo e recarregar página
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

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
          <CardTitle className="text-2xl font-bold text-primary">Acesso Pendente</CardTitle>
          <CardDescription>Sua solicitação está sendo analisada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Aguardando Aprovação</h3>
              <p className="text-muted-foreground">
                Sua conta foi criada com sucesso, mas o acesso ao sistema ainda não foi liberado. 
                Um administrador precisa aprovar sua solicitação.
              </p>
            </div>

            {userRequest && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Detalhes da Solicitação:</strong>
                  <br />📋 Equipe: {userRequest.equipes?.nome || 'Não especificada'}
                  <br />👤 Cargo: {userRequest.desired_role === 'member' ? 'Atendente' : userRequest.desired_role}
                  <br />📅 Solicitado em: {new Date(userRequest.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Status atual:</strong>
                  <br />✓ Conta criada
                  <br />⏳ Aguardando aprovação
                  <br />📧 Você será notificado da decisão
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button 
                onClick={handleRefreshStatus}
                variant="default"
                className="w-full h-11 mb-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Status de Acesso
              </Button>

              <Button 
                onClick={handleSignOut}
                variant="outline"
                className="w-full h-11"
              >
                Sair da Conta
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Em caso de dúvidas, entre em contato com o administrador do sistema
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};