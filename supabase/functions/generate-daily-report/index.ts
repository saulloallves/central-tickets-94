import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from '../_shared/zapi-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZApiConfig {
  instanceId: string;
  instanceToken: string;
  clientToken: string;
  baseUrl: string;
}

// Função para enviar mensagem via Z-API
async function sendWhatsAppReport(message: string, config: ZApiConfig, supabase: any): Promise<boolean> {
  try {
    // Buscar número de destino do banco
    const { data: settings } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'daily_report_phone')
      .maybeSingle();
    
    const phone = settings?.setting_value || '5511977256029'; // Fallback padrão
    
    console.log(`📤 Enviando relatório para ${phone}...`);
    
    const response = await fetch(
      `${config.baseUrl}/instances/${config.instanceId}/token/${config.instanceToken}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': config.clientToken,
        },
        body: JSON.stringify({
          phone: phone,
          message: message,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro ao enviar via Z-API:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('✅ Relatório enviado via WhatsApp:', result);
    return true;
  } catch (error) {
    console.error('❌ Erro no envio WhatsApp:', error);
    return false;
  }
}

// Função para formatar o relatório em texto
function formatReportMessage(data: any): string {
  const date = new Date(data.report_date).toLocaleDateString('pt-BR');
  
  return `📊 *RELATÓRIO DIÁRIO - ${date}*

🎫 *TICKETS*
━━━━━━━━━━━━━━━━━━━
📥 Abertos: *${data.total_tickets_abertos}*
✅ Concluídos: *${data.total_tickets_concluidos}*
⏳ Em andamento: *${data.total_tickets_em_andamento}*
📈 Taxa de conclusão: *${data.taxa_conclusao?.toFixed(1)}%*

⏱️ *SLA*
━━━━━━━━━━━━━━━━━━━
✅ Dentro do prazo: *${data.tickets_sla_ok}*
❌ Vencidos: *${data.tickets_sla_vencido}*
📊 Percentual SLA: *${data.percentual_sla?.toFixed(1)}%*

⚡ *PERFORMANCE*
━━━━━━━━━━━━━━━━━━━
⏰ Tempo médio resolução: *${data.tempo_medio_resolucao_horas?.toFixed(1)}h*
🚨 Tickets de crise: *${data.tickets_crise}*

🏆 *DESTAQUES*
━━━━━━━━━━━━━━━━━━━
👥 Equipe destaque: *${data.equipe_mais_chamados?.nome || 'N/A'}* (${data.equipe_mais_chamados?.total || 0} tickets)
🏢 Unidade destaque: *${data.unidade_mais_chamados?.nome || 'N/A'}* (${data.unidade_mais_chamados?.total || 0} tickets)

⚡ *DISTRIBUIÇÃO POR PRIORIDADE*
${Object.entries(data.tickets_por_prioridade || {})
  .map(([pri, count]) => `• ${pri}: ${count}`)
  .join('\n') || '• Nenhuma'}

━━━━━━━━━━━━━━━━━━━
_Relatório gerado automaticamente às 20h_`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const reportDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    console.log(`📊 Gerando relatório para ${reportDate}...`);

    // 1. Buscar tickets do dia (abertura >= 00:00 de hoje)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const { data: ticketsHoje, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        id, status, prioridade, categoria, data_abertura, resolvido_em,
        status_sla, equipe_responsavel_id, unidade_id,
        equipes:equipe_responsavel_id(id, nome),
        unidades(id, grupo)
      `)
      .gte('data_abertura', startOfDay.toISOString());

    if (ticketsError) throw ticketsError;

    // 2. Calcular KPIs
    const totalAbertos = ticketsHoje?.length || 0;
    const totalConcluidos = ticketsHoje?.filter(t => t.status === 'concluido').length || 0;
    const totalEmAndamento = totalAbertos - totalConcluidos; // Cálculo correto: abertos - concluídos
    
    const ticketsSlaOk = ticketsHoje?.filter(t => 
      t.status_sla === 'dentro_prazo' && t.status === 'concluido'
    ).length || 0;
    const ticketsSlaVencido = ticketsHoje?.filter(t => t.status_sla === 'vencido').length || 0;
    
    const ticketsCrise = ticketsHoje?.filter(t => t.prioridade === 'crise').length || 0;

    // 3. Calcular tempo médio de resolução
    const ticketsResolvidos = ticketsHoje?.filter(t => 
      t.status === 'concluido' && t.resolvido_em
    ) || [];
    
    let tempoMedioResolucao = 0;
    if (ticketsResolvidos.length > 0) {
      const totalHoras = ticketsResolvidos.reduce((acc, t) => {
        const horas = (new Date(t.resolvido_em!).getTime() - new Date(t.data_abertura).getTime()) / (1000 * 60 * 60);
        return acc + horas;
      }, 0);
      tempoMedioResolucao = totalHoras / ticketsResolvidos.length;
    }

    // 4. Top equipe
    const equipesCount = ticketsHoje?.reduce((acc, t) => {
      if (t.equipes?.nome) {
        const key = t.equipes.nome;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>) || {};

    const topEquipe = Object.entries(equipesCount)
      .sort(([,a], [,b]) => b - a)[0];

    // 5. Top unidade
    const unidadesCount = ticketsHoje?.reduce((acc, t) => {
      if (t.unidades?.grupo) {
        const key = t.unidades.grupo;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>) || {};

    const topUnidade = Object.entries(unidadesCount)
      .sort(([,a], [,b]) => b - a)[0];

    // 6. Distribuição por prioridade
    const prioridades = ticketsHoje?.reduce((acc, t) => {
      if (t.prioridade) {
        acc[t.prioridade] = (acc[t.prioridade] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>) || {};

    // 8. Preparar dados do relatório
    const reportData = {
      report_date: reportDate,
      total_tickets_abertos: totalAbertos,
      total_tickets_concluidos: totalConcluidos,
      total_tickets_em_andamento: totalEmAndamento,
      taxa_conclusao: totalAbertos > 0 ? (totalConcluidos / totalAbertos) * 100 : 0,
      tickets_sla_ok: ticketsSlaOk,
      tickets_sla_vencido: ticketsSlaVencido,
      percentual_sla: (ticketsSlaOk + ticketsSlaVencido) > 0 
        ? (ticketsSlaOk / (ticketsSlaOk + ticketsSlaVencido)) * 100 
        : 0,
      tempo_medio_resolucao_horas: tempoMedioResolucao,
      tickets_crise: ticketsCrise,
      equipe_mais_chamados: topEquipe ? { nome: topEquipe[0], total: topEquipe[1] } : null,
      unidade_mais_chamados: topUnidade ? { nome: topUnidade[0], total: topUnidade[1] } : null,
      tickets_por_prioridade: prioridades
    };

    // 9. Carregar config Z-API
    const zapiConfig = await loadZAPIConfig();
    if (!zapiConfig.instanceId || !zapiConfig.instanceToken) {
      throw new Error('Configuração Z-API incompleta');
    }

    // 10. Formatar e enviar mensagem WhatsApp
    const messageText = formatReportMessage(reportData);
    const whatsappSuccess = await sendWhatsAppReport(messageText, zapiConfig, supabase);

    // 11. Salvar relatório no banco
    const { data: relatorio, error: saveError } = await supabase
      .from('daily_reports')
      .insert({
        ...reportData,
        whatsapp_enviado: whatsappSuccess,
        whatsapp_enviado_em: whatsappSuccess ? new Date().toISOString() : null,
        whatsapp_erro: whatsappSuccess ? null : 'Erro ao enviar via Z-API'
      })
      .select()
      .single();

    if (saveError) throw saveError;

    console.log('✅ Relatório salvo:', relatorio.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        report_id: relatorio.id,
        whatsapp_sent: whatsappSuccess,
        summary: {
          total_abertos: totalAbertos,
          total_concluidos: totalConcluidos,
          equipe_destaque: topEquipe?.[0],
          sla_percentual: reportData.percentual_sla.toFixed(1) + '%'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Erro ao gerar relatório:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
