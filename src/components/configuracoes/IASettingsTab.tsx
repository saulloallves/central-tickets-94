import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, Info, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AISettings {
  id?: string;
  modelo: string;
  modelo_sugestao: string;
  modelo_chat: string;
  estilo_resposta: string;
  temperatura: number;
  top_p: number;
  max_tokens: number;
  frequency_penalty: number;
  presence_penalty: number;
  base_conhecimento_prompt: string;
  use_only_approved: boolean;
  ativo: boolean;
}

const modelOptions = [
  { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Flagship)', description: 'Modelo mais avançado' },
  { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini', description: 'Rápido e eficiente' },
  { value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1', description: 'Resultados confiáveis' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Legacy)', description: 'Econômico' },
];

const styleOptions = [
  { value: 'Direto', label: 'Direto', description: 'Respostas objetivas e concisas' },
  { value: 'Amigável', label: 'Amigável', description: 'Tom acolhedor e empático' },
  { value: 'Técnico', label: 'Técnico', description: 'Linguagem especializada' },
  { value: 'Formal', label: 'Formal', description: 'Comunicação profissional' },
];

export function IASettingsTab() {
  const [settings, setSettings] = useState<AISettings>({
    modelo: 'gpt-5-2025-08-07',
    modelo_sugestao: 'gpt-5-2025-08-07',
    modelo_chat: 'gpt-5-2025-08-07',
    estilo_resposta: 'Direto',
    temperatura: 0.7,
    top_p: 1.0,
    max_tokens: 1000,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    base_conhecimento_prompt: 'Você é um assistente especializado em suporte técnico. Use apenas as informações da base de conhecimento para responder. Seja MUITO BREVE e objetivo.',
    use_only_approved: true,
    ativo: true
  });
  
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
        const fetchedSettings = {
          id: data.id,
          modelo: data.modelo || 'gpt-5-2025-08-07',
          modelo_sugestao: data.modelo_sugestao || 'gpt-5-2025-08-07',
          modelo_chat: data.modelo_chat || 'gpt-5-2025-08-07',
          estilo_resposta: data.estilo_resposta || 'Direto',
          temperatura: data.temperatura || 0.7,
          top_p: data.top_p || 1.0,
          max_tokens: data.max_tokens || 1000,
          frequency_penalty: data.frequency_penalty || 0.0,
          presence_penalty: data.presence_penalty || 0.0,
          base_conhecimento_prompt: data.base_conhecimento_prompt || settings.base_conhecimento_prompt,
          use_only_approved: data.use_only_approved ?? true,
          ativo: data.ativo ?? true
        };
        setSettings(fetchedSettings);
        setOriginalSettings(fetchedSettings);
      } else {
        setOriginalSettings(settings);
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
        description: "As configurações da IA foram atualizadas com sucesso",
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
          <strong>Configuração Principal:</strong> Estas configurações controlam como a IA responde aos tickets e gera sugestões. 
          Para melhor experiência, mantenha respostas breves e objetivas.
        </AlertDescription>
      </Alert>

      {/* Modelos de IA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Seleção de Modelos
          </CardTitle>
          <CardDescription>
            Configure os modelos de IA para diferentes funcionalidades
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="modelo">Modelo FAQ</Label>
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
              <Label htmlFor="modelo_sugestao">Modelo Sugestões</Label>
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
              <Label htmlFor="modelo_chat">Modelo Chat</Label>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="estilo_resposta">Estilo de Resposta</Label>
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

      {/* Parâmetros de Ajuste */}
      <Card>
        <CardHeader>
          <CardTitle>Parâmetros de Ajuste da IA</CardTitle>
          <CardDescription>
            Configure os parâmetros de geração para controlar o comportamento da IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Temperatura: {settings.temperatura}</Label>
                <Badge variant="secondary">{settings.temperatura < 0.3 ? 'Conservador' : settings.temperatura > 0.7 ? 'Criativo' : 'Equilibrado'}</Badge>
              </div>
              <Slider
                value={[settings.temperatura]}
                onValueChange={([value]) => setSettings(prev => ({...prev, temperatura: value}))}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Controla a criatividade das respostas</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Top P: {settings.top_p}</Label>
              </div>
              <Slider
                value={[settings.top_p]}
                onValueChange={([value]) => setSettings(prev => ({...prev, top_p: value}))}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Diversidade de palavras consideradas</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_tokens">Tokens Máximos</Label>
              <Input
                id="max_tokens"
                type="number"
                value={settings.max_tokens}
                onChange={(e) => setSettings(prev => ({...prev, max_tokens: parseInt(e.target.value) || 1000}))}
                min={100}
                max={4000}
              />
              <p className="text-xs text-muted-foreground">Tamanho máximo da resposta</p>
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
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Reduz repetição de palavras</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Base */}
      <Card>
        <CardHeader>
          <CardTitle>Prompt Base de Conhecimento</CardTitle>
          <CardDescription>
            Configure as instruções base que a IA seguirá ao responder
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="base_prompt">Instruções para a IA</Label>
            <Textarea
              id="base_prompt"
              value={settings.base_conhecimento_prompt}
              onChange={(e) => setSettings(prev => ({...prev, base_conhecimento_prompt: e.target.value}))}
              rows={4}
              placeholder="Digite as instruções para a IA..."
            />
            <p className="text-xs text-muted-foreground">
              <strong>Dica:</strong> Inclua instruções para ser BREVE e OBJETIVO nas respostas
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resumo das Configurações Ativas */}
      <Card className="bg-muted/30 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">📋 Resumo das Configurações Ativas</CardTitle>
          <CardDescription>
            Configurações atualmente aplicadas na IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <span className="font-medium text-muted-foreground">Modelo FAQ:</span>
              <Badge variant="secondary" className="ml-2">{settings.modelo}</Badge>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-muted-foreground">Modelo Sugestões:</span>
              <Badge variant="secondary" className="ml-2">{settings.modelo_sugestao}</Badge>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-muted-foreground">Modelo Chat:</span>
              <Badge variant="secondary" className="ml-2">{settings.modelo_chat}</Badge>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-muted-foreground">Estilo:</span>
              <Badge variant="outline" className="ml-2">{settings.estilo_resposta}</Badge>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-muted-foreground">Temperatura:</span>
              <Badge variant="outline" className="ml-2">{settings.temperatura}</Badge>
            </div>
            <div className="space-y-1">
              <span className="font-medium text-muted-foreground">Max Tokens:</span>
              <Badge variant="outline" className="ml-2">{settings.max_tokens}</Badge>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-background/50 rounded border">
            <span className="font-medium text-muted-foreground text-xs">Prompt Base:</span>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {settings.base_conhecimento_prompt}
            </p>
          </div>
          
          {hasChanges() && (
            <Alert className="mt-4 border-amber-200 bg-amber-50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-amber-800">
                <strong>⚠️ Alterações Pendentes:</strong> Salve as configurações para aplicar as mudanças na IA.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

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
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}