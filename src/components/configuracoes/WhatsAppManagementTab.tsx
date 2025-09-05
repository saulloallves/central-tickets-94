import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function WhatsAppManagementTab() {
  const [isLoading, setIsLoading] = useState(false);

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