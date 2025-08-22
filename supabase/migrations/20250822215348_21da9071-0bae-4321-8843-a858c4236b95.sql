-- Criar função para limpar crises ativas órfãs (que não têm mais tickets ativos vinculados)
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_crises()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Resolver automaticamente crises ativas que não têm mais tickets em crise
  UPDATE public.crises_ativas 
  SET resolvida_em = now(),
      resolvida_por = '00000000-0000-0000-0000-000000000000'::uuid, -- Sistema
      log_acoes = log_acoes || jsonb_build_object(
        'acao', 'auto_resolver',
        'por', '00000000-0000-0000-0000-000000000000',
        'em', now(),
        'motivo', 'Crise resolvida automaticamente - ticket não está mais em status de crise'
      )
  WHERE resolvida_em IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE t.id = crises_ativas.ticket_id 
      AND t.prioridade = 'crise'
      AND t.status IN ('aberto', 'em_atendimento', 'escalonado')
    );
    
  -- Log da operação
  PERFORM public.log_system_action(
    'sistema'::public.log_tipo,
    'crises_ativas',
    'cleanup',
    'Limpeza automática de crises órfãs executada',
    '00000000-0000-0000-0000-000000000000'::uuid,
    NULL, NULL, NULL, NULL,
    jsonb_build_object('executed_at', now()),
    'painel_interno'::public.log_canal
  );
END;
$$;