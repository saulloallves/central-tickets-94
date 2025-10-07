-- Criar trigger para auto-popular codigo_grupo nos tickets
CREATE TRIGGER trigger_auto_populate_codigo_grupo
  BEFORE INSERT OR UPDATE OF unidade_id ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_populate_codigo_grupo();

-- Backfill: Preencher codigo_grupo nos tickets existentes que não têm
UPDATE public.tickets t
SET codigo_grupo = u.codigo_grupo
FROM public.unidades u
WHERE t.unidade_id = u.id
  AND (t.codigo_grupo IS NULL OR t.codigo_grupo = '');

-- Log da ação
INSERT INTO public.logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) VALUES (
  'sistema'::public.log_tipo,
  'tickets',
  'backfill_codigo_grupo',
  'Trigger criado e backfill de codigo_grupo executado',
  jsonb_build_object(
    'trigger_criado', 'trigger_auto_populate_codigo_grupo',
    'funcao', 'auto_populate_codigo_grupo()',
    'executado_em', NOW()
  ),
  'painel_interno'::public.log_canal
);