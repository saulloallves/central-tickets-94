import { ImageModal } from '@/components/ui/image-modal';

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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.mensagem}
        </p>

        {/* Anexos */}
        {hasAttachments && (
          <div className="mt-2 space-y-2">
            {message.anexos!.map((attachment, idx) => {
              const isImage = attachment.tipo === 'imagem' || attachment.type?.startsWith('image/');
              const fileName = attachment.nome || attachment.name || 'Anexo';
              
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
