import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, ArrowLeft, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';

interface ConversionResult {
  converted: string[];
  notFound: string[];
  errors: Array<{ email: string; error: string }>;
  stats: {
    total: number;
    converted: number;
    notFound: number;
    errors: number;
  };
}

export default function ConvertUsers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleConvert = async () => {
    if (!file) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo CSV para converter.",
        variant: "destructive",
      });
      return;
    }

    setConverting(true);
    setResult(null);

    try {
      // Parse CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const members = results.data.map((row: any) => ({
              email: row.email || row.Email,
              full_name: row.full_name || row['Full Name'] || row.name || row.Name,
              phone: row.phone || row.Phone
            })).filter(m => m.email);

            console.log(`📤 Enviando ${members.length} usuários para conversão...`);

            // Call edge function
            const { data, error } = await supabase.functions.invoke('convert-existing-users', {
              body: { members }
            });

            if (error) throw error;

            setResult(data);

            if (data.stats.converted > 0) {
              toast({
                title: "Conversão concluída!",
                description: `${data.stats.converted} usuário(s) convertido(s) com sucesso.`,
              });
            } else {
              toast({
                title: "Nenhum usuário convertido",
                description: "Verifique os detalhes abaixo.",
                variant: "destructive",
              });
            }

          } catch (error: any) {
            console.error('Erro ao converter:', error);
            toast({
              title: "Erro na conversão",
              description: error.message || "Não foi possível converter os usuários.",
              variant: "destructive",
            });
          } finally {
            setConverting(false);
          }
        },
        error: (error) => {
          console.error('Erro ao ler CSV:', error);
          toast({
            title: "Erro ao ler arquivo",
            description: "Verifique se o arquivo CSV está no formato correto.",
            variant: "destructive",
          });
          setConverting(false);
        }
      });

    } catch (error: any) {
      console.error('Erro geral:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro inesperado ao processar arquivo.",
        variant: "destructive",
      });
      setConverting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate('/admin/import-members')}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Importação
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6" />
            Converter Usuários Existentes
          </CardTitle>
          <CardDescription>
            Converta usuários já cadastrados para o fluxo de ativação via /welcome
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription className="space-y-2">
              <p className="font-semibold">Como funciona:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Use o <strong>mesmo CSV</strong> da importação original</li>
                <li>Apenas emails <strong>já existentes</strong> serão processados</li>
                <li>Senha será <strong>resetada</strong> para temporária</li>
                <li>Flag <code className="bg-muted px-1 rounded">is_imported_user</code> será ativada</li>
                <li>Usuários poderão usar <strong>/welcome</strong> para ativar conta</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {file ? file.name : 'Clique para selecionar arquivo CSV'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Formato: email, full_name, phone (opcional)
                </p>
              </label>
            </div>

            <Button
              onClick={handleConvert}
              disabled={!file || converting}
              className="w-full"
              size="lg"
            >
              {converting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Convertendo...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Converter Usuários
                </>
              )}
            </Button>
          </div>

          {result && (
            <div className="space-y-4 mt-6">
              <h3 className="font-semibold text-lg">Resultado da Conversão</h3>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{result.stats.total}</div>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">{result.stats.converted}</div>
                    <p className="text-xs text-muted-foreground">Convertidos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-yellow-600">{result.stats.notFound}</div>
                    <p className="text-xs text-muted-foreground">Não Encontrados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">{result.stats.errors}</div>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </CardContent>
                </Card>
              </div>

              {/* Converted */}
              {result.converted.length > 0 && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <p className="font-semibold text-green-900 mb-2">
                      ✅ {result.converted.length} usuário(s) convertido(s):
                    </p>
                    <div className="text-sm text-green-800 max-h-40 overflow-y-auto">
                      {result.converted.map((email, i) => (
                        <div key={i}>• {email}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Not Found */}
              {result.notFound.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription>
                    <p className="font-semibold text-yellow-900 mb-2">
                      ⚠️ {result.notFound.length} usuário(s) não encontrado(s):
                    </p>
                    <div className="text-sm text-yellow-800 max-h-40 overflow-y-auto">
                      {result.notFound.map((email, i) => (
                        <div key={i}>• {email}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription>
                    <p className="font-semibold text-red-900 mb-2">
                      ❌ {result.errors.length} erro(s):
                    </p>
                    <div className="text-sm text-red-800 max-h-40 overflow-y-auto">
                      {result.errors.map((err, i) => (
                        <div key={i}>
                          • {err.email}: {err.error}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {result.stats.converted > 0 && (
                <Alert>
                  <AlertDescription>
                    <p className="font-semibold mb-2">Próximos passos:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Compartilhe o link <code className="bg-muted px-1 rounded">/welcome</code> com os usuários convertidos</li>
                      <li>Eles farão login com email e senha temporária</li>
                      <li>Definirão nova senha e escolherão equipe</li>
                      <li>Conta será ativada automaticamente! 🎉</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
