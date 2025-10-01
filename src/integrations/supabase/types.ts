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
      ai_classifier_adjustments: {
        Row: {
          adjustment_type: string
          applied_at: string
          applied_by: string | null
          confidence_score: number
          id: string
          new_value: Json
          old_value: Json
          reason: string
        }
        Insert: {
          adjustment_type: string
          applied_at?: string
          applied_by?: string | null
          confidence_score: number
          id?: string
          new_value: Json
          old_value: Json
          reason: string
        }
        Update: {
          adjustment_type?: string
          applied_at?: string
          applied_by?: string | null
          confidence_score?: number
          id?: string
          new_value?: Json
          old_value?: Json
          reason?: string
        }
        Relationships: []
      }
      ai_classifier_advanced_settings: {
        Row: {
          ai_model_settings: Json
          ativo: boolean
          auto_adjustment_enabled: boolean
          classification_prompt_template: string
          continuous_learning_enabled: boolean
          created_at: string
          created_by: string | null
          dynamic_sla_enabled: boolean
          emergency_keywords: Json
          feedback_threshold: number
          id: string
          load_balancing_enabled: boolean
          priority_matrix: Json
          priority_prompt_template: string
          sla_adjustment_factors: Json
          sla_prompt_template: string
          team_capacity_weights: Json
          updated_at: string
        }
        Insert: {
          ai_model_settings?: Json
          ativo?: boolean
          auto_adjustment_enabled?: boolean
          classification_prompt_template?: string
          continuous_learning_enabled?: boolean
          created_at?: string
          created_by?: string | null
          dynamic_sla_enabled?: boolean
          emergency_keywords?: Json
          feedback_threshold?: number
          id?: string
          load_balancing_enabled?: boolean
          priority_matrix?: Json
          priority_prompt_template?: string
          sla_adjustment_factors?: Json
          sla_prompt_template?: string
          team_capacity_weights?: Json
          updated_at?: string
        }
        Update: {
          ai_model_settings?: Json
          ativo?: boolean
          auto_adjustment_enabled?: boolean
          classification_prompt_template?: string
          continuous_learning_enabled?: boolean
          created_at?: string
          created_by?: string | null
          dynamic_sla_enabled?: boolean
          emergency_keywords?: Json
          feedback_threshold?: number
          id?: string
          load_balancing_enabled?: boolean
          priority_matrix?: Json
          priority_prompt_template?: string
          sla_adjustment_factors?: Json
          sla_prompt_template?: string
          team_capacity_weights?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ai_classifier_metrics: {
        Row: {
          accuracy_rate: number
          average_response_time: number
          average_sla_adherence: number
          correct_classifications: number
          created_at: string
          date: string
          id: string
          priority_accuracy: Json
          sla_breaches: number
          sla_compliance_rate: number
          team_load_distribution: Json
          total_tickets_classified: number
        }
        Insert: {
          accuracy_rate?: number
          average_response_time?: number
          average_sla_adherence?: number
          correct_classifications?: number
          created_at?: string
          date?: string
          id?: string
          priority_accuracy?: Json
          sla_breaches?: number
          sla_compliance_rate?: number
          team_load_distribution?: Json
          total_tickets_classified?: number
        }
        Update: {
          accuracy_rate?: number
          average_response_time?: number
          average_sla_adherence?: number
          correct_classifications?: number
          created_at?: string
          date?: string
          id?: string
          priority_accuracy?: Json
          sla_breaches?: number
          sla_compliance_rate?: number
          team_load_distribution?: Json
          total_tickets_classified?: number
        }
        Relationships: []
      }
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
      atendente_unidades: {
        Row: {
          atendente_id: string | null
          ativo: boolean
          codigo_grupo: string | null
          concierge_name: string | null
          concierge_phone: string | null
          created_at: string
          grupo: string | null
          id: string
          prioridade: number | null
          updated_at: string
        }
        Insert: {
          atendente_id?: string | null
          ativo?: boolean
          codigo_grupo?: string | null
          concierge_name?: string | null
          concierge_phone?: string | null
          created_at?: string
          grupo?: string | null
          id: string
          prioridade?: number | null
          updated_at?: string
        }
        Update: {
          atendente_id?: string | null
          ativo?: boolean
          codigo_grupo?: string | null
          concierge_name?: string | null
          concierge_phone?: string | null
          created_at?: string
          grupo?: string | null
          id?: string
          prioridade?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_atendente_unidades_atendente"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "atendentes"
            referencedColumns: ["id"]
          },
        ]
      }
      atendentes: {
        Row: {
          ativo: boolean
          capacidade_atual: number
          capacidade_maxima: number
          created_at: string
          email: string | null
          foto_perfil: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string
          nome: string
          observacoes: string | null
          status: Database["public"]["Enums"]["atendente_status"]
          telefone: string | null
          tipo: Database["public"]["Enums"]["atendente_tipo"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          capacidade_atual?: number
          capacidade_maxima?: number
          created_at?: string
          email?: string | null
          foto_perfil?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["atendente_status"]
          telefone?: string | null
          tipo: Database["public"]["Enums"]["atendente_tipo"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          capacidade_atual?: number
          capacidade_maxima?: number
          created_at?: string
          email?: string | null
          foto_perfil?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["atendente_status"]
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["atendente_tipo"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendentes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      avaliacoes_atendimento: {
        Row: {
          chamado_id: string
          comentario: string | null
          created_at: string | null
          enviado_em: string
          grupo_whatsapp_id: string | null
          id: string
          rating: string | null
          respondido_em: string | null
          telefone_destino: string
          tipo_atendimento: string | null
          unidade_codigo: string | null
          unidade_nome: string | null
        }
        Insert: {
          chamado_id: string
          comentario?: string | null
          created_at?: string | null
          enviado_em?: string
          grupo_whatsapp_id?: string | null
          id?: string
          rating?: string | null
          respondido_em?: string | null
          telefone_destino: string
          tipo_atendimento?: string | null
          unidade_codigo?: string | null
          unidade_nome?: string | null
        }
        Update: {
          chamado_id?: string
          comentario?: string | null
          created_at?: string | null
          enviado_em?: string
          grupo_whatsapp_id?: string | null
          id?: string
          rating?: string | null
          respondido_em?: string | null
          telefone_destino?: string
          tipo_atendimento?: string | null
          unidade_codigo?: string | null
          unidade_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_atendimento_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          atendente_id: string | null
          atendente_nome: string | null
          atualizado_em: string | null
          categoria: string | null
          criado_em: string | null
          descricao: string
          franqueado_nome: string
          id: string
          is_emergencia: boolean | null
          prioridade: string | null
          resolucao: string | null
          status: string
          telefone: string
          tipo_atendimento: string
          unidade_id: string
        }
        Insert: {
          atendente_id?: string | null
          atendente_nome?: string | null
          atualizado_em?: string | null
          categoria?: string | null
          criado_em?: string | null
          descricao: string
          franqueado_nome: string
          id?: string
          is_emergencia?: boolean | null
          prioridade?: string | null
          resolucao?: string | null
          status?: string
          telefone: string
          tipo_atendimento: string
          unidade_id: string
        }
        Update: {
          atendente_id?: string | null
          atendente_nome?: string | null
          atualizado_em?: string | null
          categoria?: string | null
          criado_em?: string | null
          descricao?: string
          franqueado_nome?: string
          id?: string
          is_emergencia?: boolean | null
          prioridade?: string | null
          resolucao?: string | null
          status?: string
          telefone?: string
          tipo_atendimento?: string
          unidade_id?: string
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
      crise_mensagens: {
        Row: {
          created_at: string
          crise_id: string
          enviado_por: string | null
          grupos_destinatarios: Json
          id: string
          mensagem: string
          total_grupos: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          crise_id: string
          enviado_por?: string | null
          grupos_destinatarios?: Json
          id?: string
          mensagem: string
          total_grupos?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          crise_id?: string
          enviado_por?: string | null
          grupos_destinatarios?: Json
          id?: string
          mensagem?: string
          total_grupos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crise_mensagens_crise_id_fkey"
            columns: ["crise_id"]
            isOneToOne: false
            referencedRelation: "crises"
            referencedColumns: ["id"]
          },
        ]
      }
      crise_ticket_links: {
        Row: {
          crise_id: string
          id: string
          linked_at: string
          linked_by: string | null
          ticket_id: string
        }
        Insert: {
          crise_id: string
          id?: string
          linked_at?: string
          linked_by?: string | null
          ticket_id: string
        }
        Update: {
          crise_id?: string
          id?: string
          linked_at?: string
          linked_by?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crise_ticket_links_crise_id_fkey"
            columns: ["crise_id"]
            isOneToOne: false
            referencedRelation: "crises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crise_ticket_links_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      crise_updates: {
        Row: {
          created_at: string
          created_by: string | null
          crise_id: string
          id: string
          mensagem: string
          status: Database["public"]["Enums"]["crise_status"] | null
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          crise_id: string
          id?: string
          mensagem: string
          status?: Database["public"]["Enums"]["crise_status"] | null
          tipo?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          crise_id?: string
          id?: string
          mensagem?: string
          status?: Database["public"]["Enums"]["crise_status"] | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crise_updates_crise_id_fkey"
            columns: ["crise_id"]
            isOneToOne: false
            referencedRelation: "crises"
            referencedColumns: ["id"]
          },
        ]
      }
      crises: {
        Row: {
          abriu_por: string | null
          canal_oficial: string | null
          created_at: string
          descricao: string | null
          equipe_id: string | null
          id: string
          is_active: boolean
          palavras_chave: string[] | null
          problem_signature: string | null
          resolved_at: string | null
          similar_terms: string[] | null
          status: Database["public"]["Enums"]["crise_status"]
          tickets_count: number
          titulo: string
          ultima_atualizacao: string
          updated_at: string
        }
        Insert: {
          abriu_por?: string | null
          canal_oficial?: string | null
          created_at?: string
          descricao?: string | null
          equipe_id?: string | null
          id?: string
          is_active?: boolean
          palavras_chave?: string[] | null
          problem_signature?: string | null
          resolved_at?: string | null
          similar_terms?: string[] | null
          status?: Database["public"]["Enums"]["crise_status"]
          tickets_count?: number
          titulo: string
          ultima_atualizacao?: string
          updated_at?: string
        }
        Update: {
          abriu_por?: string | null
          canal_oficial?: string | null
          created_at?: string
          descricao?: string | null
          equipe_id?: string | null
          id?: string
          is_active?: boolean
          palavras_chave?: string[] | null
          problem_signature?: string | null
          resolved_at?: string | null
          similar_terms?: string[] | null
          status?: Database["public"]["Enums"]["crise_status"]
          tickets_count?: number
          titulo?: string
          ultima_atualizacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crises_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      crises_ativas: {
        Row: {
          comunicado_emitido: boolean
          criada_em: string
          criada_por: string | null
          id: string
          impacto_regional: string[] | null
          log_acoes: Json
          motivo: string | null
          resolvida_em: string | null
          resolvida_por: string | null
          ticket_id: string
        }
        Insert: {
          comunicado_emitido?: boolean
          criada_em?: string
          criada_por?: string | null
          id?: string
          impacto_regional?: string[] | null
          log_acoes?: Json
          motivo?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          ticket_id: string
        }
        Update: {
          comunicado_emitido?: boolean
          criada_em?: string
          criada_por?: string | null
          id?: string
          impacto_regional?: string[] | null
          log_acoes?: Json
          motivo?: string | null
          resolvida_em?: string | null
          resolvida_por?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crises_ativas_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      crisis_ai_settings: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          keywords_base: string[]
          similarity_threshold: number
          system_prompt: string
          threshold_similares: number
          updated_at: string
          user_prompt: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          keywords_base?: string[]
          similarity_threshold?: number
          system_prompt?: string
          threshold_similares?: number
          updated_at?: string
          user_prompt?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          keywords_base?: string[]
          similarity_threshold?: number
          system_prompt?: string
          threshold_similares?: number
          updated_at?: string
          user_prompt?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          artigo_id: string
          categoria: string | null
          classificacao: Json | null
          conteudo: Json | null
          criado_em: string
          criado_por: string | null
          embedding: string | null
          estilo: Database["public"]["Enums"]["article_estilo"] | null
          ia_modelo: string | null
          id: string
          justificativa: string
          parent_id: string | null
          processado_por_ia: boolean | null
          status: Database["public"]["Enums"]["article_status"]
          tags: string[] | null
          tipo: Database["public"]["Enums"]["article_type"]
          titulo: string
          tsv: unknown | null
          valido_ate: string | null
          versao: number
        }
        Insert: {
          artigo_id: string
          categoria?: string | null
          classificacao?: Json | null
          conteudo?: Json | null
          criado_em?: string
          criado_por?: string | null
          embedding?: string | null
          estilo?: Database["public"]["Enums"]["article_estilo"] | null
          ia_modelo?: string | null
          id?: string
          justificativa: string
          parent_id?: string | null
          processado_por_ia?: boolean | null
          status?: Database["public"]["Enums"]["article_status"]
          tags?: string[] | null
          tipo?: Database["public"]["Enums"]["article_type"]
          titulo: string
          tsv?: unknown | null
          valido_ate?: string | null
          versao?: number
        }
        Update: {
          artigo_id?: string
          categoria?: string | null
          classificacao?: Json | null
          conteudo?: Json | null
          criado_em?: string
          criado_por?: string | null
          embedding?: string | null
          estilo?: Database["public"]["Enums"]["article_estilo"] | null
          ia_modelo?: string | null
          id?: string
          justificativa?: string
          parent_id?: string | null
          processado_por_ia?: boolean | null
          status?: Database["public"]["Enums"]["article_status"]
          tags?: string[] | null
          tipo?: Database["public"]["Enums"]["article_type"]
          titulo?: string
          tsv?: unknown | null
          valido_ate?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_documentos_criado_por"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          api_base_url: string | null
          api_key: string | null
          api_provider: string | null
          ativo: boolean
          auto_classificacao: boolean | null
          auto_equipe: boolean | null
          auto_prioridade: boolean | null
          base_conhecimento_prompt: string
          blocked_tags: string[] | null
          categorias_preferidas: string[] | null
          created_at: string
          custom_headers: Json | null
          estilo_resposta: string | null
          filtrar_por_categoria: boolean | null
          forced_article_ids: string[] | null
          frequency_penalty: number
          id: string
          knowledge_mode: string | null
          limite_tokens_contexto: number | null
          log_detalhado: boolean | null
          max_tokens: number
          max_tokens_chat: number | null
          max_tokens_classificacao: number | null
          max_tokens_sugestao: number | null
          modelo: string
          modelo_analise: string | null
          modelo_chat: string | null
          modelo_classificacao: string | null
          modelo_resumo: string | null
          modelo_sugestao: string | null
          modo_debug: boolean | null
          presence_penalty: number
          profundidade_historico: number | null
          prompt_chat: string | null
          prompt_classificacao: string | null
          prompt_format_response: string | null
          prompt_sugestao: string | null
          prompt_ticket_suggestions: string | null
          prompt_typebot: string | null
          prompt_zapi_whatsapp: string | null
          temperatura: number
          temperatura_chat: number | null
          temperatura_classificacao: number | null
          temperatura_sugestao: number | null
          timeout_requests: number | null
          top_p: number
          updated_at: string
          usar_base_conhecimento_formatacao: boolean
          usar_busca_semantica: boolean | null
          usar_feedback_loop: boolean | null
          usar_historico_conversa: boolean | null
          use_only_approved: boolean
        }
        Insert: {
          allowed_categories?: string[] | null
          api_base_url?: string | null
          api_key?: string | null
          api_provider?: string | null
          ativo?: boolean
          auto_classificacao?: boolean | null
          auto_equipe?: boolean | null
          auto_prioridade?: boolean | null
          base_conhecimento_prompt?: string
          blocked_tags?: string[] | null
          categorias_preferidas?: string[] | null
          created_at?: string
          custom_headers?: Json | null
          estilo_resposta?: string | null
          filtrar_por_categoria?: boolean | null
          forced_article_ids?: string[] | null
          frequency_penalty?: number
          id?: string
          knowledge_mode?: string | null
          limite_tokens_contexto?: number | null
          log_detalhado?: boolean | null
          max_tokens?: number
          max_tokens_chat?: number | null
          max_tokens_classificacao?: number | null
          max_tokens_sugestao?: number | null
          modelo?: string
          modelo_analise?: string | null
          modelo_chat?: string | null
          modelo_classificacao?: string | null
          modelo_resumo?: string | null
          modelo_sugestao?: string | null
          modo_debug?: boolean | null
          presence_penalty?: number
          profundidade_historico?: number | null
          prompt_chat?: string | null
          prompt_classificacao?: string | null
          prompt_format_response?: string | null
          prompt_sugestao?: string | null
          prompt_ticket_suggestions?: string | null
          prompt_typebot?: string | null
          prompt_zapi_whatsapp?: string | null
          temperatura?: number
          temperatura_chat?: number | null
          temperatura_classificacao?: number | null
          temperatura_sugestao?: number | null
          timeout_requests?: number | null
          top_p?: number
          updated_at?: string
          usar_base_conhecimento_formatacao?: boolean
          usar_busca_semantica?: boolean | null
          usar_feedback_loop?: boolean | null
          usar_historico_conversa?: boolean | null
          use_only_approved?: boolean
        }
        Update: {
          allowed_categories?: string[] | null
          api_base_url?: string | null
          api_key?: string | null
          api_provider?: string | null
          ativo?: boolean
          auto_classificacao?: boolean | null
          auto_equipe?: boolean | null
          auto_prioridade?: boolean | null
          base_conhecimento_prompt?: string
          blocked_tags?: string[] | null
          categorias_preferidas?: string[] | null
          created_at?: string
          custom_headers?: Json | null
          estilo_resposta?: string | null
          filtrar_por_categoria?: boolean | null
          forced_article_ids?: string[] | null
          frequency_penalty?: number
          id?: string
          knowledge_mode?: string | null
          limite_tokens_contexto?: number | null
          log_detalhado?: boolean | null
          max_tokens?: number
          max_tokens_chat?: number | null
          max_tokens_classificacao?: number | null
          max_tokens_sugestao?: number | null
          modelo?: string
          modelo_analise?: string | null
          modelo_chat?: string | null
          modelo_classificacao?: string | null
          modelo_resumo?: string | null
          modelo_sugestao?: string | null
          modo_debug?: boolean | null
          presence_penalty?: number
          profundidade_historico?: number | null
          prompt_chat?: string | null
          prompt_classificacao?: string | null
          prompt_format_response?: string | null
          prompt_sugestao?: string | null
          prompt_ticket_suggestions?: string | null
          prompt_typebot?: string | null
          prompt_zapi_whatsapp?: string | null
          temperatura?: number
          temperatura_chat?: number | null
          temperatura_classificacao?: number | null
          temperatura_sugestao?: number | null
          timeout_requests?: number | null
          top_p?: number
          updated_at?: string
          usar_base_conhecimento_formatacao?: boolean
          usar_busca_semantica?: boolean | null
          usar_feedback_loop?: boolean | null
          usar_historico_conversa?: boolean | null
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
          id: number
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
          normalized_phone: string | null
          phone: string | null
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
          id: number
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
          normalized_phone?: string | null
          phone?: string | null
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
          id?: number
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
          normalized_phone?: string | null
          phone?: string | null
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
      internal_access_requests: {
        Row: {
          comments: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          desired_role: string
          equipe_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          desired_role?: string
          equipe_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          desired_role?: string
          equipe_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_access_requests_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_access_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notification_recipients: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          notification_id: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_id?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          notification_id?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notification_recipients_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "internal_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notifications: {
        Row: {
          created_at: string | null
          created_by: string | null
          equipe_id: string | null
          id: string
          message: string | null
          payload: Json | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          equipe_id?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          equipe_id?: string | null
          id?: string
          message?: string | null
          payload?: Json | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notifications_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
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
          arquivo_path: string | null
          ativo: boolean
          categoria: string | null
          classificacao: Json | null
          conteudo: string
          created_at: string
          criado_por: string | null
          equipe_id: string | null
          estilo: string | null
          feedback_negativo: number
          feedback_positivo: number
          id: string
          link_arquivo: string | null
          subcategoria: string | null
          tags: string[] | null
          tipo_midia: Database["public"]["Enums"]["knowledge_media_type"] | null
          titulo: string
          updated_at: string
          usado_pela_ia: boolean
        }
        Insert: {
          aprovado?: boolean
          arquivo_path?: string | null
          ativo?: boolean
          categoria?: string | null
          classificacao?: Json | null
          conteudo: string
          created_at?: string
          criado_por?: string | null
          equipe_id?: string | null
          estilo?: string | null
          feedback_negativo?: number
          feedback_positivo?: number
          id?: string
          link_arquivo?: string | null
          subcategoria?: string | null
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
          arquivo_path?: string | null
          ativo?: boolean
          categoria?: string | null
          classificacao?: Json | null
          conteudo?: string
          created_at?: string
          criado_por?: string | null
          equipe_id?: string | null
          estilo?: string | null
          feedback_negativo?: number
          feedback_positivo?: number
          id?: string
          link_arquivo?: string | null
          subcategoria?: string | null
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
          {
            foreignKeyName: "knowledge_articles_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_auto_approvals: {
        Row: {
          ai_evaluation: Json | null
          comparative_analysis: string | null
          corrected_response: string
          created_at: string
          created_by: string | null
          decision_reason: string | null
          documentation_content: string
          id: string
          original_message: string
          similar_documents: Json | null
          status: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          ai_evaluation?: Json | null
          comparative_analysis?: string | null
          corrected_response: string
          created_at?: string
          created_by?: string | null
          decision_reason?: string | null
          documentation_content: string
          id?: string
          original_message: string
          similar_documents?: Json | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_evaluation?: Json | null
          comparative_analysis?: string | null
          corrected_response?: string
          created_at?: string
          created_by?: string | null
          decision_reason?: string | null
          documentation_content?: string
          id?: string
          original_message?: string
          similar_documents?: Json | null
          status?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_suggestions: {
        Row: {
          article_id: string | null
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
          article_id?: string | null
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
          article_id?: string | null
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
            foreignKeyName: "knowledge_suggestions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_suggestions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "v_kb_articles_usage"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "knowledge_suggestions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "v_kb_resolution_rate"
            referencedColumns: ["article_id"]
          },
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
      message_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          scope: string
          template_content: string
          template_key: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          scope?: string
          template_content: string
          template_key: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          scope?: string
          template_content?: string
          template_key?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      messaging_providers: {
        Row: {
          base_url: string
          client_token: string
          created_at: string
          created_by: string | null
          id: string
          instance_id: string
          instance_token: string
          is_active: boolean
          provider_name: string
          updated_at: string
        }
        Insert: {
          base_url?: string
          client_token: string
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id: string
          instance_token: string
          is_active?: boolean
          provider_name?: string
          updated_at?: string
        }
        Update: {
          base_url?: string
          client_token?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id?: string
          instance_token?: string
          is_active?: boolean
          provider_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_routes: {
        Row: {
          created_at: string
          description: string | null
          destination_label: string | null
          destination_value: string
          id: string
          is_active: boolean
          priority: number
          type: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          destination_label?: string | null
          destination_value: string
          id?: string
          is_active?: boolean
          priority?: number
          type: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          destination_label?: string | null
          destination_value?: string
          id?: string
          is_active?: boolean
          priority?: number
          type?: string
          unit_id?: string | null
          updated_at?: string
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
      notification_source_config: {
        Row: {
          created_at: string
          description: string | null
          fixed_value: string | null
          id: string
          is_active: boolean
          notification_type: string
          source_column: string | null
          source_table: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fixed_value?: string | null
          id?: string
          is_active?: boolean
          notification_type: string
          source_column?: string | null
          source_table?: string | null
          source_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fixed_value?: string | null
          id?: string
          is_active?: boolean
          notification_type?: string
          source_column?: string | null
          source_table?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications_queue: {
        Row: {
          alert_category: string | null
          alert_level: string | null
          attempts: number
          created_at: string
          id: string
          payload: Json
          processed_at: string | null
          scheduled_at: string
          status: string
          ticket_id: string | null
          type: string
        }
        Insert: {
          alert_category?: string | null
          alert_level?: string | null
          attempts?: number
          created_at?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          scheduled_at?: string
          status?: string
          ticket_id?: string | null
          type: string
        }
        Update: {
          alert_category?: string | null
          alert_level?: string | null
          attempts?: number
          created_at?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          scheduled_at?: string
          status?: string
          ticket_id?: string | null
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
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          nome_completo: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
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
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          updated_by?: string | null
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
          model?: string
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
      ticket_status_transitions: {
        Row: {
          allowed: boolean
          created_at: string
          from_status: string
          reason: string | null
          to_status: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          from_status: string
          reason?: string | null
          to_status: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          from_status?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          arquivos: Json | null
          atendimento_iniciado_em: string | null
          atendimento_iniciado_por: string | null
          canal_origem: Database["public"]["Enums"]["canal_origem"]
          canal_resposta: Database["public"]["Enums"]["canal_resposta"] | null
          categoria: Database["public"]["Enums"]["ticket_categoria"] | null
          codigo_grupo: number | null
          codigo_ticket: string
          colaborador_id: string | null
          conversa: Json
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
          position: number
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
          codigo_grupo?: number | null
          codigo_ticket: string
          colaborador_id?: string | null
          conversa?: Json
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
          position?: number
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
          codigo_grupo?: number | null
          codigo_ticket?: string
          colaborador_id?: string | null
          conversa?: Json
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
          position?: number
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
      tickets_audit: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown | null
          new_data: Json | null
          old_data: Json | null
          ticket_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          ticket_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          new_data?: Json | null
          old_data?: Json | null
          ticket_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      user_permissions: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          approved?: boolean
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
      view_access_log: {
        Row: {
          accessed_at: string
          id: string
          ip_address: unknown | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          id?: string
          ip_address?: unknown | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversas: {
        Row: {
          connected_phone: string
          contact_name: string | null
          contact_phone: string
          conversa: Json
          created_at: string
          id: string
          instance_id: string
          is_group: boolean
          last_direction: string
          last_message_at: string
          last_message_text: string | null
          meta: Json
          sender_lid: string | null
          sender_photo: string | null
          updated_at: string
        }
        Insert: {
          connected_phone: string
          contact_name?: string | null
          contact_phone: string
          conversa?: Json
          created_at?: string
          id?: string
          instance_id: string
          is_group?: boolean
          last_direction?: string
          last_message_at?: string
          last_message_text?: string | null
          meta?: Json
          sender_lid?: string | null
          sender_photo?: string | null
          updated_at?: string
        }
        Update: {
          connected_phone?: string
          contact_name?: string | null
          contact_phone?: string
          conversa?: Json
          created_at?: string
          id?: string
          instance_id?: string
          is_group?: boolean
          last_direction?: string
          last_message_at?: string
          last_message_text?: string | null
          meta?: Json
          sender_lid?: string | null
          sender_photo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_group_states: {
        Row: {
          awaiting_ticket_response: boolean
          created_at: string
          expires_at: string | null
          group_phone: string
          id: string
          ticket_id: string | null
          updated_at: string
        }
        Insert: {
          awaiting_ticket_response?: boolean
          created_at?: string
          expires_at?: string | null
          group_phone: string
          id?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Update: {
          awaiting_ticket_response?: boolean
          created_at?: string
          expires_at?: string | null
          group_phone?: string
          id?: string
          ticket_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      add_tickets_to_crise: {
        Args: { p_by?: string; p_crise_id: string; p_ticket_ids: string[] }
        Returns: undefined
      }
      append_to_ticket_conversa: {
        Args: {
          p_autor: string
          p_canal?: Database["public"]["Enums"]["canal_resposta"]
          p_texto: string
          p_ticket_id: string
          p_usuario_id?: string
        }
        Returns: Json
      }
      approve_internal_access: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      assign_basic_user_roles: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      auto_link_similar_tickets_to_crisis: {
        Args: {
          p_crise_id: string
          p_palavras_chave?: string[]
          p_time_window_minutes?: number
        }
        Returns: number
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      broadcast_crise_message: {
        Args: {
          p_by?: string
          p_canal?: Database["public"]["Enums"]["canal_resposta"]
          p_crise_id: string
          p_mensagem: string
        }
        Returns: undefined
      }
      calculate_new_position: {
        Args: { p_after_id?: string; p_before_id?: string; p_status: string }
        Returns: number
      }
      can_create_ticket: {
        Args: { ticket_unidade_id: string }
        Returns: boolean
      }
      can_update_ticket: {
        Args: { ticket_equipe_id?: string; ticket_unidade_id: string }
        Returns: boolean
      }
      can_view_ticket: {
        Args:
          | { ticket_equipe_id?: string; ticket_unidade_id: string }
          | { ticket_unidade_id: string }
        Returns: boolean
      }
      cleanup_all_users_except_current: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_old_notifications: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_orphaned_crises: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_unconfirmed_access_requests: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_crise: {
        Args: {
          p_abriu_por?: string
          p_canal_oficial?: string
          p_descricao?: string
          p_palavras_chave?: string[]
          p_ticket_ids?: string[]
          p_titulo: string
        }
        Returns: string
      }
      create_internal_access_request_manual: {
        Args: {
          p_desired_role?: string
          p_equipe_id: string
          p_user_id: string
        }
        Returns: string
      }
      create_internal_alert: {
        Args: {
          p_alert_category?: string
          p_alert_level?: string
          p_alert_type: string
          p_payload?: Json
          p_ticket_id: string
        }
        Returns: string
      }
      fix_missing_colaborador_roles: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fix_missing_franqueado_roles: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_all_users_except_current: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      get_available_capacity: {
        Args: {
          p_tipo: Database["public"]["Enums"]["atendente_tipo"]
          p_unidade_id: string
        }
        Returns: number
      }
      get_realtime_kpis: {
        Args: {
          p_equipe_filter?: string
          p_periodo_dias?: number
          p_unidade_filter?: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_sla_minutes_for_priority: {
        Args: { p_prioridade: Database["public"]["Enums"]["ticket_prioridade"] }
        Returns: number
      }
      get_team_metrics: {
        Args: {
          p_periodo_dias?: number
          p_unidade_filter?: string
          p_user_id?: string
        }
        Returns: {
          equipe_id: string
          equipe_nome: string
          tempo_medio_resolucao: number
          tickets_crise: number
          tickets_reabertos: number
          tickets_resolvidos: number
          tickets_sla_ok: number
          total_tickets: number
          unidades_atendidas: number
        }[]
      }
      get_ticket_conversa: {
        Args: { p_ticket_id: string }
        Returns: Json
      }
      get_ticket_trends: {
        Args: { p_dias?: number; p_unidade_filter?: string; p_user_id?: string }
        Returns: {
          data: string
          tempo_medio_resolucao: number
          tickets_resolvidos: number
          tickets_sla_ok: number
          total_tickets: number
        }[]
      }
      get_unit_metrics: {
        Args:
          | {
              p_equipe_filter?: string
              p_periodo_dias?: number
              p_user_id?: string
            }
          | { p_periodo_dias?: number; p_user_id?: string }
        Returns: {
          percentual_sla: number
          tempo_medio_resolucao: number
          tickets_abertos: number
          tickets_crise: number
          tickets_resolvidos: number
          tickets_sucesso: number
          total_tickets: number
          unidade_id: string
          unidade_nome: string
        }[]
      }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          permission: Database["public"]["Enums"]["app_permission"]
        }[]
      }
      get_user_role: {
        Args: { user_id?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      group_similar_tickets_to_crisis: {
        Args: { p_crisis_id: string }
        Returns: number
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_active_member_of_equipe: {
        Args: { _equipe_id: string; _user_id: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      log_sla_action: {
        Args: { p_action: string; p_details?: Json; p_ticket_id: string }
        Returns: string
      }
      log_system_action: {
        Args: {
          p_acao_realizada: string
          p_canal?: Database["public"]["Enums"]["log_canal"]
          p_dados_anteriores?: Json
          p_dados_novos?: Json
          p_entidade_afetada: string
          p_entidade_id: string
          p_ia_modelo?: string
          p_navegador_agente?: string
          p_origem_ip?: string
          p_prompt_entrada?: string
          p_resposta_gerada?: string
          p_tipo_log: Database["public"]["Enums"]["log_tipo"]
          p_usuario_responsavel?: string
        }
        Returns: string
      }
      log_view_access: {
        Args: {
          _ip_address?: unknown
          _resource_id?: string
          _resource_type: string
          _user_agent?: string
        }
        Returns: undefined
      }
      mark_expired_documents: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      match_documentos: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          categoria: string
          conteudo: Json
          id: string
          similaridade: number
          titulo: string
          versao: number
        }[]
      }
      match_documentos_hibrido: {
        Args: {
          alpha?: number
          match_count?: number
          query_embedding: string
          query_text: string
        }
        Returns: {
          conteudo: Json
          id: string
          similarity_score: number
          titulo: string
        }[]
      }
      match_documentos_semantico: {
        Args: {
          categoria_filtro?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
          query_text?: string
          require_category_match?: boolean
        }
        Returns: {
          categoria: string
          conteudo: Json
          criado_em: string
          criado_por: string
          ia_modelo: string
          id: string
          profiles: Json
          similarity: number
          tags: string[]
          titulo: string
        }[]
      }
      monitor_unconfirmed_users: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      next_ticket_code: {
        Args: { p_unidade_id: string }
        Returns: string
      }
      process_overdue_slas: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      process_sla_half_warnings: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      refresh_user_permissions: {
        Args: { p_user_id: string }
        Returns: Json
      }
      regenerate_single_document_embedding: {
        Args: { doc_id: string }
        Returns: undefined
      }
      reject_internal_access: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: undefined
      }
      remove_user_completely: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      resolve_crise_close_tickets: {
        Args: {
          p_by?: string
          p_crise_id: string
          p_mensagem?: string
          p_status_ticket?: Database["public"]["Enums"]["ticket_status"]
        }
        Returns: undefined
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      unlink_ticket_from_crisis: {
        Args: { p_by?: string; p_crise_id: string; p_ticket_id: string }
        Returns: undefined
      }
      update_crise_status: {
        Args: {
          p_by?: string
          p_crise_id: string
          p_mensagem?: string
          p_status: Database["public"]["Enums"]["crise_status"]
        }
        Returns: undefined
      }
      user_can_view_unidade: {
        Args: { u_id: string }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vincular_tickets_existentes_a_crise: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      vincular_tickets_similares_a_crise: {
        Args: {
          p_created_since?: string
          p_crise_id: string
          p_equipe_id: string
          p_similar_terms: string[]
        }
        Returns: number
      }
      vincular_tickets_similares_manual: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      ai_interaction_kind: "suggestion" | "chat"
      ai_model_provider: "openai" | "lambda"
      app_permission:
        | "view_all_tickets"
        | "view_own_unit_tickets"
        | "view_team_tickets"
        | "respond_tickets"
        | "escalate_tickets"
        | "access_dashboards"
        | "manage_knowledge_base"
        | "validate_ai_content"
        | "configure_ai_models"
        | "view_audit_logs"
        | "export_reports"
        | "view_all_history"
        | "manage_crisis"
        | "supervise_units"
        | "validate_ai_responses"
      app_role:
        | "admin"
        | "supervisor"
        | "diretor"
        | "colaborador"
        | "juridico"
        | "diretoria"
        | "franqueado"
        | "gerente"
      article_estilo: "manual" | "diretriz"
      article_status:
        | "ativo"
        | "vencido"
        | "em_revisao"
        | "arquivado"
        | "substituido"
      article_type: "permanente" | "temporario"
      atendente_status:
        | "ativo"
        | "pausa"
        | "almoco"
        | "indisponivel"
        | "inativo"
      atendente_tipo: "concierge" | "dfcom"
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
      crise_status:
        | "aberto"
        | "investigando"
        | "comunicado"
        | "mitigado"
        | "resolvido"
        | "encerrado"
        | "reaberto"
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
      ticket_prioridade: "baixo" | "medio" | "alto" | "imediato" | "crise"
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
      app_permission: [
        "view_all_tickets",
        "view_own_unit_tickets",
        "view_team_tickets",
        "respond_tickets",
        "escalate_tickets",
        "access_dashboards",
        "manage_knowledge_base",
        "validate_ai_content",
        "configure_ai_models",
        "view_audit_logs",
        "export_reports",
        "view_all_history",
        "manage_crisis",
        "supervise_units",
        "validate_ai_responses",
      ],
      app_role: [
        "admin",
        "supervisor",
        "diretor",
        "colaborador",
        "juridico",
        "diretoria",
        "franqueado",
        "gerente",
      ],
      article_estilo: ["manual", "diretriz"],
      article_status: [
        "ativo",
        "vencido",
        "em_revisao",
        "arquivado",
        "substituido",
      ],
      article_type: ["permanente", "temporario"],
      atendente_status: ["ativo", "pausa", "almoco", "indisponivel", "inativo"],
      atendente_tipo: ["concierge", "dfcom"],
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
      crise_status: [
        "aberto",
        "investigando",
        "comunicado",
        "mitigado",
        "resolvido",
        "encerrado",
        "reaberto",
      ],
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
      ticket_prioridade: ["baixo", "medio", "alto", "imediato", "crise"],
      ticket_sla_status: ["dentro_prazo", "alerta", "vencido"],
      ticket_status: ["aberto", "em_atendimento", "escalonado", "concluido"],
    },
  },
} as const
