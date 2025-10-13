import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, MapPin, Phone, Mail, User, Building, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Franqueado {
  id: string;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  const ITEMS_PER_PAGE = 24; // 12 items per page

  useEffect(() => {
    fetchFranqueados();
  }, [currentPage, searchTerm]);

  const fetchFranqueados = async () => {
    try {
      setSearchLoading(true);
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('franqueados')
        .select('*', { count: 'exact' })
        .order('CreatedAt', { ascending: false })
        .range(from, to);

      // Se há busca, aplicar filtros
      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      
      setFranqueados(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching franqueados:', error);
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

  const getUnitDisplay = (unitName: any, unitCode: any) => {
    if (typeof unitName === 'string') return unitName;
    if (typeof unitCode === 'string') return unitCode;
    if (Array.isArray(unitName) && unitName.length > 0) return unitName[0];
    if (Array.isArray(unitCode) && unitCode.length > 0) return unitCode[0];
    return 'N/A';
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
          <h2 className="text-xl md:text-3xl font-bold tracking-tight">Franqueados</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Gerencie todos os franqueados da rede
          </p>
        </div>

        <div className="space-y-3 md:space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou cidade..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full md:max-w-sm"
              />
            </div>
            
            {/* Info de paginação */}
            <div className="text-xs md:text-sm text-muted-foreground">
              {totalCount > 0 && (
                <>
                  Pág {currentPage}/{totalPages} • {totalCount} franqueados
                </>
              )}
            </div>
          </div>

          {searchLoading && (
            <div className="text-center text-xs md:text-sm text-muted-foreground">
              Carregando...
            </div>
          )}

          {franqueados.length === 0 && !searchLoading ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground">
                  {searchTerm ? 'Nenhum franqueado encontrado com os filtros aplicados.' : 'Nenhum franqueado cadastrado.'}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                {franqueados.map((franqueado) => (
                  <Dialog key={franqueado.id}>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border bg-white dark:bg-card relative overflow-hidden">
                        <CardHeader className="pb-2 pt-2 md:pt-3 px-3 md:px-4">
                          <div className="flex items-start justify-between mb-1 md:mb-2">
                            <div className="p-1 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                              <User className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <Button variant="ghost" size="sm" className="h-5 w-5 md:h-6 md:w-6 p-0">
                              <Search className="w-2.5 h-2.5 md:w-3 md:h-3 text-muted-foreground" />
                            </Button>
                          </div>
                          
                          <div className="space-y-1">
                            <div>
                              <CardTitle className="text-xs md:text-sm font-semibold leading-tight line-clamp-1">
                                {franqueado.name || 'Franqueado'}
                              </CardTitle>
                              <p className="text-[10px] md:text-xs text-muted-foreground line-clamp-1">
                                {franqueado.city || 'N/A'}, {franqueado.state || 'N/A'}
                              </p>
                            </div>
                            
                            <div className="text-[10px] md:text-xs text-muted-foreground">
                              <div className="line-clamp-1">#{franqueado.id} • {getUnitDisplay(franqueado.unit_name, franqueado.unit_code)}</div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="pt-0 pb-2 md:pb-3 px-3 md:px-4">
                          <Badge 
                            variant="secondary" 
                            className="border-0 font-medium uppercase text-[9px] md:text-xs tracking-wide py-0.5 md:py-1 px-1.5 md:px-2 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                          >
                            {franqueado.franchisee_type || 'N/A'}
                          </Badge>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 md:gap-3 text-base md:text-lg">
                          <User className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="line-clamp-1">{franqueado.name || 'Franqueado'}</span>
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 md:space-y-6">
                        <div className="grid grid-cols-1 gap-4 md:gap-6">
                          <div className="space-y-3 md:space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2 text-sm md:text-base">Informações Pessoais</h4>
                              <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">ID:</span>
                                  <span className="font-medium">{franqueado.id}</span>
                                </div>
                                <div className="flex justify-between items-start gap-2">
                                  <span className="text-muted-foreground flex-shrink-0">Nome:</span>
                                  <span className="text-right break-words">{franqueado.name || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Tipo:</span>
                                  <Badge variant="secondary" className="text-xs">{franqueado.franchisee_type || 'N/A'}</Badge>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold mb-2 text-sm md:text-base">Unidade</h4>
                              <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                                <div className="flex justify-between items-start gap-2">
                                  <span className="text-muted-foreground flex-shrink-0">Nome:</span>
                                  <span className="text-right break-words">{getUnitDisplay(franqueado.unit_name, franqueado.unit_code)}</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold mb-2 text-sm md:text-base">Localização</h4>
                              <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Cidade:</span>
                                  <span className="font-medium">{franqueado.city || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Estado:</span>
                                  <span className="font-medium">{franqueado.state || 'N/A'}</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold mb-2 text-sm md:text-base">Contato</h4>
                              <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  <span className="break-all text-xs">{franqueado.email || 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  <span>{franqueado.phone || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 md:pt-4 border-t">
                          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3 flex-shrink-0" />
                            <span>Criado em: {new Date(franqueado.CreatedAt).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
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

export default Franqueados;