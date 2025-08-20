import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, MapPin, Phone, Mail, Building, Calendar } from 'lucide-react';
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
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | null>(null);

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
      case 'ativa': 
      case 'operação':
      case 'operacao':
        return 'bg-emerald-500';
      case 'em_construcao': 
      case 'implantação':
      case 'implantacao':
        return 'bg-amber-500';
      case 'planejamento': 
        return 'bg-blue-500';
      case 'parada':
      case 'inativa':
        return 'bg-gray-400';
      default: 
        return 'bg-slate-300';
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

        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cidade ou estado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="text-sm text-muted-foreground mb-4">
            {filteredUnidades.length} unidades encontradas
          </div>

          {filteredUnidades.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  {searchTerm ? 'Nenhuma unidade encontrada com os filtros aplicados.' : 'Nenhuma unidade cadastrada.'}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUnidades.map((unidade) => (
                <Dialog key={unidade.id}>
                  <DialogTrigger asChild>
                    <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border bg-white dark:bg-card relative overflow-hidden">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="p-1 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                            <Building className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Search className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                        
                        <div className="space-y-1">
                          <div>
                            <CardTitle className="text-sm font-semibold leading-tight">
                              {unidade.grupo || 'Unidade'}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {unidade.cidade || 'N/A'}, {unidade.estado || 'N/A'}
                            </p>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            <div>#{unidade.id.substring(0, 6)} • {unidade.modelo_loja || 'N/A'}</div>
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="pt-0 pb-3 px-4">
                        <Badge 
                          className={`${
                            unidade.fase_loja?.toLowerCase() === 'ativa' || unidade.fase_loja?.toLowerCase() === 'operação' || unidade.fase_loja?.toLowerCase() === 'operacao'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                              : unidade.fase_loja?.toLowerCase() === 'em_construcao' || unidade.fase_loja?.toLowerCase() === 'implantação' || unidade.fase_loja?.toLowerCase() === 'implantacao'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                              : unidade.fase_loja?.toLowerCase() === 'planejamento'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          } border-0 font-medium uppercase text-xs tracking-wide py-1 px-2`}
                        >
                          {unidade.fase_loja || 'N/A'}
                        </Badge>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-3">
                        <Building className="w-5 h-5" />
                        {unidade.grupo || 'Unidade'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold mb-2">Informações Básicas</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">ID:</span>
                                <span>{unidade.id}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Grupo:</span>
                                <span>{unidade.grupo || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Modelo:</span>
                                <Badge variant="outline">{unidade.modelo_loja || 'N/A'}</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Fase:</span>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${getFaseColor(unidade.fase_loja)}`}></div>
                                  <span>{unidade.fase_loja || 'N/A'}</span>
                                </div>
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
                                <span>{unidade.cidade || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Estado:</span>
                                <span>{unidade.estado || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Endereço:</span>
                                <span className="text-right">{unidade.endereco || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Contato</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="w-3 h-3 text-muted-foreground" />
                                <span>{unidade.email || 'N/A'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3 text-muted-foreground" />
                                <span>{unidade.telefone ? unidade.telefone.toString() : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>Criado em: {new Date(unidade.created_at).toLocaleDateString('pt-BR')}</span>
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

export default Unidades;