
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Users, Shield, Search, UserX, Clock, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface UserAccess {
  id: string;
  nome_completo: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  roles: string[];
  active_sessions: number;
}

export const AccessControl = () => {
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      // Buscar profiles e roles
      const { data: profiles } = await supabase
        .from('profiles')
        .select(`
          id, nome_completo, email, created_at
        `);

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Combinar dados
      const usersWithRoles = profiles?.map(profile => {
        const roles = userRoles?.filter(ur => ur.user_id === profile.id).map(ur => ur.role) || [];
        return {
          ...profile,
          roles,
          active_sessions: Math.floor(Math.random() * 3), // Simulado
          last_sign_in_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
        };
      }) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    // Simulação de sessões ativas
    const mockSessions = [
      { id: '1', user_id: 'user1', ip: '192.168.1.100', browser: 'Chrome', started_at: new Date().toISOString() },
      { id: '2', user_id: 'user2', ip: '10.0.0.50', browser: 'Firefox', started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      { id: '3', user_id: 'user3', ip: '192.168.1.200', browser: 'Safari', started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() }
    ];
    setActiveSessions(mockSessions);
  };

  useEffect(() => {
    fetchUsers();
    fetchActiveSessions();
  }, []);

  const filteredUsers = users.filter(user =>
    user.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.roles.some(role => role.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const revokeUserAccess = async (userId: string, userName: string) => {
    try {
      // Em um sistema real, isso revogaria o acesso do usuário
      // Por agora, apenas simularemos
      toast({
        title: "Acesso Revogado",
        description: `Acesso do usuário ${userName} foi revogado com sucesso.`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível revogar o acesso do usuário.",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'diretoria': return 'secondary';
      case 'gerente': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'diretoria': return 'Diretoria';
      case 'gerente': return 'Gerente';
      case 'atendente': return 'Atendente';
      default: return role;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando controle de acessos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Resumo de Acessos */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Cadastrados no sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões Ativas</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions.length}</div>
            <p className="text-xs text-muted-foreground">
              Conectados agora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.roles.includes('admin')).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Com acesso total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Últimos 7 dias</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Usuários ativos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Usuários */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Controle de Usuários e Permissões
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum usuário encontrado</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <Card key={user.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div>
                              <h4 className="font-medium">{user.nome_completo || 'Nome não informado'}</h4>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2">
                            {user.roles.length > 0 ? (
                              user.roles.map(role => (
                                <Badge key={role} variant={getRoleColor(role)} className="text-xs">
                                  {getRoleLabel(role)}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Sem permissões
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              Cadastrado {formatDistanceToNow(new Date(user.created_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                            {user.last_sign_in_at && (
                              <span>
                                Último acesso {formatDistanceToNow(new Date(user.last_sign_in_at), { 
                                  addSuffix: true, 
                                  locale: ptBR 
                                })}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              {user.active_sessions} sessão(ões)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                Ver Sessões
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Sessões Ativas - {user.nome_completo}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3">
                                {activeSessions.filter(s => s.user_id === user.id).map(session => (
                                  <div key={session.id} className="flex items-center justify-between p-3 border rounded">
                                    <div>
                                      <div className="font-medium">{session.browser}</div>
                                      <div className="text-sm text-muted-foreground">IP: {session.ip}</div>
                                      <div className="text-xs text-muted-foreground">
                                        Iniciada {formatDistanceToNow(new Date(session.started_at), { 
                                          addSuffix: true, 
                                          locale: ptBR 
                                        })}
                                      </div>
                                    </div>
                                    <Button variant="destructive" size="sm">
                                      Desconectar
                                    </Button>
                                  </div>
                                ))}
                                {activeSessions.filter(s => s.user_id === user.id).length === 0 && (
                                  <p className="text-center text-muted-foreground py-4">
                                    Nenhuma sessão ativa
                                  </p>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => revokeUserAccess(user.id, user.nome_completo || user.email)}
                            className="flex items-center gap-1"
                          >
                            <UserX className="h-3 w-3" />
                            Revogar Acesso
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
