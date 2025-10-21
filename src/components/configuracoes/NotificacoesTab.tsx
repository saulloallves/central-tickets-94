import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Save, TestTube, Settings, MessageSquare, Eye, EyeOff, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfiguracaoOrigemTab } from "./ConfiguracaoOrigemTab";
import { SLANotificationTest } from "./SLANotificationTest";
import { NotificationLogsViewer } from './NotificationLogsViewer';

interface ZApiConfig {
  id?: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  base_url: string;
  is_active: boolean;
}

interface MessageTemplate {
  id?: string;
  template_key: string;
  template_content: string;
  description: string;
  variables: string[];
  is_active: boolean;
}

export function NotificacoesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  
  // Z-API Configuration state
  const [zapiConfig, setZapiConfig] = useState<ZApiConfig>({
    instance_id: '',
    instance_token: '',
    client_token: '',
    base_url: 'https://api.z-api.io',
    is_active: true
  });

  // Message Templates state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

  // Load current configurations
  useEffect(() => {
    loadZApiConfig();
    loadMessageTemplates();
  }, []);

  const loadZApiConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('messaging_providers')
        .select('*')
        .eq('provider_name', 'zapi')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error loading Z-API config:', error);
        return;
      }

      if (data) {
        setZapiConfig({
          id: data.id,
          instance_id: data.instance_id,
          instance_token: data.instance_token,
          client_token: data.client_token,
          base_url: data.base_url,
          is_active: data.is_active
        });
      }
    } catch (error) {
      console.error('Error loading Z-API config:', error);
    }
  };

  const loadMessageTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('template_key');

      if (error) {
        console.error('Error loading templates:', error);
        return;
      }

      // Templates loaded from DB

      const formattedTemplates = (data || []).map(template => ({
        id: template.id,
        template_key: template.template_key,
        template_content: template.template_content,
        description: template.description || '',
        variables: Array.isArray(template.variables) 
          ? template.variables.map(v => String(v)) 
          : [],
        is_active: template.is_active
      }));
      
      // Templates formatted
      setTemplates(formattedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const saveZApiConfig = async () => {
    setLoading(true);
    try {
      // First deactivate any existing active config
      if (zapiConfig.id) {
        await supabase
          .from('messaging_providers')
          .update({ is_active: false })
          .eq('provider_name', 'zapi');
      }

      // Insert or update the configuration
      const { error } = await supabase
        .from('messaging_providers')
        .upsert({
          ...zapiConfig,
          provider_name: 'zapi',
          created_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Configuração Z-API salva",
        description: "As configurações foram atualizadas com sucesso.",
      });

      loadZApiConfig(); // Reload to get the new ID
    } catch (error) {
      console.error('Error saving Z-API config:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a configuração Z-API.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (template: MessageTemplate) => {
    setLoading(true);
    try {
      // First deactivate any existing active template with same key
      await supabase
        .from('message_templates')
        .update({ is_active: false })
        .eq('template_key', template.template_key);

      // Insert or update the template
      const { error } = await supabase
        .from('message_templates')
        .upsert({
          ...template,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Template salvo",
        description: `Template "${template.template_key}" foi atualizado com sucesso.`,
      });

      loadMessageTemplates();
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o template.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const [testPhone, setTestPhone] = useState('');

  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('process-notifications', {
        body: {
          type: 'test_connection',
          textoResposta: 'Teste de conexão Z-API realizado com sucesso!',
          testPhone: testPhone || undefined
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro na função');
      }

      const result = response.data;
      
      toast({
        title: result.success ? "Teste realizado com sucesso" : "Erro no teste",
        description: result.message || (testPhone ? 
          `Mensagem ${result.success ? 'enviada para' : 'não enviada para'} ${testPhone}` : 
          'Status da conexão verificado'),
        variant: result.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Error testing connection:', error);
      toast({
        title: "Erro no teste",
        description: error instanceof Error ? error.message : "Não foi possível testar a conexão Z-API.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 8) return token;
    return token.substring(0, 4) + '•'.repeat(token.length - 8) + token.substring(token.length - 4);
  };

  return (
    <div className="space-y-6">
      {/* Seção 0: Teste de Notificação SLA */}
      <SLANotificationTest />

      {/* Seção 0.5: Log de Notificações Enviadas */}
      <NotificationLogsViewer />

      {/* Seção 1: Origem dos Números */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Origem dos Números</CardTitle>
          <CardDescription className="text-sm">
            Configure a origem dos números para notificações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfiguracaoOrigemTab />
        </CardContent>
      </Card>

      {/* Seção 2: Configurações Z-API */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Configurações do Z-API</CardTitle>
          <CardDescription className="text-sm">
            Configure as credenciais e URL base para integração com Z-API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="instance_id">Instance ID</Label>
              <Input
                id="instance_id"
                value={zapiConfig.instance_id}
                onChange={(e) => setZapiConfig({ ...zapiConfig, instance_id: e.target.value })}
                placeholder="Seu Instance ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base_url">Base URL</Label>
              <Input
                id="base_url"
                value={zapiConfig.base_url}
                onChange={(e) => setZapiConfig({ ...zapiConfig, base_url: e.target.value })}
                placeholder="https://api.z-api.io"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="instance_token">Instance Token</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTokens(!showTokens)}
              >
                {showTokens ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Input
              id="instance_token"
              type={showTokens ? "text" : "password"}
              value={showTokens ? zapiConfig.instance_token : maskToken(zapiConfig.instance_token)}
              onChange={(e) => setZapiConfig({ ...zapiConfig, instance_token: e.target.value })}
              placeholder="Seu Instance Token"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_token">Client Token</Label>
            <Input
              id="client_token"
              type={showTokens ? "text" : "password"}
              value={showTokens ? zapiConfig.client_token : maskToken(zapiConfig.client_token)}
              onChange={(e) => setZapiConfig({ ...zapiConfig, client_token: e.target.value })}
              placeholder="Seu Client Token"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={zapiConfig.is_active}
              onCheckedChange={(checked) => setZapiConfig({ ...zapiConfig, is_active: checked })}
            />
            <Label htmlFor="is_active">Configuração ativa</Label>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="test_phone">Número para teste (opcional)</Label>
              <Input
                id="test_phone"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="5511999999999 (com código do país)"
              />
              <p className="text-xs text-muted-foreground">
                Se informado, enviará uma mensagem de teste. Caso contrário, apenas verificará as credenciais.
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={saveZApiConfig} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                Salvar Configuração
              </Button>
              <Button 
                variant="outline" 
                onClick={testConnection} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <TestTube className="h-4 w-4" />
                Testar Conexão
              </Button>
            </div>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Os tokens são sensíveis. Mantenha-os seguros e não os compartilhe.
              A configuração ativa será usada para todas as notificações.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Seção 3: Templates de Mensagens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Templates de Mensagens</CardTitle>
          <CardDescription className="text-sm">
            Gerencie os templates de mensagens do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-4">Templates Disponíveis</h4>
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{template.template_key}</h4>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </div>
                      <Badge variant={template.is_active ? "default" : "secondary"}>
                        {template.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedTemplate && (
              <div>
                <h4 className="font-medium mb-4">Editar Template</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Variáveis disponíveis:</Label>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.variables.map((variable) => (
                        <Badge key={variable} variant="outline" className="text-xs">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template_content">Conteúdo do Template</Label>
                    <Textarea
                      id="template_content"
                      value={selectedTemplate.template_content}
                      onChange={(e) => setSelectedTemplate({
                        ...selectedTemplate,
                        template_content: e.target.value
                      })}
                      rows={10}
                      placeholder="Digite o conteúdo do template..."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="template_active"
                      checked={selectedTemplate.is_active}
                      onCheckedChange={(checked) => setSelectedTemplate({
                        ...selectedTemplate,
                        is_active: checked
                      })}
                    />
                    <Label htmlFor="template_active">Template ativo</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => saveTemplate(selectedTemplate)} 
                      disabled={loading}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Salvar Template
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedTemplate(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}