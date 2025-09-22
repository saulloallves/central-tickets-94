import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Play, TestTube } from 'lucide-react';

export const TestFranqueadoNotification = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const testNotification = async () => {
    setIsLoading(true);
    
    try {
      console.log('🧪 Iniciando teste de notificação franqueado...');
      
      // Chama a edge function de teste
      const { data, error } = await supabase.functions.invoke('test-typebot-notification');
      
      if (error) {
        throw error;
      }
      
      console.log('🎯 Resultado do teste:', data);
      
      toast({
        title: "✅ Teste Executado",
        description: data.success 
          ? `Teste realizado com sucesso usando ticket ${data.ticket_usado?.codigo_ticket}`
          : `Erro no teste: ${data.error}`,
        variant: data.success ? "default" : "destructive",
      });
      
    } catch (error: any) {
      console.error('❌ Erro no teste:', error);
      toast({
        title: "Erro no teste",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TestTube className="h-5 w-5" />
          <span>Teste Notificação</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Testa a notificação de resposta do franqueado via Typebot. 
          Verifica se o som e o toast aparecem corretamente.
        </p>
        
        <Button 
          onClick={testNotification}
          disabled={isLoading}
          className="w-full"
        >
          <Play className="h-4 w-4 mr-2" />
          {isLoading ? 'Testando...' : 'Testar Notificação'}
        </Button>
      </CardContent>
    </Card>
  );
};