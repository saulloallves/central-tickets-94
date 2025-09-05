import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { formatResponseForFranqueado } from './utils.ts';
import { ZAPIClient } from './zapi-client.ts';
import { ConversationManager } from './conversation-manager.ts';
import { ConversationMessageData } from './types.ts';

export class AIProcessor {
  constructor(
    private supabase: SupabaseClient,
    private zapiClient: ZAPIClient,
    private conversationManager: ConversationManager
  ) {}

  async processIncomingMessage(
    message: string,
    phone: string,
    instanceId: string,
    connectedPhone: string,
    chatName: string,
    senderName: string,
    senderLid: string,
    senderPhoto: string,
    isGroup: boolean
  ): Promise<string | null> {
    try {
      console.log('Generating AI response for message:', message);
      
      // Call the existing faq-suggest function
      const { data: aiResponse, error: aiError } = await this.supabase.functions.invoke('faq-suggest', {
        body: { pergunta: message }
      });

      if (aiError) {
        console.error('Error calling faq-suggest:', aiError);
        return null;
      }

      if (!aiResponse?.resposta_sugerida) {
        console.log('No AI response generated');
        return null;
      }

      // Format response for franchisee
      const formattedResponse = formatResponseForFranqueado(aiResponse.resposta_sugerida);
      console.log('AI response generated:', formattedResponse);

      // Send response via Z-API
      const sent = await this.zapiClient.sendMessage(phone, formattedResponse);
      
      if (sent) {
        // Save our response to the conversation
        await this.saveAIResponse(
          instanceId,
          connectedPhone,
          phone,
          chatName,
          senderName,
          senderLid,
          senderPhoto,
          isGroup,
          formattedResponse,
          message
        );
        
        return formattedResponse;
      }

      return null;
    } catch (error) {
      console.error('Error processing AI response:', error);
      return null;
    }
  }

  private async saveAIResponse(
    instanceId: string,
    connectedPhone: string,
    phone: string,
    chatName: string,
    senderName: string,
    senderLid: string,
    senderPhoto: string,
    isGroup: boolean,
    formattedResponse: string,
    originalMessage: string
  ): Promise<void> {
    const responseMessageData: ConversationMessageData = {
      id: `reply_${Date.now()}`,
      from_me: true,
      text: formattedResponse,
      moment: new Date().toISOString(),
      status: 'SENT',
      type: 'SentCallback',
      meta: {
        ai_generated: true,
        original_message: originalMessage
      }
    };

    await this.conversationManager.upsertConversation(
      instanceId,
      connectedPhone,
      phone,
      chatName || senderName,
      senderLid,
      senderPhoto,
      isGroup,
      responseMessageData
    );
  }
}