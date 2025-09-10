import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Brain, AlertTriangle } from "lucide-react";

interface CrisisAISettings {
  id?: string;
  system_prompt: string;
  user_prompt: string;
  threshold_similares: number;
  keywords_base: string[];
  similarity_threshold: number;
  ativo: boolean;
}

export default function CrisisAISettingsTab() {
  const [settings, setSettings] = useState<CrisisAISettings>({
    system_prompt: '',
    user_prompt: '',
    threshold_similares: 3,
    keywords_base: [],
    similarity_threshold: 0.7,
    ativo: true
  });
  const [originalSettings, setOriginalSettings] = useState<CrisisAISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('crisis_ai_settings')
        .select('*')
        .eq('ativo', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const loadedSettings = data || {
        system_prompt: 'Você é um analista especializado em detecção de crises de TI. Analise se este ticket indica uma crise ou problema generalizado que afeta múltiplos usuários.',
        user_prompt: `Analise este ticket: {{DESCRICAO}}

Contexto de problemas existentes: {{EXISTING_PROBLEMS}}

Tickets similares recentes: {{SIMILAR_COUNT}}

Responda APENAS com um JSON válido:
{
  "is_crisis": boolean,
  "similarity_score": number (0-1),
  "confidence": number (0-1),
  "reasoning": "explicação detalhada da decisão",
  "keywords": ["palavra1", "palavra2"],
  "should_group": boolean,
  "existing_crisis_id": "uuid ou null",
  "recommended_action": "criar_nova_crise | vincular_existente | monitorar"
}`,
        threshold_similares: 3,
        keywords_base: ['sistema', 'caiu', 'travou', 'lento', 'indisponivel', 'indisponível', 'erro', 'falha', 'problema', 'fora do ar', 'não funciona', 'nao funciona'],
        similarity_threshold: 0.7,
        ativo: true
      };

      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
    } catch (error) {
      console.error('Error fetching crisis AI settings:', error);
      toast({
        title: "Erro ao carregar configurações",
        description: "Não foi possível carregar as configurações de IA para crises.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      if (settings.id) {
        const { error } = await supabase
          .from('crisis_ai_settings')
          .update({
            system_prompt: settings.system_prompt,
            user_prompt: settings.user_prompt,
            threshold_similares: settings.threshold_similares,
            keywords_base: settings.keywords_base,
            similarity_threshold: settings.similarity_threshold,
            ativo: settings.ativo
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('crisis_ai_settings')
          .insert({
            system_prompt: settings.system_prompt,
            user_prompt: settings.user_prompt,
            threshold_similares: settings.threshold_similares,
            keywords_base: settings.keywords_base,
            similarity_threshold: settings.similarity_threshold,
            ativo: settings.ativo
          })
          .select()
          .single();

        if (error) throw error;
        setSettings({ ...settings, id: data.id });
      }

      setOriginalSettings(settings);
      toast({
        title: "Configurações salvas",
        description: "As configurações de IA para crises foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving crisis AI settings:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const revertSettings = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      toast({
        title: "Alterações revertidas",
        description: "As configurações foram restauradas para o estado original.",
      });
    }
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !settings.keywords_base.includes(keywordInput.trim().toLowerCase())) {
      setSettings({
        ...settings,
        keywords_base: [...settings.keywords_base, keywordInput.trim().toLowerCase()]
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setSettings({
      ...settings,
      keywords_base: settings.keywords_base.filter(k => k !== keyword)
    });
  };

  const hasChanges = originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  if (loading) {
    return <div className="flex items-center justify-center p-8">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5" />
        <h3 className="text-lg font-medium">Configurações de IA para Crises</h3>
        {hasChanges && (
          <Badge variant="secondary" className="ml-2">
            Alterações pendentes
          </Badge>
        )}
      </div>

      <div className="grid gap-6">
        {/* System Prompt */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prompt do Sistema</CardTitle>
            <CardDescription>
              Define o comportamento geral da IA ao analisar tickets para detecção de crises
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={settings.system_prompt}
              onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
              placeholder="Exemplo: Você é um analista especializado em detecção de crises..."
              rows={4}
              className="min-h-24"
            />
          </CardContent>
        </Card>

        {/* User Prompt Template */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Template do Prompt do Usuário</CardTitle>
            <CardDescription>
              Template usado para cada análise. Use placeholders: DESCRICAO, EXISTING_PROBLEMS, SIMILAR_COUNT
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={settings.user_prompt}
              onChange={(e) => setSettings({ ...settings, user_prompt: e.target.value })}
              placeholder="Analise este ticket: {{DESCRICAO}}..."
              rows={8}
              className="min-h-32 font-mono text-sm"
            />
            <div className="mt-2 text-xs text-muted-foreground">
              <strong>Placeholders disponíveis:</strong> {`{{DESCRICAO}}, {{EXISTING_PROBLEMS}}, {{SIMILAR_COUNT}}`}
            </div>
          </CardContent>
        </Card>

        {/* Thresholds */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Threshold de Tickets Similares</CardTitle>
              <CardDescription>
                Número mínimo de tickets similares para considerar criar uma crise
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                min="1"
                max="20"
                value={settings.threshold_similares}
                onChange={(e) => setSettings({ ...settings, threshold_similares: parseInt(e.target.value) || 3 })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Threshold de Similaridade</CardTitle>
              <CardDescription>
                Nível de similaridade necessário (0.0 a 1.0)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={settings.similarity_threshold}
                onChange={(e) => setSettings({ ...settings, similarity_threshold: parseFloat(e.target.value) || 0.7 })}
              />
            </CardContent>
          </Card>
        </div>

        {/* Keywords */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Palavras-chave Base</CardTitle>
            <CardDescription>
              Palavras-chave usadas para detectar tickets relacionados a problemas de sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                placeholder="Adicionar palavra-chave..."
                onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
              />
              <Button onClick={addKeyword} variant="outline">
                Adicionar
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.keywords_base.map((keyword) => (
                <Badge
                  key={keyword}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeKeyword(keyword)}
                >
                  {keyword} ×
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Preview do Prompt
            </CardTitle>
            <CardDescription>
              Exemplo de como o prompt será usado com dados de um ticket
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-md font-mono text-sm whitespace-pre-wrap">
              {settings.user_prompt
                .replace('{{DESCRICAO}}', 'Sistema está fora do ar desde 10:00')
                .replace('{{EXISTING_PROBLEMS}}', '- Problema ID: abc123\n  Título: Sistema indisponível\n  Tickets relacionados: 2')
                .replace('{{SIMILAR_COUNT}}', '3')}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={revertSettings}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reverter
          </Button>

          <Button
            onClick={saveSettings}
            disabled={!hasChanges || saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </div>
  );
}