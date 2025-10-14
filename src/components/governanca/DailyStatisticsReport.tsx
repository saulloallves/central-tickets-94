import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const DailyStatisticsReport = () => {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const generateReport = async () => {
    setLoading(true);
    try {
      console.log('📊 Gerando relatório estatístico para:', selectedDate);

      const { data, error } = await supabase.functions.invoke('generate-daily-statistics-report', {
        body: { start_date: selectedDate, end_date: selectedDate }
      });

      if (error) throw error;

      console.log('✅ Relatório gerado:', data);

      // Converter para CSV e fazer download
      downloadCSV(data);

      toast.success('Relatório gerado com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar relatório: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = (reportData: any) => {
    const csvParts: string[] = [];

    // 1. VISÃO GERAL
    csvParts.push('VISÃO GERAL DO DIA');
    csvParts.push('Métrica,Valor');
    csvParts.push(`Total Abertos,${reportData.data.overview.total_abertos}`);
    csvParts.push(`Total Concluídos,${reportData.data.overview.total_concluidos}`);
    csvParts.push(`Em Andamento,${reportData.data.overview.total_em_andamento}`);
    csvParts.push(`Taxa de Conclusão,${reportData.data.overview.taxa_conclusao}`);
    csvParts.push('\n');

    // 2. SLA PERFORMANCE
    csvParts.push('DESEMPENHO DE SLA');
    csvParts.push('Métrica,Valor');
    csvParts.push(`Tickets Dentro do Prazo,${reportData.data.sla_performance.tickets_dentro_prazo}`);
    csvParts.push(`Tickets Vencidos,${reportData.data.sla_performance.tickets_vencidos}`);
    csvParts.push(`Próximos de Vencer,${reportData.data.sla_performance.tickets_proximos_vencer}`);
    csvParts.push(`Percentual SLA,${reportData.data.sla_performance.percentual_sla}`);
    csvParts.push('\n');

    // 3. ANÁLISE POR PRIORIDADE
    csvParts.push('ANÁLISE POR PRIORIDADE');
    csvParts.push('Prioridade,Total,Concluídos,Taxa Resolução');
    reportData.data.priority_analysis.forEach((p: any) => {
      csvParts.push(`${p.prioridade},${p.total},${p.concluidos},${p.taxa_resolucao}`);
    });
    csvParts.push('\n');

    // 4. ANÁLISE POR CANAL
    csvParts.push('ANÁLISE POR CANAL');
    csvParts.push('Canal,Total,Percentual');
    reportData.data.channel_analysis.forEach((c: any) => {
      csvParts.push(`${c.canal},${c.total},${c.percentual}`);
    });
    csvParts.push('\n');

    // 6. DESEMPENHO POR EQUIPE
    csvParts.push('DESEMPENHO POR EQUIPE');
    csvParts.push('Equipe,Total Tickets,Resolvidos,Em Andamento,Atrasados,Taxa Resolução,SLA OK');
    reportData.data.team_performance.forEach((t: any) => {
      csvParts.push(`${t.equipe},${t.total_tickets},${t.resolvidos},${t.em_andamento},${t.atrasados},${t.taxa_resolucao},${t.sla_ok}`);
    });
    csvParts.push('\n');

    // 7. DESEMPENHO POR UNIDADE
    csvParts.push('DESEMPENHO POR UNIDADE');
    csvParts.push('Unidade,Total Tickets,Resolvidos,Atrasados,Taxa Resolução,Tickets Abertos Atualmente');
    reportData.data.unit_performance.forEach((u: any) => {
      csvParts.push(`${u.unidade},${u.total_tickets},${u.resolvidos},${u.atrasados},${u.taxa_resolucao},${u.total_abertos_atual}`);
    });
    csvParts.push('\n');

    // 7.1. TICKETS EM ABERTO POR UNIDADE (DETALHADO)
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

    // 8. ANÁLISE HORÁRIA
    csvParts.push('ANÁLISE HORÁRIA');
    csvParts.push('Hora,Tickets Abertos');
    reportData.data.hourly_analysis.forEach((h: any) => {
      csvParts.push(`${h.hora},${h.tickets_abertos}`);
    });
    csvParts.push('\n');

    // 9. TICKETS ATRASADOS
    csvParts.push('TICKETS ATRASADOS (DETALHADO)');
    csvParts.push('Código,Título,Descrição Problema,Prioridade,Data Abertura,Data Limite SLA,Horas Atrasadas,Equipe,Responsável,Status,Conversa');
    reportData.data.delayed_tickets.forEach((t: any) => {
      const descricao = (t.descricao_problema || 'Sem descrição').replace(/"/g, '""');
      const titulo = (t.titulo || 'Sem título').replace(/"/g, '""');
      csvParts.push(`${t.codigo},"${titulo}","${descricao}",${t.prioridade},${t.data_abertura},${t.data_limite_sla},${t.horas_atrasadas},${t.equipe},${t.responsavel},${t.status},${t.conversa_resumida}`);
    });
    csvParts.push('\n');

    // 10. TICKETS CRISE
    csvParts.push('TICKETS EM CRISE');
    csvParts.push('Código,Descrição,Data Abertura,Tempo Decorrido (h),Status,Equipe,Unidade');
    reportData.data.crisis_tickets.forEach((t: any) => {
      csvParts.push(`${t.codigo},"${t.descricao}",${t.data_abertura},${t.tempo_decorrido_horas},${t.status},${t.equipe},${t.unidade}`);
    });
    csvParts.push('\n');

    // 13. PERFORMANCE ATENDENTES
    csvParts.push('PERFORMANCE DE ATENDENTES (APENAS ATIVOS)');
    csvParts.push('Atendente,Status,Tickets Atendidos,Concluídos,Em Andamento,Taxa Resolução');
    reportData.data.attendant_performance.forEach((a: any) => {
      csvParts.push(`${a.atendente},${a.status_atendente},${a.tickets_atendidos},${a.concluidos},${a.em_andamento},${a.taxa_resolucao}`);
    });
    csvParts.push('\n');

    // 14. ESCALAÇÕES
    csvParts.push('ESCALAÇÕES');
    csvParts.push('Métrica,Valor');
    csvParts.push(`Total de Escalações,${reportData.data.escalations.total}`);
    Object.entries(reportData.data.escalations.por_nivel || {}).forEach(([nivel, count]) => {
      csvParts.push(`${nivel},${count}`);
    });

    const csvContent = csvParts.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_estatistico_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Relatório Estatístico Diário Completo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              Selecione a Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          <Button
            onClick={generateReport}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Gerar Relatório CSV
              </>
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-semibold">O relatório inclui:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Visão Geral do Dia (totais, taxas)</li>
            <li>Desempenho de SLA (cumprimento, vencidos)</li>
            <li>Análise por Prioridade</li>
            <li>Análise por Canal de Origem</li>
            <li>Desempenho por Equipe</li>
            <li>Desempenho por Unidade</li>
            <li>Análise Horária (distribuição)</li>
            <li>Tickets Atrasados (detalhado)</li>
            <li>Tickets em Crise</li>
            <li>Performance de Atendentes</li>
            <li>Escalações</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
