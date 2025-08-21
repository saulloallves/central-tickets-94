
import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useKnowledgeMemories } from '@/hooks/useKnowledgeMemories';
import { Upload, FileText, BookOpen, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CreateMemoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const CreateMemoryModal = ({ open, onOpenChange, onSuccess }: CreateMemoryModalProps) => {
  const [estilo, setEstilo] = useState<'manual' | 'diretrizes'>('diretrizes');
  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState('');
  const [categorias, setCategorias] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [inputMethod, setInputMethod] = useState<'text' | 'file'>('text');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createMemory, loading } = useKnowledgeMemories();

  // Buscar categorias existentes
  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const { data, error } = await supabase
          .from('knowledge_articles')
          .select('categoria')
          .not('categoria', 'is', null);

        if (error) throw error;

        // Extrair categorias únicas
        const uniqueCategorias = Array.from(new Set(
          data.map(item => item.categoria).filter(Boolean)
        )).sort();

        setCategorias(uniqueCategorias);
      } catch (error) {
        console.error('Erro ao buscar categorias:', error);
      }
    };

    if (open) {
      fetchCategorias();
    }
  }, [open]);

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

      const result = await createMemory({
        estilo,
        titulo: titulo.trim() || undefined,
        categoria: categoria.trim() || undefined,
        content: inputMethod === 'file' ? '' : content,
        file: inputMethod === 'file' ? file : undefined
      });

      // Para manuais, preencher automaticamente título e categoria da resposta da IA
      if (result && estilo === 'manual') {
        if (result.titulo && !titulo.trim()) {
          setTitulo(result.titulo);
        }
        if (result.categoria && !categoria.trim()) {
          setCategoria(result.categoria);
        }
      }

      // Limpar formulário
      setTitulo('');
      setCategoria('');
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
            Novo Artigo da Base de Conhecimento
          </DialogTitle>
          <DialogDescription>
            Adicione um novo artigo que será processado pela IA e classificado automaticamente por categoria
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estilo */}
          <div className="space-y-2">
            <Label htmlFor="estilo">Tipo de Artigo</Label>
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

          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="titulo">Título do Artigo</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Digite o título do artigo (opcional - IA pode gerar automaticamente)"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <div className="flex gap-2">
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione ou digite uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">ou</span>
              </div>
            </div>
            <Input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Digite uma nova categoria (opcional - IA pode gerar automaticamente)"
            />
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
            {loading ? 'Processando...' : 'Criar Artigo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
