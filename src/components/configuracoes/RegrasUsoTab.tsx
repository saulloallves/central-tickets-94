import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, 
  Plus, 
  X, 
  Settings, 
  Filter,
  Lock,
  Unlock,
  Save,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useKnowledgeArticles } from "@/hooks/useKnowledgeArticles";

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

interface AISettings {
  id?: string;
  allowed_categories: string[];
  blocked_tags: string[];
  forced_article_ids: string[];
  use_only_approved: boolean;
}

export function RegrasUsoTab() {
  const { articles } = useKnowledgeArticles();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<AISettings>({
    allowed_categories: [],
    blocked_tags: [],
    forced_article_ids: [],
    use_only_approved: true
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newForcedArticle, setNewForcedArticle] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('faq_ai_settings')
        .select('*')
        .eq('ativo', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          id: data.id,
          allowed_categories: data.allowed_categories || [],
          blocked_tags: data.blocked_tags || [],
          forced_article_ids: data.forced_article_ids || [],
          use_only_approved: data.use_only_approved ?? true
        });
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('faq_ai_settings')
        .upsert({
          id: settings.id,
          allowed_categories: settings.allowed_categories,
          blocked_tags: settings.blocked_tags,
          forced_article_ids: settings.forced_article_ids,
          use_only_approved: settings.use_only_approved,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "✅ Regras Salvas",
        description: "As regras de uso da IA foram atualizadas com sucesso",
      });
    } catch (error) {
      console.error('Erro ao salvar regras:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as regras",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addAllowedCategory = () => {
    if (newCategory && !settings.allowed_categories.includes(newCategory)) {
      setSettings(prev => ({
        ...prev,
        allowed_categories: [...prev.allowed_categories, newCategory]
      }));
      setNewCategory('');
    }
  };

  const removeAllowedCategory = (category: string) => {
    setSettings(prev => ({
      ...prev,
      allowed_categories: prev.allowed_categories.filter(c => c !== category)
    }));
  };

  const addBlockedTag = () => {
    if (newTag && !settings.blocked_tags.includes(newTag)) {
      setSettings(prev => ({
        ...prev,
        blocked_tags: [...prev.blocked_tags, newTag]
      }));
      setNewTag('');
    }
  };

  const removeBlockedTag = (tag: string) => {
    setSettings(prev => ({
      ...prev,
      blocked_tags: prev.blocked_tags.filter(t => t !== tag)
    }));
  };

  const addForcedArticle = () => {
    if (newForcedArticle && !settings.forced_article_ids.includes(newForcedArticle)) {
      setSettings(prev => ({
        ...prev,
        forced_article_ids: [...prev.forced_article_ids, newForcedArticle]
      }));
      setNewForcedArticle('');
    }
  };

  const removeForcedArticle = (articleId: string) => {
    setSettings(prev => ({
      ...prev,
      forced_article_ids: prev.forced_article_ids.filter(id => id !== articleId)
    }));
  };

  const getArticleTitle = (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    return article?.titulo || 'Artigo não encontrado';
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando regras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Regras de Uso:</strong> Configure como a IA deve selecionar e usar o conteúdo da base de conhecimento. 
          Estas regras garantem que apenas conteúdo autorizado seja utilizado nas respostas.
        </AlertDescription>
      </Alert>

      {/* Configurações Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configurações Gerais
          </CardTitle>
          <CardDescription>
            Controles básicos sobre o uso da base de conhecimento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <Label htmlFor="use_only_approved" className="font-medium">
                  Usar apenas artigos aprovados
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Quando ativo, a IA só usa artigos que foram aprovados por um administrador
              </p>
            </div>
            <Switch
              id="use_only_approved"
              checked={settings.use_only_approved}
              onCheckedChange={(checked) => setSettings(prev => ({...prev, use_only_approved: checked}))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Categorias Permitidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-green-600" />
            Categorias Permitidas
          </CardTitle>
          <CardDescription>
            Limite quais categorias de artigos a IA pode usar (deixe vazio para permitir todas)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione uma categoria para permitir" />
              </SelectTrigger>
              <SelectContent>
                {categorias
                  .filter(cat => !settings.allowed_categories.includes(cat))
                  .map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button onClick={addAllowedCategory} disabled={!newCategory}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.allowed_categories.map(category => (
              <Badge key={category} variant="secondary" className="flex items-center gap-2">
                {category}
                <button
                  onClick={() => removeAllowedCategory(category)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {settings.allowed_categories.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Todas as categorias são permitidas
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tags Bloqueadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <X className="h-5 w-5 text-red-600" />
            Tags Bloqueadas
          </CardTitle>
          <CardDescription>
            Artigos com estas tags nunca serão usados pela IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Digite uma tag para bloquear"
              onKeyDown={(e) => e.key === 'Enter' && addBlockedTag()}
              className="flex-1"
            />
            <Button onClick={addBlockedTag} disabled={!newTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.blocked_tags.map(tag => (
              <Badge key={tag} variant="destructive" className="flex items-center gap-2">
                {tag}
                <button
                  onClick={() => removeBlockedTag(tag)}
                  className="hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {settings.blocked_tags.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Nenhuma tag bloqueada
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Artigos Forçados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-blue-600" />
            Artigos Sempre Incluídos
          </CardTitle>
          <CardDescription>
            Estes artigos sempre serão considerados nas respostas da IA, independente do contexto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={newForcedArticle} onValueChange={setNewForcedArticle}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione um artigo para incluir sempre" />
              </SelectTrigger>
              <SelectContent>
                {articles
                  .filter(article => !settings.forced_article_ids.includes(article.id))
                  .map(article => (
                    <SelectItem key={article.id} value={article.id}>
                      {article.titulo}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button onClick={addForcedArticle} disabled={!newForcedArticle}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {settings.forced_article_ids.map(articleId => (
              <div key={articleId} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{getArticleTitle(articleId)}</p>
                  <p className="text-sm text-muted-foreground">ID: {articleId}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeForcedArticle(articleId)}
                  className="text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {settings.forced_article_ids.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Nenhum artigo forçado configurado
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo das Regras */}
      <Card className="bg-muted/30 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📋 Resumo das Regras Ativas
          </CardTitle>
          <CardDescription>
            Configurações atualmente aplicadas nos filtros da IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Aprovação necessária:</span>
              <Badge variant={settings.use_only_approved ? "default" : "secondary"}>
                {settings.use_only_approved ? "✅ Apenas aprovados" : "❌ Todos os artigos"}
              </Badge>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Categorias permitidas:</span>
              <div className="flex flex-wrap gap-1">
                {settings.allowed_categories.length > 0 ? (
                  settings.allowed_categories.map(cat => (
                    <Badge key={cat} variant="outline" className="text-xs">
                      {cat}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary" className="text-xs">Todas permitidas</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Tags bloqueadas:</span>
              <div className="flex flex-wrap gap-1">
                {settings.blocked_tags.length > 0 ? (
                  settings.blocked_tags.map(tag => (
                    <Badge key={tag} variant="destructive" className="text-xs">
                      🚫 {tag}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary" className="text-xs">Nenhuma bloqueada</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-muted-foreground">Artigos sempre incluídos:</span>
              <div className="flex flex-wrap gap-1">
                {settings.forced_article_ids.length > 0 ? (
                  settings.forced_article_ids.map(id => (
                    <Badge key={id} variant="default" className="text-xs">
                      📌 {getArticleTitle(id)}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary" className="text-xs">Nenhum forçado</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Salvar */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Regras"}
        </Button>
      </div>
    </div>
  );
}