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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_locations: {
        Row: {
          accuracy_meters: number | null
          agent_id: string
          agent_name: string
          id: string
          lat: number
          lng: number
          office_id: string
          updated_at: string
        }
        Insert: {
          accuracy_meters?: number | null
          agent_id: string
          agent_name?: string
          id?: string
          lat: number
          lng: number
          office_id: string
          updated_at?: string
        }
        Update: {
          accuracy_meters?: number | null
          agent_id?: string
          agent_name?: string
          id?: string
          lat?: number
          lng?: number
          office_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_locations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      border_crossings: {
        Row: {
          created_at: string
          daily_in: number
          daily_out: number
          id: string
          is_active: boolean
          lat: number
          lng: number
          name_ar: string
          nearest_office_id: string | null
          neighboring_country_ar: string | null
        }
        Insert: {
          created_at?: string
          daily_in?: number
          daily_out?: number
          id?: string
          is_active?: boolean
          lat: number
          lng: number
          name_ar: string
          nearest_office_id?: string | null
          neighboring_country_ar?: string | null
        }
        Update: {
          created_at?: string
          daily_in?: number
          daily_out?: number
          id?: string
          is_active?: boolean
          lat?: number
          lng?: number
          name_ar?: string
          nearest_office_id?: string | null
          neighboring_country_ar?: string | null
        }
        Relationships: []
      }
      daily_reports: {
        Row: {
          coordination_joint_ops: string | null
          coordination_sectors: string | null
          created_at: string
          deaths_action_taken: string | null
          deaths_count: number
          deaths_location_mgrs: string | null
          deployment_count: number
          deployment_formations: string | null
          deployment_locations: string | null
          events_coordinates: Json
          events_count: number
          events_details: string | null
          extra_fields: Json
          id: string
          incidents_count: number
          incidents_details: string | null
          is_late_submission: boolean
          mgrs_reference: string | null
          office_id: string
          other_notes: string | null
          procession_waypoints: Json
          processions_count: number
          processions_details: string | null
          report_date: string
          reporter_lat: number | null
          reporter_lng: number | null
          resources_details: string | null
          resources_distributed: number
          submitted_at: string
          submitted_by: string
          vehicles_count: number
          vehicles_details: string | null
          violations_area: string | null
          violations_count: number
          violations_details: string | null
          violations_time_detail: string | null
          visitors_in: number
          visitors_out: number
          visitors_routes: string | null
          visits_count: number
          visits_summary: string | null
        }
        Insert: {
          coordination_joint_ops?: string | null
          coordination_sectors?: string | null
          created_at?: string
          deaths_action_taken?: string | null
          deaths_count?: number
          deaths_location_mgrs?: string | null
          deployment_count?: number
          deployment_formations?: string | null
          deployment_locations?: string | null
          events_coordinates?: Json
          events_count?: number
          events_details?: string | null
          extra_fields?: Json
          id?: string
          incidents_count?: number
          incidents_details?: string | null
          is_late_submission?: boolean
          mgrs_reference?: string | null
          office_id: string
          other_notes?: string | null
          procession_waypoints?: Json
          processions_count?: number
          processions_details?: string | null
          report_date: string
          reporter_lat?: number | null
          reporter_lng?: number | null
          resources_details?: string | null
          resources_distributed?: number
          submitted_at?: string
          submitted_by: string
          vehicles_count?: number
          vehicles_details?: string | null
          violations_area?: string | null
          violations_count?: number
          violations_details?: string | null
          violations_time_detail?: string | null
          visitors_in?: number
          visitors_out?: number
          visitors_routes?: string | null
          visits_count?: number
          visits_summary?: string | null
        }
        Update: {
          coordination_joint_ops?: string | null
          coordination_sectors?: string | null
          created_at?: string
          deaths_action_taken?: string | null
          deaths_count?: number
          deaths_location_mgrs?: string | null
          deployment_count?: number
          deployment_formations?: string | null
          deployment_locations?: string | null
          events_coordinates?: Json
          events_count?: number
          events_details?: string | null
          extra_fields?: Json
          id?: string
          incidents_count?: number
          incidents_details?: string | null
          is_late_submission?: boolean
          mgrs_reference?: string | null
          office_id?: string
          other_notes?: string | null
          procession_waypoints?: Json
          processions_count?: number
          processions_details?: string | null
          report_date?: string
          reporter_lat?: number | null
          reporter_lng?: number | null
          resources_details?: string | null
          resources_distributed?: number
          submitted_at?: string
          submitted_by?: string
          vehicles_count?: number
          vehicles_details?: string | null
          violations_area?: string | null
          violations_count?: number
          violations_details?: string | null
          violations_time_detail?: string | null
          visitors_in?: number
          visitors_out?: number
          visitors_routes?: string | null
          visits_count?: number
          visits_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergencies: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          acknowledged_by_name: string | null
          created_at: string
          description: string
          emergency_type: string
          id: string
          lat: number | null
          lng: number | null
          location_mgrs: string | null
          office_id: string
          reported_by: string
          reported_by_name: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledged_by_name?: string | null
          created_at?: string
          description: string
          emergency_type: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_mgrs?: string | null
          office_id: string
          reported_by: string
          reported_by_name?: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          acknowledged_by_name?: string | null
          created_at?: string
          description?: string
          emergency_type?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_mgrs?: string | null
          office_id?: string
          reported_by?: string
          reported_by_name?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergencies_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergencies_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_requests: {
        Row: {
          created_at: string
          extension_window_end: string | null
          id: string
          manager_reviewed_at: string | null
          manager_reviewed_by: string | null
          manager_reviewed_by_name: string | null
          office_id: string
          reason: string | null
          request_time: string
          requested_by: string
          requested_by_name: string
          status: string
          supervisor_approved_at: string | null
          supervisor_approved_by: string | null
          supervisor_approved_by_name: string | null
        }
        Insert: {
          created_at?: string
          extension_window_end?: string | null
          id?: string
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          manager_reviewed_by_name?: string | null
          office_id: string
          reason?: string | null
          request_time?: string
          requested_by: string
          requested_by_name?: string
          status?: string
          supervisor_approved_at?: string | null
          supervisor_approved_by?: string | null
          supervisor_approved_by_name?: string | null
        }
        Update: {
          created_at?: string
          extension_window_end?: string | null
          id?: string
          manager_reviewed_at?: string | null
          manager_reviewed_by?: string | null
          manager_reviewed_by_name?: string | null
          office_id?: string
          reason?: string | null
          request_time?: string
          requested_by?: string
          requested_by_name?: string
          status?: string
          supervisor_approved_at?: string | null
          supervisor_approved_by?: string | null
          supervisor_approved_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extension_requests_manager_reviewed_by_fkey"
            columns: ["manager_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extension_requests_supervisor_approved_by_fkey"
            columns: ["supervisor_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          code: string
          created_at: string
          governorate_ar: string
          id: string
          is_active: boolean
          lat: number
          lng: number
          name_ar: string
        }
        Insert: {
          code: string
          created_at?: string
          governorate_ar: string
          id: string
          is_active?: boolean
          lat: number
          lng: number
          name_ar: string
        }
        Update: {
          code?: string
          created_at?: string
          governorate_ar?: string
          id?: string
          is_active?: boolean
          lat?: number
          lng?: number
          name_ar?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name_ar: string
          id: string
          is_active: boolean
          office_id: string | null
          permitted_office_ids: string[]
          special_permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name_ar: string
          id: string
          is_active?: boolean
          office_id?: string | null
          permitted_office_ids?: string[]
          special_permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name_ar?: string
          id?: string
          is_active?: boolean
          office_id?: string | null
          permitted_office_ids?: string[]
          special_permissions?: Json
          updated_at?: string
        }
        Relationships: []
      }
      report_field_definitions: {
        Row: {
          allow_free_text: boolean
          allowed_user_ids: string[]
          count_in_stats: boolean
          created_at: string
          description_ar: string | null
          field_key: string
          field_type: Database["public"]["Enums"]["report_field_type"]
          group_id: string
          id: string
          is_built_in: boolean
          is_hidden: boolean
          label_ar: string
          max_length: number | null
          options: Json
          placeholder_ar: string | null
          sort_order: number
          stat_label_ar: string | null
          updated_at: string
          with_quantity: boolean
        }
        Insert: {
          allow_free_text?: boolean
          allowed_user_ids?: string[]
          count_in_stats?: boolean
          created_at?: string
          description_ar?: string | null
          field_key: string
          field_type?: Database["public"]["Enums"]["report_field_type"]
          group_id: string
          id?: string
          is_built_in?: boolean
          is_hidden?: boolean
          label_ar: string
          max_length?: number | null
          options?: Json
          placeholder_ar?: string | null
          sort_order?: number
          stat_label_ar?: string | null
          updated_at?: string
          with_quantity?: boolean
        }
        Update: {
          allow_free_text?: boolean
          allowed_user_ids?: string[]
          count_in_stats?: boolean
          created_at?: string
          description_ar?: string | null
          field_key?: string
          field_type?: Database["public"]["Enums"]["report_field_type"]
          group_id?: string
          id?: string
          is_built_in?: boolean
          is_hidden?: boolean
          label_ar?: string
          max_length?: number | null
          options?: Json
          placeholder_ar?: string | null
          sort_order?: number
          stat_label_ar?: string | null
          updated_at?: string
          with_quantity?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "report_field_definitions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "report_field_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      report_field_groups: {
        Row: {
          created_at: string
          id: string
          is_hidden: boolean
          sort_order: number
          title_ar: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          sort_order?: number
          title_ar: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          sort_order?: number
          title_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      time_windows: {
        Row: {
          close_time: string
          created_by: string | null
          id: string
          is_manually_closed: boolean
          is_manually_open: boolean
          open_time: string
          updated_at: string
          window_date: string
        }
        Insert: {
          close_time?: string
          created_by?: string | null
          id?: string
          is_manually_closed?: boolean
          is_manually_open?: boolean
          open_time?: string
          updated_at?: string
          window_date: string
        }
        Update: {
          close_time?: string
          created_by?: string | null
          id?: string
          is_manually_closed?: boolean
          is_manually_open?: boolean
          open_time?: string
          updated_at?: string
          window_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_windows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitor_flow_paths: {
        Row: {
          density: string
          from_lat: number
          from_lng: number
          id: string
          office_id: string
          path_name_ar: string | null
          recorded_at: string
          report_id: string | null
          to_lat: number
          to_lng: number
          visitor_count: number
        }
        Insert: {
          density?: string
          from_lat: number
          from_lng: number
          id?: string
          office_id: string
          path_name_ar?: string | null
          recorded_at?: string
          report_id?: string | null
          to_lat: number
          to_lng: number
          visitor_count?: number
        }
        Update: {
          density?: string
          from_lat?: number
          from_lng?: number
          id?: string
          office_id?: string
          path_name_ar?: string | null
          recorded_at?: string
          report_id?: string | null
          to_lat?: number
          to_lng?: number
          visitor_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "visitor_flow_paths_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_office_id: { Args: never; Returns: string }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      is_director_or_supervisor: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "director" | "supervisor" | "manager" | "agent" | "viewer"
      report_field_type:
        | "number"
        | "text"
        | "textarea"
        | "location"
        | "multi_location"
        | "route"
        | "date"
        | "time"
        | "select"
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
      app_role: ["director", "supervisor", "manager", "agent", "viewer"],
      report_field_type: [
        "number",
        "text",
        "textarea",
        "location",
        "multi_location",
        "route",
        "date",
        "time",
        "select",
      ],
    },
  },
} as const
