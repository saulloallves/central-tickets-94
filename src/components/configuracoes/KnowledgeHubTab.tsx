
import { useState } from 'react';
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
import { Plus, Search, FileText, AlertTriangle, Database, TrendingUp, Shield, CheckCircle, Bot, Sparkles, Settings, FileUp, FilePlus, X, Info, Eye } from 'lucide-react';
import { useRAGDocuments } from '@/hooks/useRAGDocuments';

const KnowledgeHubTab = () => {
  const { documents, loading, fetchDocuments, createDocument, updateDocumentStatus, runAudit } = useRAGDocuments();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [estiloFilter, setEstiloFilter] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [duplicateDialog, setDuplicateDialog] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  
  const [newDocument, setNewDocument] = useState({
    titulo: '',
    conteudo: '',
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

    console.log('Criando documento com dados:', documentData);

    const result = await createDocument(documentData);
    
    console.log('Resultado da criação:', result);
    
    if (result.warning === 'duplicate_found') {
      console.log('Detectada duplicata, mostrando modal...');
      setDuplicateDialog({
        similar: result.similar_documents,
        message: result.message,
        documentData
      });
      return;
    }

    if (result.success) {
      console.log('Documento criado com sucesso!');
      setIsCreateDialogOpen(false);
      setNewDocument({
        titulo: '',
        conteudo: '',
        tipo: 'permanente',
        valido_ate: '',
        tags: '',
        justificativa: '',
        estilo: '',
        process_with_ai: false
      });
    }
  };

  const handleForceProceed = async () => {
    // Forçar criação mesmo com duplicatas
    const result = await createDocument({
      ...duplicateDialog.documentData,
      force: true
    });
    
    setDuplicateDialog(null);
    if (result.success) {
      setIsCreateDialogOpen(false);
      setNewDocument({
        titulo: '',
        conteudo: '',
        tipo: 'permanente',
        valido_ate: '',
        tags: '',
        justificativa: '',
        estilo: '',
        process_with_ai: false
      });
    }
  };

  const handleRunAudit = async () => {
    const results = await runAudit();
    if (results) {
      setAuditResults(results);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || doc.status === statusFilter;
    const matchesEstilo = !estiloFilter || estiloFilter === 'all' || doc.estilo === estiloFilter;
    return matchesSearch && matchesStatus && matchesEstilo;
  });

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
    const total = documents.length;
    const ativos = documents.filter(d => d.status === 'ativo').length;
    const temporarios = documents.filter(d => d.tipo === 'temporario').length;
    const vencidos = documents.filter(d => d.status === 'vencido').length;
    const processadosIA = documents.filter(d => d.processado_por_ia).length;

    return { total, ativos, temporarios, vencidos, processadosIA };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
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
                      <Input
                        id="titulo"
                        value={newDocument.titulo}
                        onChange={(e) => setNewDocument({...newDocument, titulo: e.target.value})}
                        placeholder="Digite o título do documento"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="conteudo">Conteúdo *</Label>
                      <Textarea
                        id="conteudo"
                        value={newDocument.conteudo}
                        onChange={(e) => setNewDocument({...newDocument, conteudo: e.target.value})}
                        placeholder="Digite o conteúdo completo..."
                        className="min-h-[120px]"
                      />
                    </div>

                    {/* Processamento com IA */}
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <Label htmlFor="process_with_ai" className="font-medium">Processar com IA</Label>
                        </div>
                        <Switch
                          id="process_with_ai"
                          checked={newDocument.process_with_ai}
                          onCheckedChange={(checked) => {
                            setNewDocument({...newDocument, process_with_ai: checked});
                            if (!checked) {
                              setNewDocument(prev => ({...prev, estilo: ''}));
                            }
                          }}
                        />
                      </div>
                      
                      {newDocument.process_with_ai && (
                        <div className="grid gap-2">
                          <Label htmlFor="estilo">Estilo de Processamento *</Label>
                          <Select value={newDocument.estilo} onValueChange={(value: '' | 'manual' | 'diretriz') => setNewDocument({...newDocument, estilo: value})}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o estilo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">📋 Manual - Organiza e classifica documentação técnica</SelectItem>
                              <SelectItem value="diretriz">⚖️ Diretriz - Categoriza regras e infrações institucionais</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          {newDocument.estilo && (
                            <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                              {newDocument.estilo === 'manual' && (
                                <div>
                                  <strong>Manual:</strong> Organiza o conteúdo bruto, remove informações sensíveis/temporárias e classifica segundo padrões documentais (ISO 15489).
                                </div>
                              )}
                              {newDocument.estilo === 'diretriz' && (
                                <div>
                                  <strong>Diretriz:</strong> Analisa regras e infrações, categorizando em: Comunicação Visual, Conduta Comercial, Precificação, Produção de Conteúdo, Avaliações, e Regras Institucionais.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="tipo">Tipo</Label>
                        <Select value={newDocument.tipo} onValueChange={(value: 'permanente' | 'temporario') => setNewDocument({...newDocument, tipo: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="permanente">Permanente</SelectItem>
                            <SelectItem value="temporario">Temporário</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {newDocument.tipo === 'temporario' && (
                        <div className="grid gap-2">
                          <Label htmlFor="valido_ate">Válido até</Label>
                          <Input
                            id="valido_ate"
                            type="datetime-local"
                            value={newDocument.valido_ate}
                            onChange={(e) => setNewDocument({...newDocument, valido_ate: e.target.value})}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                      <Input
                        id="tags"
                        value={newDocument.tags}
                        onChange={(e) => setNewDocument({...newDocument, tags: e.target.value})}
                        placeholder="Ex: atendimento, sistema, login"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="justificativa">Justificativa *</Label>
                      <Textarea
                        id="justificativa"
                        value={newDocument.justificativa}
                        onChange={(e) => setNewDocument({...newDocument, justificativa: e.target.value})}
                        placeholder="Justifique a criação deste documento..."
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCreateDocument} 
                      disabled={loading || (newDocument.process_with_ai && !newDocument.estilo)}
                    >
                      {loading ? (
                        newDocument.process_with_ai ? 'Processando com IA...' : 'Criando...'
                      ) : (
                        'Criar Documento'
                      )}
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
                <Input
                  placeholder="Buscar documentos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
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
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Carregando documentos RAG...</div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum documento encontrado
              </div>
            ) : (
              filteredDocuments.map((doc) => (
                <Card 
                  key={doc.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => setSelectedDocument(doc)}
                >
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
                          {doc.estilo && (
                            <Badge className={estiloColors[doc.estilo]}>
                              {doc.estilo}
                            </Badge>
                          )}
                          {doc.processado_por_ia && (
                            <Badge variant="outline" className="text-purple-600">
                              <Bot className="h-3 w-3 mr-1" />
                              IA
                            </Badge>
                          )}
                        </div>
                        
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {doc.tags.map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <p className="text-sm text-muted-foreground mb-2">
                          {typeof doc.conteudo === 'string' 
                            ? doc.conteudo.substring(0, 200) + '...'
                            : JSON.stringify(doc.conteudo).substring(0, 200) + '...'
                          }
                        </p>

                        <div className="text-xs text-muted-foreground">
                          Criado em: {new Date(doc.criado_em).toLocaleDateString()} | 
                          Justificativa: {doc.justificativa.substring(0, 50)}...
                          {doc.valido_ate && (
                            <> | Válido até: {new Date(doc.valido_ate).toLocaleDateString()}</>
                          )}
                          {doc.ia_modelo && (
                            <> | IA: {doc.ia_modelo}</>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {doc.status !== 'ativo' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateDocumentStatus(doc.id, 'ativo')}
                          >
                            Reativar
                          </Button>
                        )}
                        {doc.status === 'ativo' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateDocumentStatus(doc.id, 'arquivado')}
                          >
                            Arquivar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de duplicatas melhorado */}
      {duplicateDialog && (
        <Dialog open={!!duplicateDialog} onOpenChange={() => setDuplicateDialog(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl">Duplicatas Detectadas</DialogTitle>
                  <DialogDescription className="text-base">
                    Encontramos documentos similares na base de conhecimento. Escolha como deseja proceder:
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Seção de documentos similares */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documentos Similares Encontrados
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto border rounded-lg p-4 bg-muted/20">
                  {duplicateDialog.similar.map((doc, index) => (
                    <Card key={doc.id} className="border-l-4 border-l-yellow-500">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4" />
                              <h5 className="font-medium">{doc.titulo}</h5>
                              <Badge variant="outline">v{doc.versao}</Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                              <div>
                                <span className="font-medium">Similaridade:</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-yellow-400 to-red-500 rounded-full"
                                      style={{ width: `${((doc.similarity || doc.similaridade || 0) * 100)}%` }}
                                    />
                                  </div>
                                  <span className="font-mono">{((doc.similarity || doc.similaridade || 0) * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Status:</span>
                                <div className="mt-1">
                                  <Badge className={statusColors[doc.status] || 'bg-gray-500 text-white'}>{doc.status || 'Indefinido'}</Badge>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                              <div>
                                <span className="font-medium">Categoria:</span>
                                <div className="mt-1">{doc.categoria || 'Não definida'}</div>
                              </div>
                              <div>
                                <span className="font-medium">Versão:</span>
                                <div className="mt-1">v{doc.versao || 1}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-3">
                              <div>
                                <span className="font-medium">Criado em:</span>
                                <div className="mt-1">{doc.criado_em ? new Date(doc.criado_em).toLocaleDateString('pt-BR') : 'Não informado'}</div>
                              </div>
                              <div>
                                <span className="font-medium">Criado por:</span>
                                <div className="mt-1">{doc.criado_por || 'Não informado'}</div>
                              </div>
                            </div>

                            <div className="text-sm">
                              <span className="font-medium">Conteúdo:</span>
                              <p className="text-muted-foreground mt-1 line-clamp-2">
                                {typeof doc.conteudo === 'string' 
                                  ? doc.conteudo.substring(0, 150) + '...'
                                  : JSON.stringify(doc.conteudo).substring(0, 150) + '...'
                                }
                              </p>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-2"
                                onClick={() => setSelectedDocument(doc)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Ver Conteúdo Completo
                              </Button>
                            </div>

                            {doc.tags && doc.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {doc.tags.slice(0, 3).map((tag, tagIndex) => (
                                  <Badge key={tagIndex} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {doc.tags.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{doc.tags.length - 3} mais
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Opções de ação */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Opções de Ação
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="hover:shadow-md transition-all cursor-pointer border-2 hover:border-primary/50">
                    <CardContent className="p-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
                        <FileUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h4 className="font-semibold mb-2">Nova Versão</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Criar uma nova versão do documento existente mais similar
                      </p>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => {
                          console.log('Criar nova versão para documento similar');
                          // TODO: Implementar lógica de nova versão
                          setDuplicateDialog(null);
                        }}
                      >
                        <FileUp className="w-4 h-4 mr-2" />
                        Nova Versão
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-md transition-all cursor-pointer border-2 hover:border-primary/50">
                    <CardContent className="p-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
                        <FilePlus className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <h4 className="font-semibold mb-2">Criar Separado</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Criar um novo documento independente mesmo com similaridades
                      </p>
                      <Button 
                        className="w-full" 
                        onClick={handleForceProceed}
                      >
                        <FilePlus className="w-4 h-4 mr-2" />
                        Criar Novo
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="hover:shadow-md transition-all cursor-pointer border-2 hover:border-destructive/50">
                    <CardContent className="p-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-3">
                        <X className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <h4 className="font-semibold mb-2">Cancelar</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Cancelar a criação e revisar o conteúdo
                      </p>
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => setDuplicateDialog(null)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Informações adicionais */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Sobre a Detecção de Duplicatas
                    </h4>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <p>• Similaridade acima de 85% indica conteúdo muito similar</p>
                      <p>• Nova versão mantém histórico e versionamento</p>
                      <p>• Criar separado pode causar redundância na base</p>
                      <p>• Recomendamos revisar o conteúdo antes de prosseguir</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Resultados da auditoria */}
      {auditResults && (
        <Dialog open={!!auditResults} onOpenChange={() => setAuditResults(null)}>
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
                {auditResults.inconsistencias.map((inc, index) => (
                  <Card key={index} className={`border-l-4 ${
                    inc.criticidade === 'alta' ? 'border-l-red-500' :
                    inc.criticidade === 'media' ? 'border-l-yellow-500' : 'border-l-blue-500'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium capitalize">{inc.tipo.replace('_', ' ')}</h4>
                          <p className="text-sm text-muted-foreground">{inc.acao_sugerida}</p>
                        </div>
                        <Badge className={
                          inc.criticidade === 'alta' ? 'bg-red-500' :
                          inc.criticidade === 'media' ? 'bg-yellow-500' : 'bg-blue-500'
                        }>
                          {inc.count} itens
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="recomendacoes" className="space-y-4">
                {auditResults.recomendacoes.map((rec, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <p>{rec}</p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de visualização do documento */}
      {selectedDocument && (
        <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
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
                {selectedDocument.estilo && (
                  <Badge className={estiloColors[selectedDocument.estilo]}>
                    {selectedDocument.estilo}
                  </Badge>
                )}
                {selectedDocument.processado_por_ia && (
                  <Badge variant="outline" className="text-purple-600">
                    <Bot className="h-3 w-3 mr-1" />
                    Processado por IA
                  </Badge>
                )}
              </div>

              {/* Metadados */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">Informações Gerais</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>ID:</strong> {selectedDocument.id}</div>
                      <div><strong>Artigo ID:</strong> {selectedDocument.artigo_id}</div>
                      <div><strong>Criado em:</strong> {new Date(selectedDocument.criado_em).toLocaleDateString('pt-BR')}</div>
                      <div><strong>Criado por:</strong> {selectedDocument.criado_por}</div>
                      <div><strong>Categoria:</strong> {selectedDocument.categoria || 'Não definida'}</div>
                      {selectedDocument.valido_ate && (
                        <div><strong>Válido até:</strong> {new Date(selectedDocument.valido_ate).toLocaleDateString('pt-BR')}</div>
                      )}
                      {selectedDocument.ia_modelo && (
                        <div><strong>Modelo IA:</strong> {selectedDocument.ia_modelo}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedDocument.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
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
                    {typeof selectedDocument.conteudo === 'string' ? (
                      <pre className="whitespace-pre-wrap font-mono">{selectedDocument.conteudo}</pre>
                    ) : (
                      <pre className="whitespace-pre-wrap font-mono">
                        {JSON.stringify(selectedDocument.conteudo, null, 2)}
                      </pre>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Classificação IA (se existir) */}
              {selectedDocument.classificacao && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2">Classificação IA</h4>
                    <div className="text-sm bg-muted p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(selectedDocument.classificacao, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Informações técnicas sobre embedding */}
              {selectedDocument.embedding && (
                <Card>
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
                </Card>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedDocument(null)}>
                Fechar
              </Button>
              <div onClick={(e) => e.stopPropagation()}>
                {selectedDocument.status !== 'ativo' ? (
                  <Button
                    onClick={() => {
                      updateDocumentStatus(selectedDocument.id, 'ativo');
                      setSelectedDocument(null);
                    }}
                  >
                    Reativar Documento
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      updateDocumentStatus(selectedDocument.id, 'arquivado');
                      setSelectedDocument(null);
                    }}
                  >
                    Arquivar Documento
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default KnowledgeHubTab;
