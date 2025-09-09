import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAutoApprovals } from '@/hooks/useAutoApprovals';
import { formatDistanceToNowInSaoPaulo } from '@/lib/date-utils';
import { CheckCircle, XCircle, Clock, FileText, User, MessageSquare, Eye, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export function AutoApprovalsTab() {
  const { approvals, loading, fetchApprovals, updateApprovalStatus, createDocumentFromApproval } = useAutoApprovals();
  const [selectedApproval, setSelectedApproval] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('pending');
  const { toast } = useToast();

  const handleApprove = async (id: string, reason?: string) => {
    const success = await updateApprovalStatus(id, 'approved', reason);
    if (success) {
      fetchApprovals(activeTab === 'all' ? undefined : activeTab);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    const success = await updateApprovalStatus(id, 'rejected', reason);
    if (success) {
      fetchApprovals(activeTab === 'all' ? undefined : activeTab);
    }
  };

  const handleCreateDocument = async (approvalId: string) => {
    const success = await createDocumentFromApproval(approvalId);
    if (success) {
      fetchApprovals(activeTab === 'all' ? undefined : activeTab);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
      case 'approved':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejeitado</Badge>;
      case 'processed':
        return <Badge variant="default" className="gap-1 bg-blue-600"><FileText className="h-3 w-3" />Processado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredApprovals = approvals.filter(approval => {
    if (activeTab === 'all') return true;
    return approval.status === activeTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Aprovações Automáticas</h2>
          <p className="text-muted-foreground">
            Gerencie respostas que foram processadas pela IA e podem virar documentação
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="approved">Aprovadas</TabsTrigger>
          <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
          <TabsTrigger value="processed">Processadas</TabsTrigger>
          <TabsTrigger value="all">Todas</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-muted-foreground">Carregando aprovações...</span>
              </div>
            </div>
          ) : filteredApprovals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma aprovação encontrada</h3>
                <p className="text-muted-foreground text-center">
                  {activeTab === 'pending' 
                    ? 'Não há aprovações pendentes no momento. Respostas processadas pela IA aparecerão aqui.'
                    : `Não há aprovações com status "${activeTab}".`
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredApprovals.map((approval) => (
                <Card key={approval.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(approval.status)}
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNowInSaoPaulo(new Date(approval.created_at))}
                          </span>
                        </div>
                        {approval.ticket_id && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            Ticket: {approval.ticket_id.substring(0, 8)}...
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedApproval(approval)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Ver Detalhes
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Mensagem Original:</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        {approval.original_message.substring(0, 200)}
                        {approval.original_message.length > 200 && '...'}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Resposta Corrigida:</h4>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        {approval.corrected_response.substring(0, 200)}
                        {approval.corrected_response.length > 200 && '...'}
                      </p>
                    </div>

                    {approval.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApprove(approval.id, 'Aprovado para criação de documento')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Aprovar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(approval.id, 'Rejeitado - não adequado para documentação')}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Rejeitar
                        </Button>
                      </div>
                    )}

                    {approval.status === 'approved' && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleCreateDocument(approval.id)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Documento
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Detalhes */}
      <Dialog open={!!selectedApproval} onOpenChange={() => setSelectedApproval(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Aprovação Automática</DialogTitle>
            <DialogDescription>
              Análise completa da resposta processada pela IA
            </DialogDescription>
          </DialogHeader>
          
          {selectedApproval && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {getStatusBadge(selectedApproval.status)}
                <span className="text-sm text-muted-foreground">
                  Criado {formatDistanceToNowInSaoPaulo(new Date(selectedApproval.created_at))}
                </span>
              </div>

              <div className="grid gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Mensagem Original</h3>
                  <Textarea 
                    value={selectedApproval.original_message} 
                    readOnly 
                    className="min-h-[100px]"
                  />
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Resposta Corrigida</h3>
                  <Textarea 
                    value={selectedApproval.corrected_response} 
                    readOnly 
                    className="min-h-[100px]"
                  />
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Conteúdo para Documentação</h3>
                  <Textarea 
                    value={selectedApproval.documentation_content} 
                    readOnly 
                    className="min-h-[120px]"
                  />
                </div>

                {selectedApproval.comparative_analysis && (
                  <div>
                    <h3 className="font-semibold mb-3">Análise Comparativa</h3>
                    <div className="bg-muted p-4 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm">
                        {selectedApproval.comparative_analysis}
                      </pre>
                    </div>
                  </div>
                )}

                {selectedApproval.similar_documents && selectedApproval.similar_documents.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Documentos Similares Encontrados</h3>
                    <div className="space-y-2">
                      {selectedApproval.similar_documents.map((doc: any, index: number) => (
                        <Card key={index} className="p-3">
                          <h4 className="font-medium">{doc.titulo}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {doc.conteudo?.substring(0, 150)}...
                          </p>
                          {doc.similarity && (
                            <Badge variant="outline" className="mt-2">
                              Similaridade: {(doc.similarity * 100).toFixed(1)}%
                            </Badge>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {selectedApproval.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="default"
                      onClick={() => {
                        handleApprove(selectedApproval.id, 'Aprovado via modal de detalhes');
                        setSelectedApproval(null);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Aprovar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        handleReject(selectedApproval.id, 'Rejeitado via modal de detalhes');
                        setSelectedApproval(null);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}