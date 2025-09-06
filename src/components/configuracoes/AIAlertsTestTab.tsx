import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAIAlertSystem } from "@/hooks/useAIAlertSystem";
import { AlertTriangle, Send, TestTube } from "lucide-react";

export function AIAlertsTestTab() {
  const [loading, setLoading] = useState(false);
  const [assistantName, setAssistantName] = useState("TestAssistant-Demo");
  const [errorType, setErrorType] = useState<string>("token_limit");
  const [location, setLocation] = useState("configuracoes/teste-alertas");
  const [errorDetails, setErrorDetails] = useState("Teste de alerta crítico de IA - limite de tokens simulado");
  const [ticketId, setTicketId] = useState("");
  
  const { toast } = useToast();
  const { sendAIAlert } = useAIAlertSystem();

  const handleSendTestAlert = async () => {
    setLoading(true);
    try {
      await sendAIAlert({
        assistantName,
        errorType: errorType as any,
        location,
        errorDetails,
        ticketId: ticketId || undefined,
        requestPayload: {
          test: true,
          timestamp: new Date().toISOString(),
          source: "alert-test-component"
        },
        responseData: {
          error: errorDetails,
          code: errorType
        }
      });

      toast({
        title: "✅ Alerta Enviado",
        description: "Alerta de teste enviado para o grupo WhatsApp da unidade TESTES DO MAKE",
      });
    } catch (error) {
      console.error('Erro ao enviar alerta de teste:', error);
      toast({
        title: "❌ Erro ao Enviar",
        description: "Falha ao enviar alerta de teste",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const predefinedTests = [
    {
      name: "Token Limit",
      assistantName: "SuggestReply-RAG",
      errorType: "token_limit",
      details: "O assistente atingiu o limite máximo de tokens durante a geração de resposta"
    },
    {
      name: "Rate Limit",
      assistantName: "AnalyzeTicket-AI", 
      errorType: "rate_limit",
      details: "Limite de taxa da API OpenAI excedido - muitas requisições simultâneas"
    },
    {
      name: "No Response",
      assistantName: "FAQ-Suggest-AI",
      errorType: "no_response",
      details: "Assistente não retornou nenhuma resposta após múltiplas tentativas"
    },
    {
      name: "Timeout",
      assistantName: "WhatsApp-RAG",
      errorType: "timeout",
      details: "Timeout na requisição - assistente demorou mais que 45 segundos para responder"
    }
  ];

  const runPredefinedTest = async (test: typeof predefinedTests[0]) => {
    setAssistantName(test.assistantName);
    setErrorType(test.errorType);
    setErrorDetails(test.details);
    setLocation(`teste-automatico/${test.errorType}`);
    
    // Auto enviar após 1 segundo
    setTimeout(async () => {
      await sendAIAlert({
        assistantName: test.assistantName,
        errorType: test.errorType as any,
        location: `teste-automatico/${test.errorType}`,
        errorDetails: test.details,
        requestPayload: { testType: test.name, automated: true },
        responseData: { error: test.details }
      });
      
      toast({
        title: `🧪 Teste ${test.name}`,
        description: "Alerta enviado automaticamente",
      });
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Sistema de Alertas de IA
          </CardTitle>
          <CardDescription>
            Configure e teste alertas automáticos para assistentes de IA. Os alertas são enviados para o grupo WhatsApp da unidade TESTES DO MAKE / RJ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assistant-name">Nome do Assistente</Label>
              <Input
                id="assistant-name"
                value={assistantName}
                onChange={(e) => setAssistantName(e.target.value)}
                placeholder="ex: SuggestReply-RAG"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="error-type">Tipo de Erro</Label>
              <Select value={errorType} onValueChange={setErrorType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="token_limit">📊 Limite de Tokens</SelectItem>
                  <SelectItem value="rate_limit">⏱️ Limite de Taxa</SelectItem>
                  <SelectItem value="internal_error">💥 Erro Interno</SelectItem>
                  <SelectItem value="no_response">🔇 Sem Resposta</SelectItem>
                  <SelectItem value="api_error">🔌 Erro de API</SelectItem>
                  <SelectItem value="timeout">⏰ Timeout</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Local do Erro</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ex: hooks/useAISuggestion/generateSuggestion"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-id">ID do Ticket (opcional)</Label>
            <Input
              id="ticket-id"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="UUID do ticket relacionado"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="error-details">Detalhes do Erro</Label>
            <Textarea
              id="error-details"
              value={errorDetails}
              onChange={(e) => setErrorDetails(e.target.value)}
              placeholder="Descrição detalhada do erro ou problema"
              rows={3}
            />
          </div>

          <Button 
            onClick={handleSendTestAlert} 
            disabled={loading || !assistantName || !errorType || !location}
            className="w-full"
          >
            {loading ? (
              <>
                <TestTube className="h-4 w-4 mr-2 animate-spin" />
                Enviando Alerta...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Alerta de Teste
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testes Pré-definidos</CardTitle>
          <CardDescription>
            Execute testes automáticos com cenários comuns de erro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {predefinedTests.map((test, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => runPredefinedTest(test)}
                className="h-auto p-4 text-left"
                disabled={loading}
              >
                <div>
                  <div className="font-semibold">{test.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {test.assistantName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {test.details.substring(0, 50)}...
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-semibold mb-1">Configuração Atual:</p>
              <ul className="space-y-1">
                <li>• Destino: Unidade TESTES DO MAKE / RJ</li>
                <li>• Canal: WhatsApp (id_grupo_branco)</li>
                <li>• Formato: Mensagem estruturada com emojis</li>
                <li>• Logs: Salvos em logs_de_sistema</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}