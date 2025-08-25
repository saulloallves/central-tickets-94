import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Shield, 
  Users, 
  Search, 
  RefreshCw,
  UserX,
  Key,
  Clock,
  Eye,
  Settings,
  Activity,
  UserCheck,
  AlertTriangle
} from "lucide-react";
import { useSystemLogs } from "@/hooks/useSystemLogs";
import { usePresence } from "@/hooks/usePresence";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  nome_completo: string;
  email: string;
  created_at: string;
  roles?: string[];
  last_activity?: string;
  permissions?: string[];
}

export function AccessControl() {
  const { logSystemAction } = useSystemLogs();
  const { onlineUsers, totalOnline } = usePresence();
  const { isAdmin, hasRole } = useRole();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Buscar perfis de usuários
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar roles para cada usuário
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Buscar permissões por role
      const { data: rolePermissions, error: rolePermError } = await supabase
        .from('role_permissions')
        .select('role, permission');

      if (rolePermError) console.warn('Could not fetch role permissions:', rolePermError);

      // Processar última atividade dos logs
      const { data: lastActivities, error: activitiesError } = await supabase
        .from('logs_de_sistema')
        .select('usuario_responsavel, timestamp')
        .order('timestamp', { ascending: false });

      const latestActivity = lastActivities?.reduce((acc, log) => {
        if (log.usuario_responsavel && !acc[log.usuario_responsavel]) {
          acc[log.usuario_responsavel] = log.timestamp;
        }
        return acc;
      }, {} as Record<string, string>) || {};

      // Combinar dados
      const usersWithRoles = profiles?.map(profile => {
        const userRolesList = userRoles?.filter(ur => ur.user_id === profile.id) || [];
        const roles = userRolesList.map(ur => ur.role);
        
        // Calcular permissões baseadas nos roles
        const permissions = roles.flatMap(role => 
          (rolePermissions || [])
            .filter(rp => rp.role === role)
            .map(rp => rp.permission)
        );
        
        return {
          ...profile,
          roles,
          last_activity: latestActivity[profile.id] || profile.created_at,
          permissions: [...new Set(permissions)] // Remove duplicatas
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados de usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeRole = async (userId: string, role: string) => {
    // Verificar se o usuário tem permissão para revogar roles
    if (!isAdmin && !hasRole('diretoria')) {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores e diretoria podem editar cargos de usuários",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role as any);

      if (error) throw error;

      // Log da ação
      await logSystemAction({
        tipo_log: 'acao_humana' as any,
        entidade_afetada: 'user_roles',
        entidade_id: userId,
        acao_realizada: `Role ${role} revogado`,
        dados_anteriores: { userId, role }
      });

      toast({
        title: "Sucesso",
        description: `Role ${role} revogado com sucesso`,
      });

      fetchUsers(); // Recarregar dados
    } catch (error) {
      console.error('Erro ao revogar role:', error);
      toast({
        title: "Erro",
        description: "Erro ao revogar permissão. Tente usar a página de Permissões.",
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter(user => 
    user.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.roles?.some(role => role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'diretoria': return 'destructive';
      case 'gerente': return 'default';
      case 'colaborador': return 'secondary';
      default: return 'outline';
    }
  };

  const getActivityStatus = (lastActivity: string) => {
    const activityDate = new Date(lastActivity);
    const now = new Date();
    const hoursDiff = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 1) return { status: 'online', color: 'success' };
    if (hoursDiff < 24) return { status: 'recente', color: 'warning' };
    if (hoursDiff < 168) return { status: 'semanal', color: 'secondary' };
    return { status: 'inativo', color: 'muted' };
  };

  const isUserOnline = (userId: string) => {
    return onlineUsers.some(user => user.userId === userId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Controle de Acessos</h2>
          <p className="text-muted-foreground">Gerenciamento de usuários e sessões</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => window.open('/admin/permissions', '_blank')}
            className="liquid-glass-button"
          >
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar Permissões
          </Button>
          <Button
            onClick={fetchUsers}
            disabled={loading}
            className="liquid-glass-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Usuários</p>
                <p className="text-2xl font-bold text-foreground">{users.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Perfis cadastrados
            </p>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usuários Online</p>
                <p className="text-2xl font-bold text-success">{totalOnline}</p>
              </div>
              <UserCheck className="h-8 w-8 text-success" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Conectados agora
            </p>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Administradores</p>
                <p className="text-2xl font-bold text-critical">
                  {users.filter(u => u.roles?.includes('admin')).length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-critical" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Acesso total
            </p>
          </CardContent>
        </Card>

        <Card className="liquid-glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Inativos 7d</p>
                <p className="text-2xl font-bold text-warning">
                  {users.filter(u => {
                    const hoursDiff = (new Date().getTime() - new Date(u.last_activity || u.created_at).getTime()) / (1000 * 60 * 60);
                    return hoursDiff > 168;
                  }).length}
                </p>
              </div>
              <UserX className="h-8 w-8 text-warning" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Sem atividade
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="liquid-glass-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 liquid-glass-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="liquid-glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Usuários e Permissões</span>
          </CardTitle>
          <CardDescription>
            {filteredUsers.length} usuário(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando usuários...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Última Atividade</TableHead>
                    <TableHead>Criado Em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const activityStatus = getActivityStatus(user.last_activity || user.created_at);
                    const online = isUserOnline(user.id);
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${online ? 'bg-success animate-pulse' : 'bg-muted'}`}></div>
                            <div>
                              <p className="text-sm font-medium">{user.nome_completo || 'Nome não informado'}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge variant={online ? "default" : activityStatus.color as any}>
                              {online ? 'Online' : activityStatus.status}
                            </Badge>
                            {online && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Eye className="h-3 w-3 text-success" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Ativo na aplicação
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles && user.roles.length > 0 ? (
                              user.roles.map((role) => (
                                <div key={role} className="flex items-center space-x-1">
                                  <Badge variant={getRoleBadgeVariant(role)}>
                                    {role}
                                  </Badge>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-5 w-5 p-0 hover:bg-destructive/20"
                                          onClick={() => handleRevokeRole(user.id, role)}
                                        >
                                          <UserX className="h-3 w-3 text-destructive" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Revogar role: {role}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              ))
                            ) : (
                              <Badge variant="outline">Sem roles</Badge>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm">
                                {formatDistanceToNow(new Date(user.last_activity || user.created_at), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(user.last_activity || user.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <p className="text-sm">
                            {new Date(user.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => window.open(`/admin/permissions?user=${user.id}`, '_blank')}
                                  >
                                    <Key className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Gerenciar permissões
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Online Users Detail */}
      <Card className="liquid-glass-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Sessões Ativas</span>
          </CardTitle>
          <CardDescription>
            Usuários conectados em tempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          {onlineUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum usuário online no momento
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {onlineUsers.map((user) => {
                const userProfile = users.find(u => u.id === user.userId);
                return (
                  <div key={user.userId} className="p-4 bg-success/10 border border-success/20 rounded-lg">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-3 h-3 bg-success rounded-full animate-pulse"></div>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{userProfile?.email}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        <strong>Rota:</strong> {user.route}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <strong>Desde:</strong> {formatDistanceToNow(new Date(user.timestamp), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </p>
                      {userProfile?.roles && userProfile.roles.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {userProfile.roles.map((role) => (
                            <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}