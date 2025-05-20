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
      admins: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
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
      connected_devices: {
        Row: {
          browser: string | null
          created_at: string
          device_id: string
          device_name: string | null
          id: string
          ip_address: string | null
          last_active: string
          location: string | null
          os: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_id: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          last_active?: string
          location?: string | null
          os?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_id?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          last_active?: string
          location?: string | null
          os?: string | null
          user_id?: string
        }
        Relationships: []
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
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "user_conversations"
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
      features: {
        Row: {
          created_at: string
          description: string
          feature_key: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          feature_key: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          feature_key?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          created_at: string | null
          created_by: string | null
          details: Json | null
          id: string
          operation: string
          result: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          details?: Json | null
          id?: string
          operation: string
          result: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          details?: Json | null
          id?: string
          operation?: string
          result?: string
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
          encrypted_key: string | null
          expires_at: string | null
          file_size: number | null
          id: string
          is_encrypted: boolean | null
          iv: string | null
          read: boolean | null
          sender_id: string | null
          storage_path: string | null
          thumbnail: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          content_encrypted?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          encrypted_content?: string | null
          encrypted_key?: string | null
          expires_at?: string | null
          file_size?: number | null
          id?: string
          is_encrypted?: boolean | null
          iv?: string | null
          read?: boolean | null
          sender_id?: string | null
          storage_path?: string | null
          thumbnail?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          content_encrypted?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          encrypted_content?: string | null
          encrypted_key?: string | null
          expires_at?: string | null
          file_size?: number | null
          id?: string
          is_encrypted?: boolean | null
          iv?: string | null
          read?: boolean | null
          sender_id?: string | null
          storage_path?: string | null
          thumbnail?: string | null
          type?: string | null
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
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "user_conversations"
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
      notification_channels: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          requires_subscription: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          requires_subscription?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          requires_subscription?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          body: string | null
          channel: string
          created_at: string | null
          delivered_at: string | null
          error_msg: string | null
          id: string
          is_encrypted: boolean | null
          is_read: boolean | null
          meta: Json | null
          notification_type: string
          payload: Json | null
          priority: Database["public"]["Enums"]["notification_priority"] | null
          status: Database["public"]["Enums"]["notification_status"] | null
          title: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          channel: string
          created_at?: string | null
          delivered_at?: string | null
          error_msg?: string | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean | null
          meta?: Json | null
          notification_type: string
          payload?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"] | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string | null
          delivered_at?: string | null
          error_msg?: string | null
          id?: string
          is_encrypted?: boolean | null
          is_read?: boolean | null
          meta?: Json | null
          notification_type?: string
          payload?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"] | null
          status?: Database["public"]["Enums"]["notification_status"] | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          channel_id: string
          created_at: string | null
          frequency:
            | Database["public"]["Enums"]["notification_frequency"]
            | null
          id: string
          is_enabled: boolean | null
          notify_types: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          frequency?:
            | Database["public"]["Enums"]["notification_frequency"]
            | null
          id?: string
          is_enabled?: boolean | null
          notify_types?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          frequency?:
            | Database["public"]["Enums"]["notification_frequency"]
            | null
          id?: string
          is_enabled?: boolean | null
          notify_types?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "notification_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          invoice_pdf_url: string | null
          invoice_url: string | null
          metadata: Json | null
          payment_method: string
          reference_period: string | null
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          payment_method: string
          reference_period?: string | null
          status: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_url?: string | null
          metadata?: Json | null
          payment_method?: string
          reference_period?: string | null
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          expiry_date: string | null
          id: string
          is_default: boolean
          last_four_digits: string | null
          metadata: Json | null
          payment_method_id: string
          payment_type: Database["public"]["Enums"]["payment_type_enum"]
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_default?: boolean
          last_four_digits?: string | null
          metadata?: Json | null
          payment_method_id: string
          payment_type: Database["public"]["Enums"]["payment_type_enum"]
          updated_at?: string
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          is_default?: boolean
          last_four_digits?: string | null
          metadata?: Json | null
          payment_method_id?: string
          payment_type?: Database["public"]["Enums"]["payment_type_enum"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          created_at: string
          feature_key: string
          plan_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          plan_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["feature_key"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          id: string
          name: string
          stripe_monthly_price_id: string | null
          stripe_price_id: string | null
          stripe_yearly_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          stripe_monthly_price_id?: string | null
          stripe_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          stripe_monthly_price_id?: string | null
          stripe_price_id?: string | null
          stripe_yearly_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          plan_name: string
          price_annual: number
          price_monthly: number
        }
        Insert: {
          plan_name: string
          price_annual: number
          price_monthly: number
        }
        Update: {
          plan_name?: string
          price_annual?: number
          price_monthly?: number
        }
        Relationships: []
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
      scheduled_reminders: {
        Row: {
          body: string | null
          channels: Json | null
          created_at: string | null
          id: string
          max_retries: number | null
          payload: Json | null
          priority: Database["public"]["Enums"]["notification_priority"] | null
          retry_count: number | null
          run_at: string
          status: Database["public"]["Enums"]["notification_status"] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          channels?: Json | null
          created_at?: string | null
          id?: string
          max_retries?: number | null
          payload?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"] | null
          retry_count?: number | null
          run_at: string
          status?: Database["public"]["Enums"]["notification_status"] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          channels?: Json | null
          created_at?: string | null
          id?: string
          max_retries?: number | null
          payload?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"] | null
          retry_count?: number | null
          run_at?: string
          status?: Database["public"]["Enums"]["notification_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
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
      stripe_events: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          processed_at: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id: string
          processed_at?: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          processed_at?: string
          type?: string
          updated_at?: string
          user_id?: string | null
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
      user_conversation_preferences: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string;
          is_muted: boolean;
          is_pinned: boolean;
          is_archived: boolean;
          is_deleted: boolean;
          messages_cleared_at: string | null;
          created_at: string;
          updated_at: string;
        }
        Insert: {
          user_id: string;
          conversation_id: string;
          is_muted?: boolean;
          is_pinned?: boolean;
          is_archived?: boolean;
          is_deleted?: boolean;
          messages_cleared_at?: string;
          created_at?: string;
          updated_at?: string;
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_deleted?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          messages_cleared_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_conversation_preferences_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_conversation_preferences_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "user_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_features: {
        Row: {
          created_at: string
          feature_key: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          source?: string
          user_id?: string
        }
        Relationships: []
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
      user_plans: {
        Row: {
          created_at: string
          end_date: string | null
          plan_id: string
          start_date: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          plan_id: string
          start_date?: string
          status: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          plan_id?: string
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
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
      notification_metrics: {
        Row: {
          channel: string | null
          failed_count: number | null
          hour: string | null
          notification_type: string | null
          priority: Database["public"]["Enums"]["notification_priority"] | null
          sent_count: number | null
          status: Database["public"]["Enums"]["notification_status"] | null
          total: number | null
        }
        Relationships: []
      }
      user_conversations: {
        Row: {
          created_at: string | null
          id: string | null
          is_archived: boolean | null
          is_deleted: boolean | null
          is_muted: boolean | null
          is_pinned: boolean | null
          last_message: string | null
          last_message_time: string | null
          messages_cleared_at: string | null
          name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_payment_record: {
        Args: {
          p_user_id: string
          p_transaction_id: string
          p_amount: number
          p_currency: string
          p_status: string
          p_payment_method: string
          p_description?: string
          p_invoice_url?: string
          p_invoice_pdf_url?: string
          p_reference_period?: string
          p_metadata?: Json
        }
        Returns: string
      }
      check_conversation_access: {
        Args: { conversation_id: string }
        Returns: boolean
      }
      check_meeting_access: {
        Args: { meeting_id: string }
        Returns: boolean
      }
      get_other_users_meetings: {
        Args: { user_id: string; min_date: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          start_time: string
          team_id: string | null
          title: string
          updated_at: string | null
        }[]
      }
      get_user_notification_prefs: {
        Args: { p_user_id: string }
        Returns: {
          channel_id: string
          channel_name: string
          frequency: Database["public"]["Enums"]["notification_frequency"]
          notify_types: Json
          is_enabled: boolean
        }[]
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
      is_message_visible_to_user: {
        Args: { p_message_id: string; p_user_id?: string }
        Returns: boolean
      }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: number
      }
      mark_conversation_deleted: {
        Args: { p_conversation_id: string; p_user_id?: string }
        Returns: boolean
      }
      mark_messages_cleared: {
        Args: { p_conversation_id: string; p_user_id?: string }
        Returns: boolean
      }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      schedule_reminder: {
        Args: {
          p_user_id: string
          p_title: string
          p_body: string
          p_payload: Json
          p_run_at: string
          p_channels?: Json
          p_priority?: Database["public"]["Enums"]["notification_priority"]
        }
        Returns: string
      }
      set_conversation_archived: {
        Args: {
          p_conversation_id: string
          p_is_archived: boolean
          p_user_id?: string
        }
        Returns: boolean
      }
      set_conversation_muted: {
        Args: {
          p_conversation_id: string
          p_is_muted: boolean
          p_user_id?: string
        }
        Returns: boolean
      }
      set_conversation_pinned: {
        Args: {
          p_conversation_id: string
          p_is_pinned: boolean
          p_user_id?: string
        }
        Returns: boolean
      }
      set_default_payment_method: {
        Args: { p_user_id: string; p_payment_method_id: string }
        Returns: boolean
      }
      update_payment_status: {
        Args: { p_transaction_id: string; p_status: string }
        Returns: boolean
      }
      upsert_notification_pref: {
        Args: { p_user_id: string; p_channel_id: string; p_settings: Json }
        Returns: string
      }
    }
    Enums: {
      feature_key_enum:
        | "prospecting_ai"
        | "bots"
        | "crm_sync"
        | "analytics_plus"
        | "priority_support"
        | "mensagens_ilimitadas"
        | "chamadas_audio_video"
        | "grupos"
        | "marketplace"
        | "ia_prospeccao_avancada"
        | "estatisticas_uso"
        | "automacao_marketing"
        | "bots_personalizados"
        | "integracao_crm"
        | "apis_exclusivas"
        | "sla_dedicado"
        | "suporte_24_7"
        | "onboarding_personalizado"
        | "gerente_conta_dedicado"
      notification_frequency: "instant" | "daily" | "weekly"
      notification_priority: "low" | "normal" | "high" | "critical"
      notification_status: "pending" | "sent" | "failed"
      payment_type_enum: "card" | "pix" | "bank_transfer" | "boleto"
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
    Enums: {
      feature_key_enum: [
        "prospecting_ai",
        "bots",
        "crm_sync",
        "analytics_plus",
        "priority_support",
        "mensagens_ilimitadas",
        "chamadas_audio_video",
        "grupos",
        "marketplace",
        "ia_prospeccao_avancada",
        "estatisticas_uso",
        "automacao_marketing",
        "bots_personalizados",
        "integracao_crm",
        "apis_exclusivas",
        "sla_dedicado",
        "suporte_24_7",
        "onboarding_personalizado",
        "gerente_conta_dedicado",
      ],
      notification_frequency: ["instant", "daily", "weekly"],
      notification_priority: ["low", "normal", "high", "critical"],
      notification_status: ["pending", "sent", "failed"],
      payment_type_enum: ["card", "pix", "bank_transfer", "boleto"],
    },
  },
} as const
