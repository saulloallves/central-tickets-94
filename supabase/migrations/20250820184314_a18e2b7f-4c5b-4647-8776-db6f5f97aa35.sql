-- Add equipe_id to knowledge_articles table
ALTER TABLE public.knowledge_articles 
ADD COLUMN equipe_id UUID REFERENCES public.equipes(id);

-- Add article_id to knowledge_suggestions table to link approved suggestions to articles
ALTER TABLE public.knowledge_suggestions 
ADD COLUMN article_id UUID REFERENCES public.knowledge_articles(id);

-- Create index for better performance on equipe_id lookups
CREATE INDEX idx_knowledge_articles_equipe_id ON public.knowledge_articles(equipe_id);
CREATE INDEX idx_knowledge_suggestions_article_id ON public.knowledge_suggestions(article_id);

-- Update existing articles to use equipe_id instead of categoria where possible
-- This is optional - we'll maintain backward compatibility
UPDATE public.knowledge_articles 
SET equipe_id = (
  SELECT e.id 
  FROM public.equipes e 
  WHERE LOWER(e.nome) = LOWER(knowledge_articles.categoria)
  LIMIT 1
)
WHERE categoria IS NOT NULL AND equipe_id IS NULL;