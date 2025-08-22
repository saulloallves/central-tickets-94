import React, { useState, useRef } from 'react';
import { Upload, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LogoUploadProps {
  logoUrl?: string;
  onLogoChange: (url: string) => void;
  className?: string;
}

export function LogoUpload({ logoUrl, onLogoChange, className }: LogoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erro no upload",
        description: "Por favor, selecione apenas arquivos de imagem.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Por favor, selecione uma imagem menor que 2MB.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      onLogoChange(data.publicUrl);
      
      toast({
        title: "Logo atualizado!",
        description: "O logo foi carregado com sucesso.",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer o upload do logo. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
      className={cn(
        "relative w-8 h-8 flex items-center justify-center cursor-pointer transition-all duration-300",
        "hover:scale-110 hover:bg-white/10 rounded-lg",
        className
      )}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />
      
      {logoUrl ? (
        <img 
          src={logoUrl} 
          alt="Logo" 
          className="w-10 h-10 object-contain rounded drop-shadow-lg"
        />
      ) : (
        <div className="relative">
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Upload className="h-4 w-4 text-white drop-shadow-lg" strokeWidth={1.5} />
          )}
        </div>
      )}
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-white/0 hover:bg-white/10 rounded-lg transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
        <Image className="h-3 w-3 text-white" strokeWidth={2} />
      </div>
    </div>
  );
}