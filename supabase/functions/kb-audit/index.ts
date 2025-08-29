
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando auditoria da base de conhecimento...');
    
    const inconsistencias = [];

    // 1. Documentos temporários expirados mas ainda ativos
    const { data: documentosExpirados } = await supabase
      .from('documentos')
      .select('id, titulo, valido_ate')
      .eq('status', 'ativo')
      .eq('tipo', 'temporario')
      .lt('valido_ate', new Date().toISOString());

    if (documentosExpirados?.length > 0) {
      inconsistencias.push({
        tipo: 'documentos_expirados',
        count: documentosExpirados.length,
        detalhes: documentosExpirados,
        acao_sugerida: 'Atualizar status para "vencido"',
        criticidade: 'alta'
      });

      // Auto-correção: marcar como vencidos
      await supabase
        .from('documentos')
        .update({ status: 'vencido' })
        .eq('status', 'ativo')
        .eq('tipo', 'temporario')
        .lt('valido_ate', new Date().toISOString());

      console.log(`Auto-corrigido: ${documentosExpirados.length} documentos expirados`);
    }

    // 2. Artigos sem revisão há mais de 90 dias
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 90);
    
    const { data: documentosSemRevisao } = await supabase
      .from('documentos')
      .select('id, titulo, criado_em, artigo_id')
      .eq('status', 'ativo')
      .lt('criado_em', dataLimite.toISOString())
      .order('criado_em', { ascending: true });

    if (documentosSemRevisao?.length > 0) {
      inconsistencias.push({
        tipo: 'documentos_sem_revisao',
        count: documentosSemRevisao.length,
        detalhes: documentosSemRevisao.slice(0, 10), // Primeiros 10
        acao_sugerida: 'Revisão e atualização necessária',
        criticidade: 'media'
      });
    }

    // 3. Artigos órfãos (sem versões ativas)
    const { data: artigosOrfaos } = await supabase
      .from('documentos')
      .select('artigo_id, titulo')
      .neq('status', 'ativo')
      .groupBy('artigo_id');

    // Filtrar apenas artigos que não têm NENHUMA versão ativa
    const artigosComVersaoAtiva = await supabase
      .from('documentos')
      .select('artigo_id')
      .eq('status', 'ativo')
      .groupBy('artigo_id');

    const idsAtivos = new Set(artigosComVersaoAtiva?.data?.map(a => a.artigo_id) || []);
    const orfsosReais = artigosOrfaos?.filter(artigo => !idsAtivos.has(artigo.artigo_id));

    if (orfsosReais?.length > 0) {
      inconsistencias.push({
        tipo: 'artigos_orfaos',
        count: orfsosReais.length,
        detalhes: orfsosReais,
        acao_sugerida: 'Reativar versão ou arquivar definitivamente',
        criticidade: 'baixa'
      });
    }

    // 4. Estatísticas gerais
    const { data: stats } = await supabase
      .from('documentos')
      .select('status, tipo, count(*)')
      .groupBy('status, tipo');

    const resumo = {
      total_documentos: stats?.reduce((acc, item) => acc + (item.count || 0), 0) || 0,
      documentos_ativos: stats?.find(s => s.status === 'ativo')?.count || 0,
      documentos_temporarios: stats?.filter(s => s.tipo === 'temporario').reduce((acc, item) => acc + (item.count || 0), 0) || 0,
      inconsistencias_encontradas: inconsistencias.length,
      ultima_auditoria: new Date().toISOString()
    };

    console.log('Auditoria concluída:', resumo);

    return new Response(
      JSON.stringify({ 
        success: true,
        resumo,
        inconsistencias,
        recomendacoes: [
          'Execute esta auditoria diariamente via cron job',
          'Revise documentos sem atualização há mais de 90 dias',
          'Configure alertas para documentos temporários próximos do vencimento'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na auditoria:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
