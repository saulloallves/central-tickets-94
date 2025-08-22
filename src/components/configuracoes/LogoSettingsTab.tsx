import React, { useState } from 'react';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { LogoUpload } from '@/components/LogoUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useEffect } from 'react';

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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Logo do Sistema</CardTitle>
        <CardDescription>
          Defina o logo que aparecerá na sidebar para todos os usuários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-24 h-24 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo atual" 
                className="w-20 h-20 object-contain rounded"
              />
            ) : (
              <div className="text-gray-400 text-sm text-center">
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
            <div className="text-sm text-gray-500">
              Atualizando logo...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}