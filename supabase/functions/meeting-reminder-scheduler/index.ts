import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔔 Iniciando verificação de lembretes de reunião...');

    // Buscar todas as reuniões agendadas que ainda não aconteceram
    const { data: reunioes, error: reunioesError } = await supabase
      .from('unidades_acompanhamento')
      .select(`
        id,
        codigo_grupo,
        status,
        reuniao_inicial_data,
        reuniao_proxima_data,
        responsavel_reuniao_nome,
        reuniao_confirmada,
        unidades (
          id,
          grupo,
          id_grupo_branco
        )
      `)
      .in('status', ['reuniao_agendada', 'proximas_reunioes', 'reunioes_dia'])
      .eq('em_acompanhamento', true)
      .not('reuniao_inicial_data', 'is', null);

    if (reunioesError) {
      console.error('❌ Erro ao buscar reuniões:', reunioesError);
      throw reunioesError;
    }

    console.log(`📋 Encontradas ${reunioes?.length || 0} reuniões para verificar`);

    const now = new Date();
    let lembretes_criados = 0;
    const results = [];

    for (const reuniao of reunioes || []) {
      const reuniaoData = new Date(reuniao.reuniao_inicial_data || reuniao.reuniao_proxima_data || '');
      
      if (isNaN(reuniaoData.getTime()) || reuniaoData <= now) {
        console.log(`⏭️ Pulando reunião ${reuniao.id} - Data inválida ou já passou`);
        continue;
      }

      const diffMs = reuniaoData.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      console.log(`⏰ Reunião ${reuniao.id}: faltam ${diffDays}d ${diffHours % 24}h ${diffMinutes % 60}m`);

      // Array para guardar os tipos de lembrete que devem ser criados
      const lembretes = [];

      // Lembrete de 1 dia (entre 23h e 25h antes)
      if (diffHours >= 23 && diffHours <= 25) {
        lembretes.push('reuniao_lembrete_1_dia');
      }

      // Lembrete de 1 hora (entre 55min e 65min antes)
      if (diffMinutes >= 55 && diffMinutes <= 65) {
        lembretes.push('reuniao_lembrete_1_hora');
      }

      // Lembrete de 15 minutos (entre 14min e 16min antes)
      if (diffMinutes >= 14 && diffMinutes <= 16) {
        lembretes.push('reuniao_lembrete_15_minutos');
      }

      // Processar cada tipo de lembrete
      for (const tipoLembrete of lembretes) {
        // Verificar se já existe lembrete deste tipo enviado nas últimas 24h
        const { data: existingNotif, error: existingError } = await supabase
          .from('notifications_queue')
          .select('id, status, created_at')
          .eq('type', tipoLembrete)
          .eq('acompanhamento_id', reuniao.id)
          .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (existingError && existingError.code !== 'PGRST116') {
          console.error(`❌ Erro ao verificar notificação existente:`, existingError);
          continue;
        }

        if (existingNotif) {
          console.log(`⏭️ Lembrete ${tipoLembrete} já enviado para reunião ${reuniao.id}`);
          continue;
        }

        // Criar lembrete na fila
        console.log(`📤 Criando lembrete ${tipoLembrete} para reunião ${reuniao.id}`);

        const { data: notifData, error: notifError } = await supabase
          .from('notifications_queue')
          .insert({
            type: tipoLembrete,
            acompanhamento_id: reuniao.id,
            status: 'pending',
            payload: {
              unidade_nome: reuniao.unidades?.grupo,
              responsavel_nome: reuniao.responsavel_reuniao_nome,
              data_reuniao: reuniao.reuniao_inicial_data || reuniao.reuniao_proxima_data,
              reuniao_confirmada: reuniao.reuniao_confirmada,
              destination: reuniao.unidades?.id_grupo_branco
            }
          })
          .select()
          .single();

        if (notifError) {
          console.error(`❌ Erro ao criar lembrete ${tipoLembrete}:`, notifError);
          results.push({
            acompanhamento_id: reuniao.id,
            tipo: tipoLembrete,
            success: false,
            error: notifError.message
          });
        } else {
          console.log(`✅ Lembrete ${tipoLembrete} criado com sucesso: ${notifData.id}`);
          lembretes_criados++;
          results.push({
            acompanhamento_id: reuniao.id,
            tipo: tipoLembrete,
            success: true,
            notification_id: notifData.id
          });
        }
      }
    }

    console.log(`✅ Processo concluído. ${lembretes_criados} lembretes criados`);

    return new Response(
      JSON.stringify({
        success: true,
        reunioes_verificadas: reunioes?.length || 0,
        lembretes_criados,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Erro no scheduler de lembretes:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
