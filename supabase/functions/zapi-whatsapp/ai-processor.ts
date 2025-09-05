import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { formatResponseForFranqueado } from './utils.ts';
import { ZAPIClient } from './zapi-client.ts';
import { ConversationManager } from './conversation-manager.ts';
import { ConversationMessageData } from './types.ts';
import { encontrarDocumentosRelacionados, rerankComLLM, gerarRespostaComContexto } from './rag-engine.ts';

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
      console.log('Generating AI response using RAG v4 for message:', message);
      
      // Use advanced RAG system (same as typebot-webhook)
      const candidatos = await encontrarDocumentosRelacionados(message, 12);
      
      if (candidatos.length === 0) {
        console.log('No documents found in RAG search');
        return null;
      }

      // Rerank with LLM
      let docsSelecionados = await rerankComLLM(candidatos, message);
      if (!docsSelecionados.length) {
        console.warn('No docs after rerank; falling back to top-5 candidatos');
        docsSelecionados = candidatos.slice(0, 5);
      }
      
      console.log('Docs selecionados para resposta:', 
        docsSelecionados.map(d => `${d.id}:${d.titulo}`).join(' | ')
      );

      if (docsSelecionados.length === 0) {
        console.log('No relevant documents found');
        return null;
      }

      // Generate response with context
      const respostaRAG = await gerarRespostaComContexto(docsSelecionados, message);
      
      let formattedResponse: string;
      try {
        const payload = JSON.parse(respostaRAG);
        formattedResponse = formatResponseForFranqueado(payload.texto);
      } catch (e) {
        console.error('Error parsing RAG JSON response:', e);
        formattedResponse = formatResponseForFranqueado(respostaRAG);
      }

      // Check if response is useful
      const isUseful = !/não encontrei informações suficientes/i.test(formattedResponse);
      if (!isUseful) {
        console.log('RAG response not useful, skipping');
        return null;
      }

      console.log('Generated useful RAG v4 response:', formattedResponse);

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