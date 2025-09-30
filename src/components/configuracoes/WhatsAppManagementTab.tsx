import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, MessageSquare, Loader2, Settings, TestTube, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TestZAPICredentials } from "./TestZAPICredentials";

export function WhatsAppManagementTab() {
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [instanceStatus, setInstanceStatus] = useState<'idle' | 'connected' | 'disconnected' | 'testing'>('idle');
  const [zapiConfig, setZapiConfig] = useState({
    instanceId: '',
    token: '',
    clientToken: '',
    baseUrl: 'https://api.z-api.io'
  });

  const testZAPIConnection = async () => {
    setIsTesting(true);
    setInstanceStatus('testing');
    
    try {
      const { data, error } = await supabase.functions.invoke('zapi-whatsapp', {
        body: { action: 'health_check' }
      });
      
      if (error) {
        throw error;
      }
      
      if (data?.zapi_configured) {
        setInstanceStatus('connected');
        toast({
          title: "Conexão Z-API testada com sucesso!",
          description: "A instância está configurada e respondendo.",
        });
      } else {
        setInstanceStatus('disconnected');
        toast({
          title: "Configuração Z-API incompleta",
          description: "Verifique as credenciais da instância.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao testar Z-API:', error);
      setInstanceStatus('disconnected');
      toast({
        title: "Erro ao testar conexão",
        description: "Não foi possível conectar com a instância Z-API.",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearConversations = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('whatsapp_conversas')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (error) {
        console.error('Erro ao limpar conversas:', error);
        toast({
          title: "Erro ao limpar conversas",
          description: "Não foi possível limpar as conversas do WhatsApp. Verifique suas permissões.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Conversas limpas com sucesso!",
        description: "Todas as conversas do WhatsApp foram removidas da base de dados.",
      });
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado ao limpar as conversas.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Teste de Credenciais Z-API */}
      <Card>
        <CardHeader>
          <CardTitle>Teste de Credenciais</CardTitle>
          <CardDescription>
            Verifique se as credenciais Z-API estão configuradas corretamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestZAPICredentials />
        </CardContent>
      </Card>

      <Separator />

      {/* Status da Instância Z-API */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Status da Instância Z-API
          </CardTitle>
          <CardDescription>
            Monitore e teste a conexão com a instância WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-3">
              {instanceStatus === 'connected' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {instanceStatus === 'disconnected' && <XCircle className="h-5 w-5 text-red-500" />}
              {instanceStatus === 'testing' && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
              {instanceStatus === 'idle' && <MessageSquare className="h-5 w-5 text-muted-foreground" />}
              
              <div>
                <p className="font-medium">
                  {instanceStatus === 'connected' && 'Instância Conectada'}
                  {instanceStatus === 'disconnected' && 'Instância Desconectada'}
                  {instanceStatus === 'testing' && 'Testando Conexão...'}
                  {instanceStatus === 'idle' && 'Status Desconhecido'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {instanceStatus === 'connected' && 'A instância está respondendo normalmente'}
                  {instanceStatus === 'disconnected' && 'Verifique as configurações da instância'}
                  {instanceStatus === 'testing' && 'Verificando conectividade...'}
                  {instanceStatus === 'idle' && 'Clique em testar para verificar o status'}
                </p>
              </div>
            </div>
            
            <Button 
              onClick={testZAPIConnection}
              disabled={isTesting}
              variant="outline"
              size="sm"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Testando...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Testar Conexão
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Gerenciamento de Conversas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Gerenciamento de Conversas WhatsApp
          </CardTitle>
          <CardDescription>
            Gerencie as conversas armazenadas do WhatsApp integrado via Z-API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <h3 className="font-medium text-foreground mb-2">Limpeza de Conversas</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Remove todas as conversas armazenadas na tabela whatsapp_conversas. Esta ação é irreversível.
            </p>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm"
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Limpar Todas as Conversas
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Limpeza de Conversas</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá remover permanentemente todas as conversas do WhatsApp armazenadas no sistema.
                    <br/><br/>
                    <strong>Esta ação não pode ser desfeita.</strong>
                    <br/><br/>
                    Tem certeza que deseja continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearConversations}
                    disabled={isLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Limpando...
                      </>
                    ) : (
                      'Sim, Limpar Conversas'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}