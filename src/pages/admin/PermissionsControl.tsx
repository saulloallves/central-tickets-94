import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Users, Clock, Plus, Trash2 } from 'lucide-react';
import { AppPermission } from '@/hooks/usePermissions';
import { AppRole } from '@/hooks/useRole';

interface UserPermission {
  id: string;
  user_id: string;
  permission: AppPermission;
  expires_at?: string;
  granted_by?: string;
  created_at: string;
  user_email?: string;
}

interface RolePermission {
  role: AppRole;
  permission: AppPermission;
}

export default function PermissionsControl() {
  const { toast } = useToast();
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<AppPermission>('view_own_unit_tickets');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');

  const permissions: AppPermission[] = [
    'view_all_tickets',
    'view_own_unit_tickets',
    'view_team_tickets',
    'respond_tickets',
    'escalate_tickets',
    'access_dashboards',
    'manage_knowledge_base',
    'validate_ai_content',
    'configure_ai_models',
    'view_audit_logs',
    'export_reports',
    'view_all_history',
    'manage_crisis',
    'supervise_units',
    'validate_ai_responses'
  ];

  const roles: AppRole[] = [
    'admin',
    'diretor',
    'gerente', 
    'colaborador',
    'diretoria',
    'gestor_equipe',
    'gestor_unidade',
    'franqueado',
    'auditor_juridico'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch user permissions with user details
      const { data: userPermsData, error: userPermsError } = await supabase
        .from('user_permissions')
        .select('*');

      if (userPermsError) throw userPermsError;

      // Fetch user details separately
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, nome_completo');

      if (usersError) throw usersError;

      // Combine user permissions with user details
      const formattedUserPerms = userPermsData?.map(up => {
        const user = usersData?.find(u => u.id === up.user_id);
        return {
          ...up,
          user_email: user?.email
        };
      }) || [];
      
      setUserPermissions(formattedUserPerms);

      // Fetch role permissions
      const { data: rolePermsData, error: rolePermsError } = await supabase
        .from('role_permissions')
        .select('role, permission');

      if (rolePermsError) throw rolePermsError;
      setRolePermissions((rolePermsData || []) as RolePermission[]);

      setUsers(usersData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados de permissões",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const grantUserPermission = async () => {
    if (!selectedUser || !selectedPermission) return;

    try {
      const { error } = await supabase
        .from('user_permissions')
        .insert({
          user_id: selectedUser,
          permission: selectedPermission,
          expires_at: hasExpiry && expiryDate ? new Date(expiryDate).toISOString() : null
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Permissão concedida com sucesso"
      });

      // Reset form
      setSelectedUser('');
      setSelectedPermission('view_own_unit_tickets');
      setHasExpiry(false);
      setExpiryDate('');
      
      fetchData();
    } catch (error) {
      console.error('Error granting permission:', error);
      toast({
        title: "Erro", 
        description: "Erro ao conceder permissão",
        variant: "destructive"
      });
    }
  };

  const revokeUserPermission = async (permissionId: string) => {
    try {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Permissão revogada com sucesso"
      });

      fetchData();
    } catch (error) {
      console.error('Error revoking permission:', error);
      toast({
        title: "Erro",
        description: "Erro ao revogar permissão", 
        variant: "destructive"
      });
    }
  };

  const formatPermissionName = (permission: string) => {
    return permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full py-6 pt-12 space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Controle de Permissões</h1>
      </div>
      
      <Tabs defaultValue="user-permissions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="user-permissions">Permissões de Usuário</TabsTrigger>
          <TabsTrigger value="role-permissions">Permissões por Cargo</TabsTrigger>
        </TabsList>

        <TabsContent value="user-permissions" className="space-y-6">
          {/* Grant Permission Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Conceder Permissão
              </CardTitle>
              <CardDescription>
                Conceda permissões específicas para usuários individuais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="user-select">Usuário</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.nome_completo || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="permission-select">Permissão</Label>
                  <Select value={selectedPermission} onValueChange={(value) => setSelectedPermission(value as AppPermission)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {permissions.map(permission => (
                        <SelectItem key={permission} value={permission}>
                          {formatPermissionName(permission)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="has-expiry"
                  checked={hasExpiry}
                  onCheckedChange={setHasExpiry}
                />
                <Label htmlFor="has-expiry">Definir data de expiração</Label>
              </div>

              {hasExpiry && (
                <div>
                  <Label htmlFor="expiry-date">Data de Expiração</Label>
                  <Input
                    id="expiry-date"
                    type="datetime-local"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              )}

              <Button onClick={grantUserPermission} disabled={!selectedUser || !selectedPermission}>
                <Plus className="h-4 w-4 mr-2" />
                Conceder Permissão
              </Button>
            </CardContent>
          </Card>

          {/* Active User Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Permissões Ativas
              </CardTitle>
              <CardDescription>
                Gerencie permissões específicas concedidas a usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userPermissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhuma permissão específica de usuário encontrada
                </p>
              ) : (
                <div className="space-y-4">
                  {userPermissions.map(permission => (
                    <div key={permission.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {permission.user_email}
                          </Badge>
                          <Badge variant="outline">
                            {formatPermissionName(permission.permission)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Concedida em: {new Date(permission.created_at).toLocaleDateString()}</span>
                          {permission.expires_at && (
                            <span>• Expira em: {new Date(permission.expires_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeUserPermission(permission.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="role-permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Permissões por Cargo</CardTitle>
              <CardDescription>
                Visualize as permissões associadas a cada cargo do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {roles.map(role => {
                  const rolePerms = rolePermissions.filter(rp => rp.role === role);
                  return (
                    <div key={role}>
                      <h3 className="font-semibold text-lg capitalize mb-3">
                        {role.replace(/_/g, ' ')}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {rolePerms.map(rp => (
                          <Badge key={`${role}-${rp.permission}`} variant="secondary">
                            {formatPermissionName(rp.permission)}
                          </Badge>
                        ))}
                      </div>
                      {role !== roles[roles.length - 1] && <Separator className="mt-4" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}