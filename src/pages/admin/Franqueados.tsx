import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Eye } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Franqueado {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  franchisee_type: string;
  unit_name: any;
  unit_code: any;
  CreatedAt: string;
}

const Franqueados = () => {
  const [franqueados, setFranqueados] = useState<Franqueado[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchFranqueados();
  }, []);

  const fetchFranqueados = async () => {
    try {
      const { data, error } = await supabase
        .from('franqueados')
        .select('*')
        .order('CreatedAt', { ascending: false });

      if (error) throw error;
      setFranqueados(data || []);
    } catch (error) {
      console.error('Error fetching franqueados:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFranqueados = franqueados.filter(franqueado =>
    franqueado.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    franqueado.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    franqueado.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUnitDisplay = (unitName: any, unitCode: any) => {
    if (typeof unitName === 'string') return unitName;
    if (typeof unitCode === 'string') return unitCode;
    if (Array.isArray(unitName) && unitName.length > 0) return unitName[0];
    if (Array.isArray(unitCode) && unitCode.length > 0) return unitCode[0];
    return 'N/A';
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
          <h2 className="text-3xl font-bold tracking-tight">Franqueados</h2>
          <p className="text-muted-foreground">
            Gerencie todos os franqueados da rede
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Franqueados</CardTitle>
            <CardDescription>
              {filteredFranqueados.length} franqueados encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Franqueado</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFranqueados.map((franqueado) => (
                    <TableRow key={franqueado.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div className="font-semibold">{franqueado.name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {franqueado.id}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getUnitDisplay(franqueado.unit_name, franqueado.unit_code)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{franqueado.city || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            {franqueado.state || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {franqueado.franchisee_type || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{franqueado.email || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            {franqueado.phone || 'N/A'}
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
                  {filteredFranqueados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {searchTerm ? 'Nenhum franqueado encontrado com os filtros aplicados.' : 'Nenhum franqueado cadastrado.'}
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

export default Franqueados;