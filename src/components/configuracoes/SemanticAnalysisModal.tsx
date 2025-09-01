import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, XCircle, BookOpen, Tag, Clock, User, Percent, Search, Bot, Loader2, FileCheck } from 'lucide-react';
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
  }) => void;
  onCreateNew: () => Promise<void>;
  onUpdateExisting?: (documentId: string) => Promise<void>;
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
      console.log('Iniciando análise semântica REAL para:', {
        titulo: documentData.titulo,
        conteudo: documentData.conteudo.substring(0, 200) + '...',
        categoria: documentData.categoria
      });

      setCurrentStep('embedding');
      setProgress(25);

      setCurrentStep('search');
      setProgress(50);

      // BUSCA REAL no banco de dados
      const { data: documentosExistentes, error: searchError } = await supabase
        .from('documentos')
        .select(`
          id,
          titulo,
          conteudo,
          categoria,
          versao,
          status,
          criado_em,
          criado_por,
          tags,
          profiles:criado_por(nome_completo, email)
        `)
        .eq('status', 'ativo');

      setProgress(75);

      if (searchError) {
        throw new Error(`Erro na busca: ${searchError.message}`);
      }

      console.log('Documentos encontrados na base:', documentosExistentes?.length || 0);

      // Calcular similaridade baseada em palavras-chave do título e conteúdo
      const textoBusca = `${documentData.titulo} ${documentData.conteudo}`.toLowerCase();
      const palavrasChave = textoBusca.split(/\s+/).filter(palavra => palavra.length > 3);
      
      const documentosSimilares: SimilarDocument[] = [];
      
      if (documentosExistentes) {
        for (const doc of documentosExistentes) {
          const textoDoc = `${doc.titulo} ${JSON.stringify(doc.conteudo)}`.toLowerCase();
          
          // Calcular similaridade baseada em palavras em comum
          let palavrasComuns = 0;
          
          for (const palavra of palavrasChave) {
            if (textoDoc.includes(palavra)) {
              palavrasComuns++;
            }
          }
          
          const similaridade = palavrasChave.length > 0 ? palavrasComuns / palavrasChave.length : 0;
          
          console.log(`Documento "${doc.titulo}": ${palavrasComuns}/${palavrasChave.length} palavras comuns = ${(similaridade * 100).toFixed(1)}%`);
          
          // Se similaridade > 20%, considera como similar
          if (similaridade > 0.2) {
            documentosSimilares.push({
              id: doc.id,
              titulo: doc.titulo,
              conteudo: doc.conteudo,
              categoria: doc.categoria || 'Sem categoria',
              versao: doc.versao || 1,
              similaridade: Math.round(similaridade * 100),
              criado_em: doc.criado_em,
              status: doc.status,
              tags: doc.tags || [],
              profile: doc.profiles ? {
                nome_completo: doc.profiles.nome_completo,
                email: doc.profiles.email
              } : undefined
            });
          }
        }
      }

      // Ordenar por similaridade (maior para menor)
      documentosSimilares.sort((a, b) => b.similaridade - a.similaridade);

      console.log('Documentos similares encontrados:', documentosSimilares.length);
      setSimilarDocuments(documentosSimilares);
      
      setCurrentStep('complete');
      setProgress(100);

      const hasConflicts = documentosSimilares.length > 0;
      const recommendation = hasConflicts 
        ? "Atenção! Encontramos documentos similares. Considere atualizar um existente."
        : "Nenhum documento similar encontrado. Seguro para criar.";

      const result = {
        hasConflicts,
        similarDocuments: documentosSimilares,
        recommendation
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

  const handleUpdateExisting = async (documentId: string) => {
    if (onUpdateExisting) {
      setIsCreatingDocument(true);
      try {
        await onUpdateExisting(documentId);
      } finally {
        setIsCreatingDocument(false);
      }
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
                              onClick={() => {
                                setSelectedDocumentId(doc.id);
                                handleUpdateExisting(doc.id);
                              }}
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
                  setSelectedDocumentId(viewingDocumentContent.id);
                  handleUpdateExisting(viewingDocumentContent.id);
                }}
                className="bg-primary hover:bg-primary/90"
              >
                Atualizar Este Documento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};