
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Brain, BookOpen, TrendingUp, AlertTriangle, Image, Bell, Users, MessageSquare, Headphones, Zap } from "lucide-react";
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

export default function Configuracoes() {
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

        <Tabs defaultValue="ia" className="w-full">
          <TabsList className="flex w-full overflow-x-auto mb-6 h-auto p-1 gap-1">
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

        </Tabs>
      </div>
    </div>
  );
}
