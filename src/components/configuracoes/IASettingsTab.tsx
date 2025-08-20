import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, RotateCcw, Info, Zap, MessageCircle, Sparkles, Settings, Brain, Database, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AISettings {
  id?: string;
  // Modelos
  modelo: string;
  modelo_sugestao: string;
  modelo_chat: string;
  modelo_classificacao: string;
  modelo_analise: string;
  modelo_resumo: string;
  
  // Prompts
  base_conhecimento_prompt: string;
  prompt_sugestao: string;
  prompt_chat: string;
  prompt_classificacao: string;
  
  // Configurações gerais
  estilo_resposta: string;
  temperatura: number;
  top_p: number;
  max_tokens: number;
  frequency_penalty: number;
  presence_penalty: number;
  
  // Configurações específicas por funcionalidade
  temperatura_chat: number;
  temperatura_sugestao: number;
  temperatura_classificacao: number;
  max_tokens_chat: number;
  max_tokens_sugestao: number;
  max_tokens_classificacao: number;
  
  // Configurações de comportamento
  auto_classificacao: boolean;
  auto_prioridade: boolean;
  auto_equipe: boolean;
  usar_busca_semantica: boolean;
  usar_historico_conversa: boolean;
  usar_feedback_loop: boolean;
  
  // Configurações avançadas
  limite_tokens_contexto: number;
  timeout_requests: number;
  profundidade_historico: number;
  filtrar_por_categoria: boolean;
  categorias_preferidas: string[];
  log_detalhado: boolean;
  modo_debug: boolean;
  
  use_only_approved: boolean;
  ativo: boolean;
}

