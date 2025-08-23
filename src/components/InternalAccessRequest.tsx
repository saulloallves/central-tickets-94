
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Clock, Users } from 'lucide-react';
import { useInternalAccessRequests } from '@/hooks/useInternalAccessRequests';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const InternalAccessRequest = () => {
  const { userRequest, createRequest, loading } = useInternalAccessRequests();
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: equipes } = useQuery({
    queryKey: ['equipes-for-request'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipes')
        .select('id, nome, descricao')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  const handleSubmitRequest = async () => {
    if (!selectedEquipe) return;

    setIsSubmitting(true);
    await createRequest(selectedEquipe, selectedRole);
    setIsSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-4 text-muted-foreground font-medium">Verificando status...</p>
        </div>
      </div>
    );
  }

  // Se já tem solicitação pendente
  if (userRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <CardTitle>Aguardando Aprovação</CardTitle>
            <CardDescription>
              Sua solicitação de acesso está sendo analisada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Equipe:</span>
                <span className="text-sm font-medium">{userRequest.equipes?.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cargo:</span>
                <span className="text-sm font-medium">
                  {userRequest.desired_role === 'member' && 'Atendente'}
                  {userRequest.desired_role === 'leader' && 'Gestor de Equipe'}
                  {userRequest.desired_role === 'supervisor' && 'Administrador'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span className="text-sm font-medium text-yellow-600">Pendente</span>
              </div>
            </div>
            <div className="text-center text-sm text-muted-foreground">
              Um administrador irá analisar sua solicitação em breve.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formulário de solicitação
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle>Solicitar Acesso - Equipe Interna</CardTitle>
          <CardDescription>
            Escolha a equipe e cargo que você deseja fazer parte
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="equipe">Equipe</Label>
            <Select value={selectedEquipe} onValueChange={setSelectedEquipe}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma equipe" />
              </SelectTrigger>
              <SelectContent>
                {equipes?.map((equipe) => (
                  <SelectItem key={equipe.id} value={equipe.id}>
                    {equipe.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Cargo Desejado</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Atendente</SelectItem>
                <SelectItem value="leader">Gestor de Equipe</SelectItem>
                <SelectItem value="supervisor">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Sobre os cargos:</p>
                <ul className="space-y-1 text-xs">
                  <li><strong>Atendente:</strong> Visualiza e responde tickets da equipe</li>
                  <li><strong>Gestor:</strong> Gerencia equipe e relatórios</li>
                  <li><strong>Admin:</strong> Acesso total ao sistema</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSubmitRequest} 
            disabled={!selectedEquipe || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Enviando...' : 'Solicitar Acesso'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
