import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Eye, RefreshCw, Users, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SyncPreview {
  total_unidades: number;
  atendentes_concierge: number;
  atendentes_dfcom: number;
  unidades_com_concierge: Array<{
    unidade_id: string;
    grupo: string;
    atendente: string;
    telefone?: string;
  }>;
  unidades_com_dfcom: Array<{
    unidade_id: string;
    grupo: string;
    atendente: string;
    telefone?: string;
  }>;
  novos_atendentes: Array<{
    nome: string;
    tipo: string;
    telefone?: string;
    unidade_id: string;
  }>;
  conflitos: Array<{
    nome: string;
    tipo: string;
    acao: string;
  }>;
}

export const SyncAtendentesExternos = () => {
  const { toast } = useToast();
  const [preview, setPreview] = useState<SyncPreview | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const handlePreview = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('sync-atendentes', {
        body: { action: 'preview' }
      });

      if (error) throw error;

      setPreview(data.preview);
      setShowPreviewDialog(true);
      
      toast({
        title: "Preview Carregado",
        description: `${data.preview.total_unidades} unidades encontradas`,
      });
    } catch (error) {
      console.error('Error previewing sync:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o preview",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const { data, error } = await supabase.functions.invoke('sync-atendentes', {
        body: { action: 'sync' }
      });

      if (error) throw error;

      setLastSync(new Date().toLocaleString());
      setShowPreviewDialog(false);
      
      toast({
        title: "Sincronização Concluída",
        description: `${data.stats.criados} atendentes criados, ${data.stats.atualizados} atualizados`,
      });

      // Refresh preview after sync
      await handlePreview();
    } catch (error) {
      console.error('Error syncing:', error);
      toast({
        title: "Erro na Sincronização",
        description: "Não foi possível sincronizar os atendentes",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Sincronizar Atendentes Externos
          </CardTitle>
          <CardDescription>
            Importar atendentes da tabela externa de unidades (concierge_name, dfcom_name)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={handlePreview}
              disabled={loading}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              {loading ? 'Carregando...' : 'Visualizar Dados'}
            </Button>
            
            <Button 
              onClick={handleSync}
              disabled={syncing || !preview}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          </div>

          {lastSync && (
            <div className="text-sm text-muted-foreground">
              Última sincronização: {lastSync}
            </div>
          )}

          {preview && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{preview.total_unidades}</div>
                <div className="text-sm text-blue-700">Unidades Total</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{preview.atendentes_concierge}</div>
                <div className="text-sm text-green-700">Concierge</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{preview.atendentes_dfcom}</div>
                <div className="text-sm text-purple-700">DFCom</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview da Sincronização</DialogTitle>
            <DialogDescription>
              Revise os dados que serão importados antes de sincronizar
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-xl font-bold text-blue-600">{preview.novos_atendentes.length}</div>
                  <div className="text-xs text-blue-700">Novos</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-xl font-bold text-yellow-600">{preview.conflitos.length}</div>
                  <div className="text-xs text-yellow-700">Atualizações</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-xl font-bold text-green-600">{preview.atendentes_concierge}</div>
                  <div className="text-xs text-green-700">Concierge</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-xl font-bold text-purple-600">{preview.atendentes_dfcom}</div>
                  <div className="text-xs text-purple-700">DFCom</div>
                </div>
              </div>

              {/* Novos Atendentes */}
              {preview.novos_atendentes.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Novos Atendentes ({preview.novos_atendentes.length})
                  </h3>
                  <div className="grid gap-2 max-h-48 overflow-y-auto">
                    {preview.novos_atendentes.map((atendente, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            {atendente.tipo}
                          </Badge>
                          <span className="font-medium">{atendente.nome}</span>
                          {atendente.telefone && (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {atendente.telefone}
                            </span>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {atendente.unidade_id}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conflitos/Atualizações */}
              {preview.conflitos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    Atualizações ({preview.conflitos.length})
                  </h3>
                  <div className="grid gap-2 max-h-48 overflow-y-auto">
                    {preview.conflitos.map((conflito, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">
                            {conflito.tipo}
                          </Badge>
                          <span className="font-medium">{conflito.nome}</span>
                        </div>
                        <Badge variant="default" className="text-xs">
                          {conflito.acao}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPreviewDialog(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSync}
                  disabled={syncing}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando...' : 'Confirmar Sincronização'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};