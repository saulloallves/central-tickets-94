import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle, XCircle, BookOpen, Tag, Clock, User, Percent, Search, Bot, Loader2, FileCheck, Edit, FileText, Replace } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SimilarDocument {
  id: string;
  titulo: string;
  conteudo: any;
  categoria: string;
  versao: number;
  similaridade: number;
  relevancia_semantica?: number;
  score_final?: number;
  criado_por?: string;
  criado_em?: string;
  status?: string;
  tags?: string[];
  profile?: {
    nome_completo: string;
    email: string;
  };
}

interface SemanticAnalysisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentData: {
    titulo: string;
    conteudo: string;
    categoria: string;
  };
  onAnalysisComplete: (result: {
    hasConflicts: boolean;
    similarDocuments: SimilarDocument[];
    recommendation: string;
    analiseComparativa?: string;
  }) => void;
  onCreateNew: () => Promise<void>;
  onUpdateExisting?: (documentId: string, updateType?: 'full' | 'partial', textToReplace?: string) => Promise<void>;
  onCancel: () => void;
}

type AnalysisStep = 'embedding' | 'search' | 'analysis' | 'complete';

export const SemanticAnalysisModal = ({ 
  open, 
  onOpenChange, 
  documentData,
  onAnalysisComplete,
  onCreateNew,
  onUpdateExisting,
  onCancel 
}: SemanticAnalysisModalProps) => {
  const [currentStep, setCurrentStep] = useState<AnalysisStep>('embedding');
  const [progress, setProgress] = useState(0);
  const [similarDocuments, setSimilarDocuments] = useState<SimilarDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [viewingDocumentContent, setViewingDocumentContent] = useState<SimilarDocument | null>(null);
  const [showUpdateOptions, setShowUpdateOptions] = useState<SimilarDocument | null>(null);
  const [selectedUpdateType, setSelectedUpdateType] = useState<'full' | 'partial'>('full');
  const [selectedTextToReplace, setSelectedTextToReplace] = useState<string>('');

  // Reset states when modal opens/closes
  useEffect(() => {
    if (open) {
      setCurrentStep('embedding');
      setProgress(0);
      setSimilarDocuments([]);
      setSelectedDocumentId(null);
      setAnalysisResult(null);
      setError(null);
      setHasStartedAnalysis(false);
      setIsCreatingDocument(false);
      setViewingDocumentContent(null);
      setShowUpdateOptions(null);
      setSelectedUpdateType('full');
      setSelectedTextToReplace('');
    }
  }, [open]);

  // Iniciar análise quando modal abre e ainda não começou
  useEffect(() => {
    if (open && documentData && !hasStartedAnalysis && currentStep === 'embedding') {
      performSemanticAnalysis();
    }
  }, [open, hasStartedAnalysis, currentStep]);

  const performSemanticAnalysis = async () => {
    if (hasStartedAnalysis) return;
    
    try {
      setHasStartedAnalysis(true);
      setError(null);
      console.log('Iniciando análise semântica com IA para:', {
        titulo: documentData.titulo,
        conteudo: documentData.conteudo.substring(0, 200) + '...',
        categoria: documentData.categoria
      });

      setCurrentStep('embedding');
      setProgress(25);

      setCurrentStep('search');
      setProgress(50);

      // Usar a função de análise semântica com IA
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('test-semantic-rag', {
        body: {
          titulo: documentData.titulo,
          conteudo: documentData.conteudo
        }
      });

      setProgress(75);

      if (analysisError) {
        throw new Error(`Erro na análise semântica: ${analysisError.message}`);
      }

      console.log('Resultado da análise semântica:', analysisData);

      setCurrentStep('analysis');
      setProgress(90);

      let documentosSimilares: SimilarDocument[] = [];
      let recommendation = "Nenhum documento similar encontrado. Seguro para criar.";
      let analiseComparativa = null;

      if (analysisData?.documentos_relacionados && analysisData.documentos_relacionados.length > 0) {
        documentosSimilares = analysisData.documentos_relacionados.map((doc: any) => ({
          id: doc.id,
          titulo: doc.titulo,
          conteudo: doc.conteudo,
          categoria: doc.categoria || 'Sem categoria',
          versao: doc.versao || 1,
          similaridade: doc.similaridade || 0,
          criado_em: doc.criado_em,
          status: doc.status,
          tags: doc.tags || [],
          profile: doc.profile
        }));

        recommendation = analysisData.recomendacao || "Atenção! Encontramos documentos similares. Considere atualizar um existente.";
        analiseComparativa = analysisData.analise_comparativa;
      }

      setSimilarDocuments(documentosSimilares);
      setCurrentStep('complete');
      setProgress(100);

      const hasConflicts = documentosSimilares.length > 0;

      const result = {
        hasConflicts,
        similarDocuments: documentosSimilares,
        recommendation,
        analiseComparativa
      };

      setAnalysisResult(result);
      console.log('Análise semântica concluída:', result);
      onAnalysisComplete(result);

    } catch (error) {
      console.error('Erro na análise semântica:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido na análise');
      setCurrentStep('complete');
      setProgress(100);
      
      onAnalysisComplete({
        hasConflicts: false,
        similarDocuments: [],
        recommendation: "Erro na análise. Continuando com criação."
      });
    }
  };

  const handleCreateNew = async () => {
    setIsCreatingDocument(true);
    try {
      await onCreateNew();
    } finally {
      setIsCreatingDocument(false);
    }
  };

  const handleUpdateExisting = async (documentId: string, updateType?: 'full' | 'partial', textToReplace?: string) => {
    if (onUpdateExisting) {
      setIsCreatingDocument(true);
      try {
        await onUpdateExisting(documentId, updateType, textToReplace);
      } finally {
        setIsCreatingDocument(false);
      }
    }
  };

  const handleShowUpdateOptions = (doc: SimilarDocument) => {
    setShowUpdateOptions(doc);
    setSelectedUpdateType('full');
    setSelectedTextToReplace('');
  };

  const handleConfirmUpdate = () => {
    if (showUpdateOptions) {
      handleUpdateExisting(showUpdateOptions.id, selectedUpdateType, selectedTextToReplace);
      setShowUpdateOptions(null);
    }
  };

  const getStepIcon = (step: AnalysisStep) => {
    if (currentStep === step || (currentStep === 'complete' && progress === 100)) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>;
  };

  const formatDocumentContent = (content: any, truncate: boolean = true) => {
    if (typeof content === 'string') {
      return truncate && content.length > 200 ? content.substring(0, 200) + '...' : content;
    }
    if (typeof content === 'object') {
      const text = JSON.stringify(content);
      return truncate && text.length > 200 ? text.substring(0, 200) + '...' : text;
    }
    return 'Conteúdo não disponível';
  };

  const handleViewDocument = (doc: SimilarDocument) => {
    setViewingDocumentContent(doc);
  };

  if (isCreatingDocument) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center">
            <DialogTitle className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Criando Documento
            </DialogTitle>
            <DialogDescription>
              Aguarde enquanto o documento está sendo processado...
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4 py-8">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <Progress value={75} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              Criando documento e processando conteúdo...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Análise Semântica Inteligente
          </DialogTitle>
          <DialogDescription>
            Analisando o documento com IA para identificar possíveis duplicatas e conteúdo similar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Progresso da Análise</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Analisando documento...</span>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="flex flex-col items-center space-y-2 p-3 rounded-lg bg-muted/50">
                {getStepIcon('embedding')}
                <div className="text-center">
                  <p className="text-sm font-medium">Embedding</p>
                  <p className="text-xs text-muted-foreground">Gerando representação vetorial</p>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-2 p-3 rounded-lg bg-muted/50">
                {getStepIcon('search')}
                <div className="text-center">
                  <p className="text-sm font-medium">Busca</p>
                  <p className="text-xs text-muted-foreground">Procurando documentos similares</p>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-2 p-3 rounded-lg bg-muted/50">
                {getStepIcon('analysis')}
                <div className="text-center">
                  <p className="text-sm font-medium">Análise</p>
                  <p className="text-xs text-muted-foreground">Calculando similaridades</p>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-2 p-3 rounded-lg bg-muted/50">
                {getStepIcon('complete')}
                <div className="text-center">
                  <p className="text-sm font-medium">Concluído</p>
                  <p className="text-xs text-muted-foreground">Análise finalizada</p>
                </div>
              </div>
            </div>
          </div>

          {/* Document Being Analyzed */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Documento em Análise
            </h3>
            
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {documentData.titulo ? (
                        <span>Título: <span className="font-normal">{documentData.titulo}</span></span>
                      ) : (
                        <span className="text-muted-foreground">Título não informado</span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {documentData.categoria ? (
                        <span>Categoria: <span className="font-medium">{documentData.categoria}</span></span>
                      ) : (
                        <span className="text-muted-foreground">Categoria não informada</span>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Conteúdo:</p>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      {formatDocumentContent(documentData.conteudo)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Recommendation */}
          {analysisResult && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Recomendação da IA
              </h3>
              
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="font-medium">Recomendação</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {analysisResult.recommendation}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Análise Comparativa */}
          {analysisResult?.analiseComparativa && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-500" />
                Análise Comparativa Detalhada
              </h3>
              
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-5 h-5 text-blue-500" />
                    <p className="font-medium">Análise Comparativa da IA</p>
                  </div>
                  <div className="prose prose-sm max-w-none text-muted-foreground">
                    <div className="whitespace-pre-wrap text-sm">
                      {analysisResult.analiseComparativa}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Similar Documents */}
          {similarDocuments.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Search className="w-5 h-5" />
                Documentos Similares Encontrados ({similarDocuments.length})
              </h3>
              
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {similarDocuments.map((doc, index) => (
                    <Card key={doc.id} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            {doc.titulo}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {doc.categoria}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              v{doc.versao}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-xs">
                            <Percent className="w-3 h-3 mr-1" />
                            {doc.similaridade}% similar
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-3">
                        {formatDocumentContent(doc.conteudo)}
                      </p>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {doc.profile && (
                            <>
                              <User className="w-3 h-3" />
                              <span>{doc.profile.nome_completo}</span>
                            </>
                          )}
                          {doc.criado_em && (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>{new Date(doc.criado_em).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewDocument(doc)}
                            className="text-xs"
                          >
                            Ver Conteúdo
                          </Button>
                          {onUpdateExisting && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleShowUpdateOptions(doc)}
                              className="text-xs"
                            >
                              Atualizar Este
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* No Similar Documents */}
          {similarDocuments.length === 0 && currentStep === 'complete' && !error && (
            <div className="space-y-4">
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <p className="font-medium text-green-700">Nenhum documento similar encontrado</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    O documento é único e pode ser criado sem conflitos
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="space-y-4">
              <Card className="border-l-4 border-l-red-500">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <p className="font-medium text-red-700">Erro na Análise</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {error}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <Separator />

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onCancel}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          
          <Button onClick={handleCreateNew} disabled={isCreatingDocument}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Criar Documento
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Document Content Viewer Modal */}
      <Dialog open={!!viewingDocumentContent} onOpenChange={() => setViewingDocumentContent(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              {viewingDocumentContent?.titulo}
            </DialogTitle>
            <DialogDescription>
              Visualizando conteúdo completo do documento
            </DialogDescription>
          </DialogHeader>

          {viewingDocumentContent && (
            <div className="space-y-6">
              {/* Document Metadata */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Categoria</p>
                  <p className="text-sm text-muted-foreground">{viewingDocumentContent.categoria}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Versão</p>
                  <p className="text-sm text-muted-foreground">v{viewingDocumentContent.versao}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Similaridade</p>
                  <Badge variant="default" className="text-xs">
                    {viewingDocumentContent.similaridade}% similar
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Criado em</p>
                  <p className="text-sm text-muted-foreground">
                    {viewingDocumentContent.criado_em ? new Date(viewingDocumentContent.criado_em).toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                </div>
                {viewingDocumentContent.profile && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium">Criado por</p>
                    <p className="text-sm text-muted-foreground">
                      {viewingDocumentContent.profile.nome_completo} ({viewingDocumentContent.profile.email})
                    </p>
                  </div>
                )}
              </div>

              {/* Full Content */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Conteúdo Completo</h3>
                <ScrollArea className="h-96 w-full">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">
                      {formatDocumentContent(viewingDocumentContent.conteudo, false)}
                    </p>
                  </div>
                </ScrollArea>
              </div>

              {/* Tags if available */}
              {viewingDocumentContent.tags && viewingDocumentContent.tags.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingDocumentContent.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingDocumentContent(null)}>
              Fechar
            </Button>
            {onUpdateExisting && viewingDocumentContent && (
              <Button
                onClick={() => {
                  setViewingDocumentContent(null);
                  handleShowUpdateOptions(viewingDocumentContent);
                }}
                className="bg-primary hover:bg-primary/90"
              >
                Atualizar Este Documento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Options Modal */}
      <Dialog open={!!showUpdateOptions} onOpenChange={() => setShowUpdateOptions(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              Opções de Atualização
            </DialogTitle>
            <DialogDescription>
              Escolha como deseja atualizar o documento "{showUpdateOptions?.titulo}"
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
                {showUpdateOptions && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Conteúdo Atual do Documento:</Label>
                    <ScrollArea className="h-32 w-full border rounded-md p-3">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {formatDocumentContent(showUpdateOptions.conteudo, false)}
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
                  {formatDocumentContent(documentData.conteudo)}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdateOptions(null)}>
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
    </Dialog>
  );
};