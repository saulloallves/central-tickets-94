import React, { useState, useEffect } from 'react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { LogoUpload } from '@/components/LogoUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Image } from 'lucide-react';

export function LogoSettings() {
  const { logoUrl, updateLogo, isUpdating } = useSystemSettings();

  // Definir o logo padrão quando o componente carregar
  useEffect(() => {
    if (!logoUrl || logoUrl === '') {
      handleLogoChange('/lovable-uploads/b3d36ceb-27fc-4605-b11e-8e2d8c5d2930.png');
    }
  }, [logoUrl]);

  const handleLogoChange = async (newLogoUrl: string) => {
    try {
      await updateLogo(newLogoUrl);
    } catch (error) {
      console.error('Error updating logo:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o logo do sistema.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gradient-primary">
          <Image className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Configurações de Logo</h2>
          <p className="text-muted-foreground">Defina o logo que aparecerá na sidebar para todos os usuários</p>
        </div>
      </div>
      
      <div className="w-full max-w-md space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/30">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo atual" 
                className="w-20 h-20 object-contain rounded"
              />
            ) : (
              <div className="text-muted-foreground text-sm text-center">
                Nenhum logo<br />definido
              </div>
            )}
          </div>
          
          <LogoUpload 
            logoUrl={logoUrl} 
            onLogoChange={handleLogoChange}
            className="w-12 h-12 bg-primary text-white rounded-lg hover:bg-primary/90"
          />
          
          {isUpdating && (
            <div className="text-sm text-muted-foreground">
              Atualizando logo...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}