import { useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
interface TestResult {
  success: boolean;
  webhook_response?: any;
  analyze_response?: any;
  ticket_data?: any;
  error?: string;
}
export const TestAIButton = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const {
    toast
  } = useToast();
  const runTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      // Simular um POST para o webhook do typebot
      // Usar o cliente Supabase para chamar a função
      const {
        data: webhookData,
        error: webhookError
      } = await supabase.functions.invoke('typebot-webhook', {
        body: {
          message: "Teste da IA: O sistema de vendas está apresentando lentidão e travamentos frequentes. Os clientes estão reclamando.",
          codigo_unidade: "1659",
          user: {
            web_password: "16331783"
          },
          category_hint: "sistema",
          force_create: true
        }
      });
      if (webhookError) {
        throw new Error(`Webhook failed: ${webhookError.message}`);
      }

      // Buscar os dados do ticket criado para verificar se a IA funcionou
      const ticketId = webhookData.data?.ticket_id;
      if (ticketId) {
        const {
          data: ticketData
        } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
        setResult({
          success: true,
          webhook_response: webhookData,
          ticket_data: ticketData
        });
        toast({
          title: "Teste da IA concluído",
          description: `Ticket ${ticketData?.codigo_ticket} criado e analisado pela IA`
        });
      } else {
        throw new Error('No ticket ID returned from webhook');
      }
    } catch (error: any) {
      console.error('Test error:', error);
      setResult({
        success: false,
        error: error.message
      });
      toast({
        title: "Erro no teste da IA",
        description: error.message,
        variant: "destructive"
      });
    }
    setLoading(false);
  };
  const formatJSON = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };
  return <>
      

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teste da Análise por IA</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={runTest} disabled={loading} className="flex-1">
                {loading ? <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Executando teste...
                  </> : <>
                    <Brain className="h-4 w-4 mr-2" />
                    Executar Teste
                  </>}
              </Button>
            </div>

            {result && <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? "SUCESSO" : "ERRO"}
                      </Badge>
                      Resultado do Teste
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.success ? <div className="space-y-4">
                        {result.ticket_data && <div>
                            <h4 className="font-semibold mb-2">Dados do Ticket Analisado:</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <strong>Código:</strong> {result.ticket_data.codigo_ticket}
                              </div>
                              <div>
                                <strong>Categoria:</strong> {result.ticket_data.categoria || 'Não definida'}
                              </div>
                              <div>
                                <strong>Subcategoria:</strong> {result.ticket_data.subcategoria || 'Não definida'}
                              </div>
                              <div>
                                <strong>Prioridade:</strong> {result.ticket_data.prioridade}
                              </div>
                              <div>
                                <strong>Equipe:</strong> {result.ticket_data.equipe_responsavel_id || 'Não atribuída'}
                              </div>
                              <div>
                                <strong>IA Executou:</strong> {result.ticket_data.log_ia ? 'SIM' : 'NÃO'}
                              </div>
                            </div>
                            
                            {result.ticket_data.log_ia && <div className="mt-4">
                                <h5 className="font-semibold mb-2">Log da Análise IA:</h5>
                                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                  {formatJSON(result.ticket_data.log_ia)}
                                </pre>
                              </div>}
                          </div>}

                        {result.webhook_response && <div>
                            <h4 className="font-semibold mb-2">Resposta do Webhook:</h4>
                            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                              {formatJSON(result.webhook_response)}
                            </pre>
                          </div>}
                      </div> : <div className="text-destructive">
                        <strong>Erro:</strong> {result.error}
                      </div>}
                  </CardContent>
                </Card>
              </div>}
          </div>
        </DialogContent>
      </Dialog>
    </>;
};