import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Calendar } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

interface NotificationLog {
  id: string;
  type: string;
  ticket_id: string;
  status: string;
  sent_to_whatsapp: boolean;
  created_at: string;
  processed_at: string;
  payload: {
    codigo_ticket?: string;
    titulo?: string;
    equipe_id?: string;
    prioridade?: string;
  };
}

interface WhatsAppLog {
  id: string;
  event_type: string;
  ticket_id: string;
  message: string;
  canal: string;
  created_at: string;
  response: any;
}

export function NotificationLogsViewer() {
  const [dateFilter, setDateFilter] = useState<string>('24h');
  
  // Calcular data de início baseado no filtro
  const getStartDate = () => {
    switch(dateFilter) {
      case '24h': return subDays(new Date(), 1).toISOString();
      case '7d': return subDays(new Date(), 7).toISOString();
      case '30d': return subDays(new Date(), 30).toISOString();
      case 'all': return '2000-01-01T00:00:00Z';
      default: return subDays(new Date(), 1).toISOString();
    }
  };

  // Query 1: Notificações processadas
  const { data: processedNotifications, refetch: refetchNotifications } = useQuery({
    queryKey: ['processed-notifications', dateFilter],
    queryFn: async () => {
      const startDate = getStartDate();
      const { data, error } = await supabase
        .from('notifications_queue')
        .select('*')
        .eq('status', 'processed')
        .gte('processed_at', startDate)
        .order('processed_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as NotificationLog[];
    },
    refetchInterval: 30000
  });

  // Query 2: Logs WhatsApp
  const { data: whatsappLogs, refetch: refetchWhatsapp } = useQuery({
    queryKey: ['whatsapp-logs', dateFilter],
    queryFn: async () => {
      const startDate = getStartDate();
      const { data, error } = await supabase
        .from('escalation_logs')
        .select('*')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (error) throw error;
      return data as WhatsAppLog[];
    },
    refetchInterval: 30000
  });

  // Query 3: Estatísticas do dia
  const { data: stats } = useQuery({
    queryKey: ['notification-stats-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('notifications_queue')
        .select('status, sent_to_whatsapp')
        .gte('processed_at', `${today}T00:00:00`)
        .eq('status', 'processed');
      
      const whatsappSuccess = data?.filter(n => n.sent_to_whatsapp).length || 0;
      const total = data?.length || 0;
      
      return {
        total,
        whatsapp: whatsappSuccess,
        rate: total > 0 ? Math.round((whatsappSuccess / total) * 100) : 0
      };
    },
    refetchInterval: 30000
  });

  const handleRefresh = () => {
    refetchNotifications();
    refetchWhatsapp();
  };

  // Mapear tipos de notificação
  const notificationTypeMap: Record<string, { label: string; variant: any }> = {
    'ticket_created': { label: 'Ticket Criado', variant: 'default' },
    'ticket_forwarded': { label: 'Encaminhado', variant: 'secondary' },
    'sla_half': { label: 'SLA 50%', variant: 'warning' },
    'sla_breach': { label: 'SLA Estourado', variant: 'destructive' },
    'crisis': { label: 'Crise', variant: 'critical' },
    'franqueado_respondeu': { label: 'Resposta Franqueado', variant: 'info' }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">📬 Log de Notificações Enviadas</CardTitle>
            <CardDescription className="text-sm">
              Histórico de notificações processadas e enviadas via WhatsApp
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Últimas 24h</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary">
              Hoje: {stats?.total || 0}
            </Badge>
            <Badge variant="default">
              WhatsApp: {stats?.whatsapp || 0} ({stats?.rate || 0}%)
            </Badge>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="notifications">
          <TabsList>
            <TabsTrigger value="notifications">
              Notificações ({processedNotifications?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="whatsapp">
              Logs WhatsApp ({whatsappLogs?.length || 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="notifications" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Data Processamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedNotifications?.map(notif => (
                  <TableRow key={notif.id}>
                    <TableCell>
                      <Badge variant={notificationTypeMap[notif.type]?.variant || 'outline'}>
                        {notificationTypeMap[notif.type]?.label || notif.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {notif.payload?.codigo_ticket || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {notif.payload?.titulo || '-'}
                    </TableCell>
                    <TableCell>
                      {notif.sent_to_whatsapp ? (
                        <span className="text-success">✅ Enviado</span>
                      ) : (
                        <span className="text-muted-foreground">⊗ Não enviado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {format(new Date(notif.processed_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
                {processedNotifications?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhuma notificação processada no período selecionado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
          
          <TabsContent value="whatsapp" className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Mensagem (prévia)</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {whatsappLogs?.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="outline">
                        {log.event_type.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.ticket_id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm">
                      {log.message.substring(0, 60)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.canal}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {log.response?.success ? (
                        <span className="text-success">✓ Sucesso</span>
                      ) : (
                        <span className="text-destructive">✗ Falha</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {whatsappLogs?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhum log de WhatsApp no período selecionado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
