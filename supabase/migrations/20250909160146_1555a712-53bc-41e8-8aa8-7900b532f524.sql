-- Temporary function to test embedding regeneration
CREATE OR REPLACE FUNCTION regenerate_single_document_embedding(doc_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    -- For now, just log that we would regenerate
    RAISE NOTICE 'Would regenerate embedding for document: %', doc_id;
END;
$$;