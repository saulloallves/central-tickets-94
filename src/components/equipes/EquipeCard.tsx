import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Settings, 
  UserPlus,
  Crown,
  Shield,
  User,
  Calendar,
  MoreHorizontal
} from 'lucide-react';
import { EquipeMembersDialog } from './EquipeMembersDialog';
import { EditEquipeDialog } from './EditEquipeDialog';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface EquipeCardProps {
  equipe: {
    id: string;
    nome: string;
    descricao: string;
    introducao: string;
    ativo: boolean;
    created_at: string;
    updated_at: string;
  };
  memberCount?: number;
  isLeader?: boolean;
  onRefresh?: () => void;
  isCollaborator?: boolean;
}

export const EquipeCard = ({ equipe, memberCount = 0, isLeader = false, onRefresh, isCollaborator = false }: EquipeCardProps) => {
  const [showMembers, setShowMembers] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const { user } = useAuth();
  const { hasRole } = useRole();

  const canEdit = !isCollaborator && (hasRole('admin') || hasRole('diretoria') || isLeader);
  const canManageMembers = !isCollaborator && (hasRole('admin') || hasRole('diretoria'));

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'supervisor':
        return <Crown className="h-3 w-3" />;
      case 'leader':
        return <Shield className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  return (
    <>
      <Card className="group relative overflow-hidden bg-gradient-to-br from-background to-muted/20 border hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                equipe.ativo 
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-foreground">
                  {equipe.nome}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {equipe.descricao}
                </p>
              </div>
            </div>

            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEdit(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Editar Equipe
                  </DropdownMenuItem>
                  {canManageMembers && (
                    <DropdownMenuItem onClick={() => setShowMembers(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Gerenciar Membros
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {memberCount} {memberCount === 1 ? 'membro' : 'membros'}
              </span>
            </div>

            <Badge 
              variant={equipe.ativo ? "default" : "secondary"}
              className={`${
                equipe.ativo
                  ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                  : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
              }`}
            >
              {equipe.ativo ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>

          {isLeader && (
            <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/10">
              <Crown className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-primary">
                Você é líder desta equipe
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Criada em {new Date(equipe.created_at).toLocaleDateString('pt-BR')}</span>
              </div>

              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowMembers(true)}
                className="text-xs h-7 px-3"
              >
                Ver Membros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <EquipeMembersDialog
        equipeId={equipe.id}
        equipeNome={equipe.nome}
        open={showMembers}
        onOpenChange={setShowMembers}
        isCollaborator={isCollaborator}
      />

      {canEdit && (
        <EditEquipeDialog
          equipe={equipe}
          open={showEdit}
          onOpenChange={setShowEdit}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
};