import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OverviewCards } from "./stats/OverviewCards";
import { SLAPerformanceChart } from "./stats/SLAPerformanceChart";
import { PriorityAnalysisChart } from "./stats/PriorityAnalysisChart";
import { ChannelAnalysisChart } from "./stats/ChannelAnalysisChart";
import { TeamPerformanceTable } from "./stats/TeamPerformanceTable";
import { UnitPerformanceTable } from "./stats/UnitPerformanceTable";
import { HourlyAnalysisChart } from "./stats/HourlyAnalysisChart";
import { DelayedTicketsTable } from "./stats/DelayedTicketsTable";
import { CrisisTicketsCard } from "./stats/CrisisTicketsCard";
import { AttendantPerformanceTable } from "./stats/AttendantPerformanceTable";
import { TicketDetailModal } from "./TicketDetailModal";

interface StatisticsReport {
  data: {
    overview: any;
    sla_performance: any;
    priority_analysis: any[];
    channel_analysis: any[];
    team_performance: any[];
    unit_performance: any[];
    hourly_analysis: any[];
    delayed_tickets: any[];
    crisis_tickets: any[];
    attendant_performance: any[];
    escalations: any;
  };
  generated_at: string;
  period: {
    start: string;
    end: string;
  };
}

export const StatisticsDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<StatisticsReport | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      console.log('📊 Carregando estatísticas:', { startDate, endDate });

      const { data, error } = await supabase.functions.invoke('generate-daily-statistics-report', {
        body: { start_date: startDate, end_date: endDate }
      });

      if (error) throw error;

      console.log('✅ Estatísticas carregadas:', data);
      setReportData(data);
      toast.success('Estatísticas carregadas com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao carregar estatísticas:', error);
      toast.error('Erro ao carregar estatísticas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!reportData) return;

    const csvParts: string[] = [];

    csvParts.push('VISÃO GERAL DO PERÍODO');
    csvParts.push('Métrica,Valor');
    csvParts.push(`Total Abertos,${reportData.data.overview.total_abertos}`);
    csvParts.push(`Total Concluídos,${reportData.data.overview.total_concluidos}`);
    csvParts.push(`Em Andamento,${reportData.data.overview.total_em_andamento}`);
    csvParts.push(`Taxa de Conclusão,${reportData.data.overview.taxa_conclusao}`);
    csvParts.push('\n');

    csvParts.push('DESEMPENHO DE SLA');
    csvParts.push('Métrica,Valor');
    csvParts.push(`Tickets Dentro do Prazo,${reportData.data.sla_performance.tickets_dentro_prazo}`);
    csvParts.push(`Tickets Vencidos,${reportData.data.sla_performance.tickets_vencidos}`);
    csvParts.push(`Próximos de Vencer,${reportData.data.sla_performance.tickets_proximos_vencer}`);
    csvParts.push(`Percentual SLA,${reportData.data.sla_performance.percentual_sla}`);
    csvParts.push('\n');

    csvParts.push('ANÁLISE POR PRIORIDADE');
    csvParts.push('Prioridade,Total,Concluídos,Taxa Resolução');
    reportData.data.priority_analysis.forEach((p: any) => {
      csvParts.push(`${p.prioridade},${p.total},${p.concluidos},${p.taxa_resolucao}`);
    });
    csvParts.push('\n');

    csvParts.push('ANÁLISE POR CANAL');
    csvParts.push('Canal,Total,Percentual');
    reportData.data.channel_analysis.forEach((c: any) => {
      csvParts.push(`${c.canal},${c.total},${c.percentual}`);
    });
    csvParts.push('\n');

    csvParts.push('DESEMPENHO POR EQUIPE');
    csvParts.push('Equipe,Total Tickets,Resolvidos,Em Andamento,Atrasados,Taxa Resolução,SLA OK');
    reportData.data.team_performance.forEach((t: any) => {
      csvParts.push(`${t.equipe},${t.total_tickets},${t.resolvidos},${t.em_andamento},${t.atrasados},${t.taxa_resolucao},${t.sla_ok}`);
    });
    csvParts.push('\n');

    csvParts.push('DESEMPENHO POR UNIDADE');
    csvParts.push('Unidade,Total Tickets,Resolvidos,Atrasados,Taxa Resolução,Tickets Abertos Atualmente');
    reportData.data.unit_performance.forEach((u: any) => {
      csvParts.push(`${u.unidade},${u.total_tickets},${u.resolvidos},${u.atrasados},${u.taxa_resolucao},${u.total_abertos_atual}`);
    });
    csvParts.push('\n');

    csvParts.push('TICKETS EM ABERTO POR UNIDADE (DETALHADO)');
    csvParts.push('Unidade,Código Ticket,Título,Descrição,Status,Prioridade,Data Abertura,SLA Status');
    reportData.data.unit_performance.forEach((u: any) => {
      u.tickets_em_aberto?.forEach((ticket: any) => {
        const descricao = (ticket.descricao_problema || 'Sem descrição').replace(/"/g, '""');
        const titulo = (ticket.titulo || 'Sem título').replace(/"/g, '""');
        csvParts.push(`${u.unidade},${ticket.codigo_ticket},"${titulo}","${descricao}",${ticket.status},${ticket.prioridade},${new Date(ticket.data_abertura).toLocaleString('pt-BR')},${ticket.status_sla || 'N/A'}`);
      });
    });
    csvParts.push('\n');

    csvParts.push('ANÁLISE HORÁRIA');
    csvParts.push('Hora,Tickets Abertos');
    reportData.data.hourly_analysis.forEach((h: any) => {
      csvParts.push(`${h.hora},${h.tickets_abertos}`);
    });
    csvParts.push('\n');

    csvParts.push('TICKETS ATRASADOS (DETALHADO)');
    csvParts.push('Código,Título,Descrição Problema,Prioridade,Data Abertura,Data Limite SLA,Horas Atrasadas,Equipe,Responsável,Status,Conversa');
    reportData.data.delayed_tickets.forEach((t: any) => {
      const descricao = (t.descricao_problema || 'Sem descrição').replace(/"/g, '""');
      const titulo = (t.titulo || 'Sem título').replace(/"/g, '""');
      csvParts.push(`${t.codigo},"${titulo}","${descricao}",${t.prioridade},${t.data_abertura},${t.data_limite_sla},${t.horas_atrasadas},${t.equipe},${t.responsavel},${t.status},${t.conversa_resumida}`);
    });
    csvParts.push('\n');

    csvParts.push('TICKETS EM CRISE');
    csvParts.push('Código,Descrição,Data Abertura,Tempo Decorrido (h),Status,Equipe,Unidade');
    reportData.data.crisis_tickets.forEach((t: any) => {
      csvParts.push(`${t.codigo},"${t.descricao}",${t.data_abertura},${t.tempo_decorrido_horas},${t.status},${t.equipe},${t.unidade}`);
    });
    csvParts.push('\n');

    csvParts.push('PERFORMANCE DE ATENDENTES (APENAS ATIVOS)');
    csvParts.push('Atendente,Status,Tickets Atendidos,Concluídos,Em Andamento,Taxa Resolução');
    reportData.data.attendant_performance.forEach((a: any) => {
      csvParts.push(`${a.atendente},${a.status_atendente},${a.tickets_atendidos},${a.concluidos},${a.em_andamento},${a.taxa_resolucao}`);
    });
    csvParts.push('\n');

    csvParts.push('ESCALAÇÕES (TICKETS ÚNICOS ESCALADOS)');
    csvParts.push('Métrica,Valor');
    csvParts.push(`Total de Tickets Escalados,${reportData.data.escalations.total}`);
    csvParts.push(`Total de Eventos de Escalação,${reportData.data.escalations.total_eventos || 0}`);
    csvParts.push('\nDistribuição por Nível (Nível Máximo por Ticket)');
    csvParts.push('Nível,Quantidade');
    Object.entries(reportData.data.escalations.por_nivel || {}).forEach(([nivel, count]) => {
      csvParts.push(`${nivel},${count}`);
    });

    const csvContent = csvParts.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_estatistico_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Relatório CSV exportado!');
  };

  const handleTicketClick = (ticketCode: string) => {
    // Extract ticket ID from code or use code directly
    setSelectedTicketId(ticketCode);
    setTicketModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header com seletor de datas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Dashboard de Estatísticas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Data Inicial
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Data Final
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={loadStatistics}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Carregar
                  </>
                )}
              </Button>
              {reportData && (
                <Button
                  onClick={exportCSV}
                  variant="outline"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo do dashboard */}
      {reportData && (
        <div className="space-y-6">
          <OverviewCards data={reportData.data.overview} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SLAPerformanceChart data={reportData.data.sla_performance} />
            <PriorityAnalysisChart data={reportData.data.priority_analysis} />
          </div>

          <ChannelAnalysisChart data={reportData.data.channel_analysis} />

          <TeamPerformanceTable data={reportData.data.team_performance} />

          <UnitPerformanceTable 
            data={reportData.data.unit_performance}
            onTicketClick={handleTicketClick}
          />

          <HourlyAnalysisChart data={reportData.data.hourly_analysis} />

          <DelayedTicketsTable 
            data={reportData.data.delayed_tickets}
            onTicketClick={handleTicketClick}
          />

          <CrisisTicketsCard 
            data={reportData.data.crisis_tickets}
            onTicketClick={handleTicketClick}
          />

          <AttendantPerformanceTable data={reportData.data.attendant_performance} />
        </div>
      )}

      {!reportData && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Selecione um período</h3>
            <p className="text-muted-foreground">
              Escolha as datas e clique em "Carregar" para visualizar as estatísticas
            </p>
          </CardContent>
        </Card>
      )}

      <TicketDetailModal
        ticketCode={selectedTicketId}
        open={ticketModalOpen}
        onOpenChange={setTicketModalOpen}
      />
    </div>
  );
};