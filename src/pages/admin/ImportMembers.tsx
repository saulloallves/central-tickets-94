import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, RefreshCw, CheckCircle2, AlertCircle, FileUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CSVMember {
  email: string;
  full_name: string;
  phone: string;
  user_type: 'Administrator' | 'Regular User';
  member_status: 'active' | 'inactive';
}

export default function ImportMembers() {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [fileName, setFileName] = useState('');

  const parseCSV = (text: string): CSVMember[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) throw new Error('Arquivo CSV vazio');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const emailIdx = headers.indexOf('email');
    const nameIdx = headers.indexOf('full_name');
    const phoneIdx = headers.indexOf('phone');
    const typeIdx = headers.indexOf('user_type');
    const statusIdx = headers.indexOf('member_status');

    if (emailIdx === -1 || nameIdx === -1) {
      throw new Error('CSV deve conter as colunas: email, full_name');
    }

    const members: CSVMember[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      if (values[emailIdx] && values[nameIdx]) {
        members.push({
          email: values[emailIdx],
          full_name: values[nameIdx],
          phone: values[phoneIdx] || '',
          user_type: values[typeIdx] as any || 'Regular User',
          member_status: values[statusIdx] as any || 'active',
        });
      }
    }

    return members;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    try {
      setImporting(true);
      setResults(null);

      const text = await file.text();
      const members = parseCSV(text);
      
      const activeMembers = members.filter(m => m.member_status === 'active');

      toast({
        title: "Iniciando Importação",
        description: `Processando ${activeMembers.length} membros ativos de ${members.length} total...`,
      });

      const { data, error } = await supabase.functions.invoke('import-franchising-members', {
        body: { members: activeMembers }
      });

      if (error) throw error;

      setResults(data.results);

      toast({
        title: "Importação Concluída",
        description: data.message,
      });

    } catch (error: any) {
      console.error('Error importing:', error);
      toast({
        title: "Erro na Importação",
        description: error.message || "Não foi possível importar os membros",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Importar Usuários via CSV
          </CardTitle>
          <CardDescription>
            Faça upload do arquivo CSV com os dados dos membros para importar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Como funciona:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Apenas membros com status "active" serão importados</li>
                <li>Usuários já existentes serão ignorados</li>
                <li>Cada usuário receberá email para definir senha</li>
                <li>No primeiro acesso, escolherão sua equipe</li>
                <li>Roles serão atribuídas automaticamente (Administrator → admin, Regular User → colaborador)</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Arquivo CSV
              <span className="text-muted-foreground ml-2 text-xs">
                (colunas: email, full_name, phone, user_type, member_status)
              </span>
            </label>
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={importing}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="text-sm">
                  <span className="font-semibold text-primary">
                    Clique para fazer upload
                  </span>
                  {' '}ou arraste o arquivo aqui
                </div>
                {fileName && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Arquivo selecionado: {fileName}
                  </div>
                )}
              </label>
            </div>
          </div>

          {importing && (
            <div className="flex items-center justify-center gap-2 p-4 bg-muted/50 rounded-lg">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Processando importação...</span>
            </div>
          )}

          {results && (
            <div className="space-y-3 pt-4 border-t">
              <h3 className="font-semibold">Resultados da Importação</h3>
              
              {results.success.length > 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <strong className="text-green-600">
                      {results.success.length} usuários criados com sucesso
                    </strong>
                    <ul className="list-disc list-inside mt-2 text-sm">
                      {results.success.slice(0, 5).map((email: string) => (
                        <li key={email}>{email}</li>
                      ))}
                      {results.success.length > 5 && (
                        <li className="text-muted-foreground">
                          ...e mais {results.success.length - 5} usuários
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {results.skipped.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    <strong className="text-amber-600">
                      {results.skipped.length} usuários ignorados
                    </strong>
                    <p className="text-sm mt-1 text-muted-foreground">
                      Estes usuários já existem no sistema ou estão inativos
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {results.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{results.errors.length} erros</strong>
                    <ul className="list-disc list-inside mt-2 text-sm">
                      {results.errors.slice(0, 3).map((err: any) => (
                        <li key={err.email}>
                          {err.email}: {err.error}
                        </li>
                      ))}
                      {results.errors.length > 3 && (
                        <li>...e mais {results.errors.length - 3} erros</li>
                      )}
                    </ul>
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
