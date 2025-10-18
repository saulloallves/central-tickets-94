export interface ZAPIMessage {
  isStatusReply: boolean;
  senderLid: string;
  connectedPhone: string;
  waitingMessage: boolean;
  isEdit: boolean;
  isGroup: boolean;
  isNewsletter: boolean;
  instanceId: string;
  messageId: string;
  phone: string;
  fromMe: boolean;
  momment: number;
  status: string;
  chatName: string;
  senderPhoto: string;
  senderName: string;
  participantPhone?: string;
  participantLid?: string;
  photo: string;
  broadcast: boolean;
  type: string;
  text: {
    message: string;
    description?: string;
    title?: string;
    url?: string;
    thumbnailUrl?: string;
  };
}

export interface ConversationMessageData {
  id: string;
  from_me: boolean;
  text: string;
  moment: string;
  status: string;
  type: string;
  meta: {
    senderName?: string;
    senderPhoto?: string;
    messageId?: string;
    ai_generated?: boolean;
    original_message?: string;
    source?: string;
    docs_used?: string[];
    relevance_scores?: number[];
  };
}

export interface WhatsAppConversation {
  id: string;
  instance_id: string;
  connected_phone: string;
  contact_phone: string;
  contact_name?: string;
  sender_lid?: string;
  sender_photo?: string;
  is_group: boolean;
  conversa: ConversationMessageData[];
  last_message_at: string;
  last_message_text?: string;
  last_direction: 'entrada' | 'saida';
  meta: any;
  created_at: string;
  updated_at: string;
}
