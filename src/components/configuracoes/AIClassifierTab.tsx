import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, Save, RefreshCw, Settings, Zap } from "lucide-react";

interface AIClassifierSettings {
  id?: string;
  ativo: boolean;
  modelo_classificacao: string;
  temperatura_classificacao: number;
  max_tokens_classificacao: number;
  timeout_requests: number;
  api_provider: string;
  api_base_url?: string;
  api_key?: string;
  custom_headers?: Record<string, any>;
  categorias_disponiveis: string[];
  prioridades_disponiveis: string[];
  system_prompt: string;
  user_prompt_template: string;
  validacao_prioridade: boolean;
  mapeamento_prioridades: Record<string, string>;
  limite_titulo_palavras: number;
  fallback_categoria: string;
  fallback_prioridade: string;
  log_detalhado: boolean;
  modo_debug: boolean;
}

const defaultSettings: AIClassifierSettings = {
  ativo: true,
  modelo_classificacao: 'gpt-4o-mini',
  temperatura_classificacao: 0.1,
  max_tokens_classificacao: 500,
  timeout_requests: 30,
  api_provider: 'openai',
  categorias_disponiveis: ['juridico', 'sistema', 'midia', 'operacoes', 'rh', 'financeiro', 'outro'],
  prioridades_disponiveis: ['imediato', 'alto', 'medio', 'baixo'],
  system_prompt: 'Você é um especialista em classificação de tickets de suporte técnico. Analise sempre em português brasileiro e seja preciso nas classificações.',
  user_prompt_template: `Você é um especialista em classificação de tickets de suporte técnico da Cresci & Perdi.

Analise este ticket e forneça:

1. TÍTULO: Crie um título DESCRITIVO de exatamente 3 palavras que resuma o OBJETIVO/PROBLEMA principal.
   - NÃO copie as primeiras palavras da descrição
   - Seja criativo e descritivo
   - Exemplos: "Problema áudio Zoom", "Solicitar materiais gráficos", "Criação mídia planfetos"

2. CATEGORIA: {{CATEGORIAS}}

3. PRIORIDADE (OBRIGATÓRIO escolher uma): {{PRIORIDADES}}
   - imediato: problemas críticos que impedem funcionamento
    - alto: problemas urgentes que afetam produtividade  
    - medio: problemas importantes mas não bloqueiam trabalho
    - baixo: dúvidas, solicitações, problemas menores

4. EQUIPE SUGERIDA: Escolha a melhor equipe baseado nas especialidades:

{{EQUIPES_DISPONIVEIS}}

ANÁLISE: "{{MESSAGE}}"

Responda APENAS em JSON válido:
{
  "categoria": "uma_das_categorias_definidas",
  "prioridade": "uma_das_4_prioridades_definidas",
  "titulo": "Título de 3 palavras descritivo",
  "equipe_sugerida": "id_da_equipe_mais_apropriada_ou_null",
  "justificativa": "Breve explicação da análise e por que escolheu esta equipe"
}

CRÍTICO: Use APENAS estas prioridades: {{PRIORIDADES}}`,
  validacao_prioridade: true,
  mapeamento_prioridades: {
    'urgente': 'imediato',
     'alta': 'alto',
     'hoje_18h': 'medio',
     'padrao_24h': 'baixo'
  },
  limite_titulo_palavras: 3,
  fallback_categoria: 'outro',
  fallback_prioridade: 'medio',
  log_detalhado: true,
  modo_debug: false
};

