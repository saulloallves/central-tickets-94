import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Brain, Zap } from 'lucide-react';

interface ResultadoSemantico {
  id: string;
  titulo: string;
  categoria: string;
  similaridade_vetorial: string;
  relevancia_semantica: string;
  score_final: string;
  conteudo_preview: string;
}

interface ResultadoTeste {
  busca_semantica: {
    total: number;
    documentos: ResultadoSemantico[];
    metodo: string;
  };
  busca_tradicional: {
    total: number;
    documentos: any[];
    metodo: string;
  };
}

export const TesteRAGSemantico = () => {
  const [query, setQuery] = useState('');
  const [assunto, setAssunto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const { toast } = useToast();

  const executarTeste = async () => {
    if (!query.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma consulta para testar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-semantic-rag', {
        body: {
          query: query.trim(),
          assunto: assunto.trim(),
          categoria: categoria.trim()
        }
      });

      if (error) {
        throw error;
      }

      setResultado(data.resultados);
      toast({
        title: "Teste Executado",
        description: `Encontrados ${data.resultados.busca_semantica.total} docs semânticos vs ${data.resultados.busca_tradicional.total} tradicionais`,
      });
    } catch (error) {
      console.error('Erro no teste RAG:', error);
      toast({
        title: "Erro no Teste",
        description: "Falha ao executar teste semântico",
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
            Teste RAG Semântico vs Tradicional
          </CardTitle>
          <CardDescription>
            Compare como o sistema entende ASSUNTOS através de embeddings semânticos vs busca tradicional
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="query">Consulta/Problema</Label>
              <Textarea
                id="query"
                placeholder="Ex: Cliente não consegue vender produtos no sistema"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="assunto">Assunto Principal</Label>
              <Input
                id="assunto"
                placeholder="Ex: Sistema travado, vendas"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="categoria">Categoria</Label>
              <Input
                id="categoria"
                placeholder="Ex: Sistema, Vendas, Técnico"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            onClick={executarTeste} 
            disabled={loading || !query.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executando Teste RAG...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Testar Busca Semântica
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Busca Semântica */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-500" />
                Busca Semântica ({resultado.busca_semantica.total})
              </CardTitle>
              <CardDescription>
                {resultado.busca_semantica.metodo}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {resultado.busca_semantica.documentos.map((doc, index) => (
                  <div key={doc.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{doc.titulo}</h4>
                      <Badge variant="secondary">{doc.categoria}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <div>
                        <span className="text-muted-foreground">Vetorial:</span>
                        <br />
                        <Badge variant="outline">{doc.similaridade_vetorial}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Semântica:</span>
                        <br />
                        <Badge variant="outline">{doc.relevancia_semantica}</Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Final:</span>
                        <br />
                        <Badge className="bg-blue-500">{doc.score_final}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {doc.conteudo_preview}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Busca Tradicional */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Busca Tradicional ({resultado.busca_tradicional.total})
              </CardTitle>
              <CardDescription>
                {resultado.busca_tradicional.metodo}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {resultado.busca_tradicional.documentos.map((doc, index) => (
                  <div key={doc.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{doc.titulo}</h4>
                      <Badge variant="secondary">{doc.categoria}</Badge>
                    </div>
                    <div className="mb-2">
                      <Badge variant="outline">{doc.similaridade}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {doc.conteudo_preview}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-200">
            Como Funciona a Busca Semântica
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 dark:text-blue-300">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Embedding Contextual:</strong> Cria representação vetorial rica em ASSUNTO/CONTEXTO</li>
            <li><strong>Score Híbrido:</strong> 70% similaridade vetorial + 30% relevância contextual</li>
            <li><strong>Filtros Semânticos:</strong> Bonus por categoria, palavras-chave e títulos relacionados</li>
            <li><strong>Compreensão de Assunto:</strong> Entende o PROBLEMA por trás das palavras</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};