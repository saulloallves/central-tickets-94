import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TestTube } from 'lucide-react';
import { TesteRAGSemantico } from './TesteRAGSemantico';

export const EmbeddingTestTab = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const testEmbeddingFix = async () => {
    setTesting(true);
    try {
      console.log('🧪 Testando correção de embedding...');
      
      const { data, error } = await supabase.functions.invoke('test-embedding-fix', {
        body: {}
      });

      if (error) {
        throw error;
      }

      console.log('✅ Resultado do teste:', data);
      setResult(data);

      toast({
        title: data.success ? "Teste Concluído" : "Teste Falhou",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });

    } catch (error) {
      console.error('❌ Erro no teste:', error);
      toast({
        title: "Erro no Teste",
        description: "Falha ao executar teste de embedding",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Teste de Correção de Embeddings
          </CardTitle>
          <CardDescription>
            Regenera o embedding do documento de pró-labore e testa a busca semântica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={testEmbeddingFix} 
            disabled={testing}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executando Teste...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Testar Correção de Embedding
              </>
            )}
          </Button>

          {result && (
            <Card className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <CardHeader>
                <CardTitle className={result.success ? "text-green-800" : "text-red-800"}>
                  {result.success ? "✅ Teste Bem-sucedido" : "❌ Teste Falhou"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Mensagem:</strong> {result.message}</p>
                  
                  {result.document && (
                    <div>
                      <p><strong>Documento:</strong> {result.document.titulo}</p>
                      <p><strong>Dimensões do Embedding:</strong> {result.document.embedding_dimensions}</p>
                    </div>
                  )}
                  
                  {result.searchTest && (
                    <div>
                      <p><strong>Teste de Busca:</strong> "{result.searchTest.query}"</p>
                      <p><strong>Documentos encontrados:</strong> {result.searchTest.results}</p>
                      {result.searchTest.documents && result.searchTest.documents.length > 0 && (
                        <div className="mt-2">
                          <p><strong>Resultados:</strong></p>
                          <ul className="list-disc pl-5">
                            {result.searchTest.documents.map((doc, index) => (
                              <li key={index}>
                                {doc.titulo} - Similaridade: {(doc.similaridade * 100).toFixed(1)}%
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
      
      {/* Componente de Teste RAG Semântico */}
      <TesteRAGSemantico />
    </div>
  );
};