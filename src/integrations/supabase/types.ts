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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          created_at: string
          data_fato: string | null
          delegacia: string | null
          file_name: string
          id: string
          natureza: string | null
          numero_bo: string | null
          pdf_storage_path: string | null
          result: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          data_fato?: string | null
          delegacia?: string | null
          file_name: string
          id?: string
          natureza?: string | null
          numero_bo?: string | null
          pdf_storage_path?: string | null
          result: Json
          user_id: string
        }
        Update: {
          created_at?: string
          data_fato?: string | null
          delegacia?: string | null
          file_name?: string
          id?: string
          natureza?: string | null
          numero_bo?: string | null
          pdf_storage_path?: string | null
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          equipe: string | null
          full_name: string
          id: string
          lotacao: string | null
          nf: string | null
          nickname: string | null
          role: string
          signature_style: Json
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          equipe?: string | null
          full_name?: string
          id: string
          lotacao?: string | null
          nf?: string | null
          nickname?: string | null
          role?: string
          signature_style?: Json
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          equipe?: string | null
          full_name?: string
          id?: string
          lotacao?: string | null
          nf?: string | null
          nickname?: string | null
          role?: string
          signature_style?: Json
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shift_occurrences: {
        Row: {
          analysis_id: string | null
          authority: string | null
          bu_number: string
          conducted_names: string | null
          created_at: string
          created_by: string
          fianca_paga: boolean
          final_time: string | null
          first_hearing_time: string | null
          has_fianca: boolean
          has_report: boolean
          id: string
          investigator: string | null
          num_hearings: number
          observations: string | null
          po_status: string | null
          procedure_type: string | null
          procedure_type_2: string | null
          procedure_type_3: string | null
          regional: string | null
          shift_id: string
          status: string
          suspect_names: string | null
          tipification: string | null
          tramitation_time: string | null
          victim_names: string | null
        }
        Insert: {
          analysis_id?: string | null
          authority?: string | null
          bu_number: string
          conducted_names?: string | null
          created_at?: string
          created_by: string
          fianca_paga?: boolean
          final_time?: string | null
          first_hearing_time?: string | null
          has_fianca?: boolean
          has_report?: boolean
          id?: string
          investigator?: string | null
          num_hearings?: number
          observations?: string | null
          po_status?: string | null
          procedure_type?: string | null
          procedure_type_2?: string | null
          procedure_type_3?: string | null
          regional?: string | null
          shift_id: string
          status?: string
          suspect_names?: string | null
          tipification?: string | null
          tramitation_time?: string | null
          victim_names?: string | null
        }
        Update: {
          analysis_id?: string | null
          authority?: string | null
          bu_number?: string
          conducted_names?: string | null
          created_at?: string
          created_by?: string
          fianca_paga?: boolean
          final_time?: string | null
          first_hearing_time?: string | null
          has_fianca?: boolean
          has_report?: boolean
          id?: string
          investigator?: string | null
          num_hearings?: number
          observations?: string | null
          po_status?: string | null
          procedure_type?: string | null
          procedure_type_2?: string | null
          procedure_type_3?: string | null
          regional?: string | null
          shift_id?: string
          status?: string
          suspect_names?: string | null
          tipification?: string | null
          tramitation_time?: string | null
          victim_names?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_occurrences_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_occurrences_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          absences: Json
          authorities: Json
          created_at: string
          created_by: string
          delegado_subteams: Json
          end_time: string | null
          id: string
          investigators: Json
          iseo: Json
          iseo_subteams: Json
          observations: string[]
          oip_subteams: Json
          shift_date: string
          start_time: string
          status: string
          team_name: string
        }
        Insert: {
          absences?: Json
          authorities?: Json
          created_at?: string
          created_by: string
          delegado_subteams?: Json
          end_time?: string | null
          id?: string
          investigators?: Json
          iseo?: Json
          iseo_subteams?: Json
          observations?: string[]
          oip_subteams?: Json
          shift_date: string
          start_time: string
          status?: string
          team_name: string
        }
        Update: {
          absences?: Json
          authorities?: Json
          created_at?: string
          created_by?: string
          delegado_subteams?: Json
          end_time?: string | null
          id?: string
          investigators?: Json
          iseo?: Json
          iseo_subteams?: Json
          observations?: string[]
          oip_subteams?: Json
          shift_date?: string
          start_time?: string
          status?: string
          team_name?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          cargo: string | null
          created_at: string
          created_by: string
          email: string | null
          equipe: string | null
          full_name: string
          id: string
          is_active: boolean
          lotacao: string | null
          nf: string | null
          nickname: string | null
          telefone: string | null
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          equipe?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          lotacao?: string | null
          nf?: string | null
          nickname?: string | null
          telefone?: string | null
        }
        Update: {
          cargo?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          equipe?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          lotacao?: string | null
          nf?: string | null
          nickname?: string | null
          telefone?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_safe_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          equipe: string
          full_name: string
          id: string
          lotacao: string
          nickname: string
          role: string
        }[]
      }
      list_safe_team_members: {
        Args: never
        Returns: {
          cargo: string
          equipe: string
          full_name: string
          id: string
          is_active: boolean
          lotacao: string
          nickname: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "analista"
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
      app_role: ["admin", "analista"],
    },
  },
} as const
