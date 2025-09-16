import { useState } from 'react';
import { Clock, Mail, Phone, Settings, RotateCcw, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface Atendente {
  id: string;
  nome: string;
  telefone?: string;
  email?: string;
  tipo: 'concierge' | 'dfcom';
  status: 'ativo' | 'pausa' | 'almoco' | 'indisponivel' | 'inativo';
  horario_inicio?: string;
  horario_fim?: string;
  capacidade_maxima: number;
  capacidade_atual: number;
  foto_perfil?: string;
  observacoes?: string;
  atendente_unidades?: {
    unidade_id: string;
    is_preferencial: boolean;
  }[];
}

interface AtendenteCardProps {
  atendente: Atendente;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onRedistribute: (tipo: 'concierge' | 'dfcom', unidade_id: string, motivo?: string) => Promise<any>;
}

export const AtendenteCard = ({ atendente, onStatusChange, onRedistribute }: AtendenteCardProps) => {
  const [showRedistributeDialog, setShowRedistributeDialog] = useState(false);
  const [redistributing, setRedistributing] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-500 hover:bg-green-600';
      case 'pausa': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'almoco': return 'bg-orange-500 hover:bg-orange-600';
      case 'indisponivel': return 'bg-red-500 hover:bg-red-600';
      case 'inativo': return 'bg-gray-500 hover:bg-gray-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ativo': return 'Ativo';
      case 'pausa': return 'Em Pausa';
      case 'almoco': return 'Almoço';
      case 'indisponivel': return 'Indisponível';
      case 'inativo': return 'Inativo';
      default: return status;
    }
  };

  const utilizacao = atendente.capacidade_maxima > 0 
    ? (atendente.capacidade_atual / atendente.capacidade_maxima) * 100 
    : 0;

  const handleRedistribute = async () => {
    if (!atendente.atendente_unidades?.length) return;
    
    setRedistributing(true);
    try {
      const unidadeId = atendente.atendente_unidades[0].unidade_id;
      await onRedistribute(
        atendente.tipo, 
        unidadeId, 
        `Redistribuição manual para ${atendente.nome}`
      );
      setShowRedistributeDialog(false);
    } catch (error) {
      console.error('Erro na redistribuição:', error);
    } finally {
      setRedistributing(false);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={atendente.foto_perfil} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-sm">{atendente.nome}</h3>
                <Badge variant="outline" className="text-xs">
                  {atendente.tipo === 'concierge' ? 'Concierge' : 'DFCom'}
                </Badge>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onStatusChange(atendente.id, 'ativo')}>
                  Marcar como Ativo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(atendente.id, 'pausa')}>
                  Marcar como Pausa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(atendente.id, 'almoco')}>
                  Marcar como Almoço
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onStatusChange(atendente.id, 'indisponivel')}>
                  Marcar como Indisponível
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowRedistributeDialog(true)}
                  className="text-blue-600"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Redistribuir Fila
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge className={getStatusColor(atendente.status)}>
              {getStatusLabel(atendente.status)}
            </Badge>
          </div>

          {/* Capacidade */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Capacidade</span>
              <span className="font-medium">
                {atendente.capacidade_atual}/{atendente.capacidade_maxima}
              </span>
            </div>
            <Progress value={utilizacao} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {utilizacao.toFixed(1)}% utilizado
            </p>
          </div>

          {/* Horário */}
          {atendente.horario_inicio && atendente.horario_fim && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Horário
              </span>
              <span className="font-medium">
                {atendente.horario_inicio} - {atendente.horario_fim}
              </span>
            </div>
          )}

          {/* Contato */}
          <div className="space-y-1">
            {atendente.telefone && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Phone className="h-3 w-3 mr-1" />
                {atendente.telefone}
              </div>
            )}
            {atendente.email && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Mail className="h-3 w-3 mr-1" />
                {atendente.email}
              </div>
            )}
          </div>

          {/* Unidades */}
          {atendente.atendente_unidades && atendente.atendente_unidades.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Unidades:</span>
              <div className="flex flex-wrap gap-1">
                {atendente.atendente_unidades.map((au, index) => (
                  <Badge 
                    key={index} 
                    variant={au.is_preferencial ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {au.unidade_id}
                    {au.is_preferencial && " ★"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          {atendente.observacoes && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">{atendente.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redistribution Dialog */}
      <AlertDialog open={showRedistributeDialog} onOpenChange={setShowRedistributeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redistribuir Fila</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja redistribuir a fila de atendimento de <strong>{atendente.nome}</strong>?
              <br /><br />
              Isso irá realocar todos os chamados em fila para outros atendentes disponíveis 
              do tipo <strong>{atendente.tipo === 'concierge' ? 'Concierge' : 'DFCom'}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRedistribute}
              disabled={redistributing}
            >
              {redistributing ? 'Redistribuindo...' : 'Redistribuir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};