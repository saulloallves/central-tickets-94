import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bug } from 'lucide-react';
export const TestNotificationButton = () => {
  const [isTesting, setIsTesting] = useState(false);
  const {
    toast
  } = useToast();
  const handleTestNotification = async () => {
    try {
      setIsTesting(true);
      console.log('🧪 Testando configuração de notificações...');
      const {
        data,
        error
      } = await supabase.functions.invoke('test-notifications');
      if (error) {
        console.error('❌ Erro no teste:', error);
        throw error;
      }
      console.log('🔍 Resultado do teste:', data);
      toast({
        title: "Teste de Notificações",
        description: data.success ? `Destino: ${data.destination || 'Não configurado'}` : `Erro: ${data.error}`,
        variant: data.success ? "default" : "destructive"
      });
    } catch (error: any) {
      console.error('💥 Erro ao testar notificações:', error);
      toast({
        title: "Erro",
        description: `Erro no teste: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };
  return (
    <Button
      onClick={handleTestNotification}
      disabled={isTesting}
      variant="outline"
      size="sm"
    >
      <Bug className={`h-4 w-4 ${isTesting ? 'animate-spin' : ''}`} />
    </Button>
  );
};