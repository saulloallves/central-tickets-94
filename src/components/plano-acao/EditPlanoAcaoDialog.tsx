import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { PlanoAcao } from '@/hooks/usePlanoAcao';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface EditPlanoAcaoDialogProps {
  plano: PlanoAcao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onUpdate: (id: string, data: Partial<PlanoAcao>) => Promise<boolean>;
}

export const EditPlanoAcaoDialog: React.FC<EditPlanoAcaoDialogProps> = ({
  plano,
  open,
  onOpenChange,
  onSuccess,
  onUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    categoria: '',
    setor: '',
    descricao: '',
    acoes: '',
    status: '',
    prazo: '',
    responsavel_local: '',
    upload: '',
  });

  // Pré-preencher formulário quando plano muda ou modal abre
  useEffect(() => {
    if (plano && open) {
      console.log('🔄 Carregando dados do plano para edição:', plano);
      
      // Normalizar categoria e setor antes de preencher
      const categoriaNormalizada = normalizeCategoriaValue(plano.categoria || '');
      const setorNormalizado = normalizeSetorValue(plano.setor || '');
      
      console.log('📝 Categoria original:', plano.categoria, '→ Normalizada:', categoriaNormalizada);
      console.log('📝 Setor original:', plano.setor, '→ Normalizado:', setorNormalizado);
      
      setFormData({
        titulo: plano.titulo || '',
        categoria: categoriaNormalizada,
        setor: setorNormalizado,
        descricao: plano.descricao || '',
        acoes: plano.acoes || '',
        status: plano.status || '',
        prazo: plano.prazo || '',
        responsavel_local: plano.responsavel_local || '',
        upload: plano.upload || '',
      });
    }
  }, [plano, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!plano) return;

    setLoading(true);
    try {
      const success = await onUpdate(plano.id, formData);
      
      if (success) {
        onSuccess();
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const parseDate = (dateStr: string | null): Date | undefined => {
    if (!dateStr) return undefined;
    try {
      return new Date(dateStr);
    } catch {
      return undefined;
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setFormData((prev) => ({ ...prev, prazo: format(date, 'yyyy-MM-dd') }));
    }
  };

  if (!plano) return null;

  // Opções de categorias com mapeamento de valores
  const categoriasOptions = [
    { value: 'Operacional', label: '🏪 Operacional' },
    { value: 'Gestão', label: '📊 Gestão' },
    { value: 'Financeiro', label: '💰 Financeiro' },
    { value: 'Comercial', label: '🎯 Comercial' },
    { value: 'Pessoas', label: '👥 Pessoas' },
    { value: 'Manutenção', label: '🔧 Manutenção' },
    { value: 'Tecnologia', label: '📱 Tecnologia' },
    { value: 'Segurança', label: '🏥 Segurança' },
  ];

  // Opções de setores com todas as variações possíveis
  const setoresOptions = [
    { value: 'Operacional', label: 'Operacional' },
    { value: 'Atendimento', label: 'Atendimento' },
    { value: 'Atendimento ao Franqueado', label: 'Atendimento ao Franqueado' },
    { value: 'Vendas', label: 'Vendas' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'Financeiro', label: 'Financeiro' },
    { value: 'RH', label: 'RH' },
    { value: 'TI', label: 'TI' },
    { value: 'Manutenção', label: 'Manutenção' },
    { value: 'Limpeza', label: 'Limpeza' },
    { value: 'Segurança', label: 'Segurança' },
  ];

  // Função para normalizar valor da categoria (remover emoji)
  const normalizeCategoriaValue = (value: string): string => {
    if (!value) return '';
    
    // Tentar match exato primeiro
    const exact = categoriasOptions.find(opt => opt.value === value || opt.label === value);
    if (exact) return exact.value;
    
    // Se não encontrar, remover emoji e tentar novamente
    const cleanValue = value.replace(/[^\w\sÀ-ÿ]/gi, '').trim();
    const partial = categoriasOptions.find(opt => 
      opt.value.toLowerCase() === cleanValue.toLowerCase() ||
      opt.label.replace(/[^\w\sÀ-ÿ]/gi, '').trim().toLowerCase() === cleanValue.toLowerCase()
    );
    
    return partial?.value || value;
  };

  // Função para normalizar valor do setor
  const normalizeSetorValue = (value: string): string => {
    if (!value) return '';
    
    // Tentar match exato primeiro
    const exact = setoresOptions.find(opt => opt.value === value);
    if (exact) return exact.value;
    
    return value;
  };

  const statusOptions = [
    'Pendente',
    'Em andamento',
    'Aguardando aprovação',
    'Concluído',
    'Cancelado',
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            Editar Plano de Ação
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <ScrollArea className="max-h-[calc(90vh-180px)] overflow-y-auto pr-4">
            <div className="space-y-6">
              {/* Código do Plano (Read-only) */}
              {plano.codigo_plano && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-1">Código do Plano</p>
                  <p className="text-xl font-mono font-bold text-primary">
                    {plano.codigo_plano}
                  </p>
                </div>
              )}

              {/* Informações Básicas */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="categoria">Categoria *</Label>
                      <Select
                        value={formData.categoria}
                        onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                      >
                        <SelectTrigger id="categoria">
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriasOptions.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="setor">Setor</Label>
                      <Select
                        value={formData.setor}
                        onValueChange={(value) => setFormData({ ...formData, setor: value })}
                      >
                        <SelectTrigger id="setor">
                          <SelectValue placeholder="Selecione o setor" />
                        </SelectTrigger>
                        <SelectContent>
                          {setoresOptions.map((setor) => (
                            <SelectItem key={setor.value} value={setor.value}>
                              {setor.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="titulo">Título</Label>
                    <Input
                      id="titulo"
                      value={formData.titulo}
                      onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                      placeholder="Título do plano de ação"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Contexto e Ações */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contexto e Ações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="descricao">Contexto da Situação *</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      placeholder="Descreva o contexto da situação..."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="acoes">Ações Recomendadas *</Label>
                    <Textarea
                      id="acoes"
                      value={formData.acoes}
                      onChange={(e) => setFormData({ ...formData, acoes: e.target.value })}
                      placeholder="Descreva as ações recomendadas..."
                      rows={4}
                      required
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Prazos e Responsabilidades */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Prazos e Responsabilidades</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger id="status">
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Prazo *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !formData.prazo && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.prazo ? (
                              format(parseDate(formData.prazo) || new Date(), 'PPP', { locale: ptBR })
                            ) : (
                              <span>Selecione uma data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parseDate(formData.prazo)}
                            onSelect={handleDateSelect}
                            locale={ptBR}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="responsavel_local">Responsável Local *</Label>
                    <Input
                      id="responsavel_local"
                      value={formData.responsavel_local}
                      onChange={(e) => setFormData({ ...formData, responsavel_local: e.target.value })}
                      placeholder="Nome do responsável local"
                      required
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Anexos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Anexos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="upload">URL do arquivo</Label>
                    <Input
                      id="upload"
                      value={formData.upload}
                      onChange={(e) => setFormData({ ...formData, upload: e.target.value })}
                      placeholder="Cole a URL do arquivo anexado"
                    />
                    <p className="text-xs text-muted-foreground">
                      Deixe em branco para manter o arquivo anterior
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Aviso sobre status */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  ⚠️ <strong>Importante:</strong> Ao salvar, o status do plano voltará automaticamente para <strong>ABERTO</strong> e uma notificação será enviada ao grupo da unidade.
                </p>
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
