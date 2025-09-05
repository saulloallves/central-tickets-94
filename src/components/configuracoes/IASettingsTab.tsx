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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Save, RotateCcw, Info, Zap, MessageCircle, Sparkles, Settings, Brain, RefreshCw, CheckCircle, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AISettings {
  id?: string;
  // Provedor e API
  api_provider: string;
  knowledge_mode: string;
  api_base_url?: string;
  api_key?: string;
  custom_headers?: any;
  
  // Modelos principais
  modelo_sugestao: string;
  modelo_chat: string;
  modelo_classificacao: string;
  
  // Prompts principais
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

const providerOptions = [
  { value: 'openai', label: 'OpenAI', description: 'GPT-5, GPT-4, O3/O4 (Reasoning)' },
  { value: 'anthropic', label: 'Anthropic', description: 'Claude 4 Opus/Sonnet, Claude 3.5 Haiku' },
  { value: 'perplexity', label: 'Perplexity', description: 'Llama 3.1 Sonar (Online)' },
  { value: 'lambda', label: 'Lambda', description: 'API customizada (Lambda Labs)' },
];

const knowledgeModeOptions = [
  { value: 'auto', label: 'Automática', description: 'Documentos + Artigos (Recomendado)' },
  { value: 'artigos', label: 'Somente Artigos', description: 'Base de conhecimento curada' },
  { value: 'documentos', label: 'Somente Documentos', description: 'RAG automático de documentos' },
  { value: 'sem_rag', label: 'Desativada', description: 'Sem consulta à base de conhecimento' },
];

const modelsByProvider = {
  openai: [
    { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Flagship)', description: 'Modelo mais avançado e inteligente' },
    { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini', description: 'Rápido e eficiente, ótimo custo-benefício' },
    { value: 'gpt-5-nano-2025-08-07', label: 'GPT-5 Nano', description: 'Ultra rápido para tarefas simples' },
    { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', description: 'Resultados confiáveis e consistentes' },
    { value: 'o3-2025-04-16', label: 'O3 (Reasoning)', description: 'Raciocínio avançado para problemas complexos' },
    { value: 'o4-mini-2025-04-16', label: 'O4 Mini (Reasoning)', description: 'Raciocínio rápido e eficiente' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Legacy)', description: 'Econômico para tarefas básicas' },
  ],
  anthropic: [
    { value: 'claude-opus-4-20250514', label: 'Claude 4 Opus', description: 'Mais capaz e inteligente' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude 4 Sonnet', description: 'Alto desempenho e eficiência' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', description: 'Mais rápido para respostas ágeis' },
  ],
  perplexity: [
    { value: 'llama-3.1-sonar-small-128k-online', label: 'Sonar Small (Online)', description: '8B - Rápido e econômico' },
    { value: 'llama-3.1-sonar-large-128k-online', label: 'Sonar Large (Online)', description: '70B - Equilibrado' },
    { value: 'llama-3.1-sonar-huge-128k-online', label: 'Sonar Huge (Online)', description: '405B - Máxima capacidade' },
  ],
  lambda: [
    { value: 'custom-model', label: 'Modelo Customizado', description: 'Configurar via API Base URL' },
  ],
};

const styleOptions = [
  { value: 'Direto', label: 'Direto', description: 'Respostas objetivas e concisas' },
  { value: 'Amigável', label: 'Amigável', description: 'Tom acolhedor e empático' },
  { value: 'Técnico', label: 'Técnico', description: 'Linguagem especializada e precisa' },
  { value: 'Formal', label: 'Formal', description: 'Comunicação profissional e estruturada' },
];

const defaultSettings: AISettings = {
  api_provider: 'lambda',
  knowledge_mode: 'auto',
  api_base_url: '',
  api_key: '',
  custom_headers: {},
  modelo_sugestao: 'qwen3-32b-fp8',
  modelo_chat: 'qwen3-32b-fp8',
  modelo_classificacao: 'qwen3-32b-fp8',
  estilo_resposta: 'Direto',
  prompt_sugestao: 'Você é um assistente especializado em suporte técnico. Ajude o atendente com sugestões baseadas na base de conhecimento da Cresci & Perdi.',
  prompt_chat: 'Você é um assistente de IA da Cresci & Perdi. Ajude o atendente a resolver o ticket do cliente baseado nos manuais e procedimentos da empresa.',
  prompt_classificacao: `Você é um especialista em classificação de tickets de suporte técnico da Cresci & Perdi.

Analise este ticket e forneça:

1. TÍTULO: Crie um título DESCRITIVO de exatamente 3 palavras que resuma o OBJETIVO/PROBLEMA principal.
   - NÃO copie as primeiras palavras da descrição
   - Seja criativo e descritivo
   - Exemplos: "Problema áudio Zoom", "Solicitar materiais gráficos", "Criação mídia planfetos"

2. CATEGORIA: juridico, sistema, midia, operacoes, rh, financeiro, outro

3. PRIORIDADE (OBRIGATÓRIO escolher uma): imediato, ate_1_hora, ainda_hoje, posso_esperar
   - imediato: problemas críticos que impedem funcionamento
   - ate_1_hora: problemas urgentes que afetam produtividade  
   - ainda_hoje: problemas importantes mas não bloqueiam trabalho
   - posso_esperar: dúvidas, solicitações, problemas menores

4. EQUIPE_SUGERIDA: Analise cuidadosamente qual equipe deve atender baseado nas ESPECIALIDADES de cada equipe

Responda APENAS em formato JSON válido:
{
  "titulo": "Título Descritivo Criativo",
  "categoria": "categoria_sugerida", 
  "prioridade": "imediato_ou_ate_1_hora_ou_ainda_hoje_ou_posso_esperar",
  "equipe_sugerida": "nome_exato_da_equipe_ou_null",
  "justificativa": "Breve explicação da análise e por que escolheu esta equipe"
}

CRÍTICO: Use APENAS estas 4 prioridades: imediato, ate_1_hora, ainda_hoje, posso_esperar`,
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
  const [testingConnection, setTestingConnection] = useState(false);
  const [lambdaModels, setLambdaModels] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'success' | 'error'>('none');
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<{type: string, title: string, value: string} | null>(null);
  
  // Estado para modal do prompt de classificação
  const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false);
  const [tempPromptClassification, setTempPromptClassification] = useState('');
  
  const { toast } = useToast();

  // Get models for current provider
  const getCurrentModels = (): Array<{ value: string; label: string }> => {
    if (settings.api_provider === 'lambda') {
      if (lambdaModels.length > 0) {
        console.log('Lambda models available:', lambdaModels);
        return lambdaModels.map(model => {
          const modelId = model.value || model.id;
          const isInUse = modelId === settings.modelo_sugestao || 
                         modelId === settings.modelo_chat || 
                         modelId === settings.modelo_classificacao;
          return { 
            value: modelId, 
            label: `${model.label || modelId}${isInUse ? ' (Em uso)' : ''}` 
          };
        });
      }
      return [{ value: '', label: testingConnection ? 'Conectando...' : 'Clique em "Salvar e Carregar Modelos"' }];
    }
    
    // For other providers, show which models are in use
    const providerModels = modelsByProvider[settings.api_provider as keyof typeof modelsByProvider] || modelsByProvider.openai;
    return providerModels.map(model => {
      const isInUse = model.value === settings.modelo_sugestao || 
                     model.value === settings.modelo_chat || 
                     model.value === settings.modelo_classificacao;
      return {
        value: model.value,
        label: `${model.label}${isInUse ? ' (Em uso)' : ''}`
      };
    });
  };

  const testLambdaConnection = async (isAutoLoad = false) => {
    if (!settings.api_key?.trim() || !settings.api_base_url?.trim()) {
      if (!isAutoLoad) {
        toast({
          title: "Erro",
          description: "Preencha a chave API e a URL base antes de testar a conexão",
          variant: "destructive",
        });
      }
      return;
    }

    if (testingConnection || isAutoLoading) return;

    setTestingConnection(true);
    if (isAutoLoad) setIsAutoLoading(true);
    setConnectionStatus('none');

    try {
      if (settings.id) {
        const { error: updateError } = await supabase
          .from('faq_ai_settings')
          .update({
            ...settings,
            ativo: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id);
        
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('faq_ai_settings')
          .insert({
            ...settings,
            ativo: true,
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        
        if (data) {
          setSettings(prev => ({ ...prev, id: data.id }));
        }
      }

      const { data, error } = await supabase.functions.invoke('lambda-models', {
        body: {
          api_key: settings.api_key,
          api_base_url: settings.api_base_url,
          custom_headers: settings.custom_headers || {}
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido na conexão');
      }

      setLambdaModels(data.models);
      setConnectionStatus('success');
      setOriginalSettings({ ...settings });
      
      if (!isAutoLoad) {
        toast({
          title: "✅ Conexão Realizada!",
          description: `Encontrados ${data.count} modelos na API Lambda`,
        });
      }
    } catch (error) {
      console.error('Erro ao testar conexão Lambda:', error);
      setConnectionStatus('error');
      
      let errorMessage = 'Erro desconhecido';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      if (!isAutoLoad) {
        toast({
          title: "Erro na Conexão",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setTestingConnection(false);
      if (isAutoLoad) setIsAutoLoading(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    const newModels = modelsByProvider[newProvider as keyof typeof modelsByProvider] || modelsByProvider.openai;
    const defaultModel = newModels[0]?.value || 'gpt-5-2025-08-07';
    
    setConnectionStatus('none');
    setLambdaModels([]);
    
    setSettings(prev => ({
      ...prev,
      api_provider: newProvider,
      modelo_sugestao: defaultModel,
      modelo_chat: defaultModel,
      modelo_classificacao: defaultModel,
    }));
  };

  const autoSaveModel = async (newSettings: AISettings) => {
    if (!newSettings.id) return;
    
    try {
      const saveData = {
        ...newSettings,
        ativo: true,
        updated_at: new Date().toISOString()
      };

      const { id, ...dataToSave } = saveData;

      const { error } = await supabase
        .from('faq_ai_settings')
        .update(dataToSave)
        .eq('id', newSettings.id);

      if (error) {
        console.error('Auto-save error:', error);
        return;
      }
      
      setOriginalSettings({ ...newSettings });
      
    } catch (error) {
      console.error('Error auto-saving model:', error);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data: allSettings, error: allError } = await supabase
        .from('faq_ai_settings')
        .select('*')
        .eq('ativo', true)
        .order('updated_at', { ascending: false });

      if (allError) throw allError;

      let data = null;

      if (allSettings && allSettings.length > 1) {
        const [latest, ...older] = allSettings;
        
        if (older.length > 0) {
          await supabase
            .from('faq_ai_settings')
            .update({ ativo: false })
            .in('id', older.map(s => s.id));
        }
        
        data = latest;
      } else if (allSettings && allSettings.length === 1) {
        data = allSettings[0];
      }
        
      if (data) {
        const fetchedSettings: AISettings = {
          id: data.id,
          api_provider: data.api_provider || defaultSettings.api_provider,
          knowledge_mode: data.knowledge_mode || defaultSettings.knowledge_mode,
          api_base_url: data.api_base_url || defaultSettings.api_base_url,
          api_key: data.api_key || defaultSettings.api_key,
          custom_headers: data.custom_headers || defaultSettings.custom_headers,
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
          max_tokens_chat: data.max_tokens_chat ?? defaultSettings.max_tokens_chat,
          max_tokens_sugestao: data.max_tokens_sugestao ?? defaultSettings.max_tokens_sugestao,
          max_tokens_classificacao: data.max_tokens_classificacao ?? defaultSettings.max_tokens_classificacao,
          ativo: true
        };
        
        setSettings(fetchedSettings);
        setOriginalSettings(fetchedSettings);
        
        if (fetchedSettings.api_provider === 'lambda' && fetchedSettings.api_key && fetchedSettings.api_base_url) {
          await testLambdaConnection(true);
        }
      } else {
        setSettings(defaultSettings);
        setOriginalSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const saveData = {
        ...settings,
        ativo: true,
        updated_at: new Date().toISOString()
      };

      if (settings.id) {
        const { id, ...dataToSave } = saveData;
        const { error } = await supabase
          .from('faq_ai_settings')
          .update(dataToSave)
          .eq('id', settings.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('faq_ai_settings')
          .insert(saveData)
          .select('id')
          .single();

        if (error) throw error;
        
        if (data) {
          setSettings(prev => ({ ...prev, id: data.id }));
        }
      }

      setOriginalSettings({ ...settings });
      
      if (settings.api_provider === 'lambda' && settings.api_key && settings.api_base_url) {
        await testLambdaConnection(true);
      }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const revertSettings = () => {
    if (originalSettings) {
      setSettings(originalSettings);
    }
  };

  const hasChanges = () => {
    if (!originalSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  const openClassificationModal = () => {
    setTempPromptClassification(settings.prompt_classificacao);
    setIsClassificationModalOpen(true);
  };

  const saveClassificationPrompt = () => {
    setSettings(prev => ({ ...prev, prompt_classificacao: tempPromptClassification }));
    setIsClassificationModalOpen(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Carregando configurações...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Configurações de IA</h2>
          <p className="text-sm text-muted-foreground">Configure os modelos e parâmetros de IA</p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges() && (
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              Alterações pendentes
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={revertSettings}
            disabled={!hasChanges() || saving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reverter
          </Button>
          <Button
            onClick={saveSettings}
            disabled={saving || !hasChanges()}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Configuração de Provedor e API */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Provedor de IA
            </CardTitle>
            <CardDescription>Configure o provedor de API e credenciais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provedor de API */}
            <div className="space-y-2">
              <Label>Provedor de API</Label>
              <Select
                value={settings.api_provider}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((option) => (
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

            {/* Configurações do Lambda Provider */}
            {settings.api_provider === 'lambda' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium">Configurações da API Lambda</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>URL Base da API</Label>
                    <Input
                      value={settings.api_base_url || ''}
                      onChange={(e) => setSettings(prev => ({ ...prev, api_base_url: e.target.value }))}
                      placeholder="https://api.lambda.chat/v1"
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

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => testLambdaConnection(false)}
                    disabled={testingConnection || !settings.api_key?.trim() || !settings.api_base_url?.trim()}
                    variant="outline"
                    size="sm"
                  >
                    {testingConnection ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    {testingConnection ? 'Testando...' : 'Salvar e Carregar Modelos'}
                  </Button>
                  
                  {connectionStatus === 'success' && (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Conectado ({lambdaModels.length} modelos)
                    </div>
                  )}
                  
                  {connectionStatus === 'error' && (
                    <div className="flex items-center gap-1 text-red-600 text-sm">
                      <span>❌</span>
                      Erro na conexão
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modo de Conhecimento */}
            <div className="space-y-2">
              <Label>Modo de Base de Conhecimento</Label>
              <Select
                value={settings.knowledge_mode}
                onValueChange={(value) => setSettings(prev => ({ ...prev, knowledge_mode: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {knowledgeModeOptions.map((option) => (
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

        {/* Seleção de Modelos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Modelos de IA
            </CardTitle>
            <CardDescription>Selecione os modelos para cada funcionalidade</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Modelo para Sugestões */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Modelo para Sugestões
                </Label>
                <Select
                  value={settings.modelo_sugestao}
                  onValueChange={(value) => {
                    const newSettings = { ...settings, modelo_sugestao: value };
                    setSettings(newSettings);
                    autoSaveModel(newSettings);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getCurrentModels().map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Modelo para Chat */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  Modelo para Chat
                </Label>
                <Select
                  value={settings.modelo_chat}
                  onValueChange={(value) => {
                    const newSettings = { ...settings, modelo_chat: value };
                    setSettings(newSettings);
                    autoSaveModel(newSettings);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getCurrentModels().map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Modelo para Classificação */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Modelo para Classificação
                </Label>
                <Select
                  value={settings.modelo_classificacao}
                  onValueChange={(value) => {
                    const newSettings = { ...settings, modelo_classificacao: value };
                    setSettings(newSettings);
                    autoSaveModel(newSettings);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getCurrentModels().map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parâmetros de IA */}
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros de IA</CardTitle>
            <CardDescription>Configure o comportamento dos modelos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Estilo de Resposta */}
            <div className="space-y-2">
              <Label>Estilo de Resposta</Label>
              <Select
                value={settings.estilo_resposta}
                onValueChange={(value) => setSettings(prev => ({ ...prev, estilo_resposta: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styleOptions.map((option) => (
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

            <Separator />

            {/* Temperatura para Classificação */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Temperatura (Classificação)</Label>
                <span className="text-sm text-muted-foreground">{settings.temperatura_classificacao.toFixed(1)}</span>
              </div>
              <Slider
                value={[settings.temperatura_classificacao]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, temperatura_classificacao: value }))}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Controla a consistência da classificação. Valores baixos são mais determinísticos.
              </p>
            </div>

            {/* Max Tokens para Classificação */}
            <div className="space-y-2">
              <Label>Máximo de Tokens (Classificação)</Label>
              <Input
                type="number"
                value={settings.max_tokens_classificacao}
                onChange={(e) => setSettings(prev => ({ ...prev, max_tokens_classificacao: parseInt(e.target.value) || 500 }))}
                min={100}
                max={4000}
              />
              <p className="text-xs text-muted-foreground">
                Limita o tamanho da resposta de classificação (recomendado: 500)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Configuração de Comportamento */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Comportamento</CardTitle>
            <CardDescription>Configure o comportamento automático do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Classificação Automática</Label>
                <p className="text-sm text-muted-foreground">
                  Ativar classificação automática de tickets com IA
                </p>
              </div>
              <Switch
                checked={settings.auto_classificacao}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_classificacao: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Busca Semântica</Label>
                <p className="text-sm text-muted-foreground">
                  Usar busca semântica para melhor precisão
                </p>
              </div>
              <Switch
                checked={settings.usar_busca_semantica}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, usar_busca_semantica: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Configuração de Prompts */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração de Prompts</CardTitle>
            <CardDescription>Configure as instruções específicas para cada funcionalidade da IA</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Prompt de Classificação */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <Label className="text-sm font-medium">Prompt para Classificação</Label>
              </div>
              <div className="flex gap-2">
                <Input 
                  value="Configurado via modal"
                  readOnly 
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={openClassificationModal}
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal Classificação */}
      <Dialog open={isClassificationModalOpen} onOpenChange={setIsClassificationModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Editar Prompt para Classificação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={tempPromptClassification}
              onChange={(e) => setTempPromptClassification(e.target.value)}
              rows={15}
              className="min-h-[300px] font-mono text-sm"
              placeholder="Digite o prompt para classificação..."
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsClassificationModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={saveClassificationPrompt}>
                Salvar Prompt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
