import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Search, 
  BookOpen, 
  FileText, 
  Video, 
  Link2, 
  FileCheck, 
  Eye, 
  Edit, 
  Trash2,
  Brain,
  ThumbsUp,
  ThumbsDown,
  Filter
} from "lucide-react";
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

const tiposMidia = [
  { value: 'texto', label: 'Texto', icon: FileText },
  { value: 'video', label: 'Vídeo', icon: Video },
  { value: 'pdf', label: 'PDF', icon: FileCheck },
  { value: 'link', label: 'Link Externo', icon: Link2 }
];

export function BaseConhecimentoTab() {
  const { articles, loading, createArticle, updateArticle, approveArticle, toggleAIUsage, fetchArticles } = useKnowledgeArticles();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState<string>('');
  const [filterAprovado, setFilterAprovado] = useState<string>('');
  const [filterUsadoPelaIA, setFilterUsadoPelaIA] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  
  const [newArticle, setNewArticle] = useState({
    titulo: '',
    conteudo: '',
    categoria: '',
    tags: [],
    tipo_midia: 'texto' as any,
    link_arquivo: '',
    usado_pela_ia: true
  });

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         article.conteudo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = !filterCategoria || article.categoria === filterCategoria;
    const matchesAprovado = !filterAprovado || article.aprovado.toString() === filterAprovado;
    const matchesUsadoPelaIA = !filterUsadoPelaIA || article.usado_pela_ia.toString() === filterUsadoPelaIA;
    
    return matchesSearch && matchesCategoria && matchesAprovado && matchesUsadoPelaIA;
  });

  const handleCreateArticle = async () => {
    const result = await createArticle(newArticle);
    if (result) {
      setIsCreateDialogOpen(false);
      setNewArticle({
        titulo: '',
        conteudo: '',
        categoria: '',
        tags: [],
        tipo_midia: 'texto',
        link_arquivo: '',
        usado_pela_ia: true
      });
    }
  };

  const handleUpdateArticle = async () => {
    if (editingArticle) {
      await updateArticle(editingArticle.id, editingArticle);
      setEditingArticle(null);
    }
  };

  const getStatusBadge = (article: any) => {
    if (!article.aprovado) {
      return <Badge variant="destructive">Pendente Aprovação</Badge>;
    }
    if (!article.usado_pela_ia) {
      return <Badge variant="secondary">Não Usado pela IA</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">Ativo</Badge>;
  };

  const getTipoIcon = (tipo: string) => {
    const tipoObj = tiposMidia.find(t => t.value === tipo);
    if (!tipoObj) return FileText;
    return tipoObj.icon;
  };

  return (
    <div className="space-y-6">
      <Alert className="border-primary/20 bg-primary/5">
        <BookOpen className="h-4 w-4" />
        <AlertDescription>
          <strong>Base de Conhecimento:</strong> Gerencie todos os artigos que a IA pode usar para responder tickets. 
          Artigos aprovados e marcados como "Usado pela IA" serão incluídos nas respostas automáticas.
        </AlertDescription>
      </Alert>

      {/* Controles Superiores */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Artigos da Base de Conhecimento
              </CardTitle>
              <CardDescription>
                {articles.length} artigos cadastrados
              </CardDescription>
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Artigo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Novo Artigo</DialogTitle>
                  <DialogDescription>
                    Adicione um novo artigo à base de conhecimento
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="titulo">Título</Label>
                      <Input
                        id="titulo"
                        value={newArticle.titulo}
                        onChange={(e) => setNewArticle(prev => ({...prev, titulo: e.target.value}))}
                        placeholder="Título do artigo"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="categoria">Categoria</Label>
                      <Select value={newArticle.categoria} onValueChange={(value) => setNewArticle(prev => ({...prev, categoria: value}))}>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo_midia">Tipo de Mídia</Label>
                      <Select value={newArticle.tipo_midia} onValueChange={(value: any) => setNewArticle(prev => ({...prev, tipo_midia: value}))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposMidia.map(tipo => {
                            const Icon = tipo.icon;
                            return (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {tipo.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {(newArticle.tipo_midia === 'video' || newArticle.tipo_midia === 'pdf' || newArticle.tipo_midia === 'link') && (
                      <div className="space-y-2">
                        <Label htmlFor="link_arquivo">Link/URL</Label>
                        <Input
                          id="link_arquivo"
                          value={newArticle.link_arquivo}
                          onChange={(e) => setNewArticle(prev => ({...prev, link_arquivo: e.target.value}))}
                          placeholder="URL do arquivo ou link"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conteudo">Conteúdo</Label>
                    <Textarea
                      id="conteudo"
                      value={newArticle.conteudo}
                      onChange={(e) => setNewArticle(prev => ({...prev, conteudo: e.target.value}))}
                      rows={6}
                      placeholder="Conteúdo completo do artigo"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="usado_pela_ia"
                      checked={newArticle.usado_pela_ia}
                      onCheckedChange={(checked) => setNewArticle(prev => ({...prev, usado_pela_ia: checked}))}
                    />
                    <Label htmlFor="usado_pela_ia" className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Pode ser usado pela IA
                    </Label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateArticle} disabled={!newArticle.titulo || !newArticle.conteudo}>
                      Criar Artigo
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar artigos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as categorias</SelectItem>
                  {categorias.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterAprovado} onValueChange={setFilterAprovado}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os status</SelectItem>
                  <SelectItem value="true">Aprovados</SelectItem>
                  <SelectItem value="false">Pendentes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Uso pela IA</Label>
              <Select value={filterUsadoPelaIA} onValueChange={setFilterUsadoPelaIA}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="true">Usados pela IA</SelectItem>
                  <SelectItem value="false">Não usados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Artigos */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-2">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                <p className="text-muted-foreground">Carregando artigos...</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredArticles.map((article) => {
                  const TipoIcon = getTipoIcon(article.tipo_midia);
                  return (
                    <TableRow key={article.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{article.titulo}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-md">
                            {article.conteudo.slice(0, 100)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{article.categoria}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TipoIcon className="h-4 w-4" />
                          <span className="capitalize">{article.tipo_midia}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(article)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-4 w-4 text-green-500" />
                            <span className="text-sm">{article.feedback_positivo}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ThumbsDown className="h-4 w-4 text-red-500" />
                            <span className="text-sm">{article.feedback_negativo}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(article.created_at), { 
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
                            onClick={() => setEditingArticle(article)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!article.aprovado && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => approveArticle(article.id, true)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <FileCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleAIUsage(article.id, !article.usado_pela_ia)}
                            className={article.usado_pela_ia ? 'text-orange-600' : 'text-blue-600'}
                          >
                            <Brain className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      {editingArticle && (
        <Dialog open={!!editingArticle} onOpenChange={(open) => !open && setEditingArticle(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Artigo</DialogTitle>
              <DialogDescription>
                Faça alterações no artigo da base de conhecimento
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-titulo">Título</Label>
                  <Input
                    id="edit-titulo"
                    value={editingArticle.titulo}
                    onChange={(e) => setEditingArticle(prev => ({...prev, titulo: e.target.value}))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-categoria">Categoria</Label>
                  <Select value={editingArticle.categoria} onValueChange={(value) => setEditingArticle(prev => ({...prev, categoria: value}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-conteudo">Conteúdo</Label>
                <Textarea
                  id="edit-conteudo"
                  value={editingArticle.conteudo}
                  onChange={(e) => setEditingArticle(prev => ({...prev, conteudo: e.target.value}))}
                  rows={6}
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingArticle.aprovado}
                    onCheckedChange={(checked) => setEditingArticle(prev => ({...prev, aprovado: checked}))}
                  />
                  <Label>Aprovado</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editingArticle.usado_pela_ia}
                    onCheckedChange={(checked) => setEditingArticle(prev => ({...prev, usado_pela_ia: checked}))}
                  />
                  <Label>Usado pela IA</Label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingArticle(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateArticle}>
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}