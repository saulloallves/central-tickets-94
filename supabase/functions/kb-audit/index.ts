import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const source = body?.source || 'manual';
    
    console.log(`Iniciando auditoria da base de conhecimento (fonte: ${source})...`);
    
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
    const { data: todosDocumentos } = await supabase
      .from('documentos')
      .select('artigo_id, titulo, status');

    // Agrupar manualmente artigos por status
    const artigosComVersaoAtiva = new Set();
    const artigosOrfaos = [];
    
    if (todosDocumentos) {
      todosDocumentos.forEach(doc => {
        if (doc.status === 'ativo') {
          artigosComVersaoAtiva.add(doc.artigo_id);
        }
      });
      
      // Encontrar artigos únicos sem versão ativa
      const artigosUnicos = new Map();
      todosDocumentos.forEach(doc => {
        if (!artigosComVersaoAtiva.has(doc.artigo_id) && !artigosUnicos.has(doc.artigo_id)) {
          artigosUnicos.set(doc.artigo_id, { artigo_id: doc.artigo_id, titulo: doc.titulo });
        }
      });
      
      artigosOrfaos.push(...artigosUnicos.values());
    }

    if (artigosOrfaos?.length > 0) {
      inconsistencias.push({
        tipo: 'artigos_orfaos',
        count: artigosOrfaos.length,
        detalhes: artigosOrfaos,
        acao_sugerida: 'Reativar versão ou arquivar definitivamente',
        criticidade: 'baixa'
      });
    }

    // 4. Documentos próximos ao vencimento (7 dias)
    const dataAlerta = new Date();
    dataAlerta.setDate(dataAlerta.getDate() + 7);
    
    const { data: proximosVencimento } = await supabase
      .from('documentos')
      .select('id, titulo, valido_ate')
      .eq('status', 'ativo')
      .eq('tipo', 'temporario')
      .gt('valido_ate', new Date().toISOString())
      .lt('valido_ate', dataAlerta.toISOString());

    if (proximosVencimento?.length > 0) {
      inconsistencias.push({
        tipo: 'proximos_vencimento',
        count: proximosVencimento.length,
        detalhes: proximosVencimento,
        acao_sugerida: 'Revisar e estender prazo se necessário',
        criticidade: 'media'
      });
    }

    // 5. Estatísticas gerais - calcular manualmente
    const { data: allDocs } = await supabase
      .from('documentos')
      .select('status, tipo');

    const resumo = {
      total_documentos: allDocs?.length || 0,
      documentos_ativos: allDocs?.filter(d => d.status === 'ativo').length || 0,
      documentos_temporarios: allDocs?.filter(d => d.tipo === 'temporario').length || 0,
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
