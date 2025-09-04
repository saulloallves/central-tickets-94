-- Criar função para marcar documentos vencidos automaticamente
CREATE OR REPLACE FUNCTION public.mark_expired_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar documentos temporários que passaram da validade
  UPDATE public.documentos
  SET status = 'vencido'::article_status
  WHERE status = 'ativo'::article_status
    AND tipo = 'temporario'::article_type
    AND valido_ate IS NOT NULL
    AND valido_ate < now();
    
  -- Log da operação se houver documentos atualizados
  IF FOUND THEN
    RAISE NOTICE 'Documentos vencidos atualizados automaticamente';
  END IF;
END;
$$;

-- Executar verificação imediata para marcar documentos já vencidos
SELECT public.mark_expired_documents();