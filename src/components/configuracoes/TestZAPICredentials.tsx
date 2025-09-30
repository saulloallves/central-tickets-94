import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const TestZAPICredentials = () => {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testCredentials = async () => {
    setTesting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-zapi-credentials');

      if (error) {
        throw error;
      }

      setResult(data);

      if (data.success) {
        toast({
          title: "✅ Credenciais Válidas",
          description: "As credenciais Z-API estão configuradas corretamente.",
        });
      } else {
        toast({
          title: "❌ Erro nas Credenciais",
          description: data.error || "Verifique as configurações do Z-API",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro ao testar credenciais:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível testar as credenciais",
        variant: "destructive",
      });
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Testar Credenciais Z-API</h3>
          <p className="text-sm text-muted-foreground">
            Verifique se as credenciais do Z-API estão configuradas corretamente
          </p>
        </div>
        <Button onClick={testCredentials} disabled={testing}>
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Testar Credenciais
            </>
          )}
        </Button>
      </div>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          {result.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {result.success ? "Credenciais Válidas" : "Erro nas Credenciais"}
          </AlertTitle>
          <AlertDescription>
            {result.success ? (
              <div className="space-y-2">
                <p>{result.message}</p>
                {result.instanceStatus && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.instanceStatus, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-semibold">{result.error}</p>
                {result.message && (
                  <p className="text-sm">{result.message}</p>
                )}
                {result.missing && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <p className="text-xs font-semibold mb-1">Credenciais faltando:</p>
                    <ul className="text-xs list-disc list-inside">
                      {result.missing.instanceId && <li>Instance ID</li>}
                      {result.missing.instanceToken && <li>Instance Token</li>}
                      {result.missing.clientToken && <li>Client Token</li>}
                    </ul>
                  </div>
                )}
                {result.details && (
                  <div className="mt-2 p-2 bg-muted rounded-md">
                    <p className="text-xs font-semibold mb-1">Detalhes do erro:</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Como configurar</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Para configurar as credenciais Z-API, você precisa adicionar os seguintes secrets:</p>
          <ul className="list-disc list-inside text-sm space-y-1 ml-4">
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">ZAPI_INSTANCE_ID</code> - ID da instância Z-API</li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">ZAPI_TOKEN</code> - Token da instância</li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">ZAPI_CLIENT_TOKEN</code> - Token do cliente</li>
          </ul>
          <p className="text-sm mt-2">
            Configure estes secrets no painel do Supabase em: 
            <br />
            <span className="text-xs text-muted-foreground">Settings → Edge Functions → Secrets</span>
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
};