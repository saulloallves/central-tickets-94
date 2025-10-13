import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, MapPin, Phone, Mail, Building, Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ImportUnidadesButton } from '@/components/unidades/ImportUnidadesButton';
import { cn } from '@/lib/utils';

interface Unidade {
  id: string;
  grupo: string;
  codigo_grupo?: string;
  cidade?: string;
  estado?: string;
  uf?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  email?: string;
  telefone?: string;
  modelo_loja?: string;
  fase_loja?: string;
  etapa_loja?: string;
  operation_mon?: string;
  operation_tue?: string;
  operation_wed?: string;
  operation_thu?: string;
  operation_fri?: string;
  operation_sat?: string;
  operation_sun?: string;
  operation_hol?: string;
  instagram?: string;
  has_parking?: any;
  parking_spots?: any;
  has_partner_parking?: any;
  partner_parking_address?: string;
  purchases_active?: any;
  sales_active?: any;
  created_at: string;
  updated_at?: string;
}

const Unidades = () => {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  const ITEMS_PER_PAGE = 24; // 12 items per page

  useEffect(() => {
    fetchUnidades();
  }, [currentPage, searchTerm]);

  const fetchUnidades = async () => {
    try {
      setSearchLoading(true);
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('unidades')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      // Se há busca, aplicar filtros  
      if (searchTerm.trim()) {
        query = query.or(`grupo.ilike.%${searchTerm}%,cidade.ilike.%${searchTerm}%,estado.ilike.%${searchTerm}%,uf.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      setUnidades(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching unidades:', error);
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  };

  // Reset page when search changes
  useEffect(() => {
    if (searchTerm !== '') {
      setCurrentPage(1);
    }
  }, [searchTerm]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

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
      <ProtectedRoute requiredPermissions={['view_all_tickets', 'view_team_tickets']} requireAll={false}>
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
    <ProtectedRoute requiredPermissions={['view_all_tickets', 'view_team_tickets']} requireAll={false}>
      <div className="w-full space-y-4 md:space-y-6 pt-3 md:pt-6">
        <div>
          <h2 className="text-xl md:text-3xl font-bold tracking-tight">Unidades</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Gerencie todas as unidades da rede
          </p>
        </div>

        <div className="space-y-3 md:space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center space-x-2 flex-1">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, cidade ou estado..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full md:max-w-sm"
              />
            </div>
            
            <ImportUnidadesButton />
            
            {/* Info de paginação */}
            <div className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
              {totalCount > 0 && (
                <>
                  Pág {currentPage}/{totalPages} • {totalCount} unidades
                </>
              )}
            </div>
          </div>

          {unidades.length === 0 && !searchLoading ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  {searchTerm ? 'Nenhuma unidade encontrada com os filtros aplicados.' : 'Nenhuma unidade cadastrada.'}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="relative">
                {searchLoading && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg min-h-[400px]">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground font-medium">Carregando unidades...</p>
                    </div>
                  </div>
                )}
                
                <div className={cn(
                  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4 md:gap-5 lg:gap-6 transition-opacity duration-200",
                  searchLoading && "opacity-50 pointer-events-none"
                )}>
                {unidades.map((unidade) => (
                  <Dialog key={unidade.id}>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border bg-white dark:bg-card relative overflow-hidden">
                        <CardHeader className="pb-2 pt-2 md:pt-3 px-3 md:px-4">
                          <div className="flex items-start justify-between mb-1 md:mb-2">
                            <div className="p-1 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                              <Building className="w-3 h-3 md:w-3.5 md:h-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <Button variant="ghost" size="sm" className="h-5 w-5 md:h-6 md:w-6 p-0">
                              <Search className="w-2.5 h-2.5 md:w-3 md:h-3 text-muted-foreground" />
                            </Button>
                          </div>
                          
                          <div className="space-y-1">
                            <div>
                              <CardTitle className="text-xs md:text-sm font-semibold leading-tight line-clamp-1">
                                {unidade.grupo || 'Unidade'}
                              </CardTitle>
                              <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1">
                                {unidade.cidade || unidade.grupo?.split(' / ')[1] || 'N/A'}, {unidade.estado || unidade.uf || unidade.grupo?.split(' / ')[2] || 'N/A'}
                              </p>
                            </div>
                            
                            <div className="text-[10px] md:text-xs text-muted-foreground">
                              <div className="line-clamp-1">#{unidade.id.substring(0, 6)} • {unidade.modelo_loja || 'N/A'}</div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0 pb-2 md:pb-3 px-3 md:px-4">
                          <Badge 
                            className={`${
                              unidade.fase_loja?.toLowerCase() === 'ativa' || unidade.fase_loja?.toLowerCase() === 'operação' || unidade.fase_loja?.toLowerCase() === 'operacao'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : unidade.fase_loja?.toLowerCase() === 'em_construcao' || unidade.fase_loja?.toLowerCase() === 'implantação' || unidade.fase_loja?.toLowerCase() === 'implantacao'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                                : unidade.fase_loja?.toLowerCase() === 'planejamento'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            } border-0 font-medium uppercase text-[9px] md:text-xs tracking-wide py-0.5 md:py-1 px-1.5 md:px-2`}
                          >
                            {unidade.fase_loja || 'N/A'}
                          </Badge>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
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
                                  <span>{unidade.cidade || unidade.grupo?.split(' / ')[1] || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Estado:</span>
                                  <span>{unidade.estado || unidade.uf || unidade.grupo?.split(' / ')[2] || 'N/A'}</span>
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
              </div>

              {/* Controles de paginação */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6 md:pt-8 pb-4 md:pb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || searchLoading}
                    className="w-full sm:w-auto"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden md:inline">Anterior</span>
                    <span className="md:hidden">Ant</span>
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {/* Mostrar algumas páginas ao redor da atual */}
                    {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 2, currentPage - 1)) + i;
                      if (pageNum > totalPages) return null;
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          disabled={searchLoading}
                          className="w-8 h-8 md:w-10 md:h-10 text-xs md:text-sm"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || searchLoading}
                    className="w-full sm:w-auto"
                  >
                    <span className="hidden md:inline">Próxima</span>
                    <span className="md:hidden">Prox</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Unidades;