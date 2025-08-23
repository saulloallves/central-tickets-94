
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Shield, TrendingUp, FileSearch, Users } from 'lucide-react';
import { RealtimeDashboard } from '@/components/governanca/RealtimeDashboard';
import { AuditPanel } from '@/components/governanca/AuditPanel';
import { BottleneckDetection } from '@/components/governanca/BottleneckDetection';
import { UsageReports } from '@/components/governanca/UsageReports';
import { AccessControl } from '@/components/governanca/AccessControl';

const Governanca = () => {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Central GiraBot</h1>
          <p className="text-muted-foreground">
            Monitoramento e Governança em Tempo Real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-muted-foreground">Sistema Online</span>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Tempo Real</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" />
            <span className="hidden sm:inline">Auditoria</span>
          </TabsTrigger>
          <TabsTrigger value="bottlenecks" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Gargalos</span>
          </TabsTrigger>
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Uso Sistema</span>
          </TabsTrigger>
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Acessos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <RealtimeDashboard />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditPanel />
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          <BottleneckDetection />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <UsageReports />
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <AccessControl />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Governanca;
