import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Eye } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Unidade {
  id: string;
  grupo: string;
  cidade: string;
  estado: string;
  endereco: string;
  email: string;
  telefone: number;
  modelo_loja: string;
  fase_loja: string;
  created_at: string;
}

const Unidades = () => {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUnidades();
  }, []);

  const fetchUnidades = async () => {
    try {
      const { data, error } = await supabase
        .from('unidades')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUnidades(data || []);
    } catch (error) {
      console.error('Error fetching unidades:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUnidades = unidades.filter(unidade =>
    unidade.grupo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unidade.cidade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unidade.estado?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFaseColor = (fase: string) => {
    switch (fase?.toLowerCase()) {
      case 'ativa': return 'bg-green-500';
      case 'em_construcao': return 'bg-yellow-500';
      case 'planejamento': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="space-y-6">
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
    <ProtectedRoute requiredRole="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Unidades</h2>
          <p className="text-muted-foreground">
            Gerencie todas as unidades da rede
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Unidades</CardTitle>
            <CardDescription>
              {filteredUnidades.length} unidades encontradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, cidade ou estado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Fase</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnidades.map((unidade) => (
                    <TableRow key={unidade.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{unidade.grupo || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {unidade.id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{unidade.cidade || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            {unidade.estado || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {unidade.modelo_loja || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-2 h-2 rounded-full ${getFaseColor(unidade.fase_loja)}`}
                          ></div>
                          {unidade.fase_loja || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{unidade.email || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            {unidade.telefone ? unidade.telefone.toString() : 'N/A'}
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
                  {filteredUnidades.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {searchTerm ? 'Nenhuma unidade encontrada com os filtros aplicados.' : 'Nenhuma unidade cadastrada.'}
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

export default Unidades;