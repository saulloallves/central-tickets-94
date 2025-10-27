import React from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface StepAnexosProps {
  value: string;
  onChange: (value: string) => void;
}

export const StepAnexos: React.FC<StepAnexosProps> = ({ value, onChange }) => {
  const [fileName, setFileName] = React.useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de arquivo
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/mpeg', 'audio/wav'];
      if (!validTypes.includes(file.type)) {
        alert('Tipo de arquivo não permitido. Permitidos: Imagem, PDF, Áudio');
        return;
      }

      // Validar tamanho (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Arquivo muito grande. Máximo: 10MB');
        return;
      }

      setFileName(file.name);
      // Aqui você implementaria o upload para Supabase Storage
      // Por enquanto, apenas salvamos o nome
      onChange(`temp_upload_${file.name}`);
    }
  };

  const handleClear = () => {
    setFileName('');
    onChange('');
  };

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Upload className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">📦 Anexos ou Evidências</h3>
        <p className="text-muted-foreground">
          Se houver algum material de apoio, print, áudio ou imagem, envie aqui
        </p>
        <p className="text-xs text-muted-foreground">
          Permitido: Imagem (JPG, PNG, WEBP), PDF, Áudio (MP3, WAV) - Máx: 10MB
        </p>
      </div>

      <div className="max-w-md mx-auto">
        {!value ? (
          <div className="space-y-2">
            <Label htmlFor="upload" className="cursor-pointer">
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">Clique para fazer upload</p>
                <p className="text-xs text-muted-foreground">ou arraste e solte aqui</p>
              </div>
            </Label>
            <input
              id="upload"
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf,audio/mpeg,audio/wav"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted-foreground">Arquivo selecionado</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-4">
          ℹ️ Este campo é opcional
        </p>
      </div>
    </div>
  );
};