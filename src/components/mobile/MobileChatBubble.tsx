import { ImageModal } from '@/components/ui/image-modal';
import { useState } from 'react';

interface TicketMessage {
  id: string;
  mensagem: string;
  direcao: string;
  canal: string;
  created_at: string;
  anexos?: Array<{
    tipo?: string;
    type?: string;
    url: string;
    nome?: string;
    name?: string;
  }>;
}

interface MobileChatBubbleProps {
  message: TicketMessage;
}

export function MobileChatBubble({ message }: MobileChatBubbleProps) {
  const isOutgoing = message.canal === 'typebot';
  const hasAttachments = message.anexos && Array.isArray(message.anexos) && message.anexos.length > 0;
  const [videoErrors, setVideoErrors] = useState<Set<number>>(new Set());

  const getVideoType = (url: string): string => {
    const ext = url.split('.').pop()?.toLowerCase();
    switch(ext) {
      case 'mov': return 'video/quicktime';
      case 'mp4': return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'avi': return 'video/x-msvideo';
      case 'mkv': return 'video/x-matroska';
      default: return 'video/mp4';
    }
  };

  const isVideoFile = (url: string): boolean => {
    const videoExtensions = ['.mov', '.mp4', '.webm', '.avi', '.mkv', '.m4v'];
    return videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
  };

  const handleVideoError = (idx: number) => {
    setVideoErrors(prev => new Set(prev).add(idx));
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageWithLinks = (text: string, isOutgoing: boolean) => {
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
    const parts = text.split(urlRegex).filter(Boolean);
    
    return parts.map((part, index) => {
      if (part && part.match(urlRegex)) {
        const href = part.startsWith('www.') ? `https://${part}` : part;
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline break-all hover:opacity-80 transition-opacity ${
              isOutgoing ? 'text-primary-foreground' : 'text-blue-600'
            }`}
          >
            {part}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isOutgoing
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        }`}
        style={{ wordBreak: 'break-word' }}
      >
        {/* Texto da mensagem */}
        <div className="text-sm whitespace-pre-line leading-relaxed break-words">
          {renderMessageWithLinks(message.mensagem, isOutgoing)}
        </div>

        {/* Anexos */}
        {hasAttachments && (
          <div className="mt-2 space-y-2">
            {message.anexos!.map((attachment, idx) => {
              const isImage = attachment.tipo === 'imagem' || attachment.type?.startsWith('image/');
              const isVideo = attachment.tipo === 'video' || attachment.type?.startsWith('video/') || isVideoFile(attachment.url);
              const fileName = attachment.nome || attachment.name || 'Anexo';
              const hasVideoError = videoErrors.has(idx);
              
              if (isImage) {
                return (
                  <ImageModal key={idx} src={attachment.url} alt={fileName}>
                    <img
                      src={attachment.url}
                      alt={fileName}
                      className="max-w-full rounded-lg cursor-pointer border-2 border-background/50 hover:opacity-90 transition-opacity"
                      style={{ maxHeight: '200px', objectFit: 'cover' }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </ImageModal>
                );
              }

              if (isVideo) {
                if (hasVideoError) {
                  return (
                    <a
                      key={idx}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 p-3 rounded-lg border text-sm hover:opacity-80 transition-opacity ${
                        isOutgoing 
                          ? 'bg-primary-foreground/10 border-primary-foreground/20' 
                          : 'bg-background border-border'
                      }`}
                    >
                      <span className="text-lg">📹</span>
                      <div className="flex-1">
                        <div className="font-medium">Abrir vídeo</div>
                        <div className="text-xs opacity-70">{fileName}</div>
                      </div>
                    </a>
                  );
                }

                const videoType = attachment.type || getVideoType(attachment.url);
                
                return (
                  <video 
                    key={idx}
                    controls 
                    preload="metadata"
                    playsInline
                    className="max-w-full rounded-lg border-2 border-background/50"
                    style={{ maxHeight: '200px' }}
                    onError={() => handleVideoError(idx)}
                  >
                    <source src={attachment.url} type={videoType} />
                    <source src={attachment.url} />
                    Seu navegador não suporta reprodução de vídeo.
                  </video>
                );
              }

              return (
                <a
                  key={idx}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 p-2 rounded border text-xs hover:opacity-80 transition-opacity ${
                    isOutgoing 
                      ? 'bg-primary-foreground/10 border-primary-foreground/20' 
                      : 'bg-background border-border'
                  }`}
                >
                  <span>📎</span>
                  <span className="truncate">{fileName}</span>
                </a>
              );
            })}
          </div>
        )}

        {/* Timestamp e canal */}
        <p className={`text-xs mt-1 ${isOutgoing ? 'opacity-70' : 'opacity-60'}`}>
          {formatTime(message.created_at)} • {message.canal}
        </p>
      </div>
    </div>
  );
}
