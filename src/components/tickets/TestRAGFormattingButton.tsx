import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useResponseProcessor } from "@/hooks/useResponseProcessor";
import { Loader2, TestTube } from "lucide-react";
import { useState } from "react";

export const TestRAGFormattingButton = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { processResponse, isProcessing } = useResponseProcessor();

  const testFormatting = async () => {
    setLoading(true);
    try {
      console.log('🧪 Testando formatação de resposta...');
      
      const testMessage = "Oi, para voce cadatrar roupa bebe no sistama e so ir no nivel 1 roupa bebe, nivel 2 calca, nivel 3 tipo da calca, nivel 4 condicao da peca. depois e so seguir a avaliacao normal. qualquer duvida me chama";
      const testTicketId = "test-ticket-id";
      const testUserId = "test-user-id";

      const result = await processResponse(testMessage, testTicketId, testUserId);
      
      console.log('🧪 Resultado do teste:', result);

      toast({
        title: "✅ Teste Concluído",
        description: result.processData ? 
          `Formatação processada com sucesso` :
          "Resposta processada (modo legado)",
      });

      // Mostrar a resposta formatada em um alert para comparação
      if (result.respostaFinal !== testMessage) {
        console.log('📝 Original:', testMessage);
        console.log('✨ Formatada:', result.respostaFinal);
        
        setTimeout(() => {
          alert(`ORIGINAL:\n${testMessage}\n\nFORMATADA:\n${result.respostaFinal}`);
        }, 500);
      }
      
    } catch (error) {
      console.error('Erro no teste de formatação:', error);
      toast({
        title: "❌ Erro no Teste",
        description: "Não foi possível testar a formatação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || isProcessing;

  return (
    <Button
      onClick={testFormatting}
      disabled={isLoading}
      size="sm"
      variant="outline"
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <TestTube className="h-4 w-4" />
      )}
      {isLoading ? "Testando..." : "Testar Formatação RAG"}
    </Button>
  );
};