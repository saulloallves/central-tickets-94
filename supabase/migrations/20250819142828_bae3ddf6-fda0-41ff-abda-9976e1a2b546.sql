-- Update the function to use a valid enum value
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
      'openai'::ai_model_provider,  -- Changed from 'manual' to 'openai'
      'Resposta Manual',
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;