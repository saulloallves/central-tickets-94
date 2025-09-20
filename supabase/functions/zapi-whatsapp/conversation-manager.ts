import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { normalizePhone } from './utils.ts';
import { ConversationMessageData, WhatsAppConversation } from './types.ts';

export class ConversationManager {
  constructor(private supabase: SupabaseClient) {}

  async upsertConversation(
    instanceId: string,
    connectedPhone: string,
    contactPhone: string,
    contactName: string,
    senderLid: string,
    senderPhoto: string,
    isGroup: boolean,
    messageData: ConversationMessageData
  ): Promise<WhatsAppConversation> {
    const normalizedContactPhone = normalizePhone(contactPhone);
    const normalizedConnectedPhone = normalizePhone(connectedPhone);
    
    // First, try to get existing conversation
    const { data: existingConversation, error: selectError } = await this.supabase
      .from('whatsapp_conversas')
      .select('*')
      .eq('instance_id', instanceId)
      .eq('connected_phone', normalizedConnectedPhone)
      .eq('contact_phone', normalizedContactPhone)
      .maybeSingle();

    if (selectError) {
      console.error('Error fetching conversation:', selectError);
      throw selectError;
    }

    const messageTimestamp = new Date(messageData.moment || Date.now()).toISOString();
    const direction = messageData.from_me ? 'saida' : 'entrada';

    if (existingConversation) {
      return this.updateExistingConversation(
        existingConversation,
        messageData,
        messageTimestamp,
        direction,
        contactName,
        senderPhoto
      );
    } else {
      return this.createNewConversation(
        instanceId,
        normalizedConnectedPhone,
        normalizedContactPhone,
        contactName,
        senderLid,
        senderPhoto,
        isGroup,
        messageData,
        messageTimestamp,
        direction
      );
    }
  }

  private async updateExistingConversation(
    existingConversation: any,
    messageData: ConversationMessageData,
    messageTimestamp: string,
    direction: 'entrada' | 'saida',
    contactName: string,
    senderPhoto: string
  ): Promise<WhatsAppConversation> {
    // Append message to existing conversation and keep only last 20 messages to avoid memory issues
    const currentConversa = existingConversation.conversa || [];
    const updatedConversa = [...currentConversa, messageData].slice(-20);
    
    const { data, error } = await this.supabase
      .from('whatsapp_conversas')
      .update({
        conversa: updatedConversa,
        last_message_at: messageTimestamp,
        last_message_text: messageData.text || '',
        last_direction: direction,
        contact_name: contactName || existingConversation.contact_name,
        sender_photo: senderPhoto || existingConversation.sender_photo,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingConversation.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }

    return data;
  }

  private async createNewConversation(
    instanceId: string,
    normalizedConnectedPhone: string,
    normalizedContactPhone: string,
    contactName: string,
    senderLid: string,
    senderPhoto: string,
    isGroup: boolean,
    messageData: ConversationMessageData,
    messageTimestamp: string,
    direction: 'entrada' | 'saida'
  ): Promise<WhatsAppConversation> {
    // Create new conversation
    const { data, error } = await this.supabase
      .from('whatsapp_conversas')
      .insert({
        instance_id: instanceId,
        connected_phone: normalizedConnectedPhone,
        contact_phone: normalizedContactPhone,
        contact_name: contactName,
        sender_lid: senderLid,
        sender_photo: senderPhoto,
        is_group: isGroup,
        conversa: [messageData],
        last_message_at: messageTimestamp,
        last_message_text: messageData.text || '',
        last_direction: direction,
        meta: {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }

    return data;
  }
}