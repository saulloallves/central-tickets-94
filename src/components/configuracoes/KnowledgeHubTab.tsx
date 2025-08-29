
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
import { Plus, Search, FileText, AlertTriangle, Database, TrendingUp, Shield, CheckCircle } from 'lucide-react';
import { useRAGDocuments } from '@/hooks/useRAGDocuments';

const KnowledgeHubTab = () => {
  const { documents, loading, fetchDocuments, createDocument, updateDocumentStatus, runAudit } = useRAGDocuments();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [duplicateDialog, setDuplicateDialog] = useState(null);
  
  const [newDocument, setNewDocument] = useState({
    titulo: '',
    conteudo: '',
    tipo: 'permanente' as 'permanente' | 'temporario',
    valido_ate: '',
    tags: '',
    justificativa: ''
  });

  const handleCreateDocument = async () => {
    const documentData = {
      ...newDocument,
      tags: newDocument.tags.split(',').map(t => t.trim()).filter(Boolean)
    };

    const result = await createDocument(documentData);
    
    if (result.warning === 'duplicate_found') {
      setDuplicateDialog({
        similar: result.similar_documents,
        message: result.message,
        documentData
      });
      return;
    }

    if (result.success) {
      setIsCreateDialogOpen(false);
      setNewDocument({
        titulo: '',
        conteudo: '',
        tipo: 'permanente',
        valido_ate: '',
        tags: '',
        justificativa: ''
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
        justificativa: ''
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
    return matchesSearch && matchesStatus;
  });

  const statusColors = {
    ativo: 'bg-green-500',
    vencido: 'bg-red-500',
    em_revisao: 'bg-yellow-500',
    arquivado: 'bg-gray-500',
    substituido: 'bg-blue-500'
  };

  const getStats = () => {
    const total = documents.length;
    const ativos = documents.filter(d => d.status === 'ativo').length;
    const temporarios = documents.filter(d => d.tipo === 'temporario').length;
    const vencidos = documents.filter(d => d.status === 'vencido').length;

    return { total, ativos, temporarios, vencidos };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      {/* Header com estatísticas RAG */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                Governança completa com embeddings vetoriais (3072D) e auditoria automática
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
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Criar Documento RAG</DialogTitle>
                    <DialogDescription>
                      O sistema verificará duplicatas automaticamente usando busca vetorial
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
                    <Button onClick={handleCreateDocument} disabled={loading}>
                      {loading ? 'Processando...' : 'Criar Documento'}
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
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
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
                        </div>
                        
                        {doc.tags.length > 0 && (
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
                        </div>
                      </div>

                      <div className="flex gap-2">
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

      {/* Dialog de duplicatas */}
      {duplicateDialog && (
        <AlertDialog open={!!duplicateDialog} onOpenChange={() => setDuplicateDialog(null)}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>⚠️ Duplicatas Detectadas</AlertDialogTitle>
              <AlertDialogDescription>
                {duplicateDialog.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {duplicateDialog.similar.map((doc, index) => (
                <Card key={doc.id} className="p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium">{doc.titulo}</h5>
                      <p className="text-sm text-muted-foreground">
                        Similaridade: {(doc.similaridade * 100).toFixed(1)}% | Versão: {doc.versao}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleForceProceed}>
                Prosseguir Mesmo Assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
    </div>
  );
};

export default KnowledgeHubTab;
