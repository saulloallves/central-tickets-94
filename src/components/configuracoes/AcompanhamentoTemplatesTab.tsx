import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, MessageSquare, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MessageTemplate {
  id?: string;
  template_key: string;
  template_content: string;
  description: string;
  variables: string[];
  is_active: boolean;
}

export function AcompanhamentoTemplatesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

  // Carregar templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .in('template_key', [
          'acompanhamento_iniciado',
          'reuniao_agendada',
          'reuniao_confirmada',
          'acompanhamento_finalizado'
        ])
        .order('template_key');

      if (error) {
        console.error('Error loading templates:', error);
        return;
      }

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
      
      setTemplates(formattedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const saveTemplate = async (template: MessageTemplate) => {
    setLoading(true);
    try {
      // Desativar qualquer template ativo com a mesma chave
      await supabase
        .from('message_templates')
        .update({ is_active: false })
        .eq('template_key', template.template_key);

      // Inserir ou atualizar o template
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
        description: `Template "${getTemplateName(template.template_key)}" foi atualizado com sucesso.`,
      });

      loadTemplates();
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

  const getTemplateName = (key: string): string => {
    const names: Record<string, string> = {
      'acompanhamento_iniciado': 'Acompanhamento Iniciado',
      'reuniao_agendada': 'Reunião Agendada',
      'reuniao_confirmada': 'Reunião Confirmada',
      'acompanhamento_finalizado': 'Acompanhamento Finalizado'
    };
    return names[key] || key;
  };

  const getTemplateDescription = (key: string): string => {
    const descriptions: Record<string, string> = {
      'acompanhamento_iniciado': 'Enviado quando uma unidade entra em acompanhamento',
      'reuniao_agendada': 'Enviado quando uma reunião é agendada ou reagendada',
      'reuniao_confirmada': 'Enviado quando o franqueado confirma presença na reunião',
      'acompanhamento_finalizado': 'Enviado quando o processo de acompanhamento é finalizado'
    };
    return descriptions[key] || '';
  };

  const getCharacterCount = (text: string): { count: number; limit: number } => {
    return { count: text.length, limit: 4096 };
  };

  return (
    <div className="space-y-6">
      <Alert>
        <MessageSquare className="h-4 w-4" />
        <AlertDescription>
          Configure as mensagens automáticas enviadas durante o processo de acompanhamento.
          Use as variáveis entre chaves duplas (ex: {`{{unidade_nome}}`}) que serão substituídas automaticamente.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Templates */}
        <div>
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Templates de Acompanhamento
          </h4>
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="p-4 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                onClick={() => setSelectedTemplate(template)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-medium">{getTemplateName(template.template_key)}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getTemplateDescription(template.template_key)}
                    </p>
                  </div>
                  <Badge variant={template.is_active ? "default" : "secondary"}>
                    {template.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
            ))}

            {templates.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum template encontrado. Execute a migration SQL para criar os templates iniciais.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        {/* Editor de Template */}
        {selectedTemplate && (
          <div>
            <h4 className="font-medium mb-4">Editar Template</h4>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {getTemplateName(selectedTemplate.template_key)}
                </CardTitle>
                <CardDescription>
                  {getTemplateDescription(selectedTemplate.template_key)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Variáveis Disponíveis */}
                <div className="space-y-2">
                  <Label>Variáveis disponíveis:</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.variables.map((variable) => (
                      <Badge key={variable} variant="outline" className="text-xs font-mono">
                        {`{{${variable}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Editor de Conteúdo */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="template_content">Conteúdo do Template</Label>
                    <span className="text-xs text-muted-foreground">
                      {getCharacterCount(selectedTemplate.template_content).count} / {getCharacterCount(selectedTemplate.template_content).limit}
                    </span>
                  </div>
                  <Textarea
                    id="template_content"
                    value={selectedTemplate.template_content}
                    onChange={(e) => setSelectedTemplate({
                      ...selectedTemplate,
                      template_content: e.target.value
                    })}
                    rows={12}
                    placeholder="Digite o conteúdo do template..."
                    className="font-mono text-sm"
                  />
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <Label>Preview (com dados de exemplo):</Label>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {selectedTemplate.template_content
                      .replace(/\{\{unidade_nome\}\}/g, 'Cresci e Perdi Exemplo')
                      .replace(/\{\{data_inicio\}\}/g, new Date().toLocaleDateString('pt-BR'))
                      .replace(/\{\{data_reuniao\}\}/g, new Date().toLocaleString('pt-BR'))
                      .replace(/\{\{responsavel_nome\}\}/g, 'João Silva')
                      .replace(/\{\{link_zoom_texto\}\}/g, '🔗 Link: https://zoom.us/j/exemplo')
                      .replace(/\{\{data_finalizacao\}\}/g, new Date().toLocaleDateString('pt-BR'))
                      .replace(/\{\{duracao_dias\}\}/g, '15')
                      .replace(/\{\{plano_acao_texto\}\}/g, '✅ Plano de Ação criado!')
                    }
                  </div>
                </div>

                {/* Toggle Ativo/Inativo */}
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

                {/* Botões de Ação */}
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
              </CardContent>
            </Card>
          </div>
        )}

        {!selectedTemplate && (
          <div className="flex items-center justify-center border-2 border-dashed rounded-lg p-8">
            <p className="text-muted-foreground">
              Selecione um template à esquerda para editar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
