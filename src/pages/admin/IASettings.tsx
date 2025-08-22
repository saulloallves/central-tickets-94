import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Settings, Save, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AISettings {
  id: string;
  ativo: boolean;
  modelo: string;
  modelo_sugestao: string;
  modelo_chat: string;
  temperatura: number;
  top_p: number;
  max_tokens: number;
  frequency_penalty: number;
  presence_penalty: number;
  base_conhecimento_prompt: string;
  estilo_resposta: string;
}

const modelOptions = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recomendado)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

const styleOptions = [
  { value: 'Formal', label: 'Formal' },
  { value: 'Direto', label: 'Direto' },
  { value: 'Saulo', label: 'Saulo' },
  { value: 'Explicativo', label: 'Explicativo' },
  { value: 'Maternal', label: 'Maternal' },
];

export default function IASettings() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<AISettings | null>(null);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('faq_ai_settings')
        .select('*')
        .eq('ativo', true)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        throw error;
      }

      if (data) {
        setSettings(data);
        setOriginalSettings(data);
      } else {
        // Create default settings if none exist
        const defaultSettings = {
          ativo: true,
          modelo: 'gpt-4o-mini',
          modelo_sugestao: 'gpt-4o-mini',
          modelo_chat: 'gpt-4o-mini',
          temperatura: 0.3,
          top_p: 1.0,
          max_tokens: 800,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
          base_conhecimento_prompt: 'Você é um assistente especializado em suporte técnico para uma franquia. Use apenas as informações da base de conhecimento e contexto fornecido para responder. Seja preciso, direto e profissional.',
          estilo_resposta: 'Direto'
        };

        const { data: newData, error: createError } = await supabase
          .from('faq_ai_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (createError) throw createError;

        setSettings(newData);
        setOriginalSettings(newData);
      }
    } catch (error) {
      console.error('Error fetching AI settings:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações da IA",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('faq_ai_settings')
        .update({
          modelo: settings.modelo,
          modelo_sugestao: settings.modelo_sugestao,
          modelo_chat: settings.modelo_chat,
          temperatura: settings.temperatura,
          top_p: settings.top_p,
          max_tokens: settings.max_tokens,
          frequency_penalty: settings.frequency_penalty,
          presence_penalty: settings.presence_penalty,
          base_conhecimento_prompt: settings.base_conhecimento_prompt,
          estilo_resposta: settings.estilo_resposta,
        })
        .eq('id', settings.id);

      if (error) throw error;

      setOriginalSettings({ ...settings });
      toast({
        title: "✅ Configurações Salvas",
        description: "As configurações da IA foram atualizadas",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
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
      toast({
        title: "Configurações Revertidas",
        description: "Alterações descartadas",
      });
    }
  };

  const hasChanges = () => {
    if (!settings || !originalSettings) return false;
    
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="w-full py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Configurações da IA</h1>
            <p className="text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="w-full py-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Configurações da IA</h1>
            <p className="text-muted-foreground">Erro ao carregar configurações</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-6 pt-12">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8" />
              Configurações da IA
            </h1>
            <p className="text-muted-foreground">
              Configure os parâmetros da IA para sugestões e chat
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges() && (
              <Badge variant="outline" className="text-orange-600">
                Alterações pendentes
              </Badge>
            )}
            <Button variant="outline" onClick={revertSettings} disabled={!hasChanges()}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reverter
            </Button>
            <Button onClick={saveSettings} disabled={saving || !hasChanges()}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Models Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Modelos de IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="modelo_faq">Modelo FAQ (Existente)</Label>
                <Select value={settings.modelo} onValueChange={(value) => setSettings({...settings, modelo: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="modelo_sugestao">Modelo Sugestões</Label>
                <Select value={settings.modelo_sugestao} onValueChange={(value) => setSettings({...settings, modelo_sugestao: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="modelo_chat">Modelo Chat</Label>
                <Select value={settings.modelo_chat} onValueChange={(value) => setSettings({...settings, modelo_chat: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="estilo_resposta">Estilo de Resposta</Label>
                <Select value={settings.estilo_resposta} onValueChange={(value) => setSettings({...settings, estilo_resposta: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {styleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Parameters Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Parâmetros da IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Temperatura: {settings.temperatura}</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Controla a criatividade (0.0 = determinístico, 1.0 = criativo)
                </p>
                <Slider
                  value={[settings.temperatura]}
                  onValueChange={(value) => setSettings({...settings, temperatura: value[0]})}
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div>
                <Label>Top P: {settings.top_p}</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Controla a diversidade das respostas
                </p>
                <Slider
                  value={[settings.top_p]}
                  onValueChange={(value) => setSettings({...settings, top_p: value[0]})}
                  max={1}
                  min={0}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div>
                <Label htmlFor="max_tokens">Max Tokens</Label>
                <Input
                  id="max_tokens"
                  type="number"
                  min={100}
                  max={2000}
                  value={settings.max_tokens}
                  onChange={(e) => setSettings({...settings, max_tokens: Number(e.target.value)})}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Limite de tokens na resposta (300-2000)
                </p>
              </div>

              <Separator />

              <div>
                <Label>Frequency Penalty: {settings.frequency_penalty}</Label>
                <Slider
                  value={[settings.frequency_penalty]}
                  onValueChange={(value) => setSettings({...settings, frequency_penalty: value[0]})}
                  max={2}
                  min={-2}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div>
                <Label>Presence Penalty: {settings.presence_penalty}</Label>
                <Slider
                  value={[settings.presence_penalty]}
                  onValueChange={(value) => setSettings({...settings, presence_penalty: value[0]})}
                  max={2}
                  min={-2}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prompt Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Prompt Base</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="base_conhecimento_prompt">Instruções Gerais da IA</Label>
              <Textarea
                id="base_conhecimento_prompt"
                value={settings.base_conhecimento_prompt}
                onChange={(e) => setSettings({...settings, base_conhecimento_prompt: e.target.value})}
                rows={6}
                placeholder="Digite as instruções base para a IA..."
              />
              <p className="text-xs text-muted-foreground mt-2">
                Este prompt será usado como base para todas as interações da IA
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}