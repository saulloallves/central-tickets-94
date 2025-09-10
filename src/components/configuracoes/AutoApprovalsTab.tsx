import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAutoApprovals } from '@/hooks/useAutoApprovals';
import { useRAGDocuments } from '@/hooks/useRAGDocuments';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { CheckCircle, XCircle, Clock, FileText, User, MessageSquare, Eye, Plus, BookOpen, GitCompare, AlertTriangle, Lightbulb, Loader2, Edit, Replace } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
export function AutoApprovalsTab() {
  const {
    approvals,
    loading,
    fetchApprovals,
    updateApprovalStatus,
    createDocumentFromApproval
  } = useAutoApprovals();
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [showUpdateOptions, setShowUpdateOptions] = useState(false);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [selectedUpdateDocument, setSelectedUpdateDocument] = useState<any>(null);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [selectedUpdateType, setSelectedUpdateType] = useState<'full' | 'partial'>('full');
  const [selectedTextToReplace, setSelectedTextToReplace] = useState('');
  const { createDocument, updateDocument } = useRAGDocuments();
  const {
    toast
  } = useToast();
  const handleApprove = async (id: string, reason?: string) => {
    const success = await updateApprovalStatus(id, 'user_approved', reason);
    if (success) {
      fetchApprovals(activeTab === 'all' ? undefined : activeTab);
    }
  };
  const handleReject = async (id: string, reason?: string) => {
    const success = await updateApprovalStatus(id, 'user_rejected', reason);
    if (success) {
      fetchApprovals(activeTab === 'all' ? undefined : activeTab);
    }
  };
  const handleCreateDocument = async (approvalId: string) => {
    const success = await createDocumentFromApproval(approvalId);
    if (success) {
      fetchApprovals(activeTab === 'all' ? undefined : activeTab);
      toast({
        title: "Documento criado",
        description: "Novo documento foi criado com sucesso na base de conhecimento."
      });
    }
  };
  const handleCreateNewDocument = async (estilo: 'manual' | 'diretriz') => {
    if (selectedApproval) {
      setIsCreatingDocument(true);
      setShowCreateOptions(false);
      
      try {
        const result = await createDocument({
          titulo: '', // Deixar vazio para que a IA gere um título inteligente
          conteudo: selectedApproval.documentation_content,
          categoria: 'Suporte',
          justificativa: 'Documento criado a partir de aprovação automática',
          estilo,
          process_with_ai: true, // Sempre processar com IA
          force: true // Forçar criação mesmo com duplicatas
        });
        
        if (result.success) {
          // Atualizar status da aprovação
          await updateApprovalStatus(selectedApproval.id, 'processed');
          
          fetchApprovals(activeTab === 'all' ? undefined : activeTab);
          toast({
            title: "✨ Documento criado",
            description: "Novo documento foi criado com sucesso na base de conhecimento."
          });
        } else {
          throw new Error(result.error || 'Erro ao criar documento');
        }
      } catch (error) {
        console.error('Erro ao criar documento:', error);
        toast({
          title: "Erro",
          description: `Não foi possível criar o documento: ${error.message}`,
          variant: "destructive",
        });
      } finally {
        setIsCreatingDocument(false);
        setSelectedApproval(null);
      }
    }
  };
  const handleConfirmUpdate = async () => {
    if (!selectedUpdateDocument) return;
    
    await handleUpdateExistingDocument(
      selectedUpdateDocument.id, 
      selectedUpdateType, 
      selectedUpdateType === 'partial' ? selectedTextToReplace : undefined
    );
    
    setShowUpdateOptions(false);
    setSelectedUpdateDocument(null);
    setSelectedUpdateType('full');
    setSelectedTextToReplace('');
  };

  const handleUpdateExistingDocument = async (documentId: string, updateType: 'full' | 'partial', textToReplace?: string) => {
    console.log('=== INICIANDO ATUALIZAÇÃO DE DOCUMENTO ===');
    console.log('Document ID:', documentId);
    console.log('Update Type:', updateType);
    console.log('Text to Replace:', textToReplace);
    console.log('Selected Approval:', selectedApproval);
    
    if (!selectedApproval) {
      console.error('❌ Nenhuma aprovação selecionada');
      toast({
        title: "Erro",
        description: "Nenhuma aprovação selecionada para atualização",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingDocument(true);
    
    try {
      const updateData = {
        titulo: '', // Deixar vazio para que a IA gere um título inteligente para atualizações
        conteudo: selectedApproval.documentation_content,
        categoria: 'Suporte',
        updateType: updateType || 'full',
        textToReplace: textToReplace || ''
      };
      
      console.log('📋 Dados que serão enviados para atualização:', updateData);
      const result = await updateDocument(documentId, updateData);
      console.log('📊 Resultado da atualização:', result);
      
      if (result.success) {
        console.log('✅ Documento atualizado com sucesso');
        
        // Atualizar status da aprovação
        await updateApprovalStatus(selectedApproval.id, 'processed', 'Documento atualizado com sucesso');
        
        fetchApprovals(activeTab === 'all' ? undefined : activeTab);
        toast({
          title: "✨ Documento atualizado",
          description: "O documento foi atualizado com sucesso na base de conhecimento."
        });
      } else {
        console.error('❌ Falha na atualização do documento:', result);
        throw new Error(result.error || 'Erro desconhecido na atualização');
      }
    } catch (error) {
      console.error('❌ Erro capturado ao atualizar documento:', error);
      toast({
        title: "Erro",
        description: `Erro inesperado ao atualizar documento: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsCreatingDocument(false);
      setSelectedApproval(null);
    }
  };
  const handleShowUpdateOptions = (document: any) => {
    setSelectedUpdateDocument(document);
    setSelectedUpdateType('full');
    setSelectedTextToReplace('');
    setShowUpdateOptions(true);
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejeitado</Badge>;
      case 'processing':
        return <Badge variant="default" className="gap-1 bg-orange-600"><Loader2 className="h-3 w-3 animate-spin" />Processando</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  const filteredApprovals = approvals.filter(approval => {
    if (activeTab === 'all') return true;
    
    // Mapear os status corretamente:
    // 'pending' aba = status 'approved' (aprovado pela moderação, aguardando decisão)
    // 'approved' aba = status 'processed' (já virou documento)
    // 'rejected' aba = status 'rejected' (rejeitado pela moderação)
    // 'processing' aba = status 'pending' (sendo processado pela IA)
    
    switch (activeTab) {
      case 'pending':
        return approval.status === 'approved'; // Aprovado pela moderação, aguardando decisão
      case 'approved':
        return approval.status === 'user_approved' || approval.status === 'processed'; // Você aprovou
      case 'rejected':
        return approval.status === 'rejected' || approval.status === 'user_rejected'; // Rejeitado por IA ou por você
      case 'processing':
        return approval.status === 'pending'; // Sendo processado
      default:
        return approval.status === activeTab;
    }
  });
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Aprovações</h2>
          <p className="text-muted-foreground">
            Gerencie conteúdos que passaram pela moderação da IA e aguardam aprovação final
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovados</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
          <TabsTrigger value="processing">Processando</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {loading ? <div className="flex items-center justify-center p-8">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-muted-foreground">Carregando aprovações...</span>
              </div>
            </div> : filteredApprovals.length === 0 ? <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma aprovação encontrada</h3>
                <p className="text-muted-foreground text-center">
                  {activeTab === 'pending' && 'Não há conteúdos pendentes de aprovação no momento. Conteúdos aprovados pela moderação aparecerão aqui.'}
                  {activeTab === 'approved' && 'Não há conteúdos aprovados. Conteúdos que viraram documentos ou atualizaram existentes aparecerão aqui.'}
                  {activeTab === 'rejected' && 'Não há conteúdos rejeitados. Conteúdos rejeitados pela moderação ou por você aparecerão aqui.'}
                  {activeTab === 'processing' && 'Não há conteúdos sendo processados. Tickets recém-concluídos sendo processados pela IA aparecerão aqui.'}
                  {activeTab === 'all' && 'Não há aprovações registradas no sistema.'}
                </p>
              </CardContent>
            </Card> : <div className="grid gap-4">
              {filteredApprovals.map(approval => <Card key={approval.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(approval.status)}
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNowInSaoPaulo(new Date(approval.created_at))}
                          </span>
                        </div>
                        {approval.ticket_id && <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            Ticket: {approval.ticket_id.substring(0, 8)}...
                          </div>}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedApproval(approval)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Mensagem Original:</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        {approval.original_message.substring(0, 200)}
                        {approval.original_message.length > 200 && '...'}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Resposta Corrigida:</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        {approval.corrected_response.substring(0, 200)}
                        {approval.corrected_response.length > 200 && '...'}
                      </p>
                    </div>


                  </CardContent>
                </Card>)}
            </div>}
        </TabsContent>
      </Tabs>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Aprovação</DialogTitle>
            <DialogDescription>
              Análise completa do conteúdo processado e moderado pela IA
            </DialogDescription>
          </DialogHeader>
          
          {selectedApproval && <div className="space-y-6">
              <div className="flex items-center gap-4">
                {getStatusBadge(selectedApproval.status)}
                <span className="text-sm text-muted-foreground">
                  Criado {formatDistanceToNowInSaoPaulo(new Date(selectedApproval.created_at))}
                </span>
              </div>

              <div className="grid gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Mensagem Original</h3>
                  <Textarea value={selectedApproval.original_message} readOnly className="min-h-[100px]" />
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Resposta Corrigida</h3>
                  <Textarea value={selectedApproval.corrected_response} readOnly className="min-h-[100px]" />
                </div>

                

                {selectedApproval.comparative_analysis && <div>
                    <h3 className="font-semibold mb-3">Análise Comparativa</h3>
                    <AnaliseComparativaDisplay analise={selectedApproval.comparative_analysis} />
                  </div>}

                {selectedApproval.similar_documents && selectedApproval.similar_documents.length > 0 && <div>
                    <h3 className="font-semibold mb-3">Documentos Similares Encontrados</h3>
                    <div className="space-y-2">
                      {selectedApproval.similar_documents.map((doc: any, index: number) => <Card key={index} className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{doc.titulo}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {typeof doc.conteudo === 'string' ? doc.conteudo.substring(0, 150) + '...' : typeof doc.conteudo === 'object' && doc.conteudo ? JSON.stringify(doc.conteudo).substring(0, 150) + '...' : 'Conteúdo não disponível'}
                              </p>
                              {doc.similarity && <Badge variant="outline" className="mt-2">
                                  Similaridade: {(doc.similarity * 100).toFixed(1)}%
                                </Badge>}
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleShowUpdateOptions(doc)} className="ml-3">
                              Atualizar
                            </Button>
                          </div>
                        </Card>)}
                    </div>
                  </div>}

                {/* Ações no modal */}
                <div className="flex flex-col gap-4 pt-6 border-t">
                  <div>
                    <h3 className="font-semibold mb-3">Recomendação da IA</h3>
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {selectedApproval.similar_documents && selectedApproval.similar_documents.length > 0 ? "A IA encontrou documentos similares. Recomenda-se atualizar um documento existente para evitar redundância." : "Nenhum documento similar encontrado. Recomenda-se criar um novo documento."}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="default" onClick={() => setShowCreateOptions(true)} className="bg-green-600 hover:bg-green-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Novo Documento
                    </Button>
                    
                    {selectedApproval.similar_documents && selectedApproval.similar_documents.length > 0 && <Button variant="outline" onClick={() => {
                  if (selectedApproval.similar_documents[0]) {
                    handleShowUpdateOptions(selectedApproval.similar_documents[0]);
                  }
                }}>
                        <FileText className="h-4 w-4 mr-2" />
                        Atualizar Documento Existente
                      </Button>}
                  </div>

                  {selectedApproval.status === 'approved' && <div className="flex gap-3 pt-4 border-t">
                      <Button variant="destructive" onClick={() => {
                  handleReject(selectedApproval.id, 'Rejeitado via modal de detalhes');
                  setSelectedApproval(null);
                }}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Rejeitar
                      </Button>
                    </div>}
                </div>
              </div>
            </div>}
        </DialogContent>
      </Dialog>

      {/* Modal de opções de atualização igual ao Hub de Conhecimento */}
      <Dialog open={showUpdateOptions} onOpenChange={setShowUpdateOptions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              Opções de Atualização
            </DialogTitle>
            <DialogDescription>
              Escolha como deseja atualizar o documento "{selectedUpdateDocument?.titulo}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Update Type Selection */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Tipo de Atualização</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <Card 
                  className={`cursor-pointer transition-all ${
                    selectedUpdateType === 'full' 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedUpdateType('full')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-primary" />
                      <div>
                        <h4 className="font-medium">Substituir Tudo</h4>
                        <p className="text-sm text-muted-foreground">
                          Substitui todo o conteúdo do documento existente
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-all ${
                    selectedUpdateType === 'partial' 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedUpdateType('partial')}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Replace className="w-8 h-8 text-primary" />
                      <div>
                        <h4 className="font-medium">Substituir Parte</h4>
                        <p className="text-sm text-muted-foreground">
                          Substitui apenas uma parte específica do conteúdo
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Partial Update Options */}
            {selectedUpdateType === 'partial' && (
              <div className="space-y-4">
                <Label className="text-base font-medium">Texto a ser Substituído</Label>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Digite o texto específico que deseja substituir no documento existente:
                  </p>
                  <Textarea
                    value={selectedTextToReplace}
                    onChange={(e) => setSelectedTextToReplace(e.target.value)}
                    placeholder="Digite o texto que deseja substituir..."
                    className="min-h-24"
                  />
                </div>

                {/* Current Document Preview */}
                {selectedUpdateDocument && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Conteúdo Atual do Documento:</Label>
                    <ScrollArea className="h-32 w-full border rounded-md p-3">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {typeof selectedUpdateDocument.conteudo === 'string' 
                          ? selectedUpdateDocument.conteudo 
                          : typeof selectedUpdateDocument.conteudo === 'object' && selectedUpdateDocument.conteudo?.texto
                            ? selectedUpdateDocument.conteudo.texto
                            : JSON.stringify(selectedUpdateDocument.conteudo || {}, null, 2)
                        }
                      </p>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {/* Preview of New Content */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Novo Conteúdo:</Label>
              <div className="p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  {selectedApproval?.documentation_content}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateOptions(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmUpdate}
              disabled={selectedUpdateType === 'partial' && !selectedTextToReplace.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              Confirmar Atualização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de opções de criação */}
      <Dialog open={showCreateOptions} onOpenChange={setShowCreateOptions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escolher Tipo de Processamento</DialogTitle>
            <DialogDescription>
              Selecione como deseja processar este conteúdo
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button 
              variant="outline" 
              className="justify-start h-auto p-4"
              onClick={() => handleCreateNewDocument('manual')}
            >
              <FileText className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Manual</div>
                <div className="text-sm text-muted-foreground">
                  Processamento com IA para organizar documentação técnica
                </div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="justify-start h-auto p-4"
              onClick={() => handleCreateNewDocument('diretriz')}
            >
              <BookOpen className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Diretriz</div>
                <div className="text-sm text-muted-foreground">
                  Processamento com IA para categorizar regras e infrações institucionais
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de carregamento */}
      <Dialog open={isCreatingDocument} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-3 text-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              Criando Documento
            </DialogTitle>
            <DialogDescription className="text-center">
              Processando conteúdo com IA e gerando documentação...
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
              <FileText className="h-6 w-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary" />
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Aguarde alguns instantes...</p>
              <p className="text-xs text-muted-foreground">
                A IA está analisando e estruturando o conteúdo
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
}

// Componente para exibir análise comparativa estruturada
function AnaliseComparativaDisplay({
  analise
}: {
  analise: string;
}) {
  // Parse da análise para extrair seções estruturadas
  const parseAnalise = (texto: string) => {
    const sections = {
      newDocument: '',
      overlapAnalysis: '',
      detailedComparison: '',
      contradictions: '',
      finalRecommendation: ''
    };

    // Tenta encontrar seções baseadas em marcadores comuns
    const lines = texto.split('\n');
    let currentSection = '';
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.includes('### 1.') || trimmedLine.includes('Novo Texto') || trimmedLine.includes('Novo Documento')) {
        currentSection = 'newDocument';
      } else if (trimmedLine.includes('### 2.') || trimmedLine.includes('Sobreposição') || trimmedLine.includes('Overlap')) {
        currentSection = 'overlapAnalysis';
      } else if (trimmedLine.includes('### 3.') || trimmedLine.includes('Comparação') || trimmedLine.includes('Detailed')) {
        currentSection = 'detailedComparison';
      } else if (trimmedLine.includes('### 4.') || trimmedLine.includes('Contradições') || trimmedLine.includes('Contradictions')) {
        currentSection = 'contradictions';
      } else if (trimmedLine.includes('### 5.') || trimmedLine.includes('Recomendação') || trimmedLine.includes('Recommendation')) {
        currentSection = 'finalRecommendation';
      } else if (currentSection && trimmedLine) {
        sections[currentSection as keyof typeof sections] += line + '\n';
      }
    }

    // Se não encontrou seções estruturadas, usa o texto completo
    if (!sections.newDocument && !sections.overlapAnalysis) {
      sections.newDocument = texto;
    }
    return sections;
  };
  const sections = parseAnalise(analise);
  return <div className="space-y-4">
      {sections.newDocument && <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <BookOpen className="h-5 w-5" />
              Novo Documento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm">{sections.newDocument}</pre>
            </div>
          </CardContent>
        </Card>}

      {sections.overlapAnalysis && <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <GitCompare className="h-5 w-5" />
              Análise de Sobreposição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm">{sections.overlapAnalysis}</pre>
            </div>
          </CardContent>
        </Card>}

      {sections.detailedComparison && <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <GitCompare className="h-5 w-5" />
              Comparação Detalhada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm">{sections.detailedComparison}</pre>
            </div>
          </CardContent>
        </Card>}

      {sections.contradictions && <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Contradições Identificadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm">{sections.contradictions}</pre>
            </div>
          </CardContent>
        </Card>}

      {sections.finalRecommendation && <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Lightbulb className="h-5 w-5" />
              Recomendação Final
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm">{sections.finalRecommendation}</pre>
            </div>
          </CardContent>
        </Card>}
    </div>;
}