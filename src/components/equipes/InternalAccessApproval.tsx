
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Clock, User, Mail } from 'lucide-react';
import { useInternalAccessRequests } from '@/hooks/useInternalAccessRequests';

export const InternalAccessApproval = () => {
  const { requests, approveRequest, rejectRequest, loading } = useInternalAccessRequests();
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Debug logging
  console.log('InternalAccessApproval render:', { 
    loading, 
    requestsCount: requests.length, 
    requests: requests.map(r => ({ 
      id: r.id, 
      user: r.profiles?.nome_completo, 
      equipe: r.equipes?.nome,
      status: r.status 
    }))
  });

  const handleReject = async (requestId: string) => {
    await rejectRequest(requestId, rejectReason);
    setRejectReason('');
    setRejectingId(null);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'member': return 'Atendente';
      case 'leader': return 'Gestor de Equipe';
      case 'supervisor': return 'Administrador';
      default: return role;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Solicitações de Acesso Pendentes
          </CardTitle>
          <CardDescription>
            Carregando solicitações...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Solicitações de Acesso Pendentes
          </CardTitle>
          <CardDescription>
            Não há solicitações pendentes no momento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Todas as solicitações foram processadas</p>
            <div className="mt-4 text-xs bg-muted p-2 rounded">
              Debug: {requests.length} solicitações carregadas
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Solicitações de Acesso Pendentes
        </CardTitle>
        <CardDescription>
          {requests.length} solicitação(ões) aguardando aprovação
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {request.profiles?.nome_completo || 'Nome não encontrado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{request.profiles?.email || 'Email não encontrado'}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-yellow-600">
                  Pendente
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Equipe:</span>
                  <p className="font-medium">{request.equipes?.nome || 'Equipe não encontrada'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cargo:</span>
                  <p className="font-medium">{getRoleLabel(request.desired_role)}</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Solicitado em: {new Date(request.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>

              {/* Debug info */}
              <div className="text-xs bg-muted p-2 rounded mt-2">
                <strong>Debug:</strong> ID: {request.id}, Status: {request.status}, User: {request.user_id}, Equipe: {request.equipe_id}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => approveRequest(request.id)}
                  className="flex items-center gap-1"
                >
                  <CheckCircle className="h-4 w-4" />
                  Aprovar
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      onClick={() => setRejectingId(request.id)}
                    >
                      <XCircle className="h-4 w-4" />
                      Recusar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Recusar Solicitação</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Você está recusando a solicitação de <strong>{request.profiles?.nome_completo}</strong> para a equipe <strong>{request.equipes?.nome}</strong>.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reason">Motivo (opcional)</Label>
                        <Textarea
                          id="reason"
                          placeholder="Explique o motivo da recusa..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setRejectingId(null)}>
                          Cancelar
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => rejectingId && handleReject(rejectingId)}
                        >
                          Confirmar Recusa
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
