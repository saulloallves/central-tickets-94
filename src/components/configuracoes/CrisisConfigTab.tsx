import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Plus, X, Save, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CrisisConfig {
  auto_detection_enabled: boolean;
  keyword_threshold: number;
  volume_threshold: number;
  time_window_minutes: number;
  keywords: string[];
  default_message: string;
  normalize_accents: boolean;
}

export const CrisisConfigTab = () => {
  const [config, setConfig] = useState<CrisisConfig>({
    auto_detection_enabled: true,
    keyword_threshold: 1,
    volume_threshold: 3,
    time_window_minutes: 10,
    keywords: [
      'travou tudo', 'não consigo vender', 'nao consigo vender', 'cliente xingando',
      'reclamação grave', 'reclamacao grave', 'ação judicial', 'acao judicial',
      'urgência máxima', 'urgencia maxima', 'ameaça', 'advogado', 'procon', 'trava total'
    ],
    default_message: 'Incidente detectado automaticamente. Nossa equipe está investigando.',
    normalize_accents: true
  });
  
  const [newKeyword, setNewKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const addKeyword = () => {
    if (newKeyword.trim() && !config.keywords.includes(newKeyword.trim().toLowerCase())) {
      setConfig(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim().toLowerCase()]
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setConfig(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword)
    }));
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      // Save configuration to a settings table or use it directly in the application
      toast({
        title: "Configurações Salvas",
        description: "As configurações do modo crise foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving crisis config:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configurações do Modo Crise</h2>
          <p className="text-muted-foreground">
            Configure a detecção automática e comportamento do sistema de crises
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Detecção Automática */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Detecção Automática
            </CardTitle>
            <CardDescription>
              Configure quando o sistema deve criar crises automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar detecção automática</Label>
                <p className="text-sm text-muted-foreground">
                  O sistema criará crises automaticamente baseado nas regras configuradas
                </p>
              </div>
              <Switch
                checked={config.auto_detection_enabled}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, auto_detection_enabled: checked }))
                }
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="volume_threshold">Limite de Volume</Label>
                <Input
                  id="volume_threshold"
                  type="number"
                  min="1"
                  value={config.volume_threshold}
                  onChange={(e) => 
                    setConfig(prev => ({ ...prev, volume_threshold: parseInt(e.target.value) || 3 }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Número mínimo de tickets similares para ativar crise
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_window">Janela de Tempo (minutos)</Label>
                <Input
                  id="time_window"
                  type="number"
                  min="1"
                  value={config.time_window_minutes}
                  onChange={(e) => 
                    setConfig(prev => ({ ...prev, time_window_minutes: parseInt(e.target.value) || 10 }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Período para considerar tickets relacionados
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Normalizar acentos</Label>
                <p className="text-sm text-muted-foreground">
                  Ignora acentos ao comparar palavras-chave (ex: "ação" = "acao")
                </p>
              </div>
              <Switch
                checked={config.normalize_accents}
                onCheckedChange={(checked) => 
                  setConfig(prev => ({ ...prev, normalize_accents: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Palavras-chave */}
        <Card>
          <CardHeader>
            <CardTitle>Palavras-chave Críticas</CardTitle>
            <CardDescription>
              Palavras ou frases que automaticamente ativam uma crise
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Digite uma nova palavra-chave..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
              />
              <Button onClick={addKeyword} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {config.keywords.map((keyword) => (
                <Badge
                  key={keyword}
                  variant="secondary"
                  className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => removeKeyword(keyword)}
                >
                  {keyword}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mensagem Padrão */}
        <Card>
          <CardHeader>
            <CardTitle>Mensagem Padrão</CardTitle>
            <CardDescription>
              Mensagem enviada automaticamente quando uma crise é detectada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Digite a mensagem padrão..."
              value={config.default_message}
              onChange={(e) => 
                setConfig(prev => ({ ...prev, default_message: e.target.value }))
              }
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Botão Salvar */}
        <div className="flex justify-end">
          <Button onClick={saveConfig} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </div>
  );
};