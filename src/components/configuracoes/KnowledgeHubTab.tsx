import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, FileText, AlertTriangle, Database, TrendingUp, Shield, CheckCircle, Bot, Sparkles, Settings, FileUp, FilePlus, X, Info, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { useRAGDocuments } from '@/hooks/useRAGDocuments';
import { SimilarDocumentsModal } from './SimilarDocumentsModal';
import { SemanticAnalysisModal } from './SemanticAnalysisModal';
import { RegenerateEmbeddingsButton } from './RegenerateEmbeddingsButton';
import { supabase } from '@/integrations/supabase/client';

import { useRegenerateEmbeddings } from '@/hooks/useRegenerateEmbeddings';
const KnowledgeHubTab = () => {
  const {
    documents,
    loading,
    pagination,
    fetchDocuments,
    createDocument,
    updateDocument,
    updateDocumentStatus,
    runAudit
  } = useRAGDocuments();
  const {
    regenerateEmbeddings,
    loading: regeneratingEmbeddings
  } = useRegenerateEmbeddings();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [estiloFilter, setEstiloFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [showSimilarDocumentsModal, setShowSimilarDocumentsModal] = useState(false);
  const [showSemanticAnalysisModal, setShowSemanticAnalysisModal] = useState(false);
  const [similarDocuments, setSimilarDocuments] = useState([]);
  const [pendingDocumentData, setPendingDocumentData] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [newDocument, setNewDocument] = useState({
    titulo: '',
    conteudo: '',
    categoria: '',
    tipo: 'permanente' as 'permanente' | 'temporario',
    valido_ate: '',
    tags: '',
    justificativa: '',
    estilo: '' as '' | 'manual' | 'diretriz',
    process_with_ai: false
  });
  const handleCreateDocument = async () => {
    const documentData = {
      ...newDocument,
      tags: newDocument.tags.split(',').map(t => t.trim()).filter(Boolean),
      estilo: newDocument.estilo || undefined,
      process_with_ai: newDocument.process_with_ai && !!newDocument.estilo
    };
    // Starting semantic analysis

    // Sempre abrir o modal de análise semântica primeiro
    setPendingDocumentData(documentData);
    setShowSemanticAnalysisModal(true);
  };
  const handleAnalysisComplete = (result: any) => {
    // Semantic analysis completed
    setAnalysisResult(result);
    setSimilarDocuments(result.similarDocuments || []);
  };
  const handleCreateNew = async () => {
    if (!pendingDocumentData) return;
    console.log('Criando documento após análise:', pendingDocumentData);
    const result = await createDocument({
      ...pendingDocumentData,
      force: true // Forçar criação mesmo com duplicatas
    });
    setShowSemanticAnalysisModal(false);
    setShowSimilarDocumentsModal(false);
    setSimilarDocuments([]);
    setPendingDocumentData(null);
    setAnalysisResult(null);
    if (result.success) {
      console.log('Documento criado com sucesso!');
      setIsCreateDialogOpen(false);
      setNewDocument({
        titulo: '',
        conteudo: '',
        categoria: '',
        tipo: 'permanente',
        valido_ate: '',
        tags: '',
        justificativa: '',
        estilo: '',
        process_with_ai: false
      });
    }
  };
  const handleUpdateExisting = async (documentId: string, updateType?: 'full' | 'partial', textToReplace?: string) => {
    // Document update started
    if (!pendingDocumentData) {
      console.error('❌ Nenhum dado pendente para atualização');
      alert('Erro: Nenhum dado pendente para atualização');
      return;
    }
    try {
      const updateData = {
        titulo: pendingDocumentData.titulo,
        conteudo: pendingDocumentData.conteudo,
        categoria: pendingDocumentData.categoria,
        updateType: updateType || 'full',
        textToReplace: textToReplace || ''
      };
      console.log('📋 Dados que serão enviados para atualização:', updateData);
      const result = await updateDocument(documentId, updateData);
      console.log('📊 Resultado da atualização:', result);
      if (result.success) {
        console.log('✅ Documento atualizado com sucesso');
        setShowSemanticAnalysisModal(false);
        setShowSimilarDocumentsModal(false);
        setSimilarDocuments([]);
        setPendingDocumentData(null);
        setAnalysisResult(null);
      } else {
        console.error('❌ Falha na atualização do documento:', result);
        alert('Erro ao atualizar documento: ' + (result.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('❌ Erro capturado ao atualizar documento:', error);
      alert('Erro inesperado ao atualizar documento: ' + error.message);
    }
  };
  const handleCancelAnalysis = () => {
    setShowSemanticAnalysisModal(false);
    setShowSimilarDocumentsModal(false);
    setSimilarDocuments([]);
    setPendingDocumentData(null);
    setAnalysisResult(null);
  };
  const handleRunAudit = async () => {
    const results = await runAudit();
    if (results) {
      setAuditResults(results);
    }
  };
  // Apply filters and fetch documents with pagination
  const applyFilters = async (page: number = 1) => {
    const filters = {
      search: searchTerm || undefined,
      status: (statusFilter && statusFilter !== 'all') ? statusFilter : undefined,
      estilo: (estiloFilter && estiloFilter !== 'all') ? estiloFilter : undefined,
      categoria: (categoriaFilter && categoriaFilter !== 'all') ? categoriaFilter : undefined,
      page,
      limit: 20
    };
    await fetchDocuments(filters);
    setCurrentPage(page);
  };

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1);
    applyFilters(1);
  };

  const handlePageChange = (page: number) => {
    applyFilters(page);
  };
  const statusColors = {
    ativo: 'bg-green-500',
    vencido: 'bg-red-500',
    em_revisao: 'bg-yellow-500',
    arquivado: 'bg-gray-500',
    substituido: 'bg-blue-500'
  };
  const estiloColors = {
    manual: 'bg-blue-100 text-blue-800',
    diretriz: 'bg-purple-100 text-purple-800'
  };
  const getStats = () => {
    // Use pagination total for accurate counts
    const total = pagination.total;
    const ativos = documents.filter(d => d.status === 'ativo').length;
    const temporarios = documents.filter(d => d.tipo === 'temporario').length;
    const vencidos = documents.filter(d => d.status === 'vencido').length;
    const processadosIA = documents.filter(d => d.processado_por_ia).length;
    return {
      total,
      ativos,
      temporarios,
      vencidos,
      processadosIA
    };
  };
  const stats = getStats();

  // Buscar categorias existentes e aplicar filtros iniciais
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const {
          data,
          error
        } = await supabase.from('documentos').select('categoria').not('categoria', 'is', null).not('categoria', 'eq', '');
        if (error) throw error;

        // Extrair categorias únicas
        const uniqueCategories = [...new Set(data.map(doc => doc.categoria))].filter(Boolean);
        setAvailableCategories(uniqueCategories);
      } catch (error) {
        console.error('Erro ao buscar categorias:', error);
      }
    };
    fetchCategories();
    applyFilters(1);
  }, []); // Fetch initial data

  // Apply filters when they change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleFilterChange();
    }, 500); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, estiloFilter, categoriaFilter]);

  return <div className="space-y-6">
      {/* Header com estatísticas RAG */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total RAG</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">documentos governados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ativos}</div>
            <p className="text-xs text-muted-foreground">prontos para IA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Temporários</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.temporarios}</div>
            <p className="text-xs text-muted-foreground">com data limite</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vencidos}</div>
            <p className="text-xs text-muted-foreground">requerem atenção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processados IA</CardTitle>
            <Bot className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processadosIA}</div>
            <p className="text-xs text-muted-foreground">formatados com IA</p>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Hub de Conhecimento RAG
              </CardTitle>
              <CardDescription>
                Governança completa com embeddings vetoriais (1536D) e processamento IA opcional
              </CardDescription>
            </div>
            <div className="flex gap-2">
              
              <Button onClick={handleRunAudit} variant="outline">
                🔍 Auditoria
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Documento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Criar Documento RAG</DialogTitle>
                    <DialogDescription>
                      Adicionar documento à base de conhecimento. Use processamento IA para formatação automática.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="titulo">Título *</Label>
                      <Input id="titulo" value={newDocument.titulo} onChange={e => setNewDocument({
                      ...newDocument,
                      titulo: e.target.value
                    })} placeholder="Digite o título do documento" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="conteudo">Conteúdo *</Label>
                      <Textarea id="conteudo" value={newDocument.conteudo} onChange={e => setNewDocument({
                      ...newDocument,
                      conteudo: e.target.value
                    })} placeholder="Digite o conteúdo completo..." className="min-h-[120px]" />
                    </div>

                    {/* Processamento com IA */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <Label htmlFor="process_with_ai" className="font-medium">Processar com IA</Label>
                        </div>
                        <Switch id="process_with_ai" checked={newDocument.process_with_ai} onCheckedChange={checked => {
                        setNewDocument({
                          ...newDocument,
                          process_with_ai: checked
                        });
                        if (!checked) {
                          setNewDocument(prev => ({
                            ...prev,
                            estilo: ''
                          }));
                        }
                      }} />
                      </div>
                      
                      {newDocument.process_with_ai && <div className="grid gap-2">
                          <Label htmlFor="estilo">Estilo de Processamento *</Label>
                          <Select value={newDocument.estilo} onValueChange={(value: '' | 'manual' | 'diretriz') => setNewDocument({
                        ...newDocument,
                        estilo: value
                      })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o estilo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">📋 Manual - Organiza e classifica documentação técnica</SelectItem>
                              <SelectItem value="diretriz">⚖️ Diretriz - Categoriza regras e infrações institucionais</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {newDocument.estilo && <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                              {newDocument.estilo === 'manual' && <div>
                                  <strong>Manual:</strong> Organiza o conteúdo bruto, remove informações sensíveis/temporárias e classifica segundo padrões documentais (ISO 15489).
                                </div>}
                              {newDocument.estilo === 'diretriz' && <div>
                                  <strong>Diretriz:</strong> Analisa regras e infrações, categorizando em: Comunicação Visual, Conduta Comercial, Precificação, Produção de Conteúdo, Avaliações, e Regras Institucionais.
                                </div>}
                            </div>}
                        </div>}
                    </div>

                    {/* Campo de Categoria */}
                    <div className="grid gap-2">
                      <Label htmlFor="categoria">
                        Categoria
                        <span className="text-sm text-muted-foreground ml-2">
                          (opcional - IA categoriza automaticamente se não selecionada)
                        </span>
                      </Label>
                      <Select value={newDocument.categoria || "auto"} onValueChange={value => setNewDocument({
                      ...newDocument,
                      categoria: value === "auto" ? "" : value
                    })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria ou deixe vazio para IA categorizar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">💡 Deixar vazio (IA categoriza automaticamente)</SelectItem>
                          {availableCategories.map(categoria => <SelectItem key={categoria} value={categoria}>
                              {categoria}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        💡 Deixe vazio para que a IA categorize automaticamente baseada no conteúdo
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="tipo">Tipo</Label>
                        <Select value={newDocument.tipo} onValueChange={(value: 'permanente' | 'temporario') => setNewDocument({
                        ...newDocument,
                        tipo: value
                      })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="permanente">Permanente</SelectItem>
                            <SelectItem value="temporario">Temporário</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {newDocument.tipo === 'temporario' && <div className="grid gap-2">
                          <Label htmlFor="valido_ate">Válido até</Label>
                          <Input id="valido_ate" type="datetime-local" value={newDocument.valido_ate} onChange={e => setNewDocument({
                        ...newDocument,
                        valido_ate: e.target.value
                      })} />
                        </div>}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                      <Input id="tags" value={newDocument.tags} onChange={e => setNewDocument({
                      ...newDocument,
                      tags: e.target.value
                    })} placeholder="Ex: atendimento, sistema, login" />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="justificativa">Justificativa *</Label>
                      <Textarea id="justificativa" value={newDocument.justificativa} onChange={e => setNewDocument({
                      ...newDocument,
                      justificativa: e.target.value
                    })} placeholder="Justifique a criação deste documento..." className="min-h-[80px]" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateDocument} disabled={loading || newDocument.process_with_ai && !newDocument.estilo}>
                      {loading ? newDocument.process_with_ai ? 'Processando com IA...' : 'Criando...' : 'Criar Documento'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar documentos..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8" />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
                <SelectItem value="em_revisao">Em revisão</SelectItem>
                <SelectItem value="arquivado">Arquivados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={estiloFilter} onValueChange={setEstiloFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por estilo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estilos</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="diretriz">Diretriz</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {availableCategories.map(categoria => (
                  <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {loading ? <div className="text-center py-8">Carregando documentos RAG...</div> : documents.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                Nenhum documento encontrado
              </div> : documents.map(doc => <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedDocument(doc)}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4" />
                          <h4 className="font-medium">{doc.titulo}</h4>
                          <Badge className={`${statusColors[doc.status]} text-white`}>
                            {doc.status}
                          </Badge>
                          <Badge variant="outline">{doc.tipo}</Badge>
                          <Badge variant="secondary">v{doc.versao}</Badge>
                          {doc.estilo && <Badge className={estiloColors[doc.estilo]}>
                              {doc.estilo}
                            </Badge>}
                          {doc.processado_por_ia && <Badge variant="outline" className="text-purple-600">
                              <Bot className="h-3 w-3 mr-1" />
                              IA
                            </Badge>}
                        </div>
                        
                        {doc.tags && doc.tags.length > 0 && <div className="flex flex-wrap gap-1 mb-2">
                            {doc.tags.map((tag, index) => <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>)}
                          </div>}

                        <p className="text-sm text-muted-foreground mb-2">
                          {typeof doc.conteudo === 'string' ? 
                            (doc.conteudo?.substring(0, 200) || '') + '...' : 
                            (doc.conteudo ? JSON.stringify(doc.conteudo).substring(0, 200) + '...' : 'Sem conteúdo')
                          }
                        </p>

                        <div className="text-xs text-muted-foreground">
                          Criado em: {new Date(doc.criado_em).toLocaleDateString()} | 
                          Justificativa: {doc.justificativa?.substring(0, 50) || 'Sem justificativa'}...
                          {doc.valido_ate && <> | Válido até: {new Date(doc.valido_ate).toLocaleDateString()}</>}
                          {doc.ia_modelo && <> | IA: {doc.ia_modelo}</>}
                        </div>
                      </div>

                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        {doc.status !== 'ativo' && <Button size="sm" variant="outline" onClick={() => updateDocumentStatus(doc.id, 'ativo')}>
                            Reativar
                          </Button>}
                        {doc.status === 'ativo' && <Button size="sm" variant="outline" onClick={() => updateDocumentStatus(doc.id, 'arquivado')}>
                            Arquivar
                          </Button>}
                      </div>
                    </div>
                  </CardContent>
                </Card>)}
          </div>

          {/* Paginação */}
          {pagination.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
              <div className="text-sm text-muted-foreground">
                Mostrando {((pagination.page - 1) * pagination.limit) + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} documentos
              </div>
              
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (pagination.hasPrev) handlePageChange(pagination.page - 1);
                      }}
                      className={!pagination.hasPrev ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {/* First page */}
                  {pagination.page > 2 && (
                    <>
                      <PaginationItem>
                        <PaginationLink 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(1);
                          }}
                          className="cursor-pointer"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      {pagination.page > 3 && <PaginationEllipsis />}
                    </>
                  )}
                  
                  {/* Previous page */}
                  {pagination.page > 1 && (
                    <PaginationItem>
                      <PaginationLink 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(pagination.page - 1);
                        }}
                        className="cursor-pointer"
                      >
                        {pagination.page - 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}
                  
                  {/* Current page */}
                  <PaginationItem>
                    <PaginationLink 
                      href="#" 
                      isActive
                      className="cursor-default"
                    >
                      {pagination.page}
                    </PaginationLink>
                  </PaginationItem>
                  
                  {/* Next page */}
                  {pagination.page < pagination.totalPages && (
                    <PaginationItem>
                      <PaginationLink 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(pagination.page + 1);
                        }}
                        className="cursor-pointer"
                      >
                        {pagination.page + 1}
                      </PaginationLink>
                    </PaginationItem>
                  )}
                  
                  {/* Last page */}
                  {pagination.page < pagination.totalPages - 1 && (
                    <>
                      {pagination.page < pagination.totalPages - 2 && <PaginationEllipsis />}
                      <PaginationItem>
                        <PaginationLink 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(pagination.totalPages);
                          }}
                          className="cursor-pointer"
                        >
                          {pagination.totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (pagination.hasNext) handlePageChange(pagination.page + 1);
                      }}
                      className={!pagination.hasNext ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de análise semântica */}
      <SemanticAnalysisModal open={showSemanticAnalysisModal} onOpenChange={setShowSemanticAnalysisModal} documentData={pendingDocumentData ? {
      titulo: pendingDocumentData.titulo || '',
      conteudo: pendingDocumentData.conteudo || '',
      categoria: pendingDocumentData.categoria || ''
    } : {
      titulo: '',
      conteudo: '',
      categoria: ''
    }} onAnalysisComplete={handleAnalysisComplete} onCreateNew={handleCreateNew} onUpdateExisting={handleUpdateExisting} onCancel={handleCancelAnalysis} />

      {/* Modal de documentos similares (fallback se necessário) */}
      <SimilarDocumentsModal open={showSimilarDocumentsModal} onOpenChange={setShowSimilarDocumentsModal} similarDocuments={similarDocuments} newDocumentData={pendingDocumentData ? {
      titulo: pendingDocumentData.titulo,
      conteudo: pendingDocumentData.conteudo,
      categoria: pendingDocumentData.categoria
    } : {
      titulo: '',
      conteudo: '',
      categoria: ''
    }} onCreateNew={handleCreateNew} onUpdateExisting={handleUpdateExisting} onCancel={handleCancelAnalysis} />

      {/* Resultados da auditoria */}
      {auditResults && <Dialog open={!!auditResults} onOpenChange={() => setAuditResults(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>🔍 Relatório de Auditoria RAG</DialogTitle>
              <DialogDescription>
                Análise completa da governança da base de conhecimento
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="resumo">
              <TabsList>
                <TabsTrigger value="resumo">Resumo</TabsTrigger>
                <TabsTrigger value="inconsistencias">Inconsistências</TabsTrigger>
                <TabsTrigger value="recomendacoes">Recomendações</TabsTrigger>
              </TabsList>

              <TabsContent value="resumo" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold">{auditResults.resumo.total_documentos}</div>
                      <p className="text-sm text-muted-foreground">Total de documentos</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-600">{auditResults.resumo.documentos_ativos}</div>
                      <p className="text-sm text-muted-foreground">Documentos ativos</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="inconsistencias" className="space-y-4">
                {auditResults.inconsistencias.map((inc, index) => <Card key={index} className={`border-l-4 ${inc.criticidade === 'alta' ? 'border-l-red-500' : inc.criticidade === 'media' ? 'border-l-yellow-500' : 'border-l-blue-500'}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium capitalize">{inc.tipo.replace('_', ' ')}</h4>
                          <p className="text-sm text-muted-foreground">{inc.acao_sugerida}</p>
                        </div>
                        <Badge className={inc.criticidade === 'alta' ? 'bg-red-500' : inc.criticidade === 'media' ? 'bg-yellow-500' : 'bg-blue-500'}>
                          {inc.count} itens
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>)}
              </TabsContent>

              <TabsContent value="recomendacoes" className="space-y-4">
                {auditResults.recomendacoes.map((rec, index) => <Card key={index}>
                    <CardContent className="p-4">
                      <p>{rec}</p>
                    </CardContent>
                  </Card>)}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>}

      {/* Modal de visualização do documento */}
      {selectedDocument && <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedDocument.titulo}
              </DialogTitle>
              <DialogDescription>
                Visualização completa do documento RAG
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Badges de informação */}
              <div className="flex flex-wrap gap-2">
                <Badge className={`${statusColors[selectedDocument.status]} text-white`}>
                  {selectedDocument.status}
                </Badge>
                <Badge variant="outline">{selectedDocument.tipo}</Badge>
                <Badge variant="secondary">Versão {selectedDocument.versao}</Badge>
                {selectedDocument.estilo && <Badge className={estiloColors[selectedDocument.estilo]}>
                    {selectedDocument.estilo}
                  </Badge>}
                {selectedDocument.processado_por_ia && <Badge variant="outline" className="text-purple-600">
                    <Bot className="h-3 w-3 mr-1" />
                    Processado por IA
                  </Badge>}
              </div>

              {/* Metadados */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">Informações Gerais</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>ID:</strong> {selectedDocument.id}</div>
                      <div><strong>Artigo ID:</strong> {selectedDocument.artigo_id}</div>
                      <div><strong>Criado em:</strong> {selectedDocument.criado_em ? new Date(selectedDocument.criado_em).toLocaleDateString('pt-BR') : 'Não informado'}</div>
                      <div><strong>Criado por:</strong> {selectedDocument.profile?.nome_completo || selectedDocument.criado_por}</div>
                      <div><strong>Categoria:</strong> {selectedDocument.categoria || 'Não definida'}</div>
                      {selectedDocument.valido_ate && <div><strong>Válido até:</strong> {new Date(selectedDocument.valido_ate).toLocaleDateString('pt-BR')}</div>}
                      {selectedDocument.ia_modelo && <div><strong>Modelo IA:</strong> {selectedDocument.ia_modelo}</div>}
                    </div>
                  </CardContent>
                </Card>

                {selectedDocument.tags && selectedDocument.tags.length > 0 && <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedDocument.tags.map((tag, index) => <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>)}
                      </div>
                    </CardContent>
                  </Card>}
              </div>

              {/* Justificativa */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Justificativa</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedDocument.justificativa}
                  </p>
                </CardContent>
              </Card>

              {/* Conteúdo */}
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Conteúdo</h4>
                  <div className="text-sm bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                    {typeof selectedDocument.conteudo === 'string' ? <pre className="whitespace-pre-wrap font-mono">{selectedDocument.conteudo}</pre> : <pre className="whitespace-pre-wrap font-mono">
                        {JSON.stringify(selectedDocument.conteudo, null, 2)}
                      </pre>}
                  </div>
                </CardContent>
              </Card>

              {/* Classificação IA (se existir) */}
              {selectedDocument.classificacao && <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">Classificação IA</h4>
                    <div className="text-sm bg-muted p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(selectedDocument.classificacao, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>}

              {/* Informações técnicas sobre embedding */}
              {selectedDocument.embedding && <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">Embedding Vetorial</h4>
                    <div className="text-sm text-muted-foreground">
                      <div><strong>Dimensões:</strong> 1536D (OpenAI)</div>
                      <div><strong>Status:</strong> Processado e indexado</div>
                      <div className="mt-2 text-xs bg-muted p-2 rounded">
                        Embedding disponível para busca semântica e RAG
                      </div>
                    </div>
                  </CardContent>
                </Card>}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedDocument(null)}>
                Fechar
              </Button>
              <div onClick={e => e.stopPropagation()}>
                {selectedDocument.status !== 'ativo' ? <Button onClick={() => {
              updateDocumentStatus(selectedDocument.id, 'ativo');
              setSelectedDocument(null);
            }}>
                    Reativar Documento
                  </Button> : <Button variant="destructive" onClick={() => {
              updateDocumentStatus(selectedDocument.id, 'arquivado');
              setSelectedDocument(null);
            }}>
                    Arquivar Documento
                  </Button>}
              </div>
            </div>
          </DialogContent>
        </Dialog>}
    </div>;
};
export default KnowledgeHubTab;