import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, MapPin, Phone, Mail, User, Building, Calendar } from 'lucide-react';
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

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou cidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            {filteredFranqueados.length} franqueados encontrados
          </div>

          {filteredFranqueados.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  {searchTerm ? 'Nenhum franqueado encontrado com os filtros aplicados.' : 'Nenhum franqueado cadastrado.'}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFranqueados.map((franqueado) => (
                <Dialog key={franqueado.id}>
                  <DialogTrigger asChild>
                    <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border bg-white dark:bg-card relative overflow-hidden">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="p-1 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                            <User className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Search className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                        
                        <div className="space-y-1">
                          <div>
                            <CardTitle className="text-sm font-semibold leading-tight">
                              {franqueado.name || 'Franqueado'}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {franqueado.city || 'N/A'}, {franqueado.state || 'N/A'}
                            </p>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            <div>#{franqueado.id} • {getUnitDisplay(franqueado.unit_name, franqueado.unit_code)}</div>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0 pb-3 px-4">
                        <Badge 
                          variant="secondary" 
                          className="border-0 font-medium uppercase text-xs tracking-wide py-1 px-2 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                        >
                          {franqueado.franchisee_type || 'N/A'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        <User className="w-5 h-5" />
                        {franqueado.name || 'Franqueado'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-2">Informações Pessoais</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">ID:</span>
                                <span>{franqueado.id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Nome:</span>
                                <span>{franqueado.name || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Tipo:</span>
                                <Badge variant="secondary">{franqueado.franchisee_type || 'N/A'}</Badge>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Unidade</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Nome:</span>
                                <span>{getUnitDisplay(franqueado.unit_name, franqueado.unit_code)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-2">Localização</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Cidade:</span>
                                <span>{franqueado.city || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Estado:</span>
                                <span>{franqueado.state || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Contato</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-muted-foreground" />
                                <span>{franqueado.email || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3 text-muted-foreground" />
                                <span>{franqueado.phone || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>Criado em: {new Date(franqueado.CreatedAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Franqueados;