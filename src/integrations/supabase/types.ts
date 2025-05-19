export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      connected_devices: {
        Row: {
          id: string
          user_id: string
          device_id: string
          device_name: string
          os: string
          browser: string
          location: string
          ip_address: string
          last_active: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_id: string
          device_name: string
          os: string
          browser: string
          location: string
          ip_address: string
          last_active?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_id?: string
          device_name?: string
          os?: string
          browser?: string
          location?: string
          ip_address?: string
          last_active?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connected_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      channel_members: {
        Row: {
          channel_id: string | null
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          about: string | null
          cnpj: string | null
          created_at: string | null
          id: string
          industry: string | null
          name: string
          size: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          about?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          name: string
          size?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          about?: string | null
          cnpj?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          name?: string
          size?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      company_matches: {
        Row: {
          company_a_id: string | null
          company_b_id: string | null
          compatibility_score: number | null
          created_at: string | null
          id: string
          match_reason: string | null
        }
        Insert: {
          company_a_id?: string | null
          company_b_id?: string | null
          compatibility_score?: number | null
          created_at?: string | null
          id?: string
          match_reason?: string | null
        }
        Update: {
          company_a_id?: string | null
          company_b_id?: string | null
          compatibility_score?: number | null
          created_at?: string | null
          id?: string
          match_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_matches_company_a_id_fkey"
            columns: ["company_a_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_matches_company_b_id_fkey"
            columns: ["company_b_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message: string | null
          last_message_time: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_time?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      digital_identities: {
        Row: {
          active: boolean | null
          created_at: string | null
          did: string
          id: string
          private_key_encrypted: string
          public_key: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          did: string
          id?: string
          private_key_encrypted: string
          public_key: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          did?: string
          id?: string
          private_key_encrypted?: string
          public_key?: string
          user_id?: string
        }
        Relationships: []
      }
      meeting_participants: {
        Row: {
          created_at: string | null
          id: string
          meeting_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meeting_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meeting_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          start_time: string
          team_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          start_time: string
          team_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          start_time?: string
          team_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          content_encrypted: boolean | null
          conversation_id: string | null
          created_at: string | null
          encrypted_content: string | null
          id: string
          is_encrypted: boolean | null
          read: boolean | null
          sender_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          content_encrypted?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          encrypted_content?: string | null
          id?: string
          is_encrypted?: boolean | null
          read?: boolean | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_encrypted?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          encrypted_content?: string | null
          id?: string
          is_encrypted?: boolean | null
          read?: boolean | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string | null
          currency: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          seller_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          seller_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          seller_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          about: string | null
          avatar_url: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          industry: string | null
          last_name: string | null
          position: string | null
          updated_at: string | null
        }
        Insert: {
          about?: string | null
          avatar_url?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          industry?: string | null
          last_name?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Update: {
          about?: string | null
          avatar_url?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          industry?: string | null
          last_name?: string | null
          position?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      secure_documents: {
        Row: {
          blockchain_timestamp: string | null
          blockchain_tx_id: string | null
          blockchain_verified: boolean | null
          created_at: string | null
          encrypted_content: string
          hash: string | null
          id: string
          name: string
          public_key: string | null
          suspicious_level: number | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blockchain_timestamp?: string | null
          blockchain_tx_id?: string | null
          blockchain_verified?: boolean | null
          created_at?: string | null
          encrypted_content: string
          hash?: string | null
          id?: string
          name: string
          public_key?: string | null
          suspicious_level?: number | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blockchain_timestamp?: string | null
          blockchain_tx_id?: string | null
          blockchain_verified?: boolean | null
          created_at?: string | null
          encrypted_content?: string
          hash?: string | null
          id?: string
          name?: string
          public_key?: string | null
          suspicious_level?: number | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_kyc: {
        Row: {
          address: string | null
          birth_date: string | null
          created_at: string | null
          full_name: string | null
          id: string
          level: string | null
          nationality: string | null
          tax_id_hash: string | null
          updated_at: string | null
          user_id: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          level?: string | null
          nationality?: string | null
          tax_id_hash?: string | null
          updated_at?: string | null
          user_id: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          level?: string | null
          nationality?: string | null
          tax_id_hash?: string | null
          updated_at?: string | null
          user_id?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: []
      }
      user_kyc_documents: {
        Row: {
          created_at: string | null
          document_path: string | null
          document_type: string
          id: string
          status: string | null
          submitted_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_path?: string | null
          document_type: string
          id?: string
          status?: string | null
          submitted_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_path?: string | null
          document_type?: string
          id?: string
          status?: string | null
          submitted_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      user_public_keys: {
        Row: {
          created_at: string | null
          id: string
          key_id: string
          public_key: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key_id: string
          public_key: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key_id?: string
          public_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_security_settings: {
        Row: {
          block_threshold: number | null
          block_unknown_senders: boolean | null
          created_at: string | null
          disable_preview_links: boolean | null
          hide_ip_address: boolean | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          block_threshold?: number | null
          block_unknown_senders?: boolean | null
          created_at?: string | null
          disable_preview_links?: boolean | null
          hide_ip_address?: boolean | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          block_threshold?: number | null
          block_unknown_senders?: boolean | null
          created_at?: string | null
          disable_preview_links?: boolean | null
          hide_ip_address?: boolean | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verifiable_credentials: {
        Row: {
          claims: Json
          created_at: string | null
          credential_id: string
          expiration_date: string | null
          id: string
          issuance_date: string
          issuer_did: string
          issuer_name: string
          proof: string
          subject_did: string
          types: string
          user_id: string
        }
        Insert: {
          claims: Json
          created_at?: string | null
          credential_id: string
          expiration_date?: string | null
          id?: string
          issuance_date: string
          issuer_did: string
          issuer_name: string
          proof: string
          subject_did: string
          types: string
          user_id: string
        }
        Update: {
          claims?: Json
          created_at?: string | null
          credential_id?: string
          expiration_date?: string | null
          id?: string
          issuance_date?: string
          issuer_did?: string
          issuer_name?: string
          proof?: string
          subject_did?: string
          types?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_conversation_access: {
        Args: { conversation_id: string }
        Returns: boolean
      }
      check_meeting_access: {
        Args: { meeting_id: string }
        Returns: boolean
      }
      get_user_reputation: {
        Args: { p_user_id: string }
        Returns: {
          reputation_score: number
          is_verified: boolean
        }[]
      }
      is_known_contact: {
        Args: { p_user_id: string; p_contact_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
