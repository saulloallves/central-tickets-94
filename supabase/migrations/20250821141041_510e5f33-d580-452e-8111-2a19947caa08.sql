-- Corrigir configuração do ticket_created para usar id_grupo_branco
UPDATE public.notification_source_config 
SET 
  source_type = 'column',
  source_table = 'unidades',
  source_column = 'id_grupo_branco',
  description = 'Notificação de novo ticket - pega de unidades.id_grupo_branco',
  fixed_value = NULL
WHERE notification_type = 'ticket_created';