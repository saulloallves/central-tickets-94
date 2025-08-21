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
import { CreateMemoryModal } from './CreateMemoryModal';
import { Search, Eye, Check, X, Edit, Users, Download, FileText, Plus, BookOpen, Brain, Trash2 } from 'lucide-react';

// Extended type for KnowledgeArticle with new fields
interface ExtendedKnowledgeArticle {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string | null;
  subcategoria?: string | null;
  equipe_id: string | null;
  tags: string[] | null;
  tipo_midia: string;
  aprovado: boolean;
  usado_pela_ia: boolean;
  feedback_positivo: number;
  feedback_negativo: number;
  created_at: string;
  estilo?: string | null;
  arquivo_path?: string | null;
  classificacao?: any;
}

interface Equipe {
  id: string;
  nome: string;
  ativo: boolean;
}

interface RAGDocument {
  id: number;
  content: string;
  metadata: any;
  embedding?: any;
}

export const KnowledgeHubTab = () => {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>([]);
  const [selectedEquipe, setSelectedEquipe] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateMemoryModalOpen, setIsCreateMemoryModalOpen] = useState(false);
  const [selectedRAGDoc, setSelectedRAGDoc] = useState<RAGDocument | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, importing: false });
  
  const [approvalData, setApprovalData] = useState({
    titulo: '',
    conteudo: '',
    equipe_id: 'none',
    tags: [] as string[],
    tipo_midia: 'texto' as const
  });

  const [editData, setEditData] = useState({
    id: '',
    titulo: '',
    conteudo: '',
    equipe_id: 'none',
    tags: [] as string[],
    tipo_midia: 'texto' as const,
    aprovado: false,
    usado_pela_ia: false
  });

  const { suggestions, loading: loadingSuggestions, fetchSuggestions, updateSuggestionStatus } = useKnowledgeSuggestions();
  const { articles, loading: loadingArticles, fetchArticles, createArticle, updateArticle } = useKnowledgeArticles();
  const { toast } = useToast();

  const deleteArticle = async (articleId: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_articles')
        .delete()
        .eq('id', articleId);

      if (error) throw error;

      toast({
        title: "✅ Artigo Excluído",
        description: "Artigo removido da base de conhecimento",
      });
      
      fetchArticles();
    } catch (error) {
      console.error('Error deleting article:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o artigo",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchEquipes();
    fetchRAGDocuments();
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

  const fetchRAGDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('RAG DOCUMENTOS')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      setRagDocuments(data || []);
    } catch (error) {
      console.error('Error fetching RAG documents:', error);
    }
  };

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

  // Cast articles to extended type and separate by style  
  const extendedArticles = articles as ExtendedKnowledgeArticle[];
  const regularArticles = extendedArticles.filter(a => !a.estilo);
  const memoryArticles = extendedArticles.filter(a => a.estilo);

  const filteredSuggestions = pendingSuggestions.filter(suggestion =>
    suggestion.texto_sugerido.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredArticles = regularArticles.filter(article =>
    article.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.conteudo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMemories = memoryArticles.filter(memory =>
    memory.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    memory.conteudo.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleEditArticle = (article: any) => {
    setSelectedArticle(article);
    setEditData({
      id: article.id,
      titulo: article.titulo,
      conteudo: article.conteudo,
      equipe_id: article.equipe_id || 'none',
      tags: article.tags || [],
      tipo_midia: article.tipo_midia,
      aprovado: article.aprovado,
      usado_pela_ia: article.usado_pela_ia
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateArticle = async () => {
    try {
      const finalEditData = {
        ...editData,
        equipe_id: editData.equipe_id === 'none' ? undefined : editData.equipe_id
      };
      
      await updateArticle(editData.id, finalEditData);
      
      setIsEditModalOpen(false);
      setSelectedArticle(null);
      toast({
        title: "✅ Artigo Atualizado",
        description: "Alterações salvas com sucesso",
      });
    } catch (error) {
      console.error('Error updating article:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o artigo",
        variant: "destructive",
      });
    }
  };

  const handleImportRAGDocument = async (ragDoc: RAGDocument) => {
    setSelectedRAGDoc(ragDoc);
    const title = ragDoc.metadata?.title || ragDoc.metadata?.source || `Documento ${ragDoc.id}`;
    setApprovalData({
      titulo: title,
      conteudo: ragDoc.content,
      equipe_id: selectedEquipe !== 'all' ? selectedEquipe : 'none',
      tags: ragDoc.metadata?.tags || [],
      tipo_midia: 'texto'
    });
    setIsImportModalOpen(true);
  };

  const handleImportAllRAGDocuments = async () => {
    if (ragDocuments.length === 0) return;
    
    setImportProgress({ current: 0, total: ragDocuments.length, importing: true });
    
    try {
      for (let i = 0; i < ragDocuments.length; i++) {
        const ragDoc = ragDocuments[i];
        const title = ragDoc.metadata?.title || ragDoc.metadata?.source || `Documento ${ragDoc.id}`;
        
        await createArticle({
          titulo: title,
          conteudo: ragDoc.content,
          equipe_id: selectedEquipe !== 'all' ? selectedEquipe : undefined,
          tags: ragDoc.metadata?.tags || [],
          tipo_midia: 'texto',
          usado_pela_ia: true
        });
        
        setImportProgress(prev => ({ ...prev, current: i + 1 }));
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      toast({
        title: "✅ Importação Concluída",
        description: `${ragDocuments.length} documentos foram importados para a base de conhecimento`,
      });
      
    } catch (error) {
      console.error('Error importing RAG documents:', error);
      toast({
        title: "Erro na Importação",
        description: "Alguns documentos podem não ter sido importados",
        variant: "destructive",
      });
    } finally {
      setImportProgress({ current: 0, total: 0, importing: false });
    }
  };

  const handleActivateAllForAI = async () => {
    if (filteredArticles.length === 0) return;
    
    try {
      const updatePromises = filteredArticles.map(article => 
        updateArticle(article.id, { usado_pela_ia: true })
      );
      
      await Promise.all(updatePromises);
      
      toast({
        title: "✅ Todos Ativados para IA",
        description: `${filteredArticles.length} artigos foram ativados para uso pela IA`,
      });
      
    } catch (error) {
      console.error('Error activating all articles for AI:', error);
      toast({
        title: "Erro",
        description: "Não foi possível ativar todos os artigos",
        variant: "destructive",
      });
    }
  };

  const handleApproveAll = async () => {
    if (filteredArticles.length === 0) return;
    
    try {
      const updatePromises = filteredArticles.map(article => 
        updateArticle(article.id, { aprovado: true })
      );
      
      await Promise.all(updatePromises);
      
      toast({
        title: "✅ Todos Aprovados",
        description: `${filteredArticles.length} artigos foram aprovados`,
      });
      
    } catch (error) {
      console.error('Error approving all articles:', error);
      toast({
        title: "Erro",
        description: "Não foi possível aprovar todos os artigos",
        variant: "destructive",
      });
    }
  };

  const handleConfirmImport = async () => {
    try {
      const finalApprovalData = {
        ...approvalData,
        equipe_id: approvalData.equipe_id === 'none' ? undefined : approvalData.equipe_id,
        usado_pela_ia: true
      };
      
      await createArticle(finalApprovalData);
      
      setIsImportModalOpen(false);
      setSelectedRAGDoc(null);
      
      toast({
        title: "✅ Documento Importado",
        description: "Documento RAG convertido em artigo da base de conhecimento",
      });
    } catch (error) {
      console.error('Error importing RAG document:', error);
      toast({
        title: "Erro",
        description: "Não foi possível importar o documento",
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

  const getEstiloBadge = (estilo?: string | null) => {
    if (!estilo) return null;
    
    switch (estilo) {
      case 'diretrizes':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-300">📋 Diretrizes</Badge>;
      case 'manual':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-300">📚 Manual</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Hub de Conhecimento</h2>
          <p className="text-muted-foreground">Gerencie sugestões da IA, artigos e memórias da base de conhecimento</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsCreateMemoryModalOpen(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Novo Artigo
          </Button>
          
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
      <div className="grid gap-4 md:grid-cols-4">
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
            <div className="text-2xl font-bold">{regularArticles.filter(a => a.aprovado).length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memórias Processadas</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memoryArticles.length}</div>
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
      <Tabs defaultValue="memories" className="space-y-4">
        <TabsList>
          <TabsTrigger value="memories">
            Memórias ({filteredMemories.length})
          </TabsTrigger>
          <TabsTrigger value="suggestions">
            Sugestões Pendentes ({filteredSuggestions.length})
          </TabsTrigger>
          <TabsTrigger value="articles">
            Artigos Publicados ({filteredArticles.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="memories" className="space-y-4">
          {loadingArticles ? (
            <div className="text-center py-8">Carregando memórias...</div>
          ) : filteredMemories.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Nenhuma memória encontrada</p>
                <Button onClick={() => setIsCreateMemoryModalOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar primeira memória
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {filteredMemories.length} memórias encontradas
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleApproveAll}
                    variant="outline"
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Aprovar Todas
                  </Button>
                  <Button 
                    onClick={handleActivateAllForAI}
                    variant="outline"
                    className="gap-2"
                  >
                    <Brain className="h-4 w-4" />
                    Ativar Todas para IA
                  </Button>
                </div>
              </div>
              
              {filteredMemories.map((memory) => (
                <Card key={memory.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <CardTitle className="text-lg">{memory.titulo}</CardTitle>
                        {getEstiloBadge(memory.estilo)}
                      </div>
                       <div className="flex items-center gap-2">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleEditArticle(memory)}
                           className="gap-1"
                         >
                           <Edit className="h-3 w-3" />
                           Editar
                         </Button>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => deleteArticle(memory.id)}
                           className="gap-1 text-red-600 hover:text-red-700"
                         >
                           <Trash2 className="h-3 w-3" />
                           Excluir
                         </Button>
                        {memory.aprovado && (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            Aprovado
                          </Badge>
                        )}
                        {memory.usado_pela_ia && (
                          <Badge variant="outline" className="text-blue-600 border-blue-300">
                            Usado pela IA
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <span>Categoria: {memory.categoria || 'Sem categoria'}</span>
                      {memory.subcategoria && (
                        <>
                          <span>•</span>
                          <span>Subcategoria: {memory.subcategoria}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Criado em {new Date(memory.created_at).toLocaleDateString('pt-BR')}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed line-clamp-2">
                      {memory.conteudo}
                    </p>
                    <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                      <span>👍 {memory.feedback_positivo}</span>
                      <span>👎 {memory.feedback_negativo}</span>
                      {memory.arquivo_path && (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Arquivo anexado
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

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
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {filteredArticles.length} artigos encontrados
                </p>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleApproveAll}
                    variant="outline"
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Aprovar Todos
                  </Button>
                  <Button 
                    onClick={handleActivateAllForAI}
                    variant="outline"
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Ativar Todos para IA
                  </Button>
                </div>
              </div>
                {filteredArticles.map((article) => (
                <Card key={article.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{article.titulo}</CardTitle>
                       <div className="flex items-center gap-2">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleEditArticle(article)}
                           className="gap-1"
                         >
                           <Edit className="h-3 w-3" />
                           Editar
                         </Button>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => deleteArticle(article.id)}
                           className="gap-1 text-red-600 hover:text-red-700"
                         >
                           <Trash2 className="h-3 w-3" />
                           Excluir
                         </Button>
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

      {/* Create Memory Modal */}
      <CreateMemoryModal
        open={isCreateMemoryModalOpen}
        onOpenChange={setIsCreateMemoryModalOpen}
        onSuccess={() => {
          fetchArticles();
        }}
      />

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

      {/* Edit Article Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Artigo</DialogTitle>
            <DialogDescription>
              Faça as alterações necessárias no artigo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-titulo">Título do Artigo</Label>
              <Input
                id="edit-titulo"
                value={editData.titulo}
                onChange={(e) => setEditData({ ...editData, titulo: e.target.value })}
                placeholder="Digite o título do artigo"
              />
            </div>

            <div>
              <Label htmlFor="edit-equipe">Equipe Responsável</Label>
              <Select 
                value={editData.equipe_id} 
                onValueChange={(value) => setEditData({ ...editData, equipe_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem equipe específica</SelectItem>
                  {equipes.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit-conteudo">Conteúdo</Label>
              <Textarea
                id="edit-conteudo"
                value={editData.conteudo}
                onChange={(e) => setEditData({ ...editData, conteudo: e.target.value })}
                rows={8}
                placeholder="Digite o conteúdo do artigo"
              />
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-aprovado"
                  checked={editData.aprovado}
                  onChange={(e) => setEditData({ ...editData, aprovado: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="edit-aprovado">Artigo aprovado</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-usado-ia"
                  checked={editData.usado_pela_ia}
                  onChange={(e) => setEditData({ ...editData, usado_pela_ia: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="edit-usado-ia">Usado pela IA</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateArticle}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import RAG Document Modal */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Documento RAG</DialogTitle>
            <DialogDescription>
              Revise as informações antes de importar para a base de conhecimento
            </DialogDescription>
          </DialogHeader>
          
          {selectedRAGDoc ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="import-titulo">Título do Artigo</Label>
                <Input
                  id="import-titulo"
                  value={approvalData.titulo}
                  onChange={(e) => setApprovalData({ ...approvalData, titulo: e.target.value })}
                  placeholder="Digite o título do artigo"
                />
              </div>

              <div>
                <Label htmlFor="import-equipe">Equipe Responsável</Label>
                <Select 
                  value={approvalData.equipe_id} 
                  onValueChange={(value) => setApprovalData({ ...approvalData, equipe_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem equipe específica</SelectItem>
                    {equipes.map((equipe) => (
                      <SelectItem key={equipe.id} value={equipe.id}>
                        {equipe.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="import-conteudo">Conteúdo</Label>
                <Textarea
                  id="import-conteudo"
                  value={approvalData.conteudo}
                  onChange={(e) => setApprovalData({ ...approvalData, conteudo: e.target.value })}
                  rows={8}
                  placeholder="Conteúdo do documento"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  ✅ Este documento será automaticamente marcado como "Usado pela IA"
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p>Selecione documentos RAG para importar:</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {ragDocuments.map((ragDoc) => (
                  <div 
                    key={ragDoc.id} 
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedRAGDoc(ragDoc)}
                  >
                    <h4 className="font-medium">
                      {ragDoc.metadata?.title || ragDoc.metadata?.source || `Documento ${ragDoc.id}`}
                    </h4>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {ragDoc.content?.substring(0, 150)}...
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsImportModalOpen(false);
              setSelectedRAGDoc(null);
            }}>
              Cancelar
            </Button>
            {selectedRAGDoc ? (
              <Button onClick={handleConfirmImport}>
                Importar Documento
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
