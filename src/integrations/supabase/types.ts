export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_feedback: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interaction_id: string | null
          motivo: string | null
          ticket_id: string
          util: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_id?: string | null
          motivo?: string | null
          ticket_id: string
          util: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interaction_id?: string | null
          motivo?: string | null
          ticket_id?: string
          util?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "ticket_ai_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feedback_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          aceitou_termos: boolean
          acessos: string[] | null
          beneficios: string[] | null
          cargo: Database["public"]["Enums"]["cargo"]
          cpf: string
          created_at: string
          data_admissao: string | null
          data_nascimento: string | null
          email: string
          id: string
          nome_completo: string
          remuneracao: number | null
          senha_sistema: string | null
          status: Database["public"]["Enums"]["colaborador_status"]
          telefone: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          aceitou_termos?: boolean
          acessos?: string[] | null
          beneficios?: string[] | null
          cargo: Database["public"]["Enums"]["cargo"]
          cpf: string
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          email: string
          id?: string
          nome_completo: string
          remuneracao?: number | null
          senha_sistema?: string | null
          status?: Database["public"]["Enums"]["colaborador_status"]
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          aceitou_termos?: boolean
          acessos?: string[] | null
          beneficios?: string[] | null
          cargo?: Database["public"]["Enums"]["cargo"]
          cpf?: string
          created_at?: string
          data_admissao?: string | null
          data_nascimento?: string | null
          email?: string
          id?: string
          nome_completo?: string
          remuneracao?: number | null
          senha_sistema?: string | null
          status?: Database["public"]["Enums"]["colaborador_status"]
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_colaboradores_unidade"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      equipe_members: {
        Row: {
          ativo: boolean
          created_at: string
          equipe_id: string
          id: string
          is_primary: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          equipe_id: string
          id?: string
          is_primary?: boolean
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          equipe_id?: string
          id?: string
          is_primary?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_members_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipe_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          id: string
          introducao: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          id?: string
          introducao: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          id?: string
          introducao?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      escalation_levels: {
        Row: {
          ativo: boolean
          created_at: string
          destino_user_id: string | null
          destino_whatsapp: string | null
          id: string
          ordem: number
          role: Database["public"]["Enums"]["app_role"] | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          destino_user_id?: string | null
          destino_whatsapp?: string | null
          id?: string
          ordem: number
          role?: Database["public"]["Enums"]["app_role"] | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          destino_user_id?: string | null
          destino_whatsapp?: string | null
          id?: string
          ordem?: number
          role?: Database["public"]["Enums"]["app_role"] | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_escalation_levels_destino_user"
            columns: ["destino_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_escalation_levels_unidade"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_logs: {
        Row: {
          canal: string
          created_at: string
          event_type: string
          from_level: number | null
          id: string
          message: string | null
          response: Json | null
          ticket_id: string
          to_level: number | null
          to_user_id: string | null
        }
        Insert: {
          canal?: string
          created_at?: string
          event_type: string
          from_level?: number | null
          id?: string
          message?: string | null
          response?: Json | null
          ticket_id: string
          to_level?: number | null
          to_user_id?: string | null
        }
        Update: {
          canal?: string
          created_at?: string
          event_type?: string
          from_level?: number | null
          id?: string
          message?: string | null
          response?: Json | null
          ticket_id?: string
          to_level?: number | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_escalation_logs_ticket"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_escalation_logs_to_user"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_ai_settings: {
        Row: {
          allowed_categories: string[] | null
          ativo: boolean
          base_conhecimento_prompt: string
          blocked_tags: string[] | null
          created_at: string
          estilo_resposta: string | null
          forced_article_ids: string[] | null
          frequency_penalty: number
          id: string
          max_tokens: number
          modelo: string
          modelo_chat: string | null
          modelo_sugestao: string | null
          presence_penalty: number
          temperatura: number
          top_p: number
          updated_at: string
          use_only_approved: boolean
        }
        Insert: {
          allowed_categories?: string[] | null
          ativo?: boolean
          base_conhecimento_prompt?: string
          blocked_tags?: string[] | null
          created_at?: string
          estilo_resposta?: string | null
          forced_article_ids?: string[] | null
          frequency_penalty?: number
          id?: string
          max_tokens?: number
          modelo?: string
          modelo_chat?: string | null
          modelo_sugestao?: string | null
          presence_penalty?: number
          temperatura?: number
          top_p?: number
          updated_at?: string
          use_only_approved?: boolean
        }
        Update: {
          allowed_categories?: string[] | null
          ativo?: boolean
          base_conhecimento_prompt?: string
          blocked_tags?: string[] | null
          created_at?: string
          estilo_resposta?: string | null
          forced_article_ids?: string[] | null
          frequency_penalty?: number
          id?: string
          max_tokens?: number
          modelo?: string
          modelo_chat?: string | null
          modelo_sugestao?: string | null
          presence_penalty?: number
          temperatura?: number
          top_p?: number
          updated_at?: string
          use_only_approved?: boolean
        }
        Relationships: []
      }
      faq_logs: {
        Row: {
          created_at: string
          id: string
          justificativa_abertura: string | null
          log_prompt_faq: Json
          pergunta_usuario: string
          resposta_ia_sugerida: string
          ticket_id: string | null
          usar_resposta_simples: boolean
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          justificativa_abertura?: string | null
          log_prompt_faq?: Json
          pergunta_usuario: string
          resposta_ia_sugerida: string
          ticket_id?: string | null
          usar_resposta_simples?: boolean
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          justificativa_abertura?: string | null
          log_prompt_faq?: Json
          pergunta_usuario?: string
          resposta_ia_sugerida?: string
          ticket_id?: string | null
          usar_resposta_simples?: boolean
          usuario_id?: string | null
        }
        Relationships: []
      }
      franqueados: {
        Row: {
          academic_education: string | null
          additional_address_details: string | null
          address: string | null
          address_number: string | null
          availability: string | null
          birth_date: string | null
          city: string | null
          confidentiality_term_accepted: string | null
          cpf_rnm: string | null
          CreatedAt: string | null
          description_extra_activities: string | null
          email: string | null
          franchisee_subtype: string | null
          franchisee_type: string | null
          have_extra_activities: string | null
          Id: number
          instagram: string | null
          is_in_social_contract: string | null
          labor_value: string | null
          landline: string | null
          lead_source: string | null
          lgpd_term_accepted: string | null
          link_units: string | null
          name: string | null
          nationality: string | null
          neighborhood: string | null
          phone: number | null
          profile_picture: string | null
          receive_for_labor: string | null
          state: string | null
          system_term_accepted: string | null
          uf: string | null
          unit_code: Json | null
          unit_code_indicated: string | null
          unit_id_group: string | null
          unit_name: Json | null
          UpdatedAt: string | null
          was_entrepreneur: string | null
          was_nominated: string | null
          web_password: number | null
          who_nominated: string | null
        }
        Insert: {
          academic_education?: string | null
          additional_address_details?: string | null
          address?: string | null
          address_number?: string | null
          availability?: string | null
          birth_date?: string | null
          city?: string | null
          confidentiality_term_accepted?: string | null
          cpf_rnm?: string | null
          CreatedAt?: string | null
          description_extra_activities?: string | null
          email?: string | null
          franchisee_subtype?: string | null
          franchisee_type?: string | null
          have_extra_activities?: string | null
          Id: number
          instagram?: string | null
          is_in_social_contract?: string | null
          labor_value?: string | null
          landline?: string | null
          lead_source?: string | null
          lgpd_term_accepted?: string | null
          link_units?: string | null
          name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          phone?: number | null
          profile_picture?: string | null
          receive_for_labor?: string | null
          state?: string | null
          system_term_accepted?: string | null
          uf?: string | null
          unit_code?: Json | null
          unit_code_indicated?: string | null
          unit_id_group?: string | null
          unit_name?: Json | null
          UpdatedAt?: string | null
          was_entrepreneur?: string | null
          was_nominated?: string | null
          web_password?: number | null
          who_nominated?: string | null
        }
        Update: {
          academic_education?: string | null
          additional_address_details?: string | null
          address?: string | null
          address_number?: string | null
          availability?: string | null
          birth_date?: string | null
          city?: string | null
          confidentiality_term_accepted?: string | null
          cpf_rnm?: string | null
          CreatedAt?: string | null
          description_extra_activities?: string | null
          email?: string | null
          franchisee_subtype?: string | null
          franchisee_type?: string | null
          have_extra_activities?: string | null
          Id?: number
          instagram?: string | null
          is_in_social_contract?: string | null
          labor_value?: string | null
          landline?: string | null
          lead_source?: string | null
          lgpd_term_accepted?: string | null
          link_units?: string | null
          name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          phone?: number | null
          profile_picture?: string | null
          receive_for_labor?: string | null
          state?: string | null
          system_term_accepted?: string | null
          uf?: string | null
          unit_code?: Json | null
          unit_code_indicated?: string | null
          unit_id_group?: string | null
          unit_name?: Json | null
          UpdatedAt?: string | null
          was_entrepreneur?: string | null
          was_nominated?: string | null
          web_password?: number | null
          who_nominated?: string | null
        }
        Relationships: []
      }
      knowledge_article_usage: {
        Row: {
          article_id: string
          created_at: string
          id: string
          interaction_id: string | null
          ticket_id: string | null
          used_as: string
        }
        Insert: {
          article_id: string
          created_at?: string
          id?: string
          interaction_id?: string | null
          ticket_id?: string | null
          used_as?: string
        }
        Update: {
          article_id?: string
          created_at?: string
          id?: string
          interaction_id?: string | null
          ticket_id?: string | null
          used_as?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_article_usage_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_article_usage_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "v_kb_articles_usage"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "knowledge_article_usage_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "v_kb_resolution_rate"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "knowledge_article_usage_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "ticket_ai_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_article_usage_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_articles: {
        Row: {
          aprovado: boolean
          ativo: boolean
          categoria: string | null
          conteudo: string
          created_at: string
          criado_por: string | null
          feedback_negativo: number
          feedback_positivo: number
          id: string
          link_arquivo: string | null
          tags: string[] | null
          tipo_midia: Database["public"]["Enums"]["knowledge_media_type"] | null
          titulo: string
          updated_at: string
          usado_pela_ia: boolean
        }
        Insert: {
          aprovado?: boolean
          ativo?: boolean
          categoria?: string | null
          conteudo: string
          created_at?: string
          criado_por?: string | null
          feedback_negativo?: number
          feedback_positivo?: number
          id?: string
          link_arquivo?: string | null
          tags?: string[] | null
          tipo_midia?:
            | Database["public"]["Enums"]["knowledge_media_type"]
            | null
          titulo: string
          updated_at?: string
          usado_pela_ia?: boolean
        }
        Update: {
          aprovado?: boolean
          ativo?: boolean
          categoria?: string | null
          conteudo?: string
          created_at?: string
          criado_por?: string | null
          feedback_negativo?: number
          feedback_positivo?: number
          id?: string
          link_arquivo?: string | null
          tags?: string[] | null
          tipo_midia?:
            | Database["public"]["Enums"]["knowledge_media_type"]
            | null
          titulo?: string
          updated_at?: string
          usado_pela_ia?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_suggestions: {
        Row: {
          avaliado_por: string | null
          created_at: string
          id: string
          modelo_nome: string | null
          modelo_provedor: Database["public"]["Enums"]["ai_model_provider"]
          publicado_em: string | null
          status: string
          sugerido_por: string | null
          texto_sugerido: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          avaliado_por?: string | null
          created_at?: string
          id?: string
          modelo_nome?: string | null
          modelo_provedor?: Database["public"]["Enums"]["ai_model_provider"]
          publicado_em?: string | null
          status?: string
          sugerido_por?: string | null
          texto_sugerido: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          avaliado_por?: string | null
          created_at?: string
          id?: string
          modelo_nome?: string | null
          modelo_provedor?: Database["public"]["Enums"]["ai_model_provider"]
          publicado_em?: string | null
          status?: string
          sugerido_por?: string | null
          texto_sugerido?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_suggestions_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_suggestions_sugerido_por_fkey"
            columns: ["sugerido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_suggestions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_de_sistema: {
        Row: {
          acao_realizada: string
          canal: Database["public"]["Enums"]["log_canal"] | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          entidade_afetada: string
          entidade_id: string
          ia_modelo: string | null
          id: string
          navegador_agente: string | null
          origem_ip: string | null
          prompt_entrada: string | null
          resposta_gerada: string | null
          timestamp: string
          tipo_log: Database["public"]["Enums"]["log_tipo"]
          usuario_responsavel: string | null
        }
        Insert: {
          acao_realizada: string
          canal?: Database["public"]["Enums"]["log_canal"] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade_afetada: string
          entidade_id: string
          ia_modelo?: string | null
          id?: string
          navegador_agente?: string | null
          origem_ip?: string | null
          prompt_entrada?: string | null
          resposta_gerada?: string | null
          timestamp?: string
          tipo_log: Database["public"]["Enums"]["log_tipo"]
          usuario_responsavel?: string | null
        }
        Update: {
          acao_realizada?: string
          canal?: Database["public"]["Enums"]["log_canal"] | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          entidade_afetada?: string
          entidade_id?: string
          ia_modelo?: string | null
          id?: string
          navegador_agente?: string | null
          origem_ip?: string | null
          prompt_entrada?: string | null
          resposta_gerada?: string | null
          timestamp?: string
          tipo_log?: Database["public"]["Enums"]["log_tipo"]
          usuario_responsavel?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          delay_mensagem: number
          id: string
          limite_retentativas: number
          modelo_mensagem_sla: string | null
          numero_remetente: string | null
          updated_at: string
          webhook_entrada: string | null
          webhook_saida: string | null
        }
        Insert: {
          created_at?: string
          delay_mensagem?: number
          id?: string
          limite_retentativas?: number
          modelo_mensagem_sla?: string | null
          numero_remetente?: string | null
          updated_at?: string
          webhook_entrada?: string | null
          webhook_saida?: string | null
        }
        Update: {
          created_at?: string
          delay_mensagem?: number
          id?: string
          limite_retentativas?: number
          modelo_mensagem_sla?: string | null
          numero_remetente?: string | null
          updated_at?: string
          webhook_entrada?: string | null
          webhook_saida?: string | null
        }
        Relationships: []
      }
      notifications_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          payload: Json
          processed_at: string | null
          scheduled_at: string
          status: string
          ticket_id: string
          type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          scheduled_at?: string
          status?: string
          ticket_id: string
          type: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          scheduled_at?: string
          status?: string
          ticket_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_notifications_queue_ticket"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_queue_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome_completo: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      "RAG DOCUMENTOS": {
        Row: {
          content: string | null
          embedding: Json | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: Json | null
          id: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: Json | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      ticket_ai_interactions: {
        Row: {
          created_at: string
          foi_usada: boolean | null
          id: string
          kind: Database["public"]["Enums"]["ai_interaction_kind"]
          log: Json
          mensagem: string | null
          model: string
          params: Json
          resposta: string
          resposta_final: string | null
          ticket_id: string
          used_at: string | null
          used_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          foi_usada?: boolean | null
          id?: string
          kind: Database["public"]["Enums"]["ai_interaction_kind"]
          log?: Json
          mensagem?: string | null
          model: string
          params?: Json
          resposta: string
          resposta_final?: string | null
          ticket_id: string
          used_at?: string | null
          used_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          foi_usada?: boolean | null
          id?: string
          kind?: Database["public"]["Enums"]["ai_interaction_kind"]
          log?: Json
          mensagem?: string | null
          model?: string
          params?: Json
          resposta?: string
          resposta_final?: string | null
          ticket_id?: string
          used_at?: string | null
          used_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ticket_mensagens: {
        Row: {
          anexos: Json | null
          canal: Database["public"]["Enums"]["canal_resposta"]
          created_at: string
          direcao: Database["public"]["Enums"]["mensagem_direcao"]
          id: string
          mensagem: string
          ticket_id: string
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          anexos?: Json | null
          canal?: Database["public"]["Enums"]["canal_resposta"]
          created_at?: string
          direcao?: Database["public"]["Enums"]["mensagem_direcao"]
          id?: string
          mensagem: string
          ticket_id: string
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          anexos?: Json | null
          canal?: Database["public"]["Enums"]["canal_resposta"]
          created_at?: string
          direcao?: Database["public"]["Enums"]["mensagem_direcao"]
          id?: string
          mensagem?: string
          ticket_id?: string
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ticket_mensagens_ticket"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ticket_mensagens_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_mensagens_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_sequences: {
        Row: {
          ano: number
          created_at: string
          id: string
          ultimo_numero: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          ultimo_numero?: number
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          ultimo_numero?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ticket_sequences_unidade"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          arquivos: Json | null
          atendimento_iniciado_em: string | null
          atendimento_iniciado_por: string | null
          canal_origem: Database["public"]["Enums"]["canal_origem"]
          canal_resposta: Database["public"]["Enums"]["canal_resposta"] | null
          categoria: Database["public"]["Enums"]["ticket_categoria"] | null
          codigo_ticket: string
          colaborador_id: string | null
          created_at: string
          criado_por: string | null
          data_abertura: string
          data_limite_sla: string | null
          descricao_problema: string
          equipe_responsavel_id: string | null
          escalonado_para: string | null
          escalonamento_nivel: number
          franqueado_id: number | null
          id: string
          log_ia: Json | null
          prioridade: Database["public"]["Enums"]["ticket_prioridade"]
          reaberto_count: number
          resolvido_em: string | null
          resposta_resolucao: string | null
          sla_half_time: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          status_sla: Database["public"]["Enums"]["ticket_sla_status"]
          subcategoria: string | null
          titulo: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          arquivos?: Json | null
          atendimento_iniciado_em?: string | null
          atendimento_iniciado_por?: string | null
          canal_origem: Database["public"]["Enums"]["canal_origem"]
          canal_resposta?: Database["public"]["Enums"]["canal_resposta"] | null
          categoria?: Database["public"]["Enums"]["ticket_categoria"] | null
          codigo_ticket: string
          colaborador_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_abertura?: string
          data_limite_sla?: string | null
          descricao_problema: string
          equipe_responsavel_id?: string | null
          escalonado_para?: string | null
          escalonamento_nivel?: number
          franqueado_id?: number | null
          id?: string
          log_ia?: Json | null
          prioridade?: Database["public"]["Enums"]["ticket_prioridade"]
          reaberto_count?: number
          resolvido_em?: string | null
          resposta_resolucao?: string | null
          sla_half_time?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_sla?: Database["public"]["Enums"]["ticket_sla_status"]
          subcategoria?: string | null
          titulo?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          arquivos?: Json | null
          atendimento_iniciado_em?: string | null
          atendimento_iniciado_por?: string | null
          canal_origem?: Database["public"]["Enums"]["canal_origem"]
          canal_resposta?: Database["public"]["Enums"]["canal_resposta"] | null
          categoria?: Database["public"]["Enums"]["ticket_categoria"] | null
          codigo_ticket?: string
          colaborador_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_abertura?: string
          data_limite_sla?: string | null
          descricao_problema?: string
          equipe_responsavel_id?: string | null
          escalonado_para?: string | null
          escalonamento_nivel?: number
          franqueado_id?: number | null
          id?: string
          log_ia?: Json | null
          prioridade?: Database["public"]["Enums"]["ticket_prioridade"]
          reaberto_count?: number
          resolvido_em?: string | null
          resposta_resolucao?: string | null
          sla_half_time?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_sla?: Database["public"]["Enums"]["ticket_sla_status"]
          subcategoria?: string | null
          titulo?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tickets_atendimento_iniciado_por_profiles"
            columns: ["atendimento_iniciado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_colaborador"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_criado_por"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_escalonado_para"
            columns: ["escalonado_para"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tickets_unidade"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_equipe_responsavel_id_fkey"
            columns: ["equipe_responsavel_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          codigo_grupo: number | null
          complemento: string | null
          contrato: string | null
          created_at: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          etapa_loja: string | null
          fase_loja: string | null
          func_dom: string | null
          func_sab: string | null
          func_seg_sex: string | null
          grupo: string | null
          has_parking: string | null
          has_partner_parking: string | null
          id: string
          id_agente_ia: string | null
          id_grupo_amarelo: string | null
          id_grupo_azul: string | null
          id_grupo_branco: string | null
          id_grupo_colab: string | null
          id_grupo_compras: string | null
          id_grupo_notificacoes: string | null
          id_grupo_reclame_aqui: string | null
          id_grupo_vermelho: string | null
          id_page_notion: string | null
          id_pasta_documentos: string | null
          id_pasta_unidade: string | null
          instagram: string | null
          link_pasta_documentos: string | null
          link_pasta_unidade: string | null
          modelo_loja: string | null
          numero: string | null
          parking_spots: string | null
          partner_parking_address: string | null
          purchases_active: Json | null
          sales_active: Json | null
          telefone: number | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_grupo?: number | null
          complemento?: string | null
          contrato?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          etapa_loja?: string | null
          fase_loja?: string | null
          func_dom?: string | null
          func_sab?: string | null
          func_seg_sex?: string | null
          grupo?: string | null
          has_parking?: string | null
          has_partner_parking?: string | null
          id: string
          id_agente_ia?: string | null
          id_grupo_amarelo?: string | null
          id_grupo_azul?: string | null
          id_grupo_branco?: string | null
          id_grupo_colab?: string | null
          id_grupo_compras?: string | null
          id_grupo_notificacoes?: string | null
          id_grupo_reclame_aqui?: string | null
          id_grupo_vermelho?: string | null
          id_page_notion?: string | null
          id_pasta_documentos?: string | null
          id_pasta_unidade?: string | null
          instagram?: string | null
          link_pasta_documentos?: string | null
          link_pasta_unidade?: string | null
          modelo_loja?: string | null
          numero?: string | null
          parking_spots?: string | null
          partner_parking_address?: string | null
          purchases_active?: Json | null
          sales_active?: Json | null
          telefone?: number | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          codigo_grupo?: number | null
          complemento?: string | null
          contrato?: string | null
          created_at?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          etapa_loja?: string | null
          fase_loja?: string | null
          func_dom?: string | null
          func_sab?: string | null
          func_seg_sex?: string | null
          grupo?: string | null
          has_parking?: string | null
          has_partner_parking?: string | null
          id?: string
          id_agente_ia?: string | null
          id_grupo_amarelo?: string | null
          id_grupo_azul?: string | null
          id_grupo_branco?: string | null
          id_grupo_colab?: string | null
          id_grupo_compras?: string | null
          id_grupo_notificacoes?: string | null
          id_grupo_reclame_aqui?: string | null
          id_grupo_vermelho?: string | null
          id_page_notion?: string | null
          id_pasta_documentos?: string | null
          id_pasta_unidade?: string | null
          instagram?: string | null
          link_pasta_documentos?: string | null
          link_pasta_unidade?: string | null
          modelo_loja?: string | null
          numero?: string | null
          parking_spots?: string | null
          partner_parking_address?: string | null
          purchases_active?: Json | null
          sales_active?: Json | null
          telefone?: number | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_flows: {
        Row: {
          created_at: string | null
          flow_started: boolean | null
          phone_number: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          flow_started?: boolean | null
          phone_number: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          flow_started?: boolean | null
          phone_number?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_roles_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_kb_articles_usage: {
        Row: {
          aprovado: boolean | null
          article_id: string | null
          categoria: string | null
          feedback_negativo: number | null
          feedback_positivo: number | null
          titulo: string | null
          usado_pela_ia: boolean | null
          usos_total: number | null
        }
        Relationships: []
      }
      v_kb_resolution_rate: {
        Row: {
          article_id: string | null
          resolucoes_negativas: number | null
          resolucoes_positivas: number | null
          taxa_resolucao: number | null
          titulo: string | null
        }
        Relationships: []
      }
      v_tickets_por_unidade_mes: {
        Row: {
          mes: string | null
          nome_unidade: string | null
          tempo_medio_resolucao_horas: number | null
          tickets_reabertos: number | null
          tickets_sla_vencido: number | null
          total_tickets: number | null
          unidade_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tickets_unidade"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      v_tickets_sla_overview: {
        Row: {
          abertos: number | null
          categoria: Database["public"]["Enums"]["ticket_categoria"] | null
          concluidos: number | null
          em_atendimento: number | null
          status_sla: Database["public"]["Enums"]["ticket_sla_status"] | null
          total: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_24h_skip_weekend: {
        Args: { ts: string }
        Returns: string
      }
      can_create_ticket: {
        Args: { ticket_unidade_id: string }
        Returns: boolean
      }
      can_update_ticket: {
        Args: { ticket_unidade_id: string }
        Returns: boolean
      }
      can_view_ticket: {
        Args: { ticket_unidade_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_ticket_code: {
        Args: { p_unidade_id: string }
        Returns: string
      }
    }
    Enums: {
      ai_interaction_kind: "suggestion" | "chat"
      ai_model_provider: "openai" | "lambda"
      app_role:
        | "admin"
        | "gerente"
        | "diretor"
        | "colaborador"
        | "juridico"
        | "diretoria"
      canal_origem: "typebot" | "whatsapp_zapi" | "web"
      canal_resposta: "web" | "whatsapp" | "typebot" | "interno"
      cargo:
        | "caixa"
        | "avaliador"
        | "midia"
        | "rh"
        | "gerente"
        | "diretor"
        | "admin"
      colaborador_status: "ativo" | "inativo"
      knowledge_media_type: "texto" | "video" | "pdf" | "link"
      log_canal: "web" | "whatsapp" | "typebot" | "painel_interno"
      log_tipo:
        | "acao_humana"
        | "acao_ia"
        | "sistema"
        | "erro"
        | "escalonamento"
        | "seguranca"
      mensagem_direcao: "entrada" | "saida" | "interna"
      ticket_categoria:
        | "juridico"
        | "sistema"
        | "midia"
        | "operacoes"
        | "rh"
        | "financeiro"
        | "outro"
      ticket_prioridade:
        | "urgente"
        | "alta"
        | "hoje_18h"
        | "padrao_24h"
        | "crise"
      ticket_sla_status: "dentro_prazo" | "alerta" | "vencido"
      ticket_status: "aberto" | "em_atendimento" | "escalonado" | "concluido"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_interaction_kind: ["suggestion", "chat"],
      ai_model_provider: ["openai", "lambda"],
      app_role: [
        "admin",
        "gerente",
        "diretor",
        "colaborador",
        "juridico",
        "diretoria",
      ],
      canal_origem: ["typebot", "whatsapp_zapi", "web"],
      canal_resposta: ["web", "whatsapp", "typebot", "interno"],
      cargo: [
        "caixa",
        "avaliador",
        "midia",
        "rh",
        "gerente",
        "diretor",
        "admin",
      ],
      colaborador_status: ["ativo", "inativo"],
      knowledge_media_type: ["texto", "video", "pdf", "link"],
      log_canal: ["web", "whatsapp", "typebot", "painel_interno"],
      log_tipo: [
        "acao_humana",
        "acao_ia",
        "sistema",
        "erro",
        "escalonamento",
        "seguranca",
      ],
      mensagem_direcao: ["entrada", "saida", "interna"],
      ticket_categoria: [
        "juridico",
        "sistema",
        "midia",
        "operacoes",
        "rh",
        "financeiro",
        "outro",
      ],
      ticket_prioridade: ["urgente", "alta", "hoje_18h", "padrao_24h", "crise"],
      ticket_sla_status: ["dentro_prazo", "alerta", "vencido"],
      ticket_status: ["aberto", "em_atendimento", "escalonado", "concluido"],
    },
  },
} as const
