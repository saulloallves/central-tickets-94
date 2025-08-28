import { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRole } from '@/hooks/useRole';
import { useTickets } from '@/hooks/useTickets';
import { supabase } from '@/integrations/supabase/client';

interface FormData {
  titulo: string;
  descricao: string;
  prioridade: 'crise' | 'imediato' | 'ate_1_hora' | 'ainda_hoje' | 'posso_esperar';
  categoria: 'midia' | 'rh' | 'juridico' | 'sistema' | 'operacoes' | 'financeiro' | 'outro';
  equipe_id: string;
}

const formSchema = yup.object().shape({
  titulo: yup.string().required('Título é obrigatório'),
  descricao: yup.string().required('Descrição é obrigatória'),
  prioridade: yup.string().oneOf(['crise', 'imediato', 'ate_1_hora', 'ainda_hoje', 'posso_esperar']).required('Prioridade é obrigatória'),
  categoria: yup.string().oneOf(['midia', 'rh', 'juridico', 'sistema', 'operacoes', 'financeiro', 'outro']).required('Categoria é obrigatória'),
  equipe_id: yup.string().required('Equipe é obrigatória'),
}) as yup.ObjectSchema<FormData>;

export function CreateTicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isAdmin, isSupervisor } = useRole();
  const { createTicket } = useTickets({
    search: '',
    status: '',
    categoria: '',
    prioridade: '',
    unidade_id: '',
    status_sla: '',
    equipe_id: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [unidades, setUnidades] = useState<{ id: string; nome: string; }[]>([]);
  const [selectedUnidade, setSelectedUnidade] = useState<string | null>(null);
  const [equipes, setEquipes] = useState<{ id: string; nome: string; }[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      prioridade: 'posso_esperar',
      categoria: 'outro',
      equipe_id: '',
    },
  });

  useEffect(() => {
    const fetchUnidades = async () => {
      try {
        const { data, error } = await supabase
          .from('unidades')
          .select('id, grupo, cidade, uf')
          .order('grupo');

        if (error) {
          console.error('Erro ao buscar unidades:', error);
          toast({
            title: "Erro",
            description: "Erro ao carregar unidades",
            variant: "destructive",
          });
          return;
        }

        if (data) {
          const transformedData = data.map(item => ({
            id: item.id,
            nome: `${item.grupo} - ${item.cidade}/${item.uf}`
          }));
          setUnidades(transformedData);
        }
      } catch (error) {
        console.error('Erro ao buscar unidades:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar unidades",
          variant: "destructive",
        });
      }
    };

    const fetchEquipes = async () => {
      try {
        const { data, error } = await supabase
          .from('equipes')
          .select('id, nome')
          .order('nome');

        if (error) {
          console.error('Erro ao buscar equipes:', error);
          toast({
            title: "Erro",
            description: "Erro ao carregar equipes",
            variant: "destructive",
          });
          return;
        }

        if (data) {
          setEquipes(data);
        }
      } catch (error) {
        console.error('Erro ao buscar equipes:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar equipes",
          variant: "destructive",
        });
      }
    };

    fetchUnidades();
    fetchEquipes();
  }, [toast]);

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      setSubmitting(true);
      console.log('📝 Creating ticket with data:', data);

      const ticketData = {
        titulo: data.titulo,
        descricao_problema: data.descricao,
        prioridade: data.prioridade,
        categoria: data.categoria,
        unidade_id: selectedUnidade || '',
        equipe_responsavel_id: data.equipe_id || null,
        criado_por: user?.id,
        status: 'aberto' as const,
        canal_origem: 'web' as const,
        canal_resposta: 'web' as const,
        position: Math.floor(Date.now() / 1000),
      };

      const result = await createTicket(ticketData);

      if (result.error) {
        console.error('❌ Erro ao criar ticket:', result.error);
        toast({
          title: "Erro",
          description: "Erro ao criar ticket. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Ticket criado com sucesso:', result.data?.id);
      
      toast({
        title: "Sucesso!",
        description: `Ticket criado com sucesso!`,
      });

      reset();
      setSelectedUnidade('');
      onOpenChange(false);

    } catch (error) {
      console.error('❌ Erro inesperado ao criar ticket:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Ticket de Suporte</DialogTitle>
          <DialogDescription>Preencha os campos abaixo para criar um novo ticket.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              placeholder="Título do ticket"
              type="text"
              {...register('titulo')}
            />
            {errors.titulo && (
              <p className="text-sm text-red-500">{errors.titulo.message}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="descricao">Descrição do Problema</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva o problema detalhadamente"
              {...register('descricao')}
            />
            {errors.descricao && (
              <p className="text-sm text-red-500">{errors.descricao.message}</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select {...register('prioridade')} defaultValue="posso_esperar">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crise">Crise</SelectItem>
                  <SelectItem value="imediato">Imediato (15min)</SelectItem>
                  <SelectItem value="ate_1_hora">Até 1 hora</SelectItem>
                  <SelectItem value="ainda_hoje">Ainda Hoje (18h)</SelectItem>
                  <SelectItem value="posso_esperar">Posso Esperar (24h)</SelectItem>
                </SelectContent>
              </Select>
              {errors.prioridade && (
                <p className="text-sm text-red-500">{errors.prioridade.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select {...register('categoria')} defaultValue="outro">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="midia">Mídia</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                  <SelectItem value="juridico">Jurídico</SelectItem>
                  <SelectItem value="sistema">Sistema</SelectItem>
                  <SelectItem value="operacoes">Operações</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              {errors.categoria && (
                <p className="text-sm text-red-500">{errors.categoria.message}</p>
              )}
            </div>
          </div>
          {(isAdmin || isSupervisor) && (
            <div className="grid gap-2">
              <Label htmlFor="unidade">Unidade</Label>
              <Select onValueChange={setSelectedUnidade}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((unidade) => (
                    <SelectItem key={unidade.id} value={unidade.id}>
                      {unidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="equipe_id">Equipe Responsável</Label>
            <Select {...register('equipe_id')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione a equipe responsável" />
              </SelectTrigger>
              <SelectContent>
                {equipes.map((equipe) => (
                  <SelectItem key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.equipe_id && (
              <p className="text-sm text-red-500">{errors.equipe_id.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar Ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
