
import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useKnowledgeMemories } from '@/hooks/useKnowledgeMemories';
import { Upload, FileText, BookOpen } from 'lucide-react';

interface CreateMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CreateMemoryModal = ({ open, onOpenChange, onSuccess }: CreateMemoryModalProps) => {
  const [estilo, setEstilo] = useState<'manual' | 'diretrizes'>('diretrizes');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createMemory, loading } = useKnowledgeMemories();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Verificar tipo de arquivo
      const allowedTypes = ['text/plain', 'text/markdown'];
      const allowedExtensions = ['.txt', '.md'];
      
      const isValidType = allowedTypes.includes(selectedFile.type) || 
                         allowedExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext));
      
      if (!isValidType) {
        alert('Apenas arquivos .txt e .md são suportados no momento');
        return;
      }

      setFile(selectedFile);
      
      // Se não tem título, usar nome do arquivo
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async () => {
    try {
      if (inputMethod === 'text' && !content.trim()) {
        alert('Por favor, insira o conteúdo');
        return;
      }

      if (inputMethod === 'file' && !file) {
        alert('Por favor, selecione um arquivo');
        return;
      }

      await createMemory({
        estilo,
        content: inputMethod === 'file' ? '' : content,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        file: inputMethod === 'file' ? file : undefined
      });

      // Limpar formulário
      setTitle('');
      setDescription('');
      setContent('');
      setFile(null);
      setInputMethod('text');
      setEstilo('diretrizes');
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      onOpenChange(false);
      onSuccess?.();

    } catch (error) {
      // Erro já tratado no hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Nova Memória da Base de Conhecimento
          </DialogTitle>
          <DialogDescription>
            Adicione uma nova memória que será processada pela IA e classificada automaticamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estilo */}
          <div className="space-y-2">
            <Label htmlFor="estilo">Estilo da Memória</Label>
            <Select value={estilo} onValueChange={(value: 'manual' | 'diretrizes') => setEstilo(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diretrizes">
                  📋 Diretrizes - Regras e normas institucionais
                </SelectItem>
                <SelectItem value="manual">
                  📚 Manual - Documentação técnica e operacional
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Método de input */}
          <div className="space-y-2">
            <Label>Método de Entrada</Label>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={inputMethod === 'text' ? 'default' : 'outline'}
                onClick={() => setInputMethod('text')}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                Digitar Texto
              </Button>
              <Button
                type="button"
                variant={inputMethod === 'file' ? 'default' : 'outline'}
                onClick={() => setInputMethod('file')}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload de Arquivo
              </Button>
            </div>
          </div>

          {/* Campos opcionais */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Título (opcional)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título da memória"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descrição"
              />
            </div>
          </div>

          {/* Input de conteúdo */}
          {inputMethod === 'text' ? (
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Cole aqui o conteúdo que será processado pela IA..."
                rows={8}
                className="min-h-[200px]"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo *</Label>
              <div className="space-y-2">
                <Input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-sm text-muted-foreground">
                  Suportados: .txt, .md (máx. 10MB)
                </p>
                {file && (
                  <div className="p-2 bg-muted rounded-md">
                    <p className="text-sm font-medium">Arquivo selecionado:</p>
                    <p className="text-sm text-muted-foreground">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Informação sobre processamento */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">
              {estilo === 'diretrizes' ? '📋 Processamento de Diretrizes' : '📚 Processamento de Manual'}
            </h4>
            <p className="text-sm text-blue-800">
              {estilo === 'diretrizes' 
                ? 'A IA classificará o conteúdo em categorias institucionais (Comunicação Visual, Conduta Comercial, etc.) e formatará seguindo o padrão de diretrizes.'
                : 'A IA analisará o documento e o classificará usando o sistema de códigos documentais (GOV, OPE, PRO, MKT, etc.) baseado em ISO 15489.'
              }
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Processando...' : 'Criar Memória'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
