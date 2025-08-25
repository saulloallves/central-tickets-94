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
      'supervisor': 'Supervisor',
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
      <div className="w-full space-y-4 md:space-y-6 pt-3 md:pt-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-3xl font-bold tracking-tight">Colaboradores</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              Gerencie todos os colaboradores da empresa
            </p>
          </div>
          <Button className="w-full md:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden md:inline">Novo Colaborador</span>
            <span className="md:hidden">Novo</span>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Lista de Colaboradores</CardTitle>
            <CardDescription className="text-xs md:text-sm">
              {filteredColaboradores.length} colaboradores encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-3 md:mb-4">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:max-w-sm text-xs md:text-sm"
              />
            </div>

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs md:text-sm min-w-[140px]">Colaborador</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[80px]">Cargo</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[70px]">Status</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[80px] hidden sm:table-cell">Unidade</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[100px] hidden md:table-cell">Remuneração</TableHead>
                    <TableHead className="text-xs md:text-sm min-w-[120px] hidden lg:table-cell">Contato</TableHead>
                    <TableHead className="text-xs md:text-sm w-12">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredColaboradores.map((colaborador) => (
                    <TableRow key={colaborador.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold text-xs md:text-sm line-clamp-1">{colaborador.nome_completo}</div>
                          <div className="text-[10px] md:text-xs text-muted-foreground line-clamp-1">
                            CPF: {colaborador.cpf}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] md:text-xs px-1 py-0.5">
                          {getCargoDisplay(colaborador.cargo)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 md:gap-2">
                          <div 
                            className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${getStatusColor(colaborador.status)}`}
                          ></div>
                          <span className="text-xs md:text-sm">{colaborador.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className="text-[9px] md:text-xs px-1 py-0.5">
                          {colaborador.unidade_id || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs md:text-sm">
                        {colaborador.remuneracao 
                          ? `R$ ${colaborador.remuneracao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div>
                          <div className="text-xs line-clamp-1">{colaborador.email}</div>
                          <div className="text-[10px] text-muted-foreground line-clamp-1">
                            {colaborador.telefone || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Eye className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredColaboradores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 md:py-8">
                        <div className="text-xs md:text-sm text-muted-foreground">
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