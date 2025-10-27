import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Building2, 
  User, 
  Calendar, 
  FileText,
  Image as ImageIcon,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  File,
  Music
} from 'lucide-react';
import type { PlanoAcao } from '@/hooks/usePlanoAcao';
import { formatDistanceToNowInSaoPaulo, formatDateBR } from '@/lib/date-utils';
import { ImageModal } from '@/components/ui/image-modal';

interface PlanoAcaoDetailProps {
  plano: PlanoAcao | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PlanoAcaoDetail = ({ plano, isOpen, onClose }: PlanoAcaoDetailProps) => {
  if (!plano) return null;

  // Detectar tipo de arquivo
  const getFileType = (url: string) => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.match(/\.(jpg|jpeg|png|webp)$/)) return 'image';
    if (lowerUrl.match(/\.pdf$/)) return 'pdf';
    if (lowerUrl.match(/\.(mp3|wav)$/)) return 'audio';
    return 'unknown';
  };

  // Formatar prazo
  const formatPrazo = (prazo: string | null): string => {
    if (!prazo) return 'Não definido';
    if (prazo.includes('/')) return prazo;
    try {
      return formatDateBR(prazo);
    } catch {
      return prazo;
    }
  };

  const fileType = plano.upload ? getFileType(plano.upload) : null;
  const fileName = plano.upload ? decodeURIComponent(plano.upload.split('/').pop() || 'arquivo') : 'arquivo';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">
              {plano.categoria?.match(/^([\u{1F300}-\u{1F9FF}])/u)?.[1] || '📋'}
            </span>
            <span>{plano.titulo || 'Plano de Ação'}</span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="space-y-4 p-1">
            
            {/* Informações Básicas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Unidade</p>
                      <p className="font-medium">
                        {plano.unidade?.name || `Código ${plano.codigo_grupo}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Responsável Local</p>
                      <p className="font-medium">{plano.responsavel_local || 'Não definido'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Prazo</p>
                      <p className="font-medium">{formatPrazo(plano.prazo)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Criado por</p>
                      <p className="font-medium">{plano.nome_completo || 'Sistema'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Badge>{plano.categoria?.replace(/^[\u{1F300}-\u{1F9FF}]\s*/u, '') || 'Sem categoria'}</Badge>
                  <Badge variant="outline">{plano.setor || 'Sem setor'}</Badge>
                  <Badge variant="secondary">{plano.status_frnq || 'Sem status'}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Contexto */}
            {plano.descricao && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Contexto da Situação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{plano.descricao}</p>
                </CardContent>
              </Card>
            )}

            {/* Ações Recomendadas */}
            {plano.acoes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Ações Recomendadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{plano.acoes}</p>
                </CardContent>
              </Card>
            )}

            {/* Registro Completo (GPT) */}
            {plano.gpt && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Registro Completo (IA)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="text-sm prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: plano.gpt
                        .replace(/\n/g, '<br>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/### (.*?)\n/g, '<h3 class="font-bold text-base mt-4 mb-2">$1</h3>')
                        .replace(/#### (.*?)\n/g, '<h4 class="font-semibold text-sm mt-3 mb-1">$1</h4>')
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Feedbacks do Franqueado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plano.descricao_andamento && (
                <Card className="border-green-500/50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      Em Andamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs">{plano.descricao_andamento}</p>
                  </CardContent>
                </Card>
              )}

              {plano.desscricao_nao_consegui_realizar && (
                <Card className="border-red-500/50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Não Conseguiu Realizar
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs">{plano.desscricao_nao_consegui_realizar}</p>
                  </CardContent>
                </Card>
              )}

              {plano.descricao_nao_entendi && (
                <Card className="border-yellow-500/50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-yellow-500" />
                      Não Entendeu
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs">{plano.descricao_nao_entendi}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Anexo */}
            {plano.upload && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {fileType === 'image' && <ImageIcon className="h-4 w-4" />}
                    {fileType === 'pdf' && <File className="h-4 w-4" />}
                    {fileType === 'audio' && <Music className="h-4 w-4" />}
                    {!fileType && <FileText className="h-4 w-4" />}
                    Evidências
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fileType === 'image' && (
                    <ImageModal src={plano.upload} alt="Evidência do plano de ação">
                      <div className="cursor-pointer group">
                        <img 
                          src={plano.upload} 
                          alt="Evidência" 
                          className="w-full max-w-sm rounded-lg border group-hover:opacity-90 transition-opacity"
                        />
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Clique para ampliar
                        </p>
                      </div>
                    </ImageModal>
                  )}

                  {fileType === 'pdf' && (
                    <a 
                      href={plano.upload} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <File className="h-8 w-8 text-red-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Documento PDF</p>
                        <p className="text-xs text-muted-foreground">{fileName}</p>
                      </div>
                      <span className="text-xs text-primary">Abrir →</span>
                    </a>
                  )}

                  {fileType === 'audio' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Music className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium">{fileName}</p>
                      </div>
                      <audio controls className="w-full">
                        <source src={plano.upload} />
                        Seu navegador não suporta o elemento de áudio.
                      </audio>
                    </div>
                  )}

                  {fileType === 'unknown' && (
                    <a 
                      href={plano.upload} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Ver arquivo anexado
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
