import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Crown, 
  Shield, 
  UserCheck, 
  UserX, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { useRole } from '@/hooks/useRole';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';

interface PendingAdminRole {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  nome_completo: string;
  email: string;
}

export function AdminRoleApprovals() {
  const { toast } = useToast();
  const { isAdmin, hasRole } = useRole();
  const [pendingRoles, setPendingRoles] = useState<PendingAdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingRoleId, setProcessingRoleId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingRoles();
  }, []);

  const fetchPendingRoles = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          profiles!inner(nome_completo, email)
        `)
        .eq('approved', false)
        .in('role', ['admin', 'diretoria', 'supervisor', 'diretor'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(item => ({
        id: item.id,
        user_id: item.user_id,
        role: item.role,
        created_at: item.created_at,
        nome_completo: item.profiles.nome_completo,
        email: item.profiles.email
      })) || [];

      setPendingRoles(formattedData);
    } catch (error) {
      console.error('Error fetching pending roles:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar roles pendentes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const approveRole = async (roleId: string, userId: string, role: string, userName: string) => {
    if (!isAdmin && !hasRole('diretoria')) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores e diretoria podem aprovar roles",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessingRoleId(roleId);
      
      // Aprovar a role
      const { error } = await supabase
        .from('user_roles')
        .update({ approved: true })
        .eq('id', roleId);

      if (error) throw error;

      // Disparar evento para refresh de roles
      window.dispatchEvent(new CustomEvent('roles-updated'));

      toast({
        title: "Role Aprovada",
        description: `Role ${role} aprovada para ${userName}`,
      });

      fetchPendingRoles();
    } catch (error) {
      console.error('Error approving role:', error);
      toast({
        title: "Erro",
        description: "Erro ao aprovar role",
        variant: "destructive"
      });
    } finally {
      setProcessingRoleId(null);
    }
  };

  const rejectRole = async (roleId: string, userName: string, role: string) => {
    if (!isAdmin && !hasRole('diretoria')) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores e diretoria podem rejeitar roles",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessingRoleId(roleId);
      
      // Remover a role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;

      toast({
        title: "Role Rejeitada",
        description: `Role ${role} rejeitada para ${userName}`,
        variant: "destructive"
      });

      fetchPendingRoles();
    } catch (error) {
      console.error('Error rejecting role:', error);
      toast({
        title: "Erro",
        description: "Erro ao rejeitar role",
        variant: "destructive"
      });
    } finally {
      setProcessingRoleId(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="h-4 w-4" />;
      case 'diretoria': case 'diretor': return <Shield className="h-4 w-4" />;
      case 'supervisor': return <UserCheck className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'diretoria': case 'diretor': return 'default';
      case 'supervisor': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'diretoria': return 'Diretoria';
      case 'diretor': return 'Diretor';
      case 'supervisor': return 'Supervisor';
      default: return role;
    }
  };

  if (loading) {
    return (
      <Card className="liquid-glass-card">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="liquid-glass-card">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-critical/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-critical" />
          </div>
          <div>
            <CardTitle className="text-lg">Aprovação de Roles Administrativos</CardTitle>
            <CardDescription>
              Roles administrativos pendentes de aprovação
            </CardDescription>
          </div>
          {pendingRoles.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {pendingRoles.length} pendente{pendingRoles.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {pendingRoles.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma Aprovação Pendente</h3>
            <p className="text-muted-foreground">
              Não há roles administrativos aguardando aprovação no momento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Role Solicitada</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRoles.map((pendingRole) => (
                  <TableRow key={pendingRole.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pendingRole.nome_completo}</div>
                        <div className="text-sm text-muted-foreground">{pendingRole.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={getRoleBadgeVariant(pendingRole.role)}
                        className="flex items-center space-x-1 w-fit"
                      >
                        {getRoleIcon(pendingRole.role)}
                        <span>{getRoleLabel(pendingRole.role)}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(pendingRole.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveRole(
                            pendingRole.id, 
                            pendingRole.user_id, 
                            pendingRole.role, 
                            pendingRole.nome_completo
                          )}
                          disabled={processingRoleId === pendingRole.id}
                          className="text-success border-success hover:bg-success/10"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={processingRoleId === pendingRole.id}
                              className="text-critical border-critical hover:bg-critical/10"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar Rejeição</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja rejeitar a solicitação de role <strong>{getRoleLabel(pendingRole.role)}</strong> para <strong>{pendingRole.nome_completo}</strong>?
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => rejectRole(
                                  pendingRole.id, 
                                  pendingRole.nome_completo, 
                                  pendingRole.role
                                )}
                                className="bg-critical hover:bg-critical/90"
                              >
                                Rejeitar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}