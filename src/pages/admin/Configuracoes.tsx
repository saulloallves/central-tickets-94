import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Brain, BookOpen, TrendingUp, Shield, AlertTriangle } from "lucide-react";
import { IASettingsTab } from "@/components/configuracoes/IASettingsTab";
import { KnowledgeHubTab } from "@/components/configuracoes/KnowledgeHubTab";
import { RegrasUsoTab } from "@/components/configuracoes/RegrasUsoTab";
import { RelatoriosTab } from "@/components/configuracoes/RelatoriosTab";
import { NotificacoesTab } from "@/components/configuracoes/NotificacoesTab";
import { CrisisConfigTab } from "@/components/configuracoes/CrisisConfigTab";

export default function Configuracoes() {
  return (
    <div className="min-h-screen bg-gradient-subtle p-6 pt-12">
      <div className="w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-gradient-primary">
              <Settings className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">Configurações do Sistema</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Gerencie as configurações de IA, base de conhecimento e aprendizado contínuo do sistema
          </p>
        </div>

        <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50 shadow-lg">
          <CardContent className="p-6">
            <Tabs defaultValue="ia" className="w-full">
              <TabsList className="grid w-full grid-cols-6 mb-6">
                <TabsTrigger value="ia" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  IA
                </TabsTrigger>
                <TabsTrigger value="conhecimento" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Hub de Conhecimento
                </TabsTrigger>
                <TabsTrigger value="notificacoes" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Notificações
                </TabsTrigger>
                <TabsTrigger value="regras" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Regras de Uso
                </TabsTrigger>
                <TabsTrigger value="relatorios" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Relatórios
                </TabsTrigger>
                <TabsTrigger value="crise" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Modo Crise
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ia" className="space-y-6">
                <IASettingsTab />
              </TabsContent>

              <TabsContent value="conhecimento" className="space-y-6">
                <KnowledgeHubTab />
              </TabsContent>

              <TabsContent value="notificacoes" className="space-y-6">
                <NotificacoesTab />
              </TabsContent>

              <TabsContent value="regras" className="space-y-6">
                <RegrasUsoTab />
              </TabsContent>

              <TabsContent value="relatorios" className="space-y-6">
                <RelatoriosTab />
              </TabsContent>

              <TabsContent value="crise" className="space-y-6">
                <CrisisConfigTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}