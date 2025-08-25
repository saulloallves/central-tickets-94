import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, TrendingUp, DollarSign } from 'lucide-react';

export default function FranqueadoDashboard() {
  const { user } = useAuth();
  const { profile } = useProfile();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Bem-vindo, {profile?.nome_completo || user?.email?.split('@')[0]}!
        </h1>
        <p className="text-muted-foreground">
          Área exclusiva para franqueados - Gerencie suas unidades e acompanhe resultados
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Minhas Unidades
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              +1 nova este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Colaboradores
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              +2 desde o último mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Performance
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <p className="text-xs text-muted-foreground">
              +5% desde o último mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Faturamento
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 45.2k</div>
            <p className="text-xs text-muted-foreground">
              +12% desde o último mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resumo das Unidades</CardTitle>
            <CardDescription>
              Visão geral do desempenho de suas unidades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Unidade Centro</p>
                  <p className="text-sm text-muted-foreground">São Paulo - SP</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">R$ 18.5k</p>
                  <p className="text-sm text-muted-foreground">Este mês</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Unidade Norte</p>
                  <p className="text-sm text-muted-foreground">São Paulo - SP</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">R$ 15.2k</p>
                  <p className="text-sm text-muted-foreground">Este mês</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Unidade Sul</p>
                  <p className="text-sm text-muted-foreground">São Paulo - SP</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">R$ 11.5k</p>
                  <p className="text-sm text-muted-foreground">Este mês</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximas Ações</CardTitle>
            <CardDescription>
              Tarefas e eventos importantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-4">
                <p className="font-medium">Reunião Mensal</p>
                <p className="text-sm text-muted-foreground">
                  Hoje às 14:00 - Revisão de performance
                </p>
              </div>
              
              <div className="border-l-4 border-orange-500 pl-4">
                <p className="font-medium">Relatório Financeiro</p>
                <p className="text-sm text-muted-foreground">
                  Vence em 2 dias - Envio obrigatório
                </p>
              </div>
              
              <div className="border-l-4 border-green-500 pl-4">
                <p className="font-medium">Treinamento de Equipe</p>
                <p className="text-sm text-muted-foreground">
                  Próxima semana - Capacitação em vendas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}