import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Bot, Bell, Settings, TestTube, Zap } from "lucide-react";

interface ZAPIConfig {
  id?: string;
  provider_name: string;
  display_name: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  base_url: string;
  is_active: boolean;
  description: string;
  icon: React.ReactNode;
}

export function ZAPIInstancesTab() {
  const [configs, setConfigs] = useState<ZAPIConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const { toast } = useToast();

  const defaultConfigs: ZAPIConfig[] = [
    {
      provider_name: 'zapi_whatsapp',
      display_name: 'WhatsApp Conversas',
      instance_id: '',
      instance_token: '',
      client_token: '',
      base_url: 'https://api.z-api.io',
      is_active: true,
      description: 'Instância principal para receber e processar conversas naturais do WhatsApp (usa ZAPI_INSTANCE_ID)',
      icon: <MessageSquare className="h-4 w-4" />
    },
    {
      provider_name: 'zapi_bot',
      display_name: 'Bot Automatizado',
      instance_id: '',
      instance_token: '',
      client_token: '',
      base_url: 'https://api.z-api.io',
      is_active: true,
      description: 'Instância específica para envio de botões e respostas do bot (configura BOT_ZAPI_INSTANCE_ID)',
      icon: <Bot className="h-4 w-4" />
    },
    {
      provider_name: 'zapi_notifications',
      display_name: 'Notificações de Tickets',
      instance_id: '',
      instance_token: '',
      client_token: '',
      base_url: 'https://api.z-api.io',
      is_active: true,
      description: 'Instância específica para envio de notificações automáticas (configura NOTIFICATION_ZAPI_INSTANCE_ID)',
      icon: <Bell className="h-4 w-4" />
    }
  ];

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      // Primeiro, buscar configurações do banco
      const { data, error } = await supabase
        .from('messaging_providers')
        .select('*')
        .in('provider_name', ['zapi_whatsapp', 'zapi_bot', 'zapi_notifications', 'zapi'])
        .order('provider_name');

      if (error) throw error;

      // Buscar configurações atuais via edge function para pegar env vars
      const { data: currentConfig } = await supabase.functions.invoke('test-instance-routing', {
        body: { action: 'get_configs' }
      });

      console.log('Configurações atuais:', currentConfig);

      // Merge com configurações padrão
      const mergedConfigs = defaultConfigs.map(defaultConfig => {
        const existingConfig = data?.find(d => 
          d.provider_name === defaultConfig.provider_name || 
          (d.provider_name === 'zapi' && defaultConfig.provider_name === 'zapi_whatsapp')
        );

        // Se encontrou no banco, usar essas configurações
        if (existingConfig) {
          return {
            ...defaultConfig,
            ...existingConfig,
            id: existingConfig.id
          };
        }

        // Se não encontrou no banco, carregar das env vars específicas
        let configData = { ...defaultConfig };
        
        if (currentConfig?.configurations) {
          switch (defaultConfig.provider_name) {
            case 'zapi_whatsapp':
              const whatsappConfig = currentConfig.configurations.zapi_whatsapp || {};
              configData = {
                ...defaultConfig,
                instance_id: whatsappConfig.instanceId || '',
                instance_token: whatsappConfig.token || '',
                client_token: whatsappConfig.clientToken || '',
                base_url: whatsappConfig.baseUrl || 'https://api.z-api.io'
              };
              break;
            case 'zapi_bot':
              const botConfig = currentConfig.configurations.bot_base_1 || {};
              configData = {
                ...defaultConfig,
                instance_id: botConfig.instanceId || '',
                instance_token: botConfig.token || '',
                client_token: botConfig.clientToken || '',
                base_url: botConfig.baseUrl || 'https://api.z-api.io'
              };
              break;
            case 'zapi_notifications':
              const notificationConfig = currentConfig.configurations.send_ticket_notification || {};
              configData = {
                ...defaultConfig,
                instance_id: notificationConfig.instanceId || '',
                instance_token: notificationConfig.token || '',
                client_token: notificationConfig.clientToken || '',
                base_url: notificationConfig.baseUrl || 'https://api.z-api.io'
              };
              break;
          }
        }

        return configData;
      });

      setConfigs(mergedConfigs);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações Z-API",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (config: ZAPIConfig) => {
    setSaving(config.provider_name);
    try {
      const configData = {
        provider_name: config.provider_name,
        instance_id: config.instance_id,
        instance_token: config.instance_token,
        client_token: config.client_token,
        base_url: config.base_url,
        is_active: config.is_active
      };

      if (config.id) {
        const { error } = await supabase
          .from('messaging_providers')
          .update(configData)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('messaging_providers')
          .insert(configData);
        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: `Configuração ${config.display_name} salva com sucesso`,
      });

      loadConfigs();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const testInstance = async (config: ZAPIConfig) => {
    if (!config.instance_id || !config.instance_token || !config.client_token) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios antes de testar",
        variant: "destructive",
      });
      return;
    }

    setTesting(config.provider_name);
    try {
      const { data, error } = await supabase.functions.invoke('test-instance-routing', {
        body: { test_instance: config.provider_name }
      });

      if (error) throw error;

      toast({
        title: "Teste Realizado",
        description: data.configured ? "✅ Instância configurada corretamente" : "❌ Problemas na configuração",
        variant: data.configured ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro",
        description: "Erro ao testar instância",
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const updateConfig = (providerName: string, field: string, value: string | boolean) => {
    setConfigs(configs.map(config => 
      config.provider_name === providerName 
        ? { ...config, [field]: value }
        : config
    ));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Configurações de Instâncias Z-API
          </CardTitle>
          <CardDescription>
            Configure instâncias separadas do Z-API para evitar conflitos de roteamento entre conversas, bot e notificações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {configs.map((config) => (
              <Card key={config.provider_name} className="border-l-4 border-l-primary/20">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {config.icon}
                      {config.display_name}
                    </div>
                    <Badge variant={config.is_active ? "default" : "secondary"}>
                      {config.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {config.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${config.provider_name}_instance_id`}>
                        Instance ID *
                      </Label>
                      <Input
                        id={`${config.provider_name}_instance_id`}
                        value={config.instance_id}
                        onChange={(e) => updateConfig(config.provider_name, 'instance_id', e.target.value)}
                        placeholder="Ex: 3DD637ABF21A..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${config.provider_name}_base_url`}>
                        Base URL
                      </Label>
                      <Input
                        id={`${config.provider_name}_base_url`}
                        value={config.base_url}
                        onChange={(e) => updateConfig(config.provider_name, 'base_url', e.target.value)}
                        placeholder="https://api.z-api.io"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${config.provider_name}_token`}>
                        Instance Token *
                      </Label>
                      <Input
                        id={`${config.provider_name}_token`}
                        type="password"
                        value={config.instance_token}
                        onChange={(e) => updateConfig(config.provider_name, 'instance_token', e.target.value)}
                        placeholder="Token da instância"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${config.provider_name}_client_token`}>
                        Client Token *
                      </Label>
                      <Input
                        id={`${config.provider_name}_client_token`}
                        type="password"
                        value={config.client_token}
                        onChange={(e) => updateConfig(config.provider_name, 'client_token', e.target.value)}
                        placeholder="Client token"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveConfig(config)}
                      disabled={saving === config.provider_name}
                      size="sm"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {saving === config.provider_name ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button
                      onClick={() => testInstance(config)}
                      disabled={testing === config.provider_name}
                      variant="outline"
                      size="sm"
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      {testing === config.provider_name ? "Testando..." : "Testar"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ℹ️ Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p><strong>WhatsApp Conversas:</strong> Usa variável ZAPI_INSTANCE_ID (principal). Responsável por receber mensagens dos usuários e processar conversas naturais com IA.</p>
            <p><strong>Bot Automatizado:</strong> Usa variável BOT_ZAPI_INSTANCE_ID (se configurada) ou fallback para ZAPI_INSTANCE_ID. Envia botões, menus e respostas automáticas do sistema de bot.</p>
            <p><strong>Notificações de Tickets:</strong> Usa variável NOTIFICATION_ZAPI_INSTANCE_ID (se configurada) ou fallback para ZAPI_INSTANCE_ID. Envia notificações automáticas quando tickets são criados, atualizados ou precisam de atenção.</p>
          </div>
          <Separator />
          <div className="text-sm text-amber-600">
            <p><strong>⚠️ Status Atual:</strong> {configs.filter(c => c.instance_id).length > 0 ? "Todas as funções estão usando a mesma instância principal. Recomendamos configurar instâncias separadas." : "Nenhuma configuração encontrada."}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}