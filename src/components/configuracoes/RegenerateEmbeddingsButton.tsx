import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, CheckCircle, XCircle, Zap } from 'lucide-react';

interface RegenerateResult {
  success: boolean;
  message: string;
  total_documentos: number;
  sucessos: number;
  falhas: number;
  resultados: Array<{
    id: string;
    titulo: string;
    status: 'sucesso' | 'falha';
    embedding_dimensions?: number;
    erro?: string;
  }>;
}

export const RegenerateEmbeddingsButton = () => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [result, setResult] = useState<RegenerateResult | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true);
      setResult(null);
      setProgress(0);

      toast({
        title: "Iniciando regeneração",
        description: "Atualizando embeddings para o modelo atual...",
      });

      // Simular progresso
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      console.log('🔄 Chamando função de regeneração de embeddings...');

      const { data, error } = await supabase.functions.invoke('regenerate-all-embeddings', {
        body: {}
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) {
        throw error;
      }

      console.log('✅ Resultado da regeneração:', data);
      setResult(data);

      toast({
        title: "Regeneração concluída!",
        description: `${data.sucessos} documentos atualizados com sucesso`,
      });

    } catch (error) {
      console.error('❌ Erro na regeneração:', error);
      setProgress(0);
      
      toast({
        title: "Erro na regeneração",
        description: error.message || "Falha ao regenerar embeddings",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Atualizar Embeddings
          </CardTitle>
          <CardDescription>
            Regenera todos os embeddings usando o modelo atual (text-embedding-3-small) para melhorar a busca semântica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isRegenerating && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processando documentos...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            <Button 
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="w-full"
            >
              {isRegenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Regenerando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Regenerar Todos os Embeddings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              Resultado da Regeneração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{result.total_documentos}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{result.sucessos}</div>
                  <div className="text-sm text-muted-foreground">Sucessos</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{result.falhas}</div>
                  <div className="text-sm text-muted-foreground">Falhas</div>
                </div>
              </div>

              {result.resultados && result.resultados.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Detalhes por Documento:</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {result.resultados.map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.titulo}</div>
                          {item.embedding_dimensions && (
                            <div className="text-xs text-muted-foreground">
                              Embedding: {item.embedding_dimensions} dimensões
                            </div>
                          )}
                          {item.erro && (
                            <div className="text-xs text-red-600 mt-1">{item.erro}</div>
                          )}
                        </div>
                        <Badge variant={item.status === 'sucesso' ? 'default' : 'destructive'}>
                          {item.status === 'sucesso' ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Sucesso
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Falha
                            </>
                          )}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};