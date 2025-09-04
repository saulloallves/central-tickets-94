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
END;
$$;

-- Criar trigger para verificar documentos vencidos em cada consulta
CREATE OR REPLACE FUNCTION public.check_document_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Executar verificação de documentos vencidos
  PERFORM public.mark_expired_documents();
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger que executa a verificação a cada SELECT na tabela documentos
DROP TRIGGER IF EXISTS trigger_check_document_expiry ON public.documentos;
CREATE TRIGGER trigger_check_document_expiry
  BEFORE SELECT ON public.documentos
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.check_document_expiry();

-- Executar uma verificação imediata para marcar documentos já vencidos
SELECT public.mark_expired_documents();