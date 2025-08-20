
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface KnowledgeArticle {
  id: string;
  titulo: string;
  conteudo: string;
  categoria?: string;
  equipe_id?: string;
  tags?: string[];
  tipo_midia: 'texto' | 'video' | 'pdf' | 'link';
  link_arquivo?: string;
  aprovado: boolean;
  usado_pela_ia: boolean;
  feedback_positivo: number;
  feedback_negativo: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateArticleData {
  titulo: string;
  conteudo: string;
  categoria?: string;
  equipe_id?: string;
  tags?: string[];
  tipo_midia?: 'texto' | 'video' | 'pdf' | 'link';
  link_arquivo?: string;
  usado_pela_ia?: boolean;
}

export const useKnowledgeArticles = () => {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchArticles = async (filters?: {
    categoria?: string;
    equipe_id?: string;
    aprovado?: boolean;
    usado_pela_ia?: boolean;
    ativo?: boolean;
  }) => {
    setLoading(true);
    try {
      let query = supabase
        .from('knowledge_articles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (filters) {
        if (filters.categoria) query = query.eq('categoria', filters.categoria);
        if (filters.equipe_id) query = query.eq('equipe_id', filters.equipe_id);
        if (filters.aprovado !== undefined) query = query.eq('aprovado', filters.aprovado);
        if (filters.usado_pela_ia !== undefined) query = query.eq('usado_pela_ia', filters.usado_pela_ia);
        if (filters.ativo !== undefined) query = query.eq('ativo', filters.ativo);
      }

      const { data, error } = await query;

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const createArticle = async (articleData: CreateArticleData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('knowledge_articles')
        .insert({
          ...articleData,
          criado_por: userData.user?.id,
          ativo: true
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✅ Artigo Criado",
        description: "Novo artigo adicionado à base de conhecimento",
      });

      await fetchArticles();
      return data;
    } catch (error) {
      console.error('Error creating article:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o artigo",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateArticle = async (id: string, updates: Partial<KnowledgeArticle>) => {
    try {
      const { error } = await supabase
        .from('knowledge_articles')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "✅ Artigo Atualizado",
        description: "Alterações salvas com sucesso",
      });

      await fetchArticles();
    } catch (error) {
      console.error('Error updating article:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o artigo",
        variant: "destructive",
      });
    }
  };

  const approveArticle = async (id: string, approved: boolean) => {
    await updateArticle(id, { aprovado: approved });
  };

  const toggleAIUsage = async (id: string, usado_pela_ia: boolean) => {
    await updateArticle(id, { usado_pela_ia });
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  return {
    articles,
    loading,
    fetchArticles,
    createArticle,
    updateArticle,
    approveArticle,
    toggleAIUsage
  };
};
