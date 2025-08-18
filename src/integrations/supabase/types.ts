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
        ]
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
        Relationships: []
      }
      tickets: {
        Row: {
          arquivos: Json | null
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
          franqueado_id: string | null
          id: string
          log_ia: Json | null
          prioridade: Database["public"]["Enums"]["ticket_prioridade"]
          reaberto_count: number
          resolvido_em: string | null
          resposta_resolucao: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          status_sla: Database["public"]["Enums"]["ticket_sla_status"]
          subcategoria: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          arquivos?: Json | null
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
          franqueado_id?: string | null
          id?: string
          log_ia?: Json | null
          prioridade?: Database["public"]["Enums"]["ticket_prioridade"]
          reaberto_count?: number
          resolvido_em?: string | null
          resposta_resolucao?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_sla?: Database["public"]["Enums"]["ticket_sla_status"]
          subcategoria?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          arquivos?: Json | null
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
          franqueado_id?: string | null
          id?: string
          log_ia?: Json | null
          prioridade?: Database["public"]["Enums"]["ticket_prioridade"]
          reaberto_count?: number
          resolvido_em?: string | null
          resposta_resolucao?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_sla?: Database["public"]["Enums"]["ticket_sla_status"]
          subcategoria?: string | null
          unidade_id?: string
          updated_at?: string
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
        Relationships: []
      }
    }
    Views: {
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
        Relationships: []
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
      app_role: "admin" | "gerente" | "diretor" | "colaborador"
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
      app_role: ["admin", "gerente", "diretor", "colaborador"],
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
