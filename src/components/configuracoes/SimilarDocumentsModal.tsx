import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle, XCircle, BookOpen, Tag, Clock, User, Percent } from 'lucide-react';

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
}

interface SimilarDocumentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  similarDocuments: SimilarDocument[];
  newDocumentData: {
    titulo: string;
    conteudo: string;
    categoria: string;
  };
  onCreateNew: () => void;
  onUpdateExisting: (documentId: string) => void;
  onCancel: () => void;
}

export const SimilarDocumentsModal = ({ 
  open, 
  onOpenChange, 
  similarDocuments, 
  newDocumentData,
  onCreateNew,
  onUpdateExisting,
  onCancel 
}: SimilarDocumentsModalProps) => {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const getSimilarityLevel = (similarity: number) => {
    if (similarity >= 0.9) return { label: 'Muito Alta', color: 'bg-red-500', textColor: 'text-red-700' };
    if (similarity >= 0.8) return { label: 'Alta', color: 'bg-orange-500', textColor: 'text-orange-700' };
    if (similarity >= 0.7) return { label: 'Moderada', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
    if (similarity >= 0.6) return { label: 'Baixa', color: 'bg-blue-500', textColor: 'text-blue-700' };
    return { label: 'Muito Baixa', color: 'bg-gray-500', textColor: 'text-gray-700' };
  };

  const getRecommendation = (similarity: number) => {
    if (similarity >= 0.85) {
      return {
        type: 'warning',
        message: 'Documento muito similar encontrado! Recomendamos atualizar o existente.',
        icon: AlertTriangle,
        iconColor: 'text-orange-500'
      };
    }
    if (similarity >= 0.75) {
      return {
        type: 'caution',
        message: 'Documento similar encontrado. Verifique se não é duplicação.',
        icon: AlertTriangle,
        iconColor: 'text-yellow-500'
      };
    }
    return {
      type: 'info',
      message: 'Documento relacionado encontrado, mas suficientemente diferente.',
      icon: CheckCircle,
      iconColor: 'text-green-500'
    };
  };

  const formatContent = (content: any) => {
    if (typeof content === 'string') return content;
    if (typeof content === 'object') return JSON.stringify(content, null, 2);
    return String(content);
  };

  const truncateText = (text: string, maxLength: number = 200) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const highestSimilarity = Math.max(...similarDocuments.map(doc => doc.similaridade));
  const recommendation = getRecommendation(highestSimilarity);
  const RecommendationIcon = recommendation.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Documentos Similares Encontrados
          </DialogTitle>
          <DialogDescription>
            A IA encontrou {similarDocuments.length} documento(s) com conteúdo similar. 
            Analise as opções abaixo antes de prosseguir.
          </DialogDescription>
        </DialogHeader>

        {/* Recomendação principal */}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <RecommendationIcon className={`h-5 w-5 mt-0.5 ${recommendation.iconColor}`} />
              <div>
                <p className="font-medium text-sm">{recommendation.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Maior similaridade encontrada: {(highestSimilarity * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prévia do novo documento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-green-600" />
              Novo Documento (a ser criado)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Título:</span>
                <p className="text-muted-foreground">{newDocumentData.titulo}</p>
              </div>
              <div>
                <span className="font-medium">Categoria:</span>
                <p className="text-muted-foreground">{newDocumentData.categoria}</p>
              </div>
            </div>
            <div>
              <span className="font-medium text-sm">Conteúdo:</span>
              <p className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">
                {truncateText(newDocumentData.conteudo, 150)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Lista de documentos similares */}
        <div className="flex-1 min-h-0">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Documentos Similares Encontrados ({similarDocuments.length})
          </h3>
          
          <ScrollArea className="h-full border rounded-lg">
            <div className="p-4 space-y-4">
              {similarDocuments.map((doc, index) => {
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
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-sm font-medium">
                            {doc.titulo}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Categoria: {doc.categoria} • Versão: {doc.versao}
                          </CardDescription>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${similarity.textColor}`}
                          >
                            <Percent className="h-3 w-3 mr-1" />
                            {(doc.similaridade * 100).toFixed(1)}%
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {similarity.label}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      {/* Barra de similaridade */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Similaridade Semântica</span>
                          <span>{(doc.similaridade * 100).toFixed(1)}%</span>
                        </div>
                        <Progress 
                          value={doc.similaridade * 100} 
                          className="h-2"
                        />
                      </div>

                      {/* Métricas adicionais */}
                      {(doc.relevancia_semantica || doc.score_final) && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {doc.relevancia_semantica && (
                            <div>
                              <span className="text-muted-foreground">Relevância:</span>
                              <span className="ml-1 font-medium">
                                {(doc.relevancia_semantica * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                          {doc.score_final && (
                            <div>
                              <span className="text-muted-foreground">Score Final:</span>
                              <span className="ml-1 font-medium">
                                {(doc.score_final * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      <Separator />

                      {/* Prévia do conteúdo */}
                      <div>
                        <p className="text-xs font-medium mb-1">Prévia do Conteúdo:</p>
                        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                          {truncateText(formatContent(doc.conteudo), 120)}
                        </div>
                      </div>

                      {/* Metadados */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {doc.criado_em && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(doc.criado_em).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                        {doc.status && (
                          <Badge variant="outline" className="text-xs">
                            {doc.status}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex flex-1 gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            
            {selectedDocumentId && (
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
            Criar Novo Documento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};