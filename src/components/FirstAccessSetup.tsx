import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';

export const FirstAccessSetup = () => {
  const { user, updatePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscar equipes ativas
  const { data: equipes, isLoading: loadingEquipes } = useQuery({
    queryKey: ['equipes-ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipes')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter no mínimo 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedEquipe) {
      toast({
        title: 'Erro',
        description: 'Selecione uma equipe',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Atualizar senha
      const { error: passwordError } = await updatePassword(password);
      if (passwordError) throw passwordError;

      // 2. Adicionar à equipe
      const { error: equipeError } = await supabase
        .from('equipe_members')
        .insert({
          user_id: user?.id,
          equipe_id: selectedEquipe,
          role: 'member',
          ativo: true,
        });

      if (equipeError) throw equipeError;

      // 3. Remover flag de usuário importado
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_imported_user: false })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      toast({
        title: 'Sucesso!',
        description: 'Configuração concluída. Redirecionando...',
      });

      // Redirecionar para o dashboard
      setTimeout(() => {
        navigate('/admin/dashboard');
        window.location.reload(); // Recarregar para atualizar o contexto
      }, 1500);

    } catch (error: any) {
      console.error('Erro na configuração:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao configurar acesso',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Bem-vindo(a)! 👋</CardTitle>
          <CardDescription>
            Configure sua senha e escolha sua equipe para começar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipe">Equipe</Label>
              <Select value={selectedEquipe} onValueChange={setSelectedEquipe} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione sua equipe" />
                </SelectTrigger>
                <SelectContent>
                  {loadingEquipes ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : equipes?.length === 0 ? (
                    <SelectItem value="none" disabled>Nenhuma equipe disponível</SelectItem>
                  ) : (
                    equipes?.map((equipe) => (
                      <SelectItem key={equipe.id} value={equipe.id}>
                        {equipe.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || loadingEquipes}
            >
              {isSubmitting ? 'Configurando...' : 'Concluir Configuração'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
