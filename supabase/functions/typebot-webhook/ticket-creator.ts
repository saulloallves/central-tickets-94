/**
 * Ticket creation and management
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

export interface TicketData {
  titulo: string;
  descricao_problema: string;
  categoria?: string;
  prioridade: string;
  unidade_id: string; // UUID string
  equipe_responsavel_id?: string; // UUID string
  franqueado_id?: string; // UUID string
  canal_origem?: string;
}

export async function createTicket(ticketData: TicketData) {
  console.log('Creating ticket with data:', {
    titulo: ticketData.titulo,
    categoria: ticketData.categoria,
    prioridade: ticketData.prioridade,
    unidade_id: ticketData.unidade_id,
    equipe_responsavel_id: ticketData.equipe_responsavel_id
  });

  const supabase = getSupabaseClient();
  
  // Validar e normalizar prioridade ANTES de inserir
  const validPriorities = ['baixo', 'medio', 'alto', 'imediato', 'crise'];
  let normalizedPriority = ticketData.prioridade || 'baixo';
  
  console.log('🔍 [PRIORITY DEBUG] Prioridade recebida:', {
    original: ticketData.prioridade,
    tipo: typeof ticketData.prioridade,
    isValid: validPriorities.includes(normalizedPriority)
  });
  
  if (!validPriorities.includes(normalizedPriority)) {
    console.warn(`⚠️ INVALID PRIORITY "${normalizedPriority}" - mapping to valid value`);
    
    // Mapear prioridades legadas para novas
    const priorityMap: Record<string, string> = {
      'urgente': 'imediato',
      'alta': 'alto',
      'media': 'medio',
      'baixa': 'baixo',
      'posso_esperar': 'baixo',
      'padrao_24h': 'baixo',
      'ainda_hoje': 'medio',
      'hoje_18h': 'medio',
      'ate_1_hora': 'alto'
    };
    
    normalizedPriority = priorityMap[normalizedPriority] || 'baixo';
    console.log(`✅ Mapped to: "${normalizedPriority}"`);
  }
  
  // GARANTIR conversão final (double-check crítico)
  const finalPriority = normalizedPriority === 'alta' ? 'alto' : 
                       normalizedPriority === 'urgente' ? 'imediato' :
                       normalizedPriority === 'media' ? 'medio' :
                       normalizedPriority === 'baixa' ? 'baixo' :
                       normalizedPriority;
  
  console.log('🔒 [PRIORITY FINAL]:', {
    normalized: normalizedPriority,
    final: finalPriority,
    willInsert: finalPriority
  });
  
  // Preparar dados do ticket (categoria opcional)
  const ticketInsertData: any = {
    titulo: ticketData.titulo,
    descricao_problema: ticketData.descricao_problema,
    prioridade: finalPriority, // ← Usar prioridade final garantida
    unidade_id: ticketData.unidade_id,
    equipe_responsavel_id: ticketData.equipe_responsavel_id,
    franqueado_id: ticketData.franqueado_id,
    canal_origem: ticketData.canal_origem || 'typebot',
    status: 'aberto'
  };
  
  console.log('📦 [INSERT DEBUG] Dados que serão inseridos:', {
    prioridade: ticketInsertData.prioridade,
    prioridade_type: typeof ticketInsertData.prioridade,
    ticket_completo: JSON.stringify(ticketInsertData)
  });
  
  // Adicionar categoria apenas se fornecida
  if (ticketData.categoria) {
    ticketInsertData.categoria = ticketData.categoria;
  }
  
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert(ticketInsertData)
    .select()
    .single();

  if (ticketError) {
    console.error('Error creating ticket:', ticketError);
    throw new Error(`Erro ao criar ticket: ${ticketError.message}`);
  }

  console.log('Ticket created successfully:', ticket.codigo_ticket);
  return ticket;
}

export async function addInitialMessage(ticketId: string, message: string, attachments?: any[]) {
  const supabase = getSupabaseClient();
  
  // Usar service role para inserir mensagem do sistema (typebot)
  const { error: messageError } = await supabase
    .from('ticket_mensagens')
    .insert({
      ticket_id: ticketId,
      usuario_id: null, // Sistema/Typebot não tem usuário
      mensagem: message,
      direcao: 'entrada',
      canal: 'typebot',
      anexos: attachments || null
    });

  if (messageError) {
    console.error('Error adding initial message:', messageError);
    throw new Error(`Erro ao adicionar mensagem inicial: ${messageError.message}`);
  }

  console.log('Initial message added successfully');
}

export async function findUnitByCode(codigo_unidade: string) {
  const supabase = getSupabaseClient();
  
  // Convert string to number since codigo_grupo is bigint
  const codigoNumerico = parseInt(codigo_unidade, 10);
  
  if (isNaN(codigoNumerico)) {
    throw new Error('Código da unidade deve ser um número válido');
  }
  
  // Buscar todas as unidades com este código, ordenadas pela mais recente
  const { data: unidades, error: unidadeError } = await supabase
    .from('unidades')
    .select('id, grupo, cidade, uf, created_at')
    .eq('codigo_grupo', codigoNumerico)
    .order('created_at', { ascending: false });

  if (unidadeError) {
    console.error('Erro ao buscar unidade:', unidadeError);
    console.log('Código procurado:', codigoNumerico);
    throw new Error('Erro ao buscar unidade no banco de dados');
  }

  if (!unidades || unidades.length === 0) {
    console.error('Nenhuma unidade encontrada com código:', codigoNumerico);
    throw new Error('Código da unidade não encontrado');
  }

  // Se houver múltiplas unidades, avisar e usar a mais recente
  if (unidades.length > 1) {
    console.warn(`⚠️ Múltiplas unidades encontradas com código ${codigoNumerico}:`, 
      unidades.map(u => `${u.grupo} (${u.cidade}/${u.uf})`).join(', ')
    );
    console.log(`✅ Usando unidade mais recente: ${unidades[0].grupo} (${unidades[0].cidade}/${unidades[0].uf})`);
  }

  const unidade = unidades[0];
  
  console.log('✅ Unidade encontrada:', {
    id: unidade.id,
    tipo_id: typeof unidade.id,
    codigo_grupo: codigoNumerico,
    grupo: unidade.grupo
  });

  return unidade;
}

export async function findFranqueadoByPassword(web_password: string) {
  const supabase = getSupabaseClient();
  const { data: franqueado } = await supabase
    .from('franqueados')
    .select('id')
    .eq('web_password', String(web_password))
    .maybeSingle();
  
  return franqueado;
}

export async function getActiveTeams() {
  const supabase = getSupabaseClient();
  const { data: equipes, error: equipesError } = await supabase
    .from('equipes')
    .select('id, nome, introducao, descricao')
    .eq('ativo', true)
    .order('nome');

  if (equipesError) {
    console.error('Error fetching teams:', equipesError);
    return [];
  }

  return equipes || [];
}

export async function findTeamByName(teamName: string, equipes: any[]) {
  // Clean team name by removing extra characters like ": S", ": N", etc.
  const cleanTeamName = teamName.replace(/:\s*[A-Z]$/, '').trim();
  
  // Try exact match first
  let equipeEncontrada = equipes.find(eq => eq.nome === teamName);
  
  // Try exact match with cleaned name
  if (!equipeEncontrada) {
    equipeEncontrada = equipes.find(eq => eq.nome === cleanTeamName);
  }
  
  // Try partial match
  if (!equipeEncontrada) {
    equipeEncontrada = equipes.find(eq => 
      eq.nome.toLowerCase().includes(cleanTeamName.toLowerCase())
    );
  }
  
  return equipeEncontrada;
}

export async function findTeamByNameDirect(teamName: string) {
  const supabase = getSupabaseClient();
  
  // Clean team name by removing extra characters like ": S", ": N", etc.
  const cleanTeamName = teamName.replace(/:\s*[A-Z]$/, '').trim();
  
  // First try exact match with original name
  let { data: equipe } = await supabase
    .from('equipes')
    .select('id, nome')
    .eq('ativo', true)
    .ilike('nome', teamName)
    .maybeSingle();
  
  // Try exact match with cleaned name
  if (!equipe) {
    const { data: equipeClean } = await supabase
      .from('equipes')
      .select('id, nome')
      .eq('ativo', true)
      .ilike('nome', cleanTeamName)
      .maybeSingle();
    
    equipe = equipeClean;
  }
  
  // If not found, try partial match with cleaned name
  if (!equipe) {
    const { data: equipes } = await supabase
      .from('equipes')
      .select('id, nome')
      .eq('ativo', true)
      .ilike('nome', `%${cleanTeamName}%`)
      .limit(1);
    
    equipe = equipes?.[0] || null;
  }
  
  return equipe;
}

export { getSupabaseClient };