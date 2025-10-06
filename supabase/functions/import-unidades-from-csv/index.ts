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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🚀 Iniciando importação de unidades do CSV...');

    // Fetch CSV from Supabase Storage
    const { data: csvFile, error: storageError } = await supabase
      .storage
      .from('data')
      .download('unidades_rows_8.csv');
    
    if (storageError || !csvFile) {
      console.error('Erro ao buscar CSV do storage:', storageError);
      throw new Error('Arquivo CSV não encontrado no storage. Faça upload primeiro em Storage > data bucket.');
    }

    const csvText = await csvFile.text();
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    console.log(`📊 Total de linhas: ${lines.length - 1}`);

    const stats = {
      created: 0,
      updated: 0,
      errors: 0,
      errorDetails: [] as string[]
    };

    // Process each line
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      try {
        // Parse CSV line (handling quotes)
        const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => 
          v.trim().replace(/^"|"$/g, '')
        ) || [];

        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || null;
        });

        // Convert data types
        const unidadeData = {
          id: row.id,
          name: row.name || null,
          codigo: row.codigo || null,
          codigo_grupo: row.codigo_grupo || null,
          group_id: row.group_id || null,
          fase_loja: row.fase_loja || null,
          address: row.address || null,
          neighborhood: row.neighborhood || null,
          city: row.city || null,
          state: row.state || null,
          zip_code: row.zip_code || null,
          latitude: row.latitude ? parseFloat(row.latitude) : null,
          longitude: row.longitude ? parseFloat(row.longitude) : null,
          phone: row.phone || null,
          whatsapp: row.whatsapp || null,
          email: row.email || null,
          instagram: row.instagram_profile || null, // usando instagram_profile do CSV
          opening_hours: row.opening_hours || null,
          store_hours: row.store_hours || null,
          payment_methods: row.payment_methods || null,
          has_parking: row.has_parking || null,
          has_partner_parking: row.has_partner_parking || null,
          is_active: row.is_active === 'true',
          purchases_active: row.purchases_active ? 
            { active: row.purchases_active === 'true' } : null,
          sales_active: row.sales_active ? 
            { active: row.sales_active === 'true' } : null,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
        };

        // Insert or update
        const { error } = await supabase
          .from('unidades')
          .upsert(unidadeData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`❌ Erro ao importar unidade ${unidadeData.codigo}:`, error);
          stats.errors++;
          stats.errorDetails.push(`${unidadeData.codigo}: ${error.message}`);
        } else {
          // Check if was insert or update
          const { data: existing } = await supabase
            .from('unidades')
            .select('id')
            .eq('id', unidadeData.id)
            .single();
          
          if (existing) {
            stats.updated++;
          } else {
            stats.created++;
          }
          
          console.log(`✅ Unidade ${unidadeData.codigo} processada`);
        }
      } catch (lineError) {
        console.error(`❌ Erro ao processar linha ${i}:`, lineError);
        stats.errors++;
        stats.errorDetails.push(`Linha ${i}: ${lineError.message}`);
      }
    }

    // Log the import
    await supabase.rpc('log_system_action', {
      p_tipo_log: 'sistema',
      p_entidade_afetada: 'unidades',
      p_entidade_id: 'bulk_import',
      p_acao_realizada: 'Importação em massa de unidades via CSV',
      p_dados_novos: {
        total_processado: lines.length - 1,
        criadas: stats.created,
        atualizadas: stats.updated,
        erros: stats.errors
      },
      p_canal: 'web'
    });

    console.log('📊 Estatísticas finais:', stats);

    return new Response(
      JSON.stringify({ 
        success: true, 
        stats,
        message: `Importação concluída: ${stats.created} criadas, ${stats.updated} atualizadas, ${stats.errors} erros`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro na importação:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