const modelOptions = [
  { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Flagship)', description: 'Modelo mais avançado e inteligente' },
  { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini', description: 'Rápido e eficiente, ótimo custo-benefício' },
  { value: 'gpt-5-nano-2025-08-07', label: 'GPT-5 Nano', description: 'Ultra rápido para tarefas simples' },
  { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', description: 'Resultados confiáveis e consistentes' },
  { value: 'o3-2025-04-16', label: 'O3 (Reasoning)', description: 'Raciocínio avançado para problemas complexos' },
  { value: 'o4-mini-2025-04-16', label: 'O4 Mini (Reasoning)', description: 'Raciocínio rápido e eficiente' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Legacy)', description: 'Econômico para tarefas básicas' },
];

const styleOptions = [
  { value: 'Direto', label: 'Direto', description: 'Respostas objetivas e concisas' },
  { value: 'Amigável', label: 'Amigável', description: 'Tom acolhedor e empático' },
  { value: 'Técnico', label: 'Técnico', description: 'Linguagem especializada e precisa' },
  { value: 'Formal', label: 'Formal', description: 'Comunicação profissional e estruturada' },
];

const defaultSettings: AISettings = {
  modelo: 'gpt-5-2025-08-07',
  modelo_sugestao: 'gpt-5-2025-08-07',
  modelo_chat: 'gpt-5-2025-08-07',
  modelo_classificacao: 'gpt-5-2025-08-07',
  modelo_analise: 'gpt-5-2025-08-07',
  modelo_resumo: 'gpt-5-mini-2025-08-07',
  estilo_resposta: 'Direto',
  temperatura: 0.7,
  top_p: 1.0,
  max_tokens: 1000,
  frequency_penalty: 0.0,
  presence_penalty: 0.0,
  base_conhecimento_prompt: 'Você é um assistente especializado em suporte técnico da Cresci & Perdi. Use apenas as informações da base de conhecimento para responder. Seja MUITO BREVE e objetivo.',
  prompt_sugestao: 'Você é um assistente especializado em suporte técnico. Ajude o atendente com sugestões baseadas na base de conhecimento da Cresci & Perdi.',
  prompt_chat: 'Você é um assistente de IA da Cresci & Perdi. Ajude o atendente a resolver o ticket do cliente baseado nos manuais e procedimentos da empresa.',
  prompt_classificacao: 'Classifique este ticket nas categorias apropriadas baseado na descrição do problema e diretrizes da Cresci & Perdi.',
  auto_classificacao: true,
  auto_prioridade: true,
  auto_equipe: true,
  usar_busca_semantica: true,
  usar_historico_conversa: true,
  usar_feedback_loop: true,
  limite_tokens_contexto: 8000,
  timeout_requests: 30,
  temperatura_chat: 0.3,
  temperatura_sugestao: 0.7,
  temperatura_classificacao: 0.1,
  max_tokens_chat: 800,
  max_tokens_sugestao: 1000,
  max_tokens_classificacao: 500,
  profundidade_historico: 10,
  filtrar_por_categoria: false,
  categorias_preferidas: [],
  log_detalhado: true,
  modo_debug: false,
  use_only_approved: true,
  ativo: true
};

export function IASettingsTab() {
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

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
        const fetchedSettings: AISettings = {
          id: data.id,
          modelo: data.modelo || defaultSettings.modelo,
          modelo_sugestao: data.modelo_sugestao || defaultSettings.modelo_sugestao,
          modelo_chat: data.modelo_chat || defaultSettings.modelo_chat,
          modelo_classificacao: data.modelo_classificacao || defaultSettings.modelo_classificacao,
          modelo_analise: data.modelo_analise || defaultSettings.modelo_analise,
          modelo_resumo: data.modelo_resumo || defaultSettings.modelo_resumo,
          estilo_resposta: data.estilo_resposta || defaultSettings.estilo_resposta,
          temperatura: data.temperatura ?? defaultSettings.temperatura,
          top_p: data.top_p ?? defaultSettings.top_p,
          max_tokens: data.max_tokens || defaultSettings.max_tokens,
          frequency_penalty: data.frequency_penalty ?? defaultSettings.frequency_penalty,
          presence_penalty: data.presence_penalty ?? defaultSettings.presence_penalty,
          base_conhecimento_prompt: data.base_conhecimento_prompt || defaultSettings.base_conhecimento_prompt,
          prompt_sugestao: data.prompt_sugestao || defaultSettings.prompt_sugestao,
          prompt_chat: data.prompt_chat || defaultSettings.prompt_chat,
          prompt_classificacao: data.prompt_classificacao || defaultSettings.prompt_classificacao,
          auto_classificacao: data.auto_classificacao ?? defaultSettings.auto_classificacao,
          auto_prioridade: data.auto_prioridade ?? defaultSettings.auto_prioridade,
          auto_equipe: data.auto_equipe ?? defaultSettings.auto_equipe,
          usar_busca_semantica: data.usar_busca_semantica ?? defaultSettings.usar_busca_semantica,
          usar_historico_conversa: data.usar_historico_conversa ?? defaultSettings.usar_historico_conversa,
          usar_feedback_loop: data.usar_feedback_loop ?? defaultSettings.usar_feedback_loop,
          limite_tokens_contexto: data.limite_tokens_contexto || defaultSettings.limite_tokens_contexto,
          timeout_requests: data.timeout_requests || defaultSettings.timeout_requests,
          temperatura_chat: data.temperatura_chat ?? defaultSettings.temperatura_chat,
          temperatura_sugestao: data.temperatura_sugestao ?? defaultSettings.temperatura_sugestao,
          temperatura_classificacao: data.temperatura_classificacao ?? defaultSettings.temperatura_classificacao,
          max_tokens_chat: data.max_tokens_chat || defaultSettings.max_tokens_chat,
          max_tokens_sugestao: data.max_tokens_sugestao || defaultSettings.max_tokens_sugestao,
          max_tokens_classificacao: data.max_tokens_classificacao || defaultSettings.max_tokens_classificacao,
          profundidade_historico: data.profundidade_historico || defaultSettings.profundidade_historico,
          filtrar_por_categoria: data.filtrar_por_categoria ?? defaultSettings.filtrar_por_categoria,
          categorias_preferidas: data.categorias_preferidas || defaultSettings.categorias_preferidas,
          log_detalhado: data.log_detalhado ?? defaultSettings.log_detalhado,
          modo_debug: data.modo_debug ?? defaultSettings.modo_debug,
          use_only_approved: data.use_only_approved ?? defaultSettings.use_only_approved,
          ativo: data.ativo ?? defaultSettings.ativo
        };
        setSettings(fetchedSettings);
        setOriginalSettings(fetchedSettings);
      } else {
        setOriginalSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações",
        variant: "destructive",
      });
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
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setOriginalSettings({ ...settings });
      toast({
        title: "✅ Configurações Salvas",
        description: "Todas as configurações da IA foram atualizadas com sucesso",
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const revertSettings = () => {
    if (originalSettings) {
      setSettings({ ...originalSettings });
    }
  };

  const hasChanges = () => {
    if (!originalSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert className="border-primary/20 bg-primary/5">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Controle Total da IA:</strong> Configure todos os aspectos da inteligência artificial do sistema: 
          sugestões, chat, classificação automática, modelos e comportamentos.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="modelos" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="modelos" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Modelos
          </TabsTrigger>
          <TabsTrigger value="comportamento" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Comportamento
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Prompts
          </TabsTrigger>
          <TabsTrigger value="parametros" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Parâmetros
          </TabsTrigger>
          <TabsTrigger value="avancado" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Avançado
          </TabsTrigger>
        </TabsList>

        {/* Modelos de IA */}
        <TabsContent value="modelos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Seleção de Modelos de IA
              </CardTitle>
              <CardDescription>
                Configure modelos específicos para cada funcionalidade da IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="modelo_sugestao">🔮 Modelo Sugestões</Label>
                  <Select value={settings.modelo_sugestao} onValueChange={(value) => setSettings(prev => ({...prev, modelo_sugestao: value}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modelo_chat">💬 Modelo Chat com IA</Label>
                  <Select value={settings.modelo_chat} onValueChange={(value) => setSettings(prev => ({...prev, modelo_chat: value}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modelo_classificacao">🏷️ Modelo Classificação</Label>
                  <Select value={settings.modelo_classificacao} onValueChange={(value) => setSettings(prev => ({...prev, modelo_classificacao: value}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modelo">📋 Modelo FAQ</Label>
                  <Select value={settings.modelo} onValueChange={(value) => setSettings(prev => ({...prev, modelo: value}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modelo_analise">🔍 Modelo Análise</Label>
                  <Select value={settings.modelo_analise} onValueChange={(value) => setSettings(prev => ({...prev, modelo_analise: value}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modelo_resumo">📝 Modelo Resumo</Label>
                  <Select value={settings.modelo_resumo} onValueChange={(value) => setSettings(prev => ({...prev, modelo_resumo: value}))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estilo_resposta">🎨 Estilo de Resposta Global</Label>
                <Select value={settings.estilo_resposta} onValueChange={(value) => setSettings(prev => ({...prev, estilo_resposta: value}))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {styleOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comportamento */}
        <TabsContent value="comportamento" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>⚙️ Configurações de Comportamento</CardTitle>
              <CardDescription>
                Configure como a IA se comporta em diferentes situações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">🤖 Automação</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto_classificacao">Classificação Automática</Label>
                      <Switch
                        id="auto_classificacao"
                        checked={settings.auto_classificacao}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, auto_classificacao: checked}))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto_prioridade">Prioridade Automática</Label>
                      <Switch
                        id="auto_prioridade"
                        checked={settings.auto_prioridade}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, auto_prioridade: checked}))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto_equipe">Atribuição de Equipe</Label>
                      <Switch
                        id="auto_equipe"
                        checked={settings.auto_equipe}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, auto_equipe: checked}))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">🔍 Funcionalidades</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="usar_busca_semantica">Busca Semântica</Label>
                      <Switch
                        id="usar_busca_semantica"
                        checked={settings.usar_busca_semantica}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, usar_busca_semantica: checked}))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="usar_historico_conversa">Histórico de Conversa</Label>
                      <Switch
                        id="usar_historico_conversa"
                        checked={settings.usar_historico_conversa}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, usar_historico_conversa: checked}))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="usar_feedback_loop">Loop de Feedback</Label>
                      <Switch
                        id="usar_feedback_loop"
                        checked={settings.usar_feedback_loop}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, usar_feedback_loop: checked}))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-sm">📚 Base de Conhecimento</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="use_only_approved">Usar Apenas Artigos Aprovados</Label>
                    <Switch
                      id="use_only_approved"
                      checked={settings.use_only_approved}
                      onCheckedChange={(checked) => setSettings(prev => ({...prev, use_only_approved: checked}))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="filtrar_por_categoria">Filtrar por Categoria</Label>
                    <Switch
                      id="filtrar_por_categoria"
                      checked={settings.filtrar_por_categoria}
                      onCheckedChange={(checked) => setSettings(prev => ({...prev, filtrar_por_categoria: checked}))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompts */}
        <TabsContent value="prompts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>💬 Configuração de Prompts</CardTitle>
              <CardDescription>
                Configure as instruções específicas para cada funcionalidade da IA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt_sugestao">🔮 Prompt para Sugestões</Label>
                  <Textarea
                    id="prompt_sugestao"
                    value={settings.prompt_sugestao}
                    onChange={(e) => setSettings(prev => ({...prev, prompt_sugestao: e.target.value}))}
                    rows={3}
                    placeholder="Instruções para gerar sugestões..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt_chat">💬 Prompt para Chat com IA</Label>
                  <Textarea
                    id="prompt_chat"
                    value={settings.prompt_chat}
                    onChange={(e) => setSettings(prev => ({...prev, prompt_chat: e.target.value}))}
                    rows={3}
                    placeholder="Instruções para o chat com IA..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt_classificacao">🏷️ Prompt para Classificação</Label>
                  <Textarea
                    id="prompt_classificacao"
                    value={settings.prompt_classificacao}
                    onChange={(e) => setSettings(prev => ({...prev, prompt_classificacao: e.target.value}))}
                    rows={3}
                    placeholder="Instruções para classificação automática..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="base_conhecimento_prompt">📚 Prompt Base de Conhecimento</Label>
                  <Textarea
                    id="base_conhecimento_prompt"
                    value={settings.base_conhecimento_prompt}
                    onChange={(e) => setSettings(prev => ({...prev, base_conhecimento_prompt: e.target.value}))}
                    rows={4}
                    placeholder="Instruções gerais da base de conhecimento..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Parâmetros */}
        <TabsContent value="parametros" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>⚡ Parâmetros de Geração</CardTitle>
              <CardDescription>
                Configure parâmetros específicos para cada funcionalidade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">🔮 Sugestões</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Temperatura: {settings.temperatura_sugestao}</Label>
                      <Slider
                        value={[settings.temperatura_sugestao]}
                        onValueChange={([value]) => setSettings(prev => ({...prev, temperatura_sugestao: value}))}
                        max={1}
                        min={0}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        value={settings.max_tokens_sugestao}
                        onChange={(e) => setSettings(prev => ({...prev, max_tokens_sugestao: parseInt(e.target.value) || 1000}))}
                        min={100}
                        max={4000}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">💬 Chat</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Temperatura: {settings.temperatura_chat}</Label>
                      <Slider
                        value={[settings.temperatura_chat]}
                        onValueChange={([value]) => setSettings(prev => ({...prev, temperatura_chat: value}))}
                        max={1}
                        min={0}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        value={settings.max_tokens_chat}
                        onChange={(e) => setSettings(prev => ({...prev, max_tokens_chat: parseInt(e.target.value) || 800}))}
                        min={100}
                        max={4000}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">🏷️ Classificação</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Temperatura: {settings.temperatura_classificacao}</Label>
                      <Slider
                        value={[settings.temperatura_classificacao]}
                        onValueChange={([value]) => setSettings(prev => ({...prev, temperatura_classificacao: value}))}
                        max={1}
                        min={0}
                        step={0.1}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Tokens</Label>
                      <Input
                        type="number"
                        value={settings.max_tokens_classificacao}
                        onChange={(e) => setSettings(prev => ({...prev, max_tokens_classificacao: parseInt(e.target.value) || 500}))}
                        min={100}
                        max={2000}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Top P Global: {settings.top_p}</Label>
                  </div>
                  <Slider
                    value={[settings.top_p]}
                    onValueChange={([value]) => setSettings(prev => ({...prev, top_p: value}))}
                    max={1}
                    min={0}
                    step={0.1}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Frequency Penalty: {settings.frequency_penalty}</Label>
                  </div>
                  <Slider
                    value={[settings.frequency_penalty]}
                    onValueChange={([value]) => setSettings(prev => ({...prev, frequency_penalty: value}))}
                    max={2}
                    min={-2}
                    step={0.1}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Avançado */}
        <TabsContent value="avancado" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>⚙️ Configurações Avançadas</CardTitle>
              <CardDescription>
                Configurações técnicas e de desempenho para usuários avançados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">🔧 Performance</h4>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Limite de Tokens de Contexto</Label>
                      <Input
                        type="number"
                        value={settings.limite_tokens_contexto}
                        onChange={(e) => setSettings(prev => ({...prev, limite_tokens_contexto: parseInt(e.target.value) || 8000}))}
                        min={1000}
                        max={20000}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Timeout de Requests (segundos)</Label>
                      <Input
                        type="number"
                        value={settings.timeout_requests}
                        onChange={(e) => setSettings(prev => ({...prev, timeout_requests: parseInt(e.target.value) || 30}))}
                        min={5}
                        max={120}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Profundidade do Histórico</Label>
                      <Input
                        type="number"
                        value={settings.profundidade_historico}
                        onChange={(e) => setSettings(prev => ({...prev, profundidade_historico: parseInt(e.target.value) || 10}))}
                        min={1}
                        max={50}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">🔍 Debug & Logs</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="log_detalhado">Log Detalhado</Label>
                      <Switch
                        id="log_detalhado"
                        checked={settings.log_detalhado}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, log_detalhado: checked}))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="modo_debug">Modo Debug</Label>
                      <Switch
                        id="modo_debug"
                        checked={settings.modo_debug}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, modo_debug: checked}))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status da IA */}
          <Card className="bg-muted/30 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">🤖 Status Atual da IA</CardTitle>
              <CardDescription>
                Resumo das configurações e funcionalidades ativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Sugestões:</span>
                    <Badge variant="secondary">{settings.modelo_sugestao.split('-')[0]}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Chat:</span>
                    <Badge variant="secondary">{settings.modelo_chat.split('-')[0]}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Classificação:</span>
                    <Badge variant="secondary">{settings.modelo_classificacao.split('-')[0]}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Auto Classificação:</span>
                    <Badge variant={settings.auto_classificacao ? "default" : "outline"}>
                      {settings.auto_classificacao ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Busca Semântica:</span>
                    <Badge variant={settings.usar_busca_semantica ? "default" : "outline"}>
                      {settings.usar_busca_semantica ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Histórico:</span>
                    <Badge variant={settings.usar_historico_conversa ? "default" : "outline"}>
                      {settings.usar_historico_conversa ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Estilo:</span>
                    <Badge variant="outline">{settings.estilo_resposta}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Debug:</span>
                    <Badge variant={settings.modo_debug ? "destructive" : "outline"}>
                      {settings.modo_debug ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground">Sistema:</span>
                    <Badge variant={settings.ativo ? "default" : "destructive"}>
                      {settings.ativo ? "Online" : "Offline"}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {hasChanges() && (
                <Alert className="mt-4 border-amber-200 bg-amber-50">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-amber-800">
                    <strong>⚠️ Alterações Pendentes:</strong> Salve as configurações para aplicar todas as mudanças na IA.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
        {hasChanges() && (
          <Button
            variant="outline"
            onClick={revertSettings}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Desfazer Alterações
          </Button>
        )}
        
        <Button
          onClick={saveSettings}
          disabled={saving || !hasChanges()}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Todas as Configurações"}
        </Button>
      </div>
    </div>
  );
}