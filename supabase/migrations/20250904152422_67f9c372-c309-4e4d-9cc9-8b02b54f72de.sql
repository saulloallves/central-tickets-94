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

-- Criar trigger que executa a cada INSERT/UPDATE na tabela documentos
CREATE OR REPLACE FUNCTION public.check_document_expiry_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Executar verificação de documentos vencidos sempre que houver mudanças
  PERFORM public.mark_expired_documents();
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar triggers para INSERT e UPDATE
DROP TRIGGER IF EXISTS trigger_check_document_expiry_insert ON public.documentos;
CREATE TRIGGER trigger_check_document_expiry_insert
  AFTER INSERT ON public.documentos
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.check_document_expiry_on_change();

DROP TRIGGER IF EXISTS trigger_check_document_expiry_update ON public.documentos;  
CREATE TRIGGER trigger_check_document_expiry_update
  AFTER UPDATE ON public.documentos
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.check_document_expiry_on_change();

-- Executar verificação imediata para marcar documentos já vencidos
SELECT public.mark_expired_documents();