import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function ImportMembers() {
  const { toast } = useToast();
  const [sqlContent, setSqlContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<any>(null);

  const parseSQLInsert = (sql: string) => {
    try {
      // Extrair valores do INSERT
      const valuesMatch = sql.match(/VALUES\s+(.+)/is);
      if (!valuesMatch) throw new Error('SQL inválido');

      const valuesString = valuesMatch[1];
      const rows = [];
      
      // Regex para capturar cada linha de valores
      const rowRegex = /\(([^)]+)\)/g;
      let match;

      while ((match = rowRegex.exec(valuesString)) !== null) {
        const values = match[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));
        
        if (values.length >= 12) {
          rows.push({
            id: values[0],
            member_id: values[1],
            full_name: values[2],
            email: values[3],
            phone: values[4],
            job_title: values[5],
            user_type: values[6],
            password_hash: values[7],
            team_id: values[8],
            team_role: values[9],
            start_date: values[10],
            member_status: values[11],
          });
        }
      }

      return rows;
    } catch (error) {
      console.error('Erro ao parsear SQL:', error);
      throw new Error('Erro ao processar SQL. Verifique o formato.');
    }
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      setResults(null);

      const members = parseSQLInsert(sqlContent);

      toast({
        title: "Iniciando Importação",
        description: `Processando ${members.length} membros...`,
      });

      const { data, error } = await supabase.functions.invoke('import-franchising-members', {
        body: { members }
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
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Franchising Members
          </CardTitle>
          <CardDescription>
            Cole o conteúdo do arquivo SQL com os dados dos membros para importar
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
            <label className="text-sm font-medium">Conteúdo SQL</label>
            <Textarea
              placeholder="Cole aqui o INSERT INTO franchising_members..."
              value={sqlContent}
              onChange={(e) => setSqlContent(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <Button
            onClick={handleImport}
            disabled={importing || !sqlContent}
            className="w-full gap-2"
            size="lg"
          >
            {importing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Iniciar Importação
              </>
            )}
          </Button>

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
