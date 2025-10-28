import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Building2,
  User,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  AlertCircle,
} from 'lucide-react';
import type { Acompanhamento } from '@/hooks/useAcompanhamento';
import { formatDateBR } from '@/lib/date-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AcompanhamentoDetailProps {
  acompanhamento: Acompanhamento | null;
  isOpen: boolean;
  onClose: () => void;
  onAgendarReuniao: () => void;
  onConfirmarReuniao?: (id: string) => Promise<boolean>;
  onFinalizarAcompanhamento?: (id: string) => Promise<boolean>;
}

export const AcompanhamentoDetail = ({
  acompanhamento,
  isOpen,
  onClose,
  onAgendarReuniao,
  onConfirmarReuniao,
  onFinalizarAcompanhamento,
}: AcompanhamentoDetailProps) => {
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

  if (!acompanhamento) return null;

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Não definido';
    try {
      return formatDateBR(dateString);
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return 'Não definido';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'em_acompanhamento':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'reuniao_agendada':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'plano_criado':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'em_acompanhamento':
        return 'Em Acompanhamento';
      case 'reuniao_agendada':
        return 'Reunião Agendada';
      case 'plano_criado':
        return 'Plano Criado';
      default:
        return status;
    }
  };

  const handleConfirmarReuniao = async () => {
    if (!onConfirmarReuniao || !acompanhamento.id) return;
    setLoading(true);
    try {
      const success = await onConfirmarReuniao(acompanhamento.id);
      if (success) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = async () => {
    if (!onFinalizarAcompanhamento || !acompanhamento.id) return;
    setLoading(true);
    try {
      const success = await onFinalizarAcompanhamento(acompanhamento.id);
      if (success) {
        setShowCancelDialog(false);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizar = async () => {
    if (!onFinalizarAcompanhamento || !acompanhamento.id) return;
    setLoading(true);
    try {
      const success = await onFinalizarAcompanhamento(acompanhamento.id);
      if (success) {
        setShowFinalizeDialog(false);
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const renderActions = () => {
    switch (acompanhamento.status) {
      case 'em_acompanhamento':
        return (
          <Button onClick={onAgendarReuniao} className="w-full">
            <Calendar className="h-4 w-4 mr-2" />
            Agendar Reunião Inicial
          </Button>
        );

      case 'reuniao_agendada':
        return (
          <div className="flex flex-col gap-2">
            {!acompanhamento.reuniao_confirmada && (
              <Button onClick={handleConfirmarReuniao} disabled={loading} className="w-full">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar Reunião
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onAgendarReuniao}
                disabled={loading}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Reagendar
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowCancelDialog(true)}
                disabled={loading}
                className="flex-1"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </div>
        );

      case 'plano_criado':
        return (
          <Button
            onClick={() => setShowFinalizeDialog(true)}
            disabled={loading}
            className="w-full"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Finalizar Acompanhamento
          </Button>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>Unidade em Acompanhamento</span>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(90vh-180px)] overflow-y-auto pr-4">
            <div className="space-y-4 p-1">
              {/* Informações da Unidade */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Informações da Unidade</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Código do Grupo</p>
                        <p className="text-lg font-mono font-bold text-primary">
                          {acompanhamento.codigo_grupo}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(acompanhamento.status)}>
                      {getStatusLabel(acompanhamento.status)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Nome da Unidade</p>
                        <p className="font-medium">
                          {acompanhamento.unidade?.fantasy_name ||
                            acompanhamento.unidade?.grupo ||
                            `Unidade ${acompanhamento.codigo_grupo}`}
                        </p>
                      </div>
                    </div>

                    {(acompanhamento.unidade?.cidade || acompanhamento.unidade?.estado) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Localização</p>
                          <p className="font-medium">
                            {[acompanhamento.unidade?.cidade, acompanhamento.unidade?.estado]
                              .filter(Boolean)
                              .join(' - ')}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Em acompanhamento desde</p>
                        <p className="font-medium">{formatDate(acompanhamento.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Informações da Reunião */}
              {acompanhamento.reuniao_inicial_data && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Reunião Inicial
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {acompanhamento.responsavel_reuniao_nome && (
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Consultor Responsável</p>
                            <p className="font-medium">{acompanhamento.responsavel_reuniao_nome}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Data e Hora</p>
                          <p className="font-medium">
                            {formatDateTime(acompanhamento.reuniao_inicial_data)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <CheckCircle2
                          className={`h-4 w-4 mt-0.5 ${
                            acompanhamento.reuniao_confirmada
                              ? 'text-green-500'
                              : 'text-muted-foreground'
                          }`}
                        />
                        <div>
                          <p className="text-xs text-muted-foreground">Status de Confirmação</p>
                          <p
                            className={`font-medium ${
                              acompanhamento.reuniao_confirmada
                                ? 'text-green-500'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {acompanhamento.reuniao_confirmada ? 'Confirmada' : 'Pendente'}
                          </p>
                        </div>
                      </div>

                      {acompanhamento.reuniao_proxima_data && (
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-xs text-muted-foreground">Próxima Reunião</p>
                            <p className="font-medium">
                              {formatDateTime(acompanhamento.reuniao_proxima_data)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          </ScrollArea>

          {/* Ações */}
          <div className="mt-4 space-y-2">
            {renderActions()}
            <Button variant="outline" onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs de Confirmação */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Acompanhamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o acompanhamento desta unidade? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelar} disabled={loading}>
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Acompanhamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar o acompanhamento desta unidade? O registro será
              arquivado e não aparecerá mais no quadro de acompanhamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalizar} disabled={loading}>
              Confirmar Finalização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
