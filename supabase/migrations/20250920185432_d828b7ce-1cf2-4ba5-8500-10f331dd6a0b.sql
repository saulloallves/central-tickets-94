-- Criar o trigger para processar SLA automaticamente na inserção
DROP TRIGGER IF EXISTS auto_process_sla_on_insert_trigger ON public.tickets;

CREATE TRIGGER auto_process_sla_on_insert_trigger
  BEFORE INSERT ON public.tickets
  FOR EACH ROW 
  EXECUTE FUNCTION public.auto_process_sla_on_insert();

-- Testar se o trigger foi criado
SELECT 
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'auto_process_sla_on_insert_trigger';