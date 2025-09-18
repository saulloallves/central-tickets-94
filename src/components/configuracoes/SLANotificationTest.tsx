import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Play, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface TestResult {
  success: boolean;
  message: string;
  steps?: any;
  data?: any;
  error?: string;
}

export const SLANotificationTest = () => {
  const [testTicketId, setTestTicketId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const { toast } = useToast();

  const runSLATest = async () => {
    if (!testTicketId.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, insira um ID de ticket para teste",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      console.log('🧪 Starting SLA notification test for ticket:', testTicketId);

      // Call the test function
      const { data, error } = await supabase.functions.invoke('test-sla-notification', {
        body: { ticketId: testTicketId }
      });

      if (error) {
        console.error('❌ Test function error:', error);
        setTestResult({
          success: false,
          message: 'Erro ao executar teste',
          error: error.message || 'Erro desconhecido'
        });
        toast({
          title: "Erro no Teste",
          description: error.message || 'Erro desconhecido',
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Test function response:', data);
      setTestResult(data);

      if (data.success) {
        toast({
          title: "Teste Concluído",
          description: data.message || 'Teste de notificação SLA executado com sucesso',
        });
      } else {
        toast({
          title: "Teste Falhou",
          description: data.error || 'Teste de notificação SLA falhou',
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('💥 Unexpected error:', error);
      setTestResult({
        success: false,
        message: 'Erro inesperado',
        error: error.message
      });
      toast({
        title: "Erro Inesperado",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepIcon = (success: boolean | undefined) => {
    if (success === undefined) return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
    return success ? 
      <CheckCircle className="h-4 w-4 text-success" /> : 
      <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getStepColor = (success: boolean | undefined) => {
    if (success === undefined) return 'text-muted-foreground';
    return success ? 'text-success' : 'text-destructive';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Teste de Notificação SLA
        </CardTitle>
        <CardDescription>
          Teste o sistema de notificações de SLA vencido para verificar se as mensagens estão sendo enviadas corretamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ticketId">ID do Ticket para Teste</Label>
          <Input
            id="ticketId"
            placeholder="Digite o ID do ticket (ex: 1b9ed873-b3eb-4e47-9791-d5e5e8eae4c0)"
            value={testTicketId}
            onChange={(e) => setTestTicketId(e.target.value)}
          />
        </div>

        <Button 
          onClick={runSLATest}
          disabled={isLoading || !testTicketId.trim()}
          className="w-full"
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Executando Teste...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Executar Teste SLA
            </>
          )}
        </Button>

        {testResult && (
          <div className="space-y-4">
            <Alert variant={testResult.success ? "default" : "destructive"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Resultado:</strong> {testResult.message}
                {testResult.error && (
                  <div className="mt-2 text-sm">
                    <strong>Erro:</strong> {testResult.error}
                  </div>
                )}
              </AlertDescription>
            </Alert>

            {testResult.steps && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detalhes do Teste</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className={`flex items-center gap-2 ${getStepColor(testResult.steps.ticket_found)}`}>
                      {getStepIcon(testResult.steps.ticket_found)}
                      <span>Ticket encontrado</span>
                    </div>
                    
                    <div className={`flex items-center gap-2 ${getStepColor(testResult.steps.zapi_configured)}`}>
                      {getStepIcon(testResult.steps.zapi_configured)}
                      <span>Z-API configurado</span>
                    </div>
                    
                    <div className={`flex items-center gap-2 ${getStepColor(testResult.steps.destination_found)}`}>
                      {getStepIcon(testResult.steps.destination_found)}
                      <span>Destino encontrado</span>
                    </div>
                    
                    <div className={`flex items-center gap-2 ${getStepColor(testResult.steps.message_prepared)}`}>
                      {getStepIcon(testResult.steps.message_prepared)}
                      <span>Mensagem preparada</span>
                    </div>
                    
                    {testResult.steps.direct_send && (
                      <div className={`flex items-center gap-2 ${getStepColor(testResult.steps.direct_send.success)}`}>
                        {getStepIcon(testResult.steps.direct_send.success)}
                        <span>Envio direto Z-API (Status: {testResult.steps.direct_send.status})</span>
                      </div>
                    )}
                    
                    {testResult.steps.process_function && (
                      <div className={`flex items-center gap-2 ${getStepColor(testResult.steps.process_function.success)}`}>
                        {getStepIcon(testResult.steps.process_function.success)}
                        <span>Função process-notifications</span>
                      </div>
                    )}
                  </div>

                  {testResult.data && (
                    <div className="mt-4 space-y-2">
                      <Label>Dados do Teste:</Label>
                      <Textarea
                        value={JSON.stringify(testResult.data, null, 2)}
                        readOnly
                        className="font-mono text-xs"
                        rows={8}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};