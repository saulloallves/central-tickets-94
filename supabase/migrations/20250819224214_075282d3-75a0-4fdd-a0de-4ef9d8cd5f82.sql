-- Inicializar positions dos tickets existentes usando um loop
DO $$
DECLARE
    ticket_record RECORD;
    position_counter NUMERIC;
BEGIN
    -- Para cada status, inicializar positions espaçadas
    FOR ticket_record IN 
        SELECT DISTINCT status FROM public.tickets WHERE position = 1000
    LOOP
        position_counter := 1000;
        
        -- Atualizar tickets deste status ordenados por created_at
        UPDATE public.tickets 
        SET position = position_counter * (
            SELECT count(*) + 1 
            FROM public.tickets t2 
            WHERE t2.status = tickets.status 
            AND t2.created_at < tickets.created_at
            AND t2.position = 1000
        ) * 1000
        WHERE status = ticket_record.status AND position = 1000;
    END LOOP;
END $$;

-- Função para calcular nova position usando fractional indexing
CREATE OR REPLACE FUNCTION public.calculate_new_position(
  p_status TEXT,
  p_before_id UUID DEFAULT NULL,
  p_after_id UUID DEFAULT NULL
) 
RETURNS NUMERIC 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  before_pos NUMERIC;
  after_pos NUMERIC;
  new_pos NUMERIC;
BEGIN
  -- Buscar position do item anterior
  IF p_before_id IS NOT NULL THEN
    SELECT position INTO before_pos 
    FROM tickets 
    WHERE id = p_before_id;
  END IF;
  
  -- Buscar position do item posterior  
  IF p_after_id IS NOT NULL THEN
    SELECT position INTO after_pos 
    FROM tickets 
    WHERE id = p_after_id;
  END IF;
  
  -- Calcular nova position
  IF before_pos IS NOT NULL AND after_pos IS NOT NULL THEN
    -- Entre dois itens
    new_pos := (before_pos + after_pos) / 2;
  ELSIF before_pos IS NOT NULL AND after_pos IS NULL THEN
    -- Após o último item (fundo da coluna)
    SELECT COALESCE(MAX(position), 0) + 1000 INTO new_pos
    FROM tickets 
    WHERE status = p_status;
  ELSIF before_pos IS NULL AND after_pos IS NOT NULL THEN
    -- Antes do primeiro item (topo da coluna)  
    SELECT COALESCE(MIN(position), 2000) - 1000 INTO new_pos
    FROM tickets 
    WHERE status = p_status;
  ELSE
    -- Coluna vazia ou sem referências
    new_pos := 1000;
  END IF;
  
  RETURN new_pos;
END;
$$;