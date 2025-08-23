
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

interface InternalAccessRequest {
  id: string;
  user_id: string;
  equipe_id: string;
  desired_role: string;
  status: 'pending' | 'approved' | 'rejected';
  comments: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  equipes?: {
    id: string;
    nome: string;
  };
  profiles?: {
    id: string;
    nome_completo: string;
    email: string;
  };
}

export const useInternalAccessRequests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<InternalAccessRequest[]>([]);
  const [userRequest, setUserRequest] = useState<InternalAccessRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRequest = async () => {
    if (!user) return;

    try {
      console.log('Fetching user request for user:', user.id);
      
      const { data, error } = await supabase
        .from('internal_access_requests')
        .select(`
          *,
          equipes:equipe_id (
            id,
            nome
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) {
        console.error('Error fetching user request:', error);
        throw error;
      }
      
      console.log('User request data:', data);
      
      if (data) {
        const typedData: InternalAccessRequest = {
          ...data,
          status: data.status as 'pending' | 'approved' | 'rejected',
          equipes: data.equipes
        };
        setUserRequest(typedData);
      } else {
        setUserRequest(null);
      }
    } catch (error) {
      console.error('Error fetching user request:', error);
    }
  };

  const fetchAllRequests = async () => {
    try {
      console.log('Fetching all pending requests...');
      
      const { data, error } = await supabase
        .from('internal_access_requests')
        .select(`
          *,
          equipes:equipe_id (
            id,
            nome
          ),
          profiles:user_id (
            id,
            nome_completo,
            email
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all requests:', error);
        throw error;
      }
      
      console.log('All requests data:', data);
      console.log('Number of requests found:', data?.length || 0);
      
      const typedData: InternalAccessRequest[] = (data || []).map(item => ({
        ...item,
        status: item.status as 'pending' | 'approved' | 'rejected',
        equipes: item.equipes,
        profiles: item.profiles
      }));
      
      setRequests(typedData);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar solicitações: " + (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createRequest = async (equipeId: string, desiredRole: string) => {
    if (!user) return { error: 'Usuário não autenticado' };

    try {
      console.log('Creating request:', { user_id: user.id, equipe_id: equipeId, desired_role: desiredRole });
      
      const { error } = await supabase
        .from('internal_access_requests')
        .insert([{
          user_id: user.id,
          equipe_id: equipeId,
          desired_role: desiredRole,
          status: 'pending'
        }]);

      if (error) {
        console.error('Error creating request:', error);
        throw error;
      }

      toast({
        title: "Solicitação enviada",
        description: "Sua solicitação de acesso foi enviada para aprovação."
      });

      await fetchUserRequest();
      return { error: null };
    } catch (error: any) {
      console.error('Error creating request:', error);
      const errorMessage = error.message || 'Erro ao criar solicitação';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
      return { error: errorMessage };
    }
  };

  const approveRequest = async (requestId: string) => {
    try {
      console.log('Approving request:', requestId);
      
      const { error } = await supabase.rpc('approve_internal_access', {
        p_request_id: requestId
      });

      if (error) {
        console.error('Error approving request:', error);
        throw error;
      }

      toast({
        title: "Solicitação aprovada",
        description: "O usuário foi adicionado à equipe com sucesso."
      });

      await fetchAllRequests();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao aprovar solicitação',
        variant: "destructive"
      });
    }
  };

  const rejectRequest = async (requestId: string, reason?: string) => {
    try {
      console.log('Rejecting request:', requestId, 'reason:', reason);
      
      const { error } = await supabase.rpc('reject_internal_access', {
        p_request_id: requestId,
        p_reason: reason
      });

      if (error) {
        console.error('Error rejecting request:', error);
        throw error;
      }

      toast({
        title: "Solicitação recusada",
        description: "A solicitação foi recusada."
      });

      await fetchAllRequests();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Erro",
        description: error.message || 'Erro ao recusar solicitação',
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    console.log('useInternalAccessRequests effect running for user:', user.id);
    fetchUserRequest();
    fetchAllRequests();
  }, [user]);

  return {
    requests,
    userRequest,
    loading,
    createRequest,
    approveRequest,
    rejectRequest,
    refetch: () => {
      fetchUserRequest();
      fetchAllRequests();
    }
  };
};
