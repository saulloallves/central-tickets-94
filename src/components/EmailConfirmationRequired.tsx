import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const EmailConfirmationRequired = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  const handleResendConfirmation = async () => {
    if (!user?.email) return;
    
    setIsResending(true);
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    });

    if (error) {
      toast({
        title: "Erro ao reenviar email",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Email reenviado",
        description: "Verifique sua caixa de entrada (e spam) para o email de confirmação."
      });
    }
    
    setIsResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Confirme seu email</CardTitle>
          <CardDescription>
            Para acessar o sistema, você precisa confirmar seu endereço de email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground text-center">
            Um email de confirmação foi enviado para:
            <div className="font-medium text-foreground mt-1">
              {user?.email}
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground text-center">
            Clique no link de confirmação no email para ativar sua conta.
          </div>

          <div className="space-y-2">
            <Button 
              onClick={handleResendConfirmation}
              disabled={isResending}
              className="w-full"
              variant="outline"
            >
              {isResending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Reenviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Reenviar email
                </>
              )}
            </Button>
            
            <Button 
              onClick={signOut}
              variant="ghost"
              className="w-full"
            >
              Sair da conta
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center">
            Não recebeu o email? Verifique sua pasta de spam ou clique em "Reenviar email".
          </div>
        </CardContent>
      </Card>
    </div>
  );
};