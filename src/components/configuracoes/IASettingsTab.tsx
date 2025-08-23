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
import { Separator } from "@/components/ui/separator";
import { Save, RotateCcw, Info, Zap, MessageCircle, Sparkles, Settings, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AISettings {
  id?: string;
  // Modelos principais
  modelo_sugestao: string;
  modelo_chat: string;
  modelo_classificacao: string;
  
  // Prompts
  prompt_sugestao: string;
  prompt_chat: string;
  prompt_classificacao: string;
  
  // Configurações gerais
  estilo_resposta: string;
  
  // Configurações específicas por funcionalidade
  temperatura_chat: number;
  temperatura_sugestao: number;
  temperatura_classificacao: number;
  max_tokens_chat: number;
  max_tokens_sugestao: number;
  max_tokens_classificacao: number;
  
  // Configurações de comportamento
  auto_classificacao: boolean;
  usar_busca_semantica: boolean;
  
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
  modelo_sugestao: 'gpt-5-2025-08-07',
  modelo_chat: 'gpt-5-2025-08-07',
  modelo_classificacao: 'gpt-5-2025-08-07',
  estilo_resposta: 'Direto',
  prompt_sugestao: 'Você é um assistente especializado em suporte técnico. Ajude o atendente com sugestões baseadas na base de conhecimento da Cresci & Perdi.',
  prompt_chat: 'Você é um assistente de IA da Cresci & Perdi. Ajude o atendente a resolver o ticket do cliente baseado nos manuais e procedimentos da empresa.',
  prompt_classificacao: 'Classifique este ticket nas categorias apropriadas baseado na descrição do problema e diretrizes da Cresci & Perdi.',
  auto_classificacao: true,
  usar_busca_semantica: true,
  temperatura_chat: 0.3,
  temperatura_sugestao: 0.7,
  temperatura_classificacao: 0.1,
  max_tokens_chat: 800,
  max_tokens_sugestao: 1000,
  max_tokens_classificacao: 500,
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
          modelo_sugestao: data.modelo_sugestao || defaultSettings.modelo_sugestao,
          modelo_chat: data.modelo_chat || defaultSettings.modelo_chat,
          modelo_classificacao: data.modelo_classificacao || defaultSettings.modelo_classificacao,
          estilo_resposta: data.estilo_resposta || defaultSettings.estilo_resposta,
          prompt_sugestao: data.prompt_sugestao || defaultSettings.prompt_sugestao,
          prompt_chat: data.prompt_chat || defaultSettings.prompt_chat,
          prompt_classificacao: data.prompt_classificacao || defaultSettings.prompt_classificacao,
          auto_classificacao: data.auto_classificacao ?? defaultSettings.auto_classificacao,
          usar_busca_semantica: data.usar_busca_semantica ?? defaultSettings.usar_busca_semantica,
          temperatura_chat: data.temperatura_chat ?? defaultSettings.temperatura_chat,
          temperatura_sugestao: data.temperatura_sugestao ?? defaultSettings.temperatura_sugestao,
          temperatura_classificacao: data.temperatura_classificacao ?? defaultSettings.temperatura_classificacao,
          max_tokens_chat: data.max_tokens_chat || defaultSettings.max_tokens_chat,
          max_tokens_sugestao: data.max_tokens_sugestao || defaultSettings.max_tokens_sugestao,
          max_tokens_classificacao: data.max_tokens_classificacao || defaultSettings.max_tokens_classificacao,
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
          sugestões, chat e classificação automática.
        </AlertDescription>
      </Alert>

      {/* Seção 1: Modelos de IA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Modelos de IA</CardTitle>
          <CardDescription className="text-sm">
            Configure modelos específicos para cada funcionalidade da IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="estilo_resposta">🎨 Estilo de Resposta Global</Label>
            <Select value={settings.estilo_resposta} onValueChange={(value) => setSettings(prev => ({...prev, estilo_resposta: value}))}>
              <SelectTrigger className="max-w-sm">
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

      {/* Seção 2: Parâmetros de Geração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Parâmetros de Geração</CardTitle>
          <CardDescription className="text-sm">
            Configure temperatura e tokens para cada funcionalidade
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                🔮 Sugestões
              </h4>
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
              <h4 className="font-semibold text-sm flex items-center gap-2">
                💬 Chat
              </h4>
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
              <h4 className="font-semibold text-sm flex items-center gap-2">
                🏷️ Classificação
              </h4>
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
        </CardContent>
      </Card>

      {/* Seção 3: Comportamento da IA */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Comportamento da IA</CardTitle>
          <CardDescription className="text-sm">
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
              </div>
            </div>
          </div>

          <Separator />

          {/* Status da IA */}
          <div className="bg-muted/30 border border-primary/20 rounded-lg p-4">
            <h4 className="text-lg font-semibold mb-4">🤖 Status Atual da IA</h4>
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
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-muted-foreground">Estilo:</span>
                  <Badge variant="outline">{settings.estilo_resposta}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-muted-foreground">Sistema:</span>
                  <Badge variant={settings.ativo ? "default" : "destructive"}>
                    {settings.ativo ? "Online" : "Offline"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 4: Configuração de Prompts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Configuração de Prompts</CardTitle>
          <CardDescription className="text-sm">
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
          </div>
        </CardContent>
      </Card>

      {/* Alertas de mudanças pendentes */}
      {hasChanges() && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-amber-800">
            <strong>⚠️ Alterações Pendentes:</strong> Salve as configurações para aplicar todas as mudanças na IA.
          </AlertDescription>
        </Alert>
      )}

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