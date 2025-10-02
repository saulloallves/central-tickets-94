import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Search } from 'lucide-react';
import { EditAtendenteDialog } from './EditAtendenteDialog';
import { DeleteAtendenteDialog } from './DeleteAtendenteDialog';

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
  user_id?: string;
}

interface AtendentesTableProps {
  atendentes: Atendente[];
  onUpdate: (id: string, data: Partial<Atendente>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStatusChange: (id: string, status: string) => Promise<void>;
}

export const AtendentesTable = ({ atendentes, onUpdate, onDelete, onStatusChange }: AtendentesTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<'all' | 'concierge' | 'dfcom'>('all');
  const [editingAtendente, setEditingAtendente] = useState<Atendente | null>(null);
  const [deletingAtendente, setDeletingAtendente] = useState<Atendente | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'pausa': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'almoco': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'indisponivel': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'inativo': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ativo': return '🟢 Ativo';
      case 'pausa': return '🟡 Pausa';
      case 'almoco': return '🟠 Almoço';
      case 'indisponivel': return '🔴 Indisponível';
      case 'inativo': return '⚫ Inativo';
      default: return status;
    }
  };

  const filteredAtendentes = atendentes.filter(atendente => {
    const matchesSearch = atendente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         atendente.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = filterTipo === 'all' || atendente.tipo === filterTipo;
    return matchesSearch && matchesTipo;
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterTipo} onValueChange={(value: 'all' | 'concierge' | 'dfcom') => setFilterTipo(value)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            <SelectItem value="concierge">Concierge</SelectItem>
            <SelectItem value="dfcom">DFCom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atendente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Capacidade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAtendentes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhum atendente encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredAtendentes.map((atendente) => (
                <TableRow key={atendente.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={atendente.foto_perfil} />
                        <AvatarFallback>
                          {atendente.nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{atendente.nome}</div>
                        {atendente.observacoes && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {atendente.observacoes}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {atendente.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(atendente.status)}>
                      {getStatusLabel(atendente.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {atendente.email && (
                        <div className="truncate max-w-[200px]">{atendente.email}</div>
                      )}
                      {atendente.telefone && (
                        <div className="text-muted-foreground">{atendente.telefone}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className={atendente.capacidade_atual >= atendente.capacidade_maxima ? 'text-destructive font-medium' : ''}>
                        {atendente.capacidade_atual}
                      </span>
                      <span className="text-muted-foreground"> / {atendente.capacidade_maxima}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingAtendente(atendente)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingAtendente(atendente)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      {editingAtendente && (
        <EditAtendenteDialog
          open={!!editingAtendente}
          onOpenChange={(open) => !open && setEditingAtendente(null)}
          atendente={editingAtendente}
          onSave={onUpdate}
        />
      )}

      {deletingAtendente && (
        <DeleteAtendenteDialog
          open={!!deletingAtendente}
          onOpenChange={(open) => !open && setDeletingAtendente(null)}
          atendenteName={deletingAtendente.nome}
          onConfirm={() => onDelete(deletingAtendente.id)}
        />
      )}
    </div>
  );
};
