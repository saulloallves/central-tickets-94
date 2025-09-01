
import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useKnowledgeMemories } from '@/hooks/useKnowledgeMemories';
import { Upload, FileText, BookOpen, Plus, Loader2, CheckCircle, XCircle } from 'lucide-react';
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
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
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

      setProcessingState('processing');
      setErrorMessage('');

      const result = await createMemory({
        estilo,
        titulo: titulo.trim() || undefined,
        categoria: categoria.trim() || undefined,
        content: inputMethod === 'file' ? '' : content,
        file: inputMethod === 'file' ? file : undefined
      });

      // Para manuais e diretrizes, preencher automaticamente título e categoria da resposta da IA
      if (result && (estilo === 'manual' || estilo === 'diretrizes')) {
        if (result.titulo && !titulo.trim()) {
          setTitulo(result.titulo);
        }
        if (result.categoria && !categoria.trim()) {
          setCategoria(result.categoria);
        }
      }

      setProcessingState('success');
      
      // Aguardar um momento para mostrar sucesso, depois limpar e fechar
      setTimeout(() => {
        setTitulo('');
        setCategoria('');
        setContent('');
        setFile(null);
        setInputMethod('text');
        setEstilo('diretrizes');
        setProcessingState('idle');
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        onOpenChange(false);
        onSuccess?.();
      }, 1500);

    } catch (error: any) {
      setProcessingState('error');
      setErrorMessage(error?.message || 'Erro inesperado ao processar artigo');
    }
  };

  const handleTryAgain = () => {
    setProcessingState('idle');
    setErrorMessage('');
  };

  const handleClose = () => {
    setProcessingState('idle');
    setErrorMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={processingState === 'processing' ? () => {} : onOpenChange}>
      <DialogContent className="max-w-2xl">
        {processingState === 'processing' && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg p-6 text-center space-y-4 min-w-[300px]">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <div className="space-y-2">
                <h3 className="font-semibold">Processando artigo com IA...</h3>
                <p className="text-sm text-muted-foreground">
                  A IA está analisando e classificando o conteúdo
                </p>
              </div>
            </div>
          </div>
        )}

        {processingState === 'success' && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg p-6 text-center space-y-4 min-w-[300px]">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
              <div className="space-y-2">
                <h3 className="font-semibold text-green-700">Concluído!</h3>
                <p className="text-sm text-muted-foreground">
                  Artigo criado e classificado com sucesso
                </p>
              </div>
            </div>
          </div>
        )}

        {processingState === 'error' && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg p-6 text-center space-y-4 min-w-[300px]">
              <XCircle className="h-8 w-8 mx-auto text-red-500" />
              <div className="space-y-2">
                <h3 className="font-semibold text-red-700">Erro no processamento</h3>
                <p className="text-sm text-muted-foreground">
                  {errorMessage}
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleTryAgain} size="sm">
                  Tentar novamente
                </Button>
                <Button variant="default" onClick={handleClose} size="sm">
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}

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
              disabled={processingState !== 'idle'}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoria">
              Categoria
              <span className="text-sm text-muted-foreground ml-2">
                (opcional - IA categoriza automaticamente se não selecionada)
              </span>
            </Label>
            <div className="flex gap-2">
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione uma categoria existente" />
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
              placeholder="Digite uma nova categoria ou deixe vazio para IA categorizar"
              disabled={processingState !== 'idle'}
            />
            <p className="text-xs text-muted-foreground">
              💡 Deixe vazio para que a IA categorize automaticamente baseada no conteúdo
            </p>
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
                disabled={processingState !== 'idle'}
              >
                <FileText className="h-4 w-4 mr-2" />
                Digitar Texto
              </Button>
              <Button
                type="button"
                variant={inputMethod === 'file' ? 'default' : 'outline'}
                onClick={() => setInputMethod('file')}
                className="flex-1"
                disabled={processingState !== 'idle'}
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
                disabled={processingState !== 'idle'}
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
                  disabled={processingState !== 'idle'}
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
            disabled={processingState !== 'idle'}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={processingState !== 'idle'}>
            {processingState === 'processing' ? 'Processando...' : 'Criar Artigo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