export function AIClassifierTab() {
  const [settings, setSettings] = useState<AIClassifierSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<AIClassifierSettings>(defaultSettings);
  const { toast } = useToast();

  const availableModels = [
    'gpt-5-2025-08-07',
    'gpt-5-mini-2025-08-07',
    'gpt-5-nano-2025-08-07',
    'gpt-4.1-2025-04-14',
    'gpt-4.1-mini-2025-04-14',
    'gpt-4o-mini',
    'gpt-4o'
  ];

  const availableProviders = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'lambda', label: 'Lambda/Custom' }
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Try to get from faq_ai_settings first since that's what the current code uses
      const { data, error } = await supabase
        .from('faq_ai_settings')
        .select('*')
        .eq('ativo', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const mappedSettings: AIClassifierSettings = {
          id: data.id,
          ativo: data.ativo || true,
          modelo_classificacao: data.modelo_classificacao || 'gpt-4o-mini',
          temperatura_classificacao: data.temperatura_classificacao || 0.1,
          max_tokens_classificacao: data.max_tokens_classificacao || 500,
          timeout_requests: data.timeout_requests || 30,
          api_provider: data.api_provider || 'openai',
          api_base_url: data.api_base_url,
          api_key: data.api_key,
          custom_headers: (data.custom_headers as Record<string, any>) || {},
          categorias_disponiveis: data.categorias_preferidas || defaultSettings.categorias_disponiveis,
          prioridades_disponiveis: defaultSettings.prioridades_disponiveis,
          system_prompt: data.prompt_classificacao || defaultSettings.system_prompt,
          user_prompt_template: defaultSettings.user_prompt_template,
          validacao_prioridade: true,
          mapeamento_prioridades: defaultSettings.mapeamento_prioridades,
          limite_titulo_palavras: 3,
          fallback_categoria: 'outro',
          fallback_prioridade: 'medio',
          log_detalhado: data.log_detalhado || true,
          modo_debug: data.modo_debug || false
        };
        
        setSettings(mappedSettings);
        setOriginalSettings(mappedSettings);
      } else {
        setSettings(defaultSettings);
        setOriginalSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      const dataToSave = {
        ativo: settings.ativo,
        modelo_classificacao: settings.modelo_classificacao,
        temperatura_classificacao: settings.temperatura_classificacao,
        max_tokens_classificacao: settings.max_tokens_classificacao,
        timeout_requests: settings.timeout_requests,
        api_provider: settings.api_provider,
        api_base_url: settings.api_base_url,
        api_key: settings.api_key,
        custom_headers: settings.custom_headers,
        categorias_preferidas: settings.categorias_disponiveis,
        prompt_classificacao: settings.system_prompt,
        log_detalhado: settings.log_detalhado,
        modo_debug: settings.modo_debug
      };

      if (settings.id) {
        const { error } = await supabase
          .from('faq_ai_settings')
          .update(dataToSave)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('faq_ai_settings')
          .insert([dataToSave]);

        if (error) throw error;
      }

      setOriginalSettings(settings);
      toast({
        title: "Sucesso",
        description: "Configurações do AI Classifier salvas com sucesso!"
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(originalSettings);
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Configurações do AI Classifier
                <Badge variant={settings.ativo ? "default" : "secondary"}>
                  {settings.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Configure como a IA classifica e prioriza os tickets automaticamente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Configurações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar AI Classifier</Label>
              <p className="text-sm text-muted-foreground">
                Habilita a classificação automática de tickets pela IA
              </p>
            </div>
            <Switch
              checked={settings.ativo}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, ativo: checked }))}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo de IA</Label>
              <Select
                value={settings.modelo_classificacao}
                onValueChange={(value) => setSettings(prev => ({ ...prev, modelo_classificacao: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model} value={model}>{model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Provedor de API</Label>
              <Select
                value={settings.api_provider}
                onValueChange={(value) => setSettings(prev => ({ ...prev, api_provider: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map(provider => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {settings.api_provider === 'lambda' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>URL Base da API</Label>
                <Input
                  value={settings.api_base_url || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, api_base_url: e.target.value }))}
                  placeholder="https://api.exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Chave da API</Label>
                <Input
                  type="password"
                  value={settings.api_key || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, api_key: e.target.value }))}
                  placeholder="sk-..."
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parâmetros do Modelo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Parâmetros do Modelo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Temperatura: {settings.temperatura_classificacao}</Label>
            <Slider
              value={[settings.temperatura_classificacao]}
              onValueChange={([value]) => setSettings(prev => ({ ...prev, temperatura_classificacao: value }))}
              max={1}
              min={0}
              step={0.1}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Controla a criatividade das respostas (0 = mais determinístico, 1 = mais criativo)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Máximo de Tokens</Label>
              <Input
                type="number"
                value={settings.max_tokens_classificacao}
                onChange={(e) => setSettings(prev => ({ ...prev, max_tokens_classificacao: parseInt(e.target.value) || 500 }))}
                min={100}
                max={2000}
              />
            </div>
            <div className="space-y-2">
              <Label>Timeout (segundos)</Label>
              <Input
                type="number"
                value={settings.timeout_requests}
                onChange={(e) => setSettings(prev => ({ ...prev, timeout_requests: parseInt(e.target.value) || 30 }))}
                min={10}
                max={120}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categorias e Prioridades */}
      <Card>
        <CardHeader>
          <CardTitle>Categorias e Prioridades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Categorias Disponíveis</Label>
            <div className="flex flex-wrap gap-2">
              {settings.categorias_disponiveis.map(categoria => (
                <Badge key={categoria} variant="outline">{categoria}</Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Prioridades Disponíveis</Label>
            <div className="flex flex-wrap gap-2">
              {settings.prioridades_disponiveis.map(prioridade => (
                <Badge key={prioridade} variant="outline">{prioridade}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>Prompts do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea
              value={settings.system_prompt}
              onChange={(e) => setSettings(prev => ({ ...prev, system_prompt: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Template do User Prompt</Label>
            <Textarea
              value={settings.user_prompt_template}
              onChange={(e) => setSettings(prev => ({ ...prev, user_prompt_template: e.target.value }))}
              rows={8}
            />
            <p className="text-sm text-muted-foreground">
              Use placeholders: {`{{MESSAGE}}, {{CATEGORIAS}}, {{PRIORIDADES}}, {{EQUIPES_DISPONIVEIS}}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Debug e Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Debug e Logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Log Detalhado</Label>
              <p className="text-sm text-muted-foreground">
                Registra informações detalhadas sobre o processo de classificação
              </p>
            </div>
            <Switch
              checked={settings.log_detalhado}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, log_detalhado: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Modo Debug</Label>
              <p className="text-sm text-muted-foreground">
                Ativa logs extras para depuração (apenas para desenvolvimento)
              </p>
            </div>
            <Switch
              checked={settings.modo_debug}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, modo_debug: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      {hasChanges && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Você tem alterações não salvas
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetSettings}>
                  Reverter
                </Button>
                <Button onClick={saveSettings} disabled={saving}>
                  {saving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}