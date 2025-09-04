import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const ResetUserPassword = () => {
  const [email, setEmail] = useState('igor.augusto@crescieperdi.com.br');
  const [newPassword, setNewPassword] = useState('TempPass123!');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { email, newPassword }
      });

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Senha resetada para ${email}. Nova senha: ${newPassword}`,
      });

      console.log('Reset realizado:', data);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || 'Erro ao resetar senha',
        variant: "destructive"
      });
      console.error('Erro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Reset de Senha - Igor</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Nova Senha</Label>
            <Input
              id="password"
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Resetando...' : 'Resetar Senha'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};