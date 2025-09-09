import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Brain, CheckCircle, AlertTriangle } from 'lucide-react';

interface DocumentoSimilar {
  id: string;
  titulo: string;
  categoria: string;
  versao: number;
  similaridade: number;
  conteudo_preview: string;
}

interface ResultadoTeste {
  documentos_relacionados: DocumentoSimilar[];
  recomendacao: string;
  analise_comparativa?: string;
  deve_criar_novo: boolean;
}

export const TesteRAGSemantico = () => {
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const { toast } = useToast();

  const executarTeste = async () => {
    if (!titulo.trim() && !conteudo.trim()) {
      toast({
        title: "Erro",
        description: "Digite um título ou conteúdo para testar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-semantic-rag', {
        body: {
          titulo: titulo.trim(),
          conteudo: conteudo.trim()
        }
      });

      if (error) {
        throw error;
      }

      setResultado(data);
      toast({
        title: "Análise Concluída",
        description: `Encontrados ${data.documentos_relacionados?.length || 0} documentos similares`,
      });
    } catch (error) {
      console.error('Erro no teste RAG:', error);
      toast({
        title: "Erro no Teste",
        description: "Falha ao executar análise semântica",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Teste de Detecção de Conteúdo Similar
          </CardTitle>
          <CardDescription>
            Teste como a IA analisa similaridade de documentos e fornece recomendações inteligentes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="titulo">Título do Documento</Label>
              <Input
                id="titulo"
                placeholder="Ex: Como configurar sistema de vendas"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="conteudo">Conteúdo</Label>
              <Textarea
                id="conteudo"
                placeholder="Ex: Este documento explica como configurar o sistema para vendas de produtos..."
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          
          <Button 
            onClick={executarTeste} 
            disabled={loading || (!titulo.trim() && !conteudo.trim())}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analisando Similaridade...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Testar Detecção de Similaridade
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <div className="space-y-6">
          {/* Recomendação da IA */}
          <Card className={resultado.deve_criar_novo ? "border-green-200 bg-green-50 dark:bg-green-950" : "border-orange-200 bg-orange-50 dark:bg-orange-950"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {resultado.deve_criar_novo ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                )}
                Recomendação da IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={resultado.deve_criar_novo ? "text-green-800 dark:text-green-200" : "text-orange-800 dark:text-orange-200"}>
                {resultado.recomendacao}
              </p>
            </CardContent>
          </Card>

          {/* Análise Comparativa Detalhada */}
          {resultado.analise_comparativa && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-500" />
                  Análise Comparativa Detalhada
                </CardTitle>
                <CardDescription>
                  Análise inteligente das relações entre o novo documento e os existentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap text-sm">
                    {resultado.analise_comparativa}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documentos Similares Encontrados */}
          {resultado.documentos_relacionados && resultado.documentos_relacionados.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Documentos Similares Encontrados ({resultado.documentos_relacionados.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {resultado.documentos_relacionados.map((doc, index) => (
                    <div key={doc.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium">{doc.titulo}</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{doc.categoria}</Badge>
                          <Badge 
                            variant="outline" 
                            className={doc.similaridade >= 80 ? "border-red-200 text-red-700" : 
                                     doc.similaridade >= 60 ? "border-orange-200 text-orange-700" : 
                                     "border-blue-200 text-blue-700"}
                          >
                            {doc.similaridade}% similar
                          </Badge>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        Versão {doc.versao}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {doc.conteudo_preview}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-200">
            Como Funciona a Análise de Similaridade
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 dark:text-blue-300">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Análise Semântica:</strong> Usa embeddings para entender o contexto do conteúdo</li>
            <li><strong>Busca Híbrida:</strong> Combina similaridade vetorial (85%) + relevância textual (15%)</li>
            <li><strong>Re-ranking com IA:</strong> GPT re-analisa e classifica a relevância dos documentos</li>
            <li><strong>Análise Comparativa:</strong> Explica as relações e fornece recomendações estratégicas</li>
            <li><strong>Filtragem Contextual:</strong> Prioriza conteúdo semanticamente relevante sobre palavras similares</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};