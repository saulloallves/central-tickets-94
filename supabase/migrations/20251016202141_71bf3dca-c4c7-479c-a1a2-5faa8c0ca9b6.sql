-- Recriar a função notify_new_atendimento para usar 'alert' em emergências
CREATE OR REPLACE FUNCTION public.notify_new_atendimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.is_emergencia = true THEN
    INSERT INTO public.internal_notifications (
      title,
      message,
      type,
      payload
    ) VALUES (
      '🚨 EMERGÊNCIA',
      'Nova emergência criada: ' || NEW.descricao,
      'alert',  -- Alterado de 'emergencia' para 'alert'
      jsonb_build_object(
        'chamado_id', NEW.id,
        'unidade_id', NEW.unidade_id,
        'telefone', NEW.telefone,
        'prioridade', 'urgente'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;