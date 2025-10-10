
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Brain, BookOpen, TrendingUp, AlertTriangle, Image, Bell, Users, MessageSquare, Headphones, Zap, Database } from "lucide-react";
import { IASettingsTab } from "@/components/configuracoes/IASettingsTab";
import KnowledgeHubTab from "@/components/configuracoes/KnowledgeHubTab";
import { RelatoriosTab } from "@/components/configuracoes/RelatoriosTab";
import { NotificacoesTab } from "@/components/configuracoes/NotificacoesTab";
import { AutoApprovalsTab } from "@/components/configuracoes/AutoApprovalsTab";

import { LogoSettings } from "@/components/configuracoes/LogoSettingsTab";

import { WhatsAppManagementTab } from '@/components/configuracoes/WhatsAppManagementTab';
import { AIAlertsTestTab } from '@/components/configuracoes/AIAlertsTestTab';
import CrisisAISettingsTab from '@/components/configuracoes/CrisisAISettingsTab';
import { AtendentesTab } from '@/components/configuracoes/AtendentesTab';
import { AIClassifierAdvancedTab } from '@/components/configuracoes/AIClassifierAdvancedTab';
import { ZAPIInstancesTab } from '@/components/configuracoes/ZAPIInstancesTab';
import { CleanupTicketsButton } from '@/components/admin/CleanupTicketsButton';

export default function Configuracoes() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'ia');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="w-full space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Configurações do Sistema</h1>
              <p className="text-muted-foreground">Gerencie as configurações e preferências do sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-muted px-3 py-1 rounded-full text-sm text-muted-foreground">
              Admin Only
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap w-full justify-start mb-6 h-auto p-1 gap-1">
            <TabsTrigger value="logo" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Logo
            </TabsTrigger>
            <TabsTrigger value="ia" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              IA
            </TabsTrigger>
            <TabsTrigger value="ai-classifier-advanced" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              IA Classifier Avançado
            </TabsTrigger>
            <TabsTrigger value="conhecimento" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Hub de Conhecimento
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Relatórios
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="ai-alerts" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertas IA
            </TabsTrigger>
            <TabsTrigger value="auto-approvals" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Aprovações
            </TabsTrigger>
            <TabsTrigger value="crisis-ai" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              IA Crises
            </TabsTrigger>
            <TabsTrigger value="atendentes" className="flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Atendentes
            </TabsTrigger>
            <TabsTrigger value="zapi-instances" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Z-API Instâncias
            </TabsTrigger>
            <TabsTrigger value="manutencao" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Manutenção
            </TabsTrigger>
          </TabsList>

          <TabsContent value="logo" className="space-y-6 animate-fade-in">
            <LogoSettings />
          </TabsContent>

          <TabsContent value="ia" className="space-y-6 animate-fade-in">
            <IASettingsTab />
          </TabsContent>

          <TabsContent value="ai-classifier-advanced" className="space-y-6 animate-fade-in">
            <AIClassifierAdvancedTab />
          </TabsContent>

          <TabsContent value="conhecimento" className="space-y-6 animate-fade-in">
            <KnowledgeHubTab />
          </TabsContent>

          <TabsContent value="notificacoes" className="space-y-6 animate-fade-in">
            <NotificacoesTab />
          </TabsContent>

          <TabsContent value="relatorios" className="space-y-6 animate-fade-in">
            <RelatoriosTab />
          </TabsContent>


          <TabsContent value="whatsapp" className="space-y-6 animate-fade-in">
            <WhatsAppManagementTab />
          </TabsContent>

          <TabsContent value="ai-alerts" className="space-y-6 animate-fade-in">
            <AIAlertsTestTab />
          </TabsContent>

          <TabsContent value="auto-approvals" className="space-y-6 animate-fade-in">
            <AutoApprovalsTab />
          </TabsContent>

          <TabsContent value="crisis-ai" className="space-y-6 animate-fade-in">
            <CrisisAISettingsTab />
          </TabsContent>

          <TabsContent value="atendentes" className="space-y-6 animate-fade-in">
            <AtendentesTab />
          </TabsContent>

          <TabsContent value="zapi-instances" className="space-y-6 animate-fade-in">
            <ZAPIInstancesTab />
          </TabsContent>

          <TabsContent value="manutencao" className="space-y-6 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Manutenção do Banco de Dados
                </CardTitle>
                <CardDescription>
                  Ferramentas de limpeza e manutenção do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border border-destructive/20 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <h3 className="font-semibold text-foreground">Limpeza de Tickets</h3>
                      <p className="text-sm text-muted-foreground">
                        Remove todos os tickets, mensagens e chamados do banco de dados. 
                        Esta ação é <strong>irreversível</strong>.
                      </p>
                      <CleanupTicketsButton />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
