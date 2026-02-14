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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          deleted_at: string | null
          end_date_time: string
          id: string
          is_demo: boolean | null
          linked_task_id: string | null
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
          deleted_at?: string | null
          end_date_time: string
          id?: string
          is_demo?: boolean | null
          linked_task_id?: string | null
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
          deleted_at?: string | null
          end_date_time?: string
          id?: string
          is_demo?: boolean | null
          linked_task_id?: string | null
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
      copilot_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          tool_args: Json | null
          tool_name: string | null
          tool_result: Json | null
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_threads: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      copilot_tool_audit: {
        Row: {
          created_at: string
          created_entities: Json | null
          error: string | null
          id: string
          outcome: string
          thread_id: string | null
          tool_args: Json
          tool_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_entities?: Json | null
          error?: string | null
          id?: string
          outcome: string
          thread_id?: string | null
          tool_args?: Json
          tool_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_entities?: Json | null
          error?: string | null
          id?: string
          outcome?: string
          thread_id?: string | null
          tool_args?: Json
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_tool_audit_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      habit_logs: {
        Row: {
          count: number | null
          created_at: string | null
          habit_id: string
          id: string
          logged_on: string
          user_id: string
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          habit_id: string
          id?: string
          logged_on: string
          user_id: string
        }
        Update: {
          count?: number | null
          created_at?: string | null
          habit_id?: string
          id?: string
          logged_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string
          deleted_at: string | null
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
          active?: boolean | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
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
          active?: boolean | null
          category?: string | null
          created_at?: string
          deleted_at?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          route: string | null
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
          route?: string | null
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
          route?: string | null
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
      scheduler_state: {
        Row: {
          last_automation_run: string | null
          last_notification_run: string | null
          user_id: string
        }
        Insert: {
          last_automation_run?: string | null
          last_notification_run?: string | null
          user_id: string
        }
        Update: {
          last_automation_run?: string | null
          last_notification_run?: string | null
          user_id?: string
        }
        Relationships: []
      }
      search_index: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          search_text: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          search_text?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          search_text?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          deleted_at: string | null
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
          source: string | null
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
          deleted_at?: string | null
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
          source?: string | null
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
          deleted_at?: string | null
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
          source?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      search_entities: {
        Args: {
          p_limit?: number
          p_query: string
          p_types?: string[]
          p_user_id: string
        }
        Returns: {
          entity_id: string
          entity_type: string
          metadata: Json
          score: number
          snippet: string
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
