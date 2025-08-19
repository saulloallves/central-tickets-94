-- Function to capture outgoing ticket messages as knowledge suggestions
CREATE OR REPLACE FUNCTION public.capture_ticket_response_as_suggestion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process outgoing messages (responses) that are not empty
  IF NEW.direcao = 'saida' AND NEW.mensagem IS NOT NULL AND trim(NEW.mensagem) != '' THEN
    -- Insert the response as a knowledge suggestion
    INSERT INTO public.knowledge_suggestions (
      texto_sugerido,
      ticket_id,
      sugerido_por,
      modelo_provedor,
      modelo_nome,
      status
    ) VALUES (
      NEW.mensagem,
      NEW.ticket_id,
      NEW.usuario_id,
      'manual'::ai_model_provider,
      'Resposta Manual',
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically capture responses as knowledge suggestions
CREATE TRIGGER trigger_capture_ticket_response_suggestion
  AFTER INSERT ON public.ticket_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_ticket_response_as_suggestion();