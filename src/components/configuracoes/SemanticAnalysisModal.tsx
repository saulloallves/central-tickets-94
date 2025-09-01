import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, XCircle, BookOpen, Tag, Clock, User, Percent, Search, Bot, Loader2, FileCheck } from 'lucide-react';

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
  onCreateNew: () => void;
  onUpdateExisting?: (documentId: string) => void;
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
    }
  }, [open]);

  // Iniciar análise quando modal abre e ainda não começou
  useEffect(() => {
    if (open && documentData && !hasStartedAnalysis && currentStep === 'embedding') {
      performSemanticAnalysis();
    }
  }, [open, hasStartedAnalysis, currentStep]);

  const performSemanticAnalysis = async () => {
    if (hasStartedAnalysis) return; // Evitar execuções múltiplas
    
    try {
      setHasStartedAnalysis(true);
      setError(null);
      setCurrentStep('embedding');
      setProgress(10);

      // Simular geração de embedding
      await new Promise(resolve => setTimeout(resolve, 1500));
      setProgress(30);

      setCurrentStep('search');
      
      // Simular busca semântica
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(60);

      setCurrentStep('analysis');
      
      // Aqui você faria a chamada real para a edge function
      // Por ora, vou simular alguns documentos similares
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Documentos fictícios para demonstração
      const mockSimilarDocs: SimilarDocument[] = [
        {
          id: '1',
          titulo: 'Documento Similar 1',
          conteudo: 'Conteúdo similar ao que está sendo criado...',
          categoria: 'Exemplo',
          versao: 1,
          similaridade: 0.85,
          relevancia_semantica: 0.8,
          score_final: 0.82,
          status: 'ativo',
          criado_em: new Date().toISOString(),
          tags: ['exemplo', 'teste']
        },
        {
          id: '2',
          titulo: 'Outro Documento Relacionado',
          conteudo: 'Outro conteúdo com alguma similaridade...',
          categoria: 'Exemplo',
          versao: 2,
          similaridade: 0.73,
          relevancia_semantica: 0.7,
          score_final: 0.71,
          status: 'ativo',
          criado_em: new Date().toISOString(),
          tags: ['relacionado']
        }
      ];

      setProgress(90);
      setSimilarDocuments(mockSimilarDocs);
      
      setCurrentStep('complete');
      setProgress(100);

      // Determinar recomendação
      const maxSimilarity = Math.max(...mockSimilarDocs.map(doc => doc.similaridade));
      let recommendation = '';
      let hasConflicts = false;

      if (maxSimilarity >= 0.85) {
        recommendation = 'Alto risco de duplicação detectado. Recomendamos atualizar documento existente.';
        hasConflicts = true;
      } else if (maxSimilarity >= 0.75) {
        recommendation = 'Documentos similares encontrados. Verifique se não há sobreposição de conteúdo.';
        hasConflicts = true;
      } else if (mockSimilarDocs.length > 0) {
        recommendation = 'Documentos relacionados encontrados, mas suficientemente diferentes.';
        hasConflicts = false;
      } else {
        recommendation = 'Nenhum documento similar encontrado. Seguro para criar.';
        hasConflicts = false;
      }

      setAnalysisResult({
        hasConflicts,
        similarDocuments: mockSimilarDocs,
        recommendation
      });

      onAnalysisComplete({
        hasConflicts,
        similarDocuments: mockSimilarDocs,
        recommendation
      });

    } catch (error) {
      setError('Erro durante a análise semântica');
      setCurrentStep('complete');
      setProgress(100);
      setHasStartedAnalysis(false);
    }
  };

  const getStepIcon = (step: AnalysisStep, current: AnalysisStep) => {
    const isCompleted = getStepOrder(step) < getStepOrder(current);
    const isCurrent = step === current;
    
    if (isCompleted) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (isCurrent && current !== 'complete') {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    } else {
      return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStepOrder = (step: AnalysisStep): number => {
    const order = { embedding: 1, search: 2, analysis: 3, complete: 4 };
    return order[step];
  };

  const getSimilarityLevel = (similarity: number) => {
    if (similarity >= 0.9) return { label: 'Muito Alta', color: 'bg-red-500', textColor: 'text-red-700' };
    if (similarity >= 0.8) return { label: 'Alta', color: 'bg-orange-500', textColor: 'text-orange-700' };
    if (similarity >= 0.7) return { label: 'Moderada', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    if (similarity >= 0.6) return { label: 'Baixa', color: 'bg-blue-500', textColor: 'text-blue-700' };
    return { label: 'Muito Baixa', color: 'bg-gray-500', textColor: 'text-gray-700' };
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatContent = (content: any) => {
    if (typeof content === 'string') return content;
    if (typeof content === 'object') return JSON.stringify(content, null, 2);
    return String(content);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            Análise Semântica Inteligente
          </DialogTitle>
          <DialogDescription>
            Analisando o documento com IA para identificar possíveis duplicatas e conteúdo similar
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 pb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Progresso da Análise</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Analisando documento...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Etapas */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { step: 'embedding' as AnalysisStep, label: 'Embedding', description: 'Gerando representação vetorial' },
                  { step: 'search' as AnalysisStep, label: 'Busca', description: 'Procurando documentos similares' },
                  { step: 'analysis' as AnalysisStep, label: 'Análise', description: 'Calculando similaridades' },
                  { step: 'complete' as AnalysisStep, label: 'Concluído', description: 'Análise finalizada' }
                ].map(({ step, label, description }) => (
                  <div key={step} className="text-center space-y-2">
                    <div className="flex justify-center">
                      {getStepIcon(step, currentStep)}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Documento sendo analisado */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-blue-600" />
                Documento em Análise
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Título:</span>
                  <p className="text-muted-foreground">{documentData.titulo}</p>
                </div>
                <div>
                  <span className="font-medium">Categoria:</span>
                  <p className="text-muted-foreground">{documentData.categoria}</p>
                </div>
              </div>
              <div>
                <span className="font-medium text-sm">Conteúdo:</span>
                <p className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">
                  {truncateText(documentData.conteudo, 150)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Resultados */}
          {currentStep === 'complete' && (
            <>
              {error ? (
                <Card className="border-red-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3 text-red-700">
                      <XCircle className="h-5 w-5" />
                      <p>{error}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Recomendação */}
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        {analysisResult?.hasConflicts ? (
                          <AlertTriangle className="h-5 w-5 mt-0.5 text-orange-500" />
                        ) : (
                          <CheckCircle className="h-5 w-5 mt-0.5 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">Recomendação da IA</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {analysisResult?.recommendation}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Documentos similares */}
                  {similarDocuments.length > 0 ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Search className="h-4 w-4 text-orange-500" />
                          Documentos Similares Encontrados ({similarDocuments.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <ScrollArea className="h-60 p-4">
                          <div className="space-y-3 pr-4">
                            {similarDocuments.map((doc) => {
                              const similarity = getSimilarityLevel(doc.similaridade);
                              const isSelected = selectedDocumentId === doc.id;
                              
                              return (
                                <Card 
                                  key={doc.id} 
                                  className={`cursor-pointer transition-all hover:shadow-md ${
                                    isSelected ? 'ring-2 ring-primary' : ''
                                  }`}
                                  onClick={() => setSelectedDocumentId(doc.id)}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1">
                                        <h4 className="text-sm font-medium">{doc.titulo}</h4>
                                        <p className="text-xs text-muted-foreground">
                                          {doc.categoria} • v{doc.versao}
                                        </p>
                                      </div>
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${similarity.textColor}`}
                                      >
                                        <Percent className="h-3 w-3 mr-1" />
                                        {(doc.similaridade * 100).toFixed(1)}%
                                      </Badge>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-xs">
                                          <span>Similaridade</span>
                                          <span className={similarity.textColor}>
                                            {similarity.label}
                                          </span>
                                        </div>
                                        <Progress 
                                          value={doc.similaridade * 100} 
                                          className="h-1"
                                        />
                                      </div>
                                      
                                      <p className="text-xs text-muted-foreground">
                                        {truncateText(formatContent(doc.conteudo), 100)}
                                      </p>
                                      
                                      {doc.tags && doc.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {doc.tags.slice(0, 3).map((tag, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs">
                                              {tag}
                                            </Badge>
                                          ))}
                                          {doc.tags.length > 3 && (
                                            <Badge variant="outline" className="text-xs">
                                              +{doc.tags.length - 3}
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-green-200">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-3 text-green-700">
                          <CheckCircle className="h-5 w-5" />
                          <div>
                            <p className="font-medium">Nenhum documento similar encontrado</p>
                            <p className="text-sm text-muted-foreground">
                              O documento é único e pode ser criado sem conflitos
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
          </div>
        </ScrollArea>

        {currentStep === 'complete' && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex flex-1 gap-2">
              <Button variant="outline" onClick={onCancel} className="flex-1">
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              
              {selectedDocumentId && onUpdateExisting && (
                <Button 
                  variant="secondary" 
                  onClick={() => onUpdateExisting(selectedDocumentId)}
                  className="flex-1"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Atualizar Selecionado
                </Button>
              )}
            </div>
            
            <Button onClick={onCreateNew} className="flex-1 sm:flex-none">
              <CheckCircle className="h-4 w-4 mr-2" />
              {similarDocuments.length > 0 ? 'Criar Mesmo Assim' : 'Criar Documento'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};