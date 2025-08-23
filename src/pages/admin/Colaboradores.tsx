import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Eye, Plus } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Colaborador {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  telefone: string;
  cargo: string;
  status: string;
  unidade_id: string;
  data_admissao: string;
  beneficios: string[];
  remuneracao: number;
  created_at: string;
}

const Colaboradores = () => {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchColaboradores();
  }, []);

  const fetchColaboradores = async () => {
    try {
      const { data, error } = await supabase
        .from('colaboradores')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setColaboradores(data || []);
    } catch (error) {
      console.error('Error fetching colaboradores:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredColaboradores = colaboradores.filter(colaborador =>
    colaborador.nome_completo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    colaborador.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    colaborador.cargo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ativo': return 'bg-green-500';
      case 'inativo': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getCargoDisplay = (cargo: string) => {
    const cargoMap: { [key: string]: string } = {
      'caixa': 'Caixa',
      'avaliador': 'Avaliador',
      'midia': 'Mídia',
      'rh': 'RH',
      'gerente': 'Gerente',
      'diretor': 'Diretor',
      'admin': 'Administrador'
    };
    return cargoMap[cargo] || cargo;
  };

  if (loading) {
    return (
      <ProtectedRoute requiredPermission="view_all_tickets">
        <div className="w-full space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-48 mb-2"></div>
            <div className="h-4 bg-muted rounded w-96"></div>
          </div>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex space-x-4 animate-pulse">
                    <div className="h-4 bg-muted rounded flex-1"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission="view_all_tickets">
      <div className="w-full space-y-6 pt-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Colaboradores</h2>
            <p className="text-muted-foreground">
              Gerencie todos os colaboradores da empresa
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo Colaborador
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Colaboradores</CardTitle>
            <CardDescription>
              {filteredColaboradores.length} colaboradores encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Remuneração</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredColaboradores.map((colaborador) => (
                    <TableRow key={colaborador.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{colaborador.nome_completo}</div>
                          <div className="text-sm text-muted-foreground">
                            CPF: {colaborador.cpf}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getCargoDisplay(colaborador.cargo)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-2 h-2 rounded-full ${getStatusColor(colaborador.status)}`}
                          ></div>
                          {colaborador.status}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {colaborador.unidade_id || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {colaborador.remuneracao 
                          ? `R$ ${colaborador.remuneracao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{colaborador.email}</div>
                          <div className="text-sm text-muted-foreground">
                            {colaborador.telefone || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredColaboradores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {searchTerm ? 'Nenhum colaborador encontrado com os filtros aplicados.' : 'Nenhum colaborador cadastrado.'}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
};

export default Colaboradores;