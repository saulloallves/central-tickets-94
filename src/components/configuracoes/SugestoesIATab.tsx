import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, 
  Check, 
  X, 
  Eye, 
  Lightbulb, 
  ArrowRight,
  FileText,
  Calendar,
  User
} from "lucide-react";
import { useKnowledgeSuggestions } from "@/hooks/useKnowledgeSuggestions";
import { useKnowledgeArticles } from "@/hooks/useKnowledgeArticles";
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const categorias = [
  'Jurídico',
  'RH', 
  'Sistema',
  'Operações',
  'Financeiro',
  'Marketing',
  'Técnico',
  'Atendimento',
  'Geral'
];

export function SugestoesIATab() {
  const { suggestions, loading, updateSuggestionStatus, fetchSuggestions } = useKnowledgeSuggestions();
  const { createArticle } = useKnowledgeArticles();
  
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertData, setConvertData] = useState({
    titulo: '',
    categoria: '',
    tags: [],
    tipo_midia: 'texto' as any
  });

  const handleApproveSuggestion = async (id: string) => {
    await updateSuggestionStatus(id, 'aprovada');
  };

  const handleRejectSuggestion = async (id: string) => {
    await updateSuggestionStatus(id, 'rejeitada');
  };

  const handleConvertToArticle = async () => {
    if (!selectedSuggestion) return;
    
    setIsConverting(true);
    try {
      const result = await createArticle({
        titulo: convertData.titulo,
        conteudo: selectedSuggestion.texto_sugerido,
        categoria: convertData.categoria,
        tags: convertData.tags,
        tipo_midia: convertData.tipo_midia,
        usado_pela_ia: true
      });

      if (result) {
        await updateSuggestionStatus(selectedSuggestion.id, 'publicada');
        setSelectedSuggestion(null);
        setConvertData({
          titulo: '',
          categoria: '',
          tags: [],
          tipo_midia: 'texto'
        });
      }
    } catch (error) {
      console.error('Erro ao converter sugestão:', error);
    } finally {
      setIsConverting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'aprovada':
        return <Badge className="bg-green-500">Aprovada</Badge>;
      case 'rejeitada':
        return <Badge variant="destructive">Rejeitada</Badge>;
      case 'publicada':
        return <Badge className="bg-blue-500">Publicada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const processedSuggestions = suggestions.filter(s => s.status !== 'pending');

  useEffect(() => {
    fetchSuggestions();
  }, []);

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50">
        <Lightbulb className="h-4 w-4" />
        <AlertDescription>
          <strong>Sugestões da IA:</strong> A IA analisa resoluções de tickets e sugere novos artigos para a base de conhecimento. 
          Aprove as sugestões úteis para alimentar o aprendizado contínuo.
        </AlertDescription>
      </Alert>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Brain className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{pendingSuggestions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovadas</p>
                <p className="text-2xl font-bold">
                  {suggestions.filter(s => s.status === 'aprovada').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Publicadas</p>
                <p className="text-2xl font-bold">
                  {suggestions.filter(s => s.status === 'publicada').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejeitadas</p>
                <p className="text-2xl font-bold">
                  {suggestions.filter(s => s.status === 'rejeitada').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sugestões Pendentes */}
      {pendingSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-yellow-600" />
              Sugestões Pendentes de Análise
            </CardTitle>
            <CardDescription>
              Avalie as sugestões geradas pela IA e decida se devem ser adicionadas à base de conhecimento
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conteúdo Sugerido</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Modelo IA</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingSuggestions.map((suggestion) => (
                  <TableRow key={suggestion.id}>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="font-medium text-sm mb-1">
                          {suggestion.texto_sugerido.slice(0, 100)}...
                        </p>
                        <div className="text-xs text-muted-foreground">
                          {suggestion.texto_sugerido.length} caracteres
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {suggestion.ticket_id && (
                          <Badge variant="outline">Ticket</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {suggestion.modelo_provedor}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(suggestion.created_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSuggestion(suggestion)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleApproveSuggestion(suggestion.id)}
                          className="text-green-600 hover:text-green-700"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRejectSuggestion(suggestion.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Sugestões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Histórico de Sugestões
          </CardTitle>
          <CardDescription>
            Todas as sugestões processadas anteriormente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center space-y-2">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-sm text-muted-foreground">Carregando histórico...</p>
              </div>
            </div>
          ) : processedSuggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma sugestão processada ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Avaliado por</TableHead>
                  <TableHead>Data Avaliação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedSuggestions.map((suggestion) => (
                  <TableRow key={suggestion.id}>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="text-sm">
                          {suggestion.texto_sugerido.slice(0, 150)}...
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(suggestion.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {suggestion.avaliado_por ? 'Admin' : 'Sistema'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {suggestion.updated_at && formatDistanceToNow(new Date(suggestion.updated_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Visualizar/Converter Sugestão */}
      {selectedSuggestion && (
        <Dialog open={!!selectedSuggestion} onOpenChange={(open) => !open && setSelectedSuggestion(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Avaliar Sugestão da IA
              </DialogTitle>
              <DialogDescription>
                Revise o conteúdo sugerido e converta para artigo da base de conhecimento se aprovado
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Conteúdo Original */}
              <div className="space-y-2">
                <Label>Conteúdo Sugerido pela IA</Label>
                <div className="p-4 bg-muted rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">
                    {selectedSuggestion.texto_sugerido}
                  </pre>
                </div>
              </div>

              {/* Formulário de Conversão */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Converter para Artigo
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="convert-titulo">Título do Artigo</Label>
                    <Input
                      id="convert-titulo"
                      value={convertData.titulo}
                      onChange={(e) => setConvertData(prev => ({...prev, titulo: e.target.value}))}
                      placeholder="Digite um título para o artigo"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="convert-categoria">Categoria</Label>
                    <Select value={convertData.categoria} onValueChange={(value) => setConvertData(prev => ({...prev, categoria: value}))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleRejectSuggestion(selectedSuggestion.id)}
                  className="text-red-600"
                >
                  <X className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
                
                <Button
                  variant="secondary"
                  onClick={() => handleApproveSuggestion(selectedSuggestion.id)}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
                
                <Button
                  onClick={handleConvertToArticle}
                  disabled={!convertData.titulo || !convertData.categoria || isConverting}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isConverting ? 'Convertendo...' : 'Converter para Artigo'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}