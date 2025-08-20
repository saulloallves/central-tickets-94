import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useKnowledgeSuggestions } from '@/hooks/useKnowledgeSuggestions';
import { useKnowledgeArticles } from '@/hooks/useKnowledgeArticles';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, Eye, Check, X, Edit, Users } from 'lucide-react';

interface Equipe {
  id: string;
  nome: string;
  ativo: boolean;
}

export const KnowledgeHubTab = () => {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [selectedEquipe, setSelectedEquipe] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [approvalData, setApprovalData] = useState({
    titulo: '',
    conteudo: '',
    equipe_id: 'none',
    tags: [] as string[],
    tipo_midia: 'texto' as const
  });

  const { suggestions, loading: loadingSuggestions, fetchSuggestions, updateSuggestionStatus } = useKnowledgeSuggestions();
  const { articles, loading: loadingArticles, fetchArticles, createArticle } = useKnowledgeArticles();
  const { toast } = useToast();

  useEffect(() => {
    fetchEquipes();
  }, []);

  useEffect(() => {
    if (selectedEquipe && selectedEquipe !== 'all') {
      fetchSuggestions();
      fetchArticles({ equipe_id: selectedEquipe, ativo: true });
    } else {
      fetchSuggestions();
      fetchArticles({ ativo: true });
    }
  }, [selectedEquipe]);

  const fetchEquipes = async () => {
    try {
      const { data, error } = await supabase
        .from('equipes')
        .select('id, nome, ativo')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setEquipes(data || []);
    } catch (error) {
      console.error('Error fetching equipes:', error);
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const approvedSuggestions = suggestions.filter(s => s.status === 'approved');

  const filteredSuggestions = pendingSuggestions.filter(suggestion =>
    suggestion.texto_sugerido.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredArticles = articles.filter(article =>
    article.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.conteudo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApproveSuggestion = (suggestion: any) => {
    setSelectedSuggestion(suggestion);
    setApprovalData({
      titulo: `Artigo baseado em sugestão #${suggestion.id.slice(0, 8)}`,
      conteudo: suggestion.texto_sugerido,
      equipe_id: selectedEquipe !== 'all' ? selectedEquipe : 'none',
      tags: [],
      tipo_midia: 'texto'
    });
    setIsApprovalModalOpen(true);
  };

  const handleRejectSuggestion = async (suggestionId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    await updateSuggestionStatus(suggestionId, 'rejected', userData.user?.id);
  };

  const handlePublishArticle = async () => {
    try {
      const finalApprovalData = {
        ...approvalData,
        equipe_id: approvalData.equipe_id === 'none' ? undefined : approvalData.equipe_id
      };
      const articleData = await createArticle(finalApprovalData);
      
      if (articleData && selectedSuggestion) {
        // Link the suggestion to the created article
        const { data: userData } = await supabase.auth.getUser();
        await supabase
          .from('knowledge_suggestions')
          .update({ article_id: articleData.id })
          .eq('id', selectedSuggestion.id);

        await updateSuggestionStatus(selectedSuggestion.id, 'approved', userData.user?.id);
      }

      setIsApprovalModalOpen(false);
      setSelectedSuggestion(null);
      toast({
        title: "✅ Artigo Publicado",
        description: "Sugestão aprovada e convertida em artigo da base de conhecimento",
      });
    } catch (error) {
      console.error('Error publishing article:', error);
      toast({
        title: "Erro",
        description: "Não foi possível publicar o artigo",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Pendente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-300">Aprovada</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-300">Rejeitada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Hub de Conhecimento</h2>
          <p className="text-muted-foreground">Gerencie sugestões da IA e artigos da base de conhecimento</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-full sm:w-[200px]"
            />
          </div>
          
          <Select value={selectedEquipe} onValueChange={setSelectedEquipe}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filtrar por equipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as equipes</SelectItem>
              {equipes.map((equipe) => (
                <SelectItem key={equipe.id} value={equipe.id}>
                  {equipe.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sugestões Pendentes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingSuggestions.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Artigos Publicados</CardTitle>
            <Check className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{articles.filter(a => a.aprovado).length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sugestões Aprovadas</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedSuggestions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Content tabs */}
      <Tabs defaultValue="suggestions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="suggestions">
            Sugestões Pendentes ({filteredSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="articles">
            Artigos Publicados ({filteredArticles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-4">
          {loadingSuggestions ? (
            <div className="text-center py-8">Carregando sugestões...</div>
          ) : filteredSuggestions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Nenhuma sugestão pendente encontrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredSuggestions.map((suggestion) => (
                <Card key={suggestion.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(suggestion.status)}
                        <span className="text-sm text-muted-foreground">
                          {suggestion.modelo_provedor} • {new Date(suggestion.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApproveSuggestion(suggestion)}
                          className="gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectSuggestion(suggestion.id)}
                          className="gap-1 text-red-600 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm leading-relaxed line-clamp-3">
                        {suggestion.texto_sugerido}
                      </p>
                      {suggestion.tickets && (
                        <div className="text-xs text-muted-foreground">
                          Baseado no ticket: {suggestion.tickets.codigo_ticket}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="articles" className="space-y-4">
          {loadingArticles ? (
            <div className="text-center py-8">Carregando artigos...</div>
          ) : filteredArticles.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Nenhum artigo encontrado</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredArticles.map((article) => (
                <Card key={article.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{article.titulo}</CardTitle>
                      <div className="flex items-center gap-2">
                        {article.aprovado && (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            Aprovado
                          </Badge>
                        )}
                        {article.usado_pela_ia && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300">
                            Usado pela IA
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription>
                      Categoria: {article.categoria || 'Sem categoria'} • 
                      Criado em {new Date(article.created_at).toLocaleDateString('pt-BR')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed line-clamp-2">
                      {article.conteudo}
                    </p>
                    <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                      <span>👍 {article.feedback_positivo}</span>
                      <span>👎 {article.feedback_negativo}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Approval Modal */}
      <Dialog open={isApprovalModalOpen} onOpenChange={setIsApprovalModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aprovar e Publicar Artigo</DialogTitle>
            <DialogDescription>
              Revise e edite o conteúdo antes de publicar na base de conhecimento
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo">Título do Artigo</Label>
              <Input
                id="titulo"
                value={approvalData.titulo}
                onChange={(e) => setApprovalData({ ...approvalData, titulo: e.target.value })}
                placeholder="Digite o título do artigo"
              />
            </div>

            <div>
              <Label htmlFor="equipe">Equipe Responsável</Label>
              <Select 
                value={approvalData.equipe_id} 
                onValueChange={(value) => setApprovalData({ ...approvalData, equipe_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione uma equipe</SelectItem>
                  {equipes.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="conteudo">Conteúdo</Label>
              <Textarea
                id="conteudo"
                value={approvalData.conteudo}
                onChange={(e) => setApprovalData({ ...approvalData, conteudo: e.target.value })}
                rows={8}
                placeholder="Digite o conteúdo do artigo"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePublishArticle}>
              Publicar Artigo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};