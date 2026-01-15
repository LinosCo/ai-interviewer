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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_models: {
        Row: {
          capabilities: Json | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          name: string
          provider: string
        }
        Insert: {
          capabilities?: Json | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
          provider: string
        }
        Update: {
          capabilities?: Json | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          provider?: string
        }
        Relationships: []
      }
      analysis_queries: {
        Row: {
          brand_name: string | null
          category: string | null
          created_at: string
          id: string
          industry: string
          market: string
          product_name: string | null
          results: Json | null
          session_id: string | null
          url: string
          user_email: string | null
          user_id: string | null
          visibility_score: number | null
        }
        Insert: {
          brand_name?: string | null
          category?: string | null
          created_at?: string
          id?: string
          industry: string
          market: string
          product_name?: string | null
          results?: Json | null
          session_id?: string | null
          url: string
          user_email?: string | null
          user_id?: string | null
          visibility_score?: number | null
        }
        Update: {
          brand_name?: string | null
          category?: string | null
          created_at?: string
          id?: string
          industry?: string
          market?: string
          product_name?: string | null
          results?: Json | null
          session_id?: string | null
          url?: string
          user_email?: string | null
          user_id?: string | null
          visibility_score?: number | null
        }
        Relationships: []
      }
      analysis_runs: {
        Row: {
          brand_id: string
          brand_mentioned: boolean | null
          brand_position: number | null
          competitors_mentioned: string[] | null
          completed_at: string | null
          confidence_score: number | null
          cost_usd: number | null
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          model_id: string
          project_id: string
          prompt_id: string
          raw_response: string | null
          sentiment: string | null
          status: string | null
          tokens_used: number | null
        }
        Insert: {
          brand_id: string
          brand_mentioned?: boolean | null
          brand_position?: number | null
          competitors_mentioned?: string[] | null
          completed_at?: string | null
          confidence_score?: number | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          model_id: string
          project_id: string
          prompt_id: string
          raw_response?: string | null
          sentiment?: string | null
          status?: string | null
          tokens_used?: number | null
        }
        Update: {
          brand_id?: string
          brand_mentioned?: boolean | null
          brand_position?: number | null
          competitors_mentioned?: string[] | null
          completed_at?: string | null
          confidence_score?: number | null
          cost_usd?: number | null
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          model_id?: string
          project_id?: string
          prompt_id?: string
          raw_response?: string | null
          sentiment?: string | null
          status?: string | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_runs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_tags: {
        Row: {
          brand_id: string
          tag_id: string
        }
        Insert: {
          brand_id: string
          tag_id: string
        }
        Update: {
          brand_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_tags_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          aliases: string[] | null
          competitors: string[] | null
          created_at: string
          description: string | null
          id: string
          industry: string | null
          logo_url: string | null
          market: string | null
          metadata: Json | null
          name: string
          project_id: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          aliases?: string[] | null
          competitors?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          market?: string | null
          metadata?: Json | null
          name: string
          project_id: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          aliases?: string[] | null
          competitors?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          market?: string | null
          metadata?: Json | null
          name?: string
          project_id?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      prompt_tags: {
        Row: {
          prompt_id: string
          tag_id: string
        }
        Insert: {
          prompt_id: string
          tag_id: string
        }
        Update: {
          prompt_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_tags_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          brand_id: string | null
          category: string | null
          created_at: string
          id: string
          intent: string | null
          is_active: boolean | null
          language: string | null
          metadata: Json | null
          preferred_model_id: string | null
          project_id: string
          status: string
          text: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          is_active?: boolean | null
          language?: string | null
          metadata?: Json | null
          preferred_model_id?: string | null
          project_id: string
          status?: string
          text: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          is_active?: boolean | null
          language?: string | null
          metadata?: Json | null
          preferred_model_id?: string | null
          project_id?: string
          status?: string
          text?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_preferred_model_id_fkey"
            columns: ["preferred_model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      query_packs: {
        Row: {
          id: string
          payment_status: string
          price_paid: number
          purchased_at: string
          queries_purchased: number
          queries_remaining: number
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          payment_status?: string
          price_paid: number
          purchased_at?: string
          queries_purchased?: number
          queries_remaining?: number
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          payment_status?: string
          price_paid?: number
          purchased_at?: string
          queries_purchased?: number
          queries_remaining?: number
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      source_usages: {
        Row: {
          brand_id: string
          context: string | null
          created_at: string
          id: string
          is_competitor_source: boolean | null
          mention_count: number | null
          model_id: string
          run_id: string
          source_id: string
        }
        Insert: {
          brand_id: string
          context?: string | null
          created_at?: string
          id?: string
          is_competitor_source?: boolean | null
          mention_count?: number | null
          model_id: string
          run_id: string
          source_id: string
        }
        Update: {
          brand_id?: string
          context?: string | null
          created_at?: string
          id?: string
          is_competitor_source?: boolean | null
          mention_count?: number | null
          model_id?: string
          run_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_usages_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_usages_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_usages_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_usages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          category: string | null
          domain: string
          first_seen_at: string
          full_url: string | null
          id: string
          metadata: Json | null
          name: string | null
          trust_score: number | null
        }
        Insert: {
          category?: string | null
          domain: string
          first_seen_at?: string
          full_url?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          trust_score?: number | null
        }
        Update: {
          category?: string | null
          domain?: string
          first_seen_at?: string
          full_url?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          trust_score?: number | null
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "user_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          settings: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          settings?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          settings?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visibility_metrics: {
        Row: {
          avg_position: number | null
          brand_id: string
          created_at: string
          id: string
          mention_rate: number | null
          metadata: Json | null
          model_id: string
          period_end: string
          period_start: string
          sentiment_score: number | null
          successful_runs: number | null
          top_competitors: Json | null
          total_runs: number | null
          updated_at: string
          visibility_score: number | null
        }
        Insert: {
          avg_position?: number | null
          brand_id: string
          created_at?: string
          id?: string
          mention_rate?: number | null
          metadata?: Json | null
          model_id: string
          period_end: string
          period_start: string
          sentiment_score?: number | null
          successful_runs?: number | null
          top_competitors?: Json | null
          total_runs?: number | null
          updated_at?: string
          visibility_score?: number | null
        }
        Update: {
          avg_position?: number | null
          brand_id?: string
          created_at?: string
          id?: string
          mention_rate?: number | null
          metadata?: Json | null
          model_id?: string
          period_end?: string
          period_start?: string
          sentiment_score?: number | null
          successful_runs?: number | null
          top_competitors?: Json | null
          total_runs?: number | null
          updated_at?: string
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visibility_metrics_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_metrics_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "ai_models"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      associate_session_analyses: {
        Args: { _session_id: string; _user_id: string }
        Returns: undefined
      }
      decrement_query_pack: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      get_user_available_queries: {
        Args: { user_id_param: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
