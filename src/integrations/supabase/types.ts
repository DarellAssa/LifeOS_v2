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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      automation_rules: {
        Row: {
          actions: Json | null
          conditions: Json | null
          created_at: string
          enabled: boolean | null
          id: string
          is_demo: boolean | null
          last_run_at: string | null
          name: string
          throttle: Json | null
          trigger: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          is_demo?: boolean | null
          last_run_at?: string | null
          name: string
          throttle?: Json | null
          trigger: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string
          enabled?: boolean | null
          id?: string
          is_demo?: boolean | null
          last_run_at?: string | null
          name?: string
          throttle?: Json | null
          trigger?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_run_logs: {
        Row: {
          created_at: string
          created_entity_refs: Json | null
          id: string
          ran_at: string
          reason: string | null
          rule_id: string
          status: string
          undo_token: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_entity_refs?: Json | null
          id?: string
          ran_at: string
          reason?: string | null
          rule_id: string
          status?: string
          undo_token?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_entity_refs?: Json | null
          id?: string
          ran_at?: string
          reason?: string | null
          rule_id?: string
          status?: string
          undo_token?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          category: string | null
          created_at: string
          end_date_time: string
          id: string
          is_demo: boolean | null
          location: string | null
          notes: string | null
          recurring: Json | null
          start_date_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          end_date_time: string
          id?: string
          is_demo?: boolean | null
          location?: string | null
          notes?: string | null
          recurring?: Json | null
          start_date_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          end_date_time?: string
          id?: string
          is_demo?: boolean | null
          location?: string | null
          notes?: string | null
          recurring?: Json | null
          start_date_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          blockers: string | null
          created_at: string
          date: string
          energy: number
          focus: number
          gratitude: string | null
          highlights: string | null
          id: string
          is_demo: boolean | null
          mood: number
          updated_at: string
          user_id: string
        }
        Insert: {
          blockers?: string | null
          created_at?: string
          date: string
          energy: number
          focus: number
          gratitude?: string | null
          highlights?: string | null
          id?: string
          is_demo?: boolean | null
          mood: number
          updated_at?: string
          user_id: string
        }
        Update: {
          blockers?: string | null
          created_at?: string
          date?: string
          energy?: number
          focus?: number
          gratitude?: string | null
          highlights?: string | null
          id?: string
          is_demo?: boolean | null
          mood?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      focus_blocks: {
        Row: {
          created_at: string
          end_date_time: string
          id: string
          is_demo: boolean | null
          linked_goal_id: string | null
          linked_task_id: string | null
          notes: string | null
          start_date_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date_time: string
          id?: string
          is_demo?: boolean | null
          linked_goal_id?: string | null
          linked_task_id?: string | null
          notes?: string | null
          start_date_time: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date_time?: string
          id?: string
          is_demo?: boolean | null
          linked_goal_id?: string | null
          linked_task_id?: string | null
          notes?: string | null
          start_date_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_demo: boolean | null
          linked_task_ids: Json | null
          milestones: Json | null
          progress_type: string
          progress_value: number
          start_date: string
          status: string
          target_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean | null
          linked_task_ids?: Json | null
          milestones?: Json | null
          progress_type?: string
          progress_value?: number
          start_date: string
          status?: string
          target_date: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean | null
          linked_task_ids?: Json | null
          milestones?: Json | null
          progress_type?: string
          progress_value?: number
          start_date?: string
          status?: string
          target_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          frequency: string
          id: string
          is_demo: boolean | null
          logs: Json | null
          status: string
          target_count_per_period: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          is_demo?: boolean | null
          logs?: Json | null
          status?: string
          target_count_per_period?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          frequency?: string
          id?: string
          is_demo?: boolean | null
          logs?: Json | null
          status?: string
          target_count_per_period?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          content: string
          conversion: Json | null
          created_at: string
          detected: Json | null
          id: string
          is_demo: boolean | null
          pinned: boolean | null
          source: string | null
          status: string | null
          tags: Json | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          conversion?: Json | null
          created_at?: string
          detected?: Json | null
          id?: string
          is_demo?: boolean | null
          pinned?: boolean | null
          source?: string | null
          status?: string | null
          tags?: Json | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          conversion?: Json | null
          created_at?: string
          detected?: Json | null
          id?: string
          is_demo?: boolean | null
          pinned?: boolean | null
          source?: string | null
          status?: string | null
          tags?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      life_score_snapshots: {
        Row: {
          breakdown: Json
          created_at: string
          date: string
          id: string
          is_demo: boolean | null
          score: number
          user_id: string
        }
        Insert: {
          breakdown: Json
          created_at?: string
          date: string
          id?: string
          is_demo?: boolean | null
          score: number
          user_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          date?: string
          id?: string
          is_demo?: boolean | null
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_demo: boolean | null
          pinned: boolean | null
          tags: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_demo?: boolean | null
          pinned?: boolean | null
          tags?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_demo?: boolean | null
          pinned?: boolean | null
          tags?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          daily_digest_time: string | null
          due_soon_days: number | null
          enabled_types: Json
          event_upcoming_minutes: number | null
          id: string
          max_notifications_per_day: number | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_digest_time?: string | null
          due_soon_days?: number | null
          enabled_types?: Json
          event_upcoming_minutes?: number | null
          id: string
          max_notifications_per_day?: number | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_digest_time?: string | null
          due_soon_days?: number | null
          enabled_types?: Json
          event_upcoming_minutes?: number | null
          id?: string
          max_notifications_per_day?: number | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action: Json | null
          created_at: string
          dismissed_at: string | null
          entity_ref: Json | null
          id: string
          is_demo: boolean | null
          message: string
          read_at: string | null
          severity: string
          snoozed_until: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action?: Json | null
          created_at?: string
          dismissed_at?: string | null
          entity_ref?: Json | null
          id?: string
          is_demo?: boolean | null
          message: string
          read_at?: string | null
          severity?: string
          snoozed_until?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action?: Json | null
          created_at?: string
          dismissed_at?: string | null
          entity_ref?: Json | null
          id?: string
          is_demo?: boolean | null
          message?: string
          read_at?: string | null
          severity?: string
          snoozed_until?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pinned_focus: {
        Row: {
          date: string
          id: string
          task_ids: Json | null
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          task_ids?: Json | null
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          task_ids?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          demo_mode: boolean | null
          email: string | null
          first_name: string | null
          focus_areas: Json | null
          id: string
          modules: Json | null
          onboarding_completed: boolean | null
          operating_style: string | null
          preferences: Json | null
          timezone: string | null
          updated_at: string
          week_start: string | null
        }
        Insert: {
          created_at?: string
          demo_mode?: boolean | null
          email?: string | null
          first_name?: string | null
          focus_areas?: Json | null
          id: string
          modules?: Json | null
          onboarding_completed?: boolean | null
          operating_style?: string | null
          preferences?: Json | null
          timezone?: string | null
          updated_at?: string
          week_start?: string | null
        }
        Update: {
          created_at?: string
          demo_mode?: boolean | null
          email?: string | null
          first_name?: string | null
          focus_areas?: Json | null
          id?: string
          modules?: Json | null
          onboarding_completed?: boolean | null
          operating_style?: string | null
          preferences?: Json | null
          timezone?: string | null
          updated_at?: string
          week_start?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_minutes: number | null
          goal_id: string | null
          id: string
          is_demo: boolean | null
          priority: string
          project: string | null
          recurring: Json | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: string
          subtasks: Json | null
          tags: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          is_demo?: boolean | null
          priority?: string
          project?: string | null
          recurring?: Json | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          subtasks?: Json | null
          tags?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_minutes?: number | null
          goal_id?: string | null
          id?: string
          is_demo?: boolean | null
          priority?: string
          project?: string | null
          recurring?: Json | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: string
          subtasks?: Json | null
          tags?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          category: string | null
          created_at: string
          default_schedule: Json | null
          description: string | null
          id: string
          is_built_in: boolean | null
          is_demo: boolean | null
          items: Json | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_schedule?: Json | null
          description?: string | null
          id?: string
          is_built_in?: boolean | null
          is_demo?: boolean | null
          items?: Json | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_schedule?: Json | null
          description?: string | null
          id?: string
          is_built_in?: boolean | null
          is_demo?: boolean | null
          items?: Json | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_plans: {
        Row: {
          committed_task_ids: Json | null
          created_at: string
          id: string
          is_demo: boolean | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          committed_task_ids?: Json | null
          created_at?: string
          id?: string
          is_demo?: boolean | null
          user_id: string
          week_start_date: string
        }
        Update: {
          committed_task_ids?: Json | null
          created_at?: string
          id?: string
          is_demo?: boolean | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
