import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TestTube } from "lucide-react";
import { useState } from "react";

export const TestOpenAIButton = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const testOpenAI = async () => {
    setLoading(true);
    try {
      console.log('Testando conexão OpenAI...');
      
      const { data, error } = await supabase.functions.invoke('test-openai-key', {
        body: {}
      });

      if (error) {
        console.error('Error testing OpenAI:', error);
        toast({
          title: "❌ Erro no Teste",
          description: "Não foi possível testar a conexão OpenAI",
          variant: "destructive",
        });
        return;
      }

      console.log('Resultado do teste OpenAI:', data);

      if (data.success) {
        toast({
          title: "✅ OpenAI OK",
          description: `API funcionando! Chave configurada corretamente`,
        });
      } else {
        toast({
          title: "❌ Problema na API",
          description: data.error || "Erro desconhecido",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error in OpenAI test:', error);
      toast({
        title: "❌ Erro",
        description: "Erro inesperado no teste",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={testOpenAI}
      disabled={loading}
      size="sm"
      variant="outline"
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <TestTube className="h-4 w-4" />
      )}
      {loading ? "Testando..." : "Testar OpenAI"}
    </Button>
  );
};