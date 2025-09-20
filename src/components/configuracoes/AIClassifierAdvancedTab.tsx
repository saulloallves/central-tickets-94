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
    "imediato": { "impact": "alto", "urgency": "alta", "sla_minutes": 15 },
    "alto": { "impact": "alto", "urgency": "media", "sla_minutes": 60 },
    "medio": { "impact": "medio", "urgency": "media", "sla_minutes": 600 }, // 10 horas
    "baixo": { "impact": "baixo", "urgency": "baixa", "sla_minutes": 1440 }, // 24 horas
    "crise": { "impact": "critico", "urgency": "critica", "sla_minutes": 5 }
  },
  emergency_keywords: {
    "imediato": ["urgentissimo", "imediato", "agora", "parou tudo", "travou tudo"],
    "alto": ["lento", "travando", "erro critico", "nao funciona", "urgente"],
    "medio": ["problema", "dificuldade", "demora", "instavel"],
    "baixo": ["duvida", "orientacao", "informacao", "sugestao"],
    "crise": ["sistema caiu", "fora do ar", "parou completamente", "emergencia", "critico", "crise"]
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
  const [newKeywords, setNewKeywords] = useState<Record<string, string>>({});
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
                  {metrics ? Math.round(metrics.accuracy_rate * 100) : 100}%
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
                  {metrics?.total_tickets_classified || 15}
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
                <p className="text-sm font-medium">Tempo Médio (min)</p>
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

      {/* Métricas de Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Métricas de Performance (Últimas 24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-500">15</div>
              <div className="text-xs text-muted-foreground">Tickets Classificados</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-500">100.0%</div>
              <div className="text-xs text-muted-foreground">Precisão</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-500">0.0%</div>
              <div className="text-xs text-muted-foreground">Conformidade SLA</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-500">0min</div>
              <div className="text-xs text-muted-foreground">Tempo Médio</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">0</div>
              <div className="text-xs text-muted-foreground">SLAs Quebrados</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Configuração */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="prioridades" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="prioridades">Prioridades</TabsTrigger>
              <TabsTrigger value="sla-dinamico">SLA Dinâmico</TabsTrigger>
              <TabsTrigger value="balanceamento">Balanceamento</TabsTrigger>
              <TabsTrigger value="modelos-ia">Modelos IA</TabsTrigger>
              <TabsTrigger value="aprendizagem">Aprendizagem</TabsTrigger>
            </TabsList>

            {/* Aba Prioridades */}
            <TabsContent value="prioridades" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Matriz de Prioridade ITIL
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure a matriz de prioridades baseada em Impacto vs Urgência
                </p>
                
                <div className="space-y-4">
                  {Object.entries(settings.priority_matrix).map(([priority, config]) => {
                    const configData = config as any;
                    return (
                      <div key={priority} className="grid grid-cols-4 gap-4 p-4 border rounded-lg">
                        <div className="flex items-center">
                          <Badge variant={priority === 'critico' ? 'destructive' : priority === 'alto' ? 'default' : priority === 'medio' ? 'secondary' : 'outline'}>
                            {priority.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Impacto</Label>
                          <Select
                            value={configData.impact}
                            onValueChange={(value) => {
                              setSettings(prev => ({
                                ...prev,
                                priority_matrix: {
                                  ...prev.priority_matrix,
                                  [priority]: { ...configData, impact: value }
                                }
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="baixo">baixo</SelectItem>
                              <SelectItem value="medio">médio</SelectItem>
                              <SelectItem value="alto">alto</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Urgência</Label>
                          <Select
                            value={configData.urgency}
                            onValueChange={(value) => {
                              setSettings(prev => ({
                                ...prev,
                                priority_matrix: {
                                  ...prev.priority_matrix,
                                  [priority]: { ...configData, urgency: value }
                                }
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="baixa">baixa</SelectItem>
                              <SelectItem value="media">média</SelectItem>
                              <SelectItem value="alta">alta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>SLA (minutos)</Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={configData.sla_minutes || 0}
                            onChange={(e) => {
                              const value = e.target.value;
                              const minutes = value === '' ? 0 : parseInt(value) || 0;
                              setSettings(prev => ({
                                ...prev,
                                priority_matrix: {
                                  ...prev.priority_matrix,
                                  [priority]: { ...configData, sla_minutes: minutes }
                                }
                              }));
                            }}
                            placeholder="Minutos para SLA"
                            className="w-full"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Palavras-chave de Emergência */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Palavras-chave de Emergência</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure palavras que automaticamente levam a prioridade do ticket
                </p>
                
                <div className="space-y-4">
                  {Object.entries(settings.emergency_keywords).map(([priority, keywords]) => {
                    const keywordsList = keywords as string[];
                    const currentKeyword = newKeywords[priority] || '';
                    
                    return (
                      <div key={priority} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={priority === 'critico' ? 'destructive' : priority === 'alto' ? 'default' : priority === 'medio' ? 'secondary' : 'outline'}>
                            {priority.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="flex gap-2">
                          <Input
                            placeholder="Nova palavra-chave..."
                            value={currentKeyword}
                            onChange={(e) => setNewKeywords(prev => ({ ...prev, [priority]: e.target.value }))}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                addKeyword(priority, currentKeyword);
                                setNewKeywords(prev => ({ ...prev, [priority]: '' }));
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              addKeyword(priority, currentKeyword);
                              setNewKeywords(prev => ({ ...prev, [priority]: '' }));
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <Textarea
                          value={Array.isArray(keywordsList) ? keywordsList.join(', ') : ''}
                          onChange={(e) => {
                            const newKeywords = e.target.value.split(',').map(k => k.trim()).filter(k => k);
                            setSettings(prev => ({
                              ...prev,
                              emergency_keywords: {
                                ...prev.emergency_keywords,
                                [priority]: newKeywords
                              }
                            }));
                          }}
                          placeholder={`Palavras-chave para prioridade ${priority}...`}
                          className="min-h-[100px]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Aba SLA Dinâmico */}
            <TabsContent value="sla-dinamico" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  SLA Dinâmico e Inteligente
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure SLA que se ajusta automaticamente baseado na carga e contexto
                </p>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Habilitar SLA Dinâmico</Label>
                    <p className="text-sm text-muted-foreground">
                      Ajusta automaticamente SLA baseado na carga e contexto
                    </p>
                  </div>
                  <Switch
                    checked={settings.dynamic_sla_enabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, dynamic_sla_enabled: checked }))}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-md font-semibold mb-4">Fatores de Ajuste</h4>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Fator de Fim de Semana</Label>
                      <span className="text-sm font-medium">{settings.sla_adjustment_factors.weekend_factor}</span>
                    </div>
                    <Slider
                      value={[settings.sla_adjustment_factors.weekend_factor]}
                      onValueChange={([value]) => {
                        setSettings(prev => ({
                          ...prev,
                          sla_adjustment_factors: {
                            ...prev.sla_adjustment_factors,
                            weekend_factor: value
                          }
                        }));
                      }}
                      max={3}
                      min={1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Fator de Carga da Equipe</Label>
                      <span className="text-sm font-medium">{settings.sla_adjustment_factors.team_load_factor}</span>
                    </div>
                    <Slider
                      value={[settings.sla_adjustment_factors.team_load_factor]}
                      onValueChange={([value]) => {
                        setSettings(prev => ({
                          ...prev,
                          sla_adjustment_factors: {
                            ...prev.sla_adjustment_factors,
                            team_load_factor: value
                          }
                        }));
                      }}
                      max={3}
                      min={1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Fator de Complexidade</Label>
                      <span className="text-sm font-medium">{settings.sla_adjustment_factors.complexity_factor}</span>
                    </div>
                    <Slider
                      value={[settings.sla_adjustment_factors.complexity_factor]}
                      onValueChange={([value]) => {
                        setSettings(prev => ({
                          ...prev,
                          sla_adjustment_factors: {
                            ...prev.sla_adjustment_factors,
                            complexity_factor: value
                          }
                        }));
                      }}
                      max={3}
                      min={1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Fator de Horário</Label>
                      <span className="text-sm font-medium">{settings.sla_adjustment_factors.time_of_day_factor}</span>
                    </div>
                    <Slider
                      value={[settings.sla_adjustment_factors.time_of_day_factor]}
                      onValueChange={([value]) => {
                        setSettings(prev => ({
                          ...prev,
                          sla_adjustment_factors: {
                            ...prev.sla_adjustment_factors,
                            time_of_day_factor: value
                          }
                        }));
                      }}
                      max={2}
                      min={1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Aba Balanceamento */}
            <TabsContent value="balanceamento" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Balanceamento de Carga Inteligente
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure como os tickets são distribuídos entre as equipes
                </p>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Habilitar Balanceamento Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Distribui tickets automaticamente baseado na capacidade das equipes
                    </p>
                  </div>
                  <Switch
                    checked={settings.load_balancing_enabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, load_balancing_enabled: checked }))}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-md font-semibold mb-4">Pesos de Capacidade da Equipe</h4>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Peso da Experiência</Label>
                      <span className="text-sm font-medium">{settings.team_capacity_weights.experience_weight}</span>
                    </div>
                    <Slider
                      value={[settings.team_capacity_weights.experience_weight]}
                      onValueChange={([value]) => {
                        setSettings(prev => ({
                          ...prev,
                          team_capacity_weights: {
                            ...prev.team_capacity_weights,
                            experience_weight: value
                          }
                        }));
                      }}
                      max={1}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Peso da Carga Atual</Label>
                      <span className="text-sm font-medium">{settings.team_capacity_weights.current_load_weight}</span>
                    </div>
                    <Slider
                      value={[settings.team_capacity_weights.current_load_weight]}
                      onValueChange={([value]) => {
                        setSettings(prev => ({
                          ...prev,
                          team_capacity_weights: {
                            ...prev.team_capacity_weights,
                            current_load_weight: value
                          }
                        }));
                      }}
                      max={1}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Peso da Especialização</Label>
                      <span className="text-sm font-medium">{settings.team_capacity_weights.specialization_weight}</span>
                    </div>
                    <Slider
                      value={[settings.team_capacity_weights.specialization_weight]}
                      onValueChange={([value]) => {
                        setSettings(prev => ({
                          ...prev,
                          team_capacity_weights: {
                            ...prev.team_capacity_weights,
                            specialization_weight: value
                          }
                        }));
                      }}
                      max={1}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Aba Modelos IA */}
            <TabsContent value="modelos-ia" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurações dos Modelos IA
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure os modelos de IA e parâmetros para cada função
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Modelo de Classificação</Label>
                    <Select
                      value={settings.ai_model_settings.classification_model}
                      onValueChange={(value) => {
                        setSettings(prev => ({
                          ...prev,
                          ai_model_settings: {
                            ...prev.ai_model_settings,
                            classification_model: value
                          }
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Modelo de Prioridade</Label>
                    <Select
                      value={settings.ai_model_settings.priority_model}
                      onValueChange={(value) => {
                        setSettings(prev => ({
                          ...prev,
                          ai_model_settings: {
                            ...prev.ai_model_settings,
                            priority_model: value
                          }
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Modelo de SLA</Label>
                    <Select
                      value={settings.ai_model_settings.sla_model}
                      onValueChange={(value) => {
                        setSettings(prev => ({
                          ...prev,
                          ai_model_settings: {
                            ...prev.ai_model_settings,
                            sla_model: value
                          }
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      value={settings.ai_model_settings.max_tokens}
                      onChange={(e) => {
                        setSettings(prev => ({
                          ...prev,
                          ai_model_settings: {
                            ...prev.ai_model_settings,
                            max_tokens: parseInt(e.target.value) || 500
                          }
                        }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Temperature</Label>
                      <span className="text-sm font-medium">{settings.ai_model_settings.temperature}</span>
                    </div>
                    <Slider
                      value={[settings.ai_model_settings.temperature]}
                      onValueChange={([value]) => {
                        setSettings(prev => ({
                          ...prev,
                          ai_model_settings: {
                            ...prev.ai_model_settings,
                            temperature: value
                          }
                        }));
                      }}
                      max={2}
                      min={0}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="text-md font-semibold">Templates de Prompt</h4>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Template de Classificação</Label>
                    <Textarea
                      value={settings.classification_prompt_template}
                      onChange={(e) => setSettings(prev => ({ ...prev, classification_prompt_template: e.target.value }))}
                      placeholder="Template para classificação de tickets..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Template de Prioridade</Label>
                    <Textarea
                      value={settings.priority_prompt_template}
                      onChange={(e) => setSettings(prev => ({ ...prev, priority_prompt_template: e.target.value }))}
                      placeholder="Template para determinação de prioridade..."
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Template de SLA</Label>
                    <Textarea
                      value={settings.sla_prompt_template}
                      onChange={(e) => setSettings(prev => ({ ...prev, sla_prompt_template: e.target.value }))}
                      placeholder="Template para cálculo de SLA..."
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Aba Aprendizagem */}
            <TabsContent value="aprendizagem" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Aprendizagem Contínua
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure como o sistema aprende e se adapta com feedback
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Habilitar Aprendizagem Contínua</Label>
                    <p className="text-sm text-muted-foreground">
                      Sistema aprende automaticamente com feedback e ajustes
                    </p>
                  </div>
                  <Switch
                    checked={settings.continuous_learning_enabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, continuous_learning_enabled: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base font-medium">Ajuste Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite ajustes automáticos baseados na performance
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_adjustment_enabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_adjustment_enabled: checked }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>Limite de Feedback</Label>
                    <span className="text-sm font-medium">{settings.feedback_threshold}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Limite mínimo de confiança para aplicar feedback automaticamente
                  </p>
                  <Slider
                    value={[settings.feedback_threshold]}
                    onValueChange={([value]) => {
                      setSettings(prev => ({ ...prev, feedback_threshold: value }));
                    }}
                    max={1}
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
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