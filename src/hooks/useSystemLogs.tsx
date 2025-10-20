import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SystemLog {
  id: string;
  tipo_log: 'acao_humana' | 'acao_ia' | 'sistema' | 'erro' | 'escalonamento' | 'seguranca';
  entidade_afetada: string;
  entidade_id: string;
  acao_realizada: string;
  usuario_responsavel?: string;
  ia_modelo?: string;
  prompt_entrada?: string;
  resposta_gerada?: string;
  dados_anteriores?: any;
  dados_novos?: any;
  canal?: 'web' | 'whatsapp' | 'typebot' | 'painel_interno' | 'sistema';
  origem_ip?: string;
  navegador_agente?: string;
  timestamp: string;
  created_at: string;
}

export interface LogFilters {
  tipo_log?: string;
  entidade_afetada?: string;
  usuario_responsavel?: string;
  data_inicio?: string;
  data_fim?: string;
  entidade_id?: string;
}

export const useSystemLogs = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchLogs = async (filters: LogFilters = {}, limit = 100) => {
    setLoading(true);
    try {
      let query = supabase
        .from('logs_de_sistema')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (filters.tipo_log) {
        query = query.eq('tipo_log', filters.tipo_log as any);
      }
      if (filters.entidade_afetada) {
        query = query.eq('entidade_afetada', filters.entidade_afetada);
      }
      if (filters.usuario_responsavel) {
        query = query.eq('usuario_responsavel', filters.usuario_responsavel);
      }
      if (filters.entidade_id) {
        query = query.eq('entidade_id', filters.entidade_id);
      }
      if (filters.data_inicio) {
        query = query.gte('timestamp', filters.data_inicio);
      }
      if (filters.data_fim) {
        query = query.lte('timestamp', filters.data_fim);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);
      console.log('Logs fetched:', data?.length);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTicketTimeline = async (ticketId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('logs_de_sistema')
        .select('*')
        .or(`entidade_id.eq.${ticketId},dados_novos->>id.eq.${ticketId},dados_anteriores->>id.eq.${ticketId}`)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching ticket timeline:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a timeline do ticket",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const logSystemAction = async (logData: {
    tipo_log: 'acao_humana' | 'acao_ia' | 'sistema' | 'erro' | 'escalonamento' | 'seguranca';
    entidade_afetada: string;
    entidade_id: string;
    acao_realizada: string;
    usuario_responsavel?: string;
    ia_modelo?: string;
    prompt_entrada?: string;
    resposta_gerada?: string;
    dados_anteriores?: any;
    dados_novos?: any;
    canal?: 'web' | 'whatsapp' | 'typebot' | 'painel_interno';
  }) => {
    try {
      // Get user IP and browser info
      const origem_ip = await fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => data.ip)
        .catch(() => null);

      const navegador_agente = navigator.userAgent;

      const { data, error } = await supabase.functions.invoke('system-log', {
        body: {
          ...logData,
          origem_ip,
          navegador_agente
        }
      });

      if (error) throw error;

      console.log('System action logged:', data);
      return data;
    } catch (error) {
      console.error('Error logging system action:', error);
      throw error;
    }
  };

  const exportLogs = async (filters: LogFilters = {}) => {
    try {
      const logsToExport = logs.length > 0 ? logs : await fetchLogsForExport(filters);
      
      const csvContent = [
        // CSV Header
        'Timestamp,Tipo,Entidade,ID Entidade,Ação,Usuário,Modelo IA,Canal',
        // CSV Data
        ...logsToExport.map(log => 
          `"${log.timestamp}","${log.tipo_log}","${log.entidade_afetada}","${log.entidade_id}","${log.acao_realizada}","${log.usuario_responsavel || ''}","${log.ia_modelo || ''}","${log.canal || ''}"`
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `logs_sistema_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast({
        title: "Sucesso",
        description: "Logs exportados com sucesso",
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar os logs",
        variant: "destructive",
      });
    }
  };

  const fetchLogsForExport = async (filters: LogFilters) => {
    let query = supabase
      .from('logs_de_sistema')
      .select('*')
      .order('timestamp', { ascending: false });

    if (filters.tipo_log) query = query.eq('tipo_log', filters.tipo_log as any);
    if (filters.entidade_afetada) query = query.eq('entidade_afetada', filters.entidade_afetada);
    if (filters.usuario_responsavel) query = query.eq('usuario_responsavel', filters.usuario_responsavel);
    if (filters.data_inicio) query = query.gte('timestamp', filters.data_inicio);
    if (filters.data_fim) query = query.lte('timestamp', filters.data_fim);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  return {
    logs,
    loading,
    fetchLogs,
    getTicketTimeline,
    logSystemAction,
    exportLogs
  };
};