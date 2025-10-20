-- ========================================
-- CORREÇÃO 1: Adicionar 'sistema' ao enum log_canal
-- ========================================

-- Adicionar valor 'sistema' ao enum log_canal se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'sistema' 
    AND enumtypid = 'public.log_canal'::regtype
  ) THEN
    ALTER TYPE public.log_canal ADD VALUE 'sistema';
  END IF;
END
$$;

COMMENT ON TYPE public.log_canal IS 'Canais de log do sistema: web, whatsapp, typebot, painel_interno, sistema';