import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Save, 
  RefreshCw, 
  Clock, 
  Users, 
  Zap, 
  TrendingUp, 
  Target,
  Settings,
  BookOpen,
  Plus,
  Trash2
} from "lucide-react";

interface AdvancedSettings {
  id?: string;
  priority_matrix: any;
  emergency_keywords: any;
  dynamic_sla_enabled: boolean;
  sla_adjustment_factors: any;
  load_balancing_enabled: boolean;
  team_capacity_weights: any;
  ai_model_settings: any;
  classification_prompt_template: string;
  priority_prompt_template: string;
  sla_prompt_template: string;
  continuous_learning_enabled: boolean;
  feedback_threshold: number;
  auto_adjustment_enabled: boolean;
  ativo: boolean;
}

interface ClassifierMetrics {
  total_tickets_classified: number;
  correct_classifications: number;
  accuracy_rate: number;
  priority_accuracy: any;
  sla_compliance_rate: number;
  average_response_time: number;
  sla_breaches: number;
}

const defaultSettings: AdvancedSettings = {
  priority_matrix: {
    "alto": { "impact": "alto", "urgency": "media", "sla_minutes": 60 },
    "baixo": { "impact": "baixo", "urgency": "baixa", "sla_minutes": 1440 },
    "medio": { "impact": "medio", "urgency": "media", "sla_minutes": 240 },
    "critico": { "impact": "alto", "urgency": "alta", "sla_minutes": 15 }
  },
  emergency_keywords: {
    "alto": ["lento", "travando", "erro critico", "nao funciona", "urgente"],
    "baixo": ["duvida", "orientacao", "informacao", "sugestao"],
    "medio": ["problema", "dificuldade", "demora", "instavel"],
    "critico": ["sistema caiu", "fora do ar", "parou completamente", "emergencia", "critico"]
  },
  dynamic_sla_enabled: true,
  sla_adjustment_factors: {
    "weekend_factor": 2.0,
    "team_load_factor": 1.2,
    "complexity_factor": 1.5,
    "time_of_day_factor": 1.1
  },
  load_balancing_enabled: true,
  team_capacity_weights: {
    "experience_weight": 0.3,
    "current_load_weight": 0.4,
    "specialization_weight": 0.3
  },
  ai_model_settings: {
    "sla_model": "gpt-5-nano-2025-08-07",
    "max_tokens": 500,
    "temperature": 0.1,
    "priority_model": "gpt-5-mini-2025-08-07",
    "classification_model": "gpt-5-2025-08-07"
  },
  classification_prompt_template: "Você é um especialista em classificação de tickets ITIL. Analise este ticket considerando: {{CONTEXT}}",
  priority_prompt_template: "Determine a prioridade baseada em Impacto vs Urgência: {{TICKET_DATA}}",
  sla_prompt_template: "Calcule o SLA apropriado considerando: {{SLA_FACTORS}}",
  continuous_learning_enabled: true,
  feedback_threshold: 0.8,
  auto_adjustment_enabled: false,
  ativo: true
};

export function AIClassifierAdvancedTab() {
  const [settings, setSettings] = useState<AdvancedSettings>(defaultSettings);
  const [metrics, setMetrics] = useState<ClassifierMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    fetchSettings();
    fetchMetrics();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('ai_classifier_advanced_settings')
        .select('*')
        .eq('ativo', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data as AdvancedSettings);
      } else {
        setSettings(defaultSettings);
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

  const fetchMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_classifier_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setMetrics(data as ClassifierMetrics);
      }
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      if (settings.id) {
        const { error } = await supabase
          .from('ai_classifier_advanced_settings')
          .update(settings)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_classifier_advanced_settings')
          .insert([settings]);

        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: "Configurações do AI Classifier Avançado salvas com sucesso!"
      });

      fetchSettings();
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

  const addKeyword = (priority: string, keyword: string) => {
    if (!keyword.trim()) return;
    
    setSettings(prev => ({
      ...prev,
      emergency_keywords: {
        ...prev.emergency_keywords,
        [priority]: [...(prev.emergency_keywords[priority] || []), keyword.trim()]
      }
    }));
  };

  const removeKeyword = (priority: string, index: number) => {
    setSettings(prev => ({
      ...prev,
      emergency_keywords: {
        ...prev.emergency_keywords,
        [priority]: prev.emergency_keywords[priority].filter((_: string, i: number) => i !== index)
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Precisão</p>
                <p className="text-2xl font-bold text-primary">
                  {metrics ? Math.round(metrics.accuracy_rate * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">Tickets Classificados</p>
                <p className="text-2xl font-bold text-emerald-500">
                  {metrics?.total_tickets_classified || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">SLA Compliance</p>
                <p className="text-2xl font-bold text-blue-500">
                  {metrics ? Math.round(metrics.sla_compliance_rate * 100) : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-sm font-medium">Tempo Médio (s)</p>
                <p className="text-2xl font-bold text-amber-500">
                  {metrics?.average_response_time || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configurações Principais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>AI Classifier Avançado</CardTitle>
                <CardDescription>
                  Sistema inteligente com matriz ITIL, SLA dinâmico e balanceamento de carga
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={settings.ativo ? "default" : "secondary"}>
                {settings.ativo ? "Ativo" : "Inativo"}
              </Badge>
              <Switch
                checked={settings.ativo}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, ativo: checked }))}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={fetchSettings}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Recarregar
        </Button>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}