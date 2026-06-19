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
      bet_legs: {
        Row: {
          bet_id: string
          id: string
          label: string
          market_id: string
          match_id: string
          odds: number
          result: string | null
        }
        Insert: {
          bet_id: string
          id?: string
          label: string
          market_id: string
          match_id: string
          odds: number
          result?: string | null
        }
        Update: {
          bet_id?: string
          id?: string
          label?: string
          market_id?: string
          match_id?: string
          odds?: number
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bet_legs_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_legs_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bet_legs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          combined_odds: number
          id: string
          league_id: string | null
          payout: number
          placed_at: string
          potential_payout: number
          resolved_at: string | null
          stake: number
          status: Database["public"]["Enums"]["bet_status"]
          user_id: string
        }
        Insert: {
          combined_odds: number
          id?: string
          league_id?: string | null
          payout?: number
          placed_at?: string
          potential_payout: number
          resolved_at?: string | null
          stake: number
          status?: Database["public"]["Enums"]["bet_status"]
          user_id: string
        }
        Update: {
          combined_odds?: number
          id?: string
          league_id?: string | null
          payout?: number
          placed_at?: string
          potential_payout?: number
          resolved_at?: string | null
          stake?: number
          status?: Database["public"]["Enums"]["bet_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          bankroll: number
          joined_at: string
          league_id: string
          user_id: string
        }
        Insert: {
          bankroll?: number
          joined_at?: string
          league_id: string
          user_id: string
        }
        Update: {
          bankroll?: number
          joined_at?: string
          league_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
          starting_bankroll: number
          status: Database["public"]["Enums"]["league_status"]
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          owner_id: string
          starting_bankroll?: number
          status?: Database["public"]["Enums"]["league_status"]
          tournament_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          starting_bankroll?: number
          status?: Database["public"]["Enums"]["league_status"]
          tournament_id?: string
        }
        Relationships: []
      }
      markets: {
        Row: {
          category: string
          id: string
          is_open: boolean
          label: string
          match_id: string
          odds: number
          resolved_at: string | null
          result: string | null
          selection: string
        }
        Insert: {
          category: string
          id?: string
          is_open?: boolean
          label: string
          match_id: string
          odds: number
          resolved_at?: string | null
          result?: string | null
          selection: string
        }
        Update: {
          category?: string
          id?: string
          is_open?: boolean
          label?: string
          match_id?: string
          odds?: number
          resolved_at?: string | null
          result?: string | null
          selection?: string
        }
        Relationships: [
          {
            foreignKeyName: "markets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_team: Json
          home_team: Json
          id: string
          kickoff_at: string
          score: Json | null
          stats: Json | null
          status: Database["public"]["Enums"]["match_status"]
          tournament_id: string
          updated_at: string
        }
        Insert: {
          away_team: Json
          home_team: Json
          id: string
          kickoff_at: string
          score?: Json | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id?: string
          updated_at?: string
        }
        Update: {
          away_team?: Json
          home_team?: Json
          id?: string
          kickoff_at?: string
          score?: Json | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bankroll: number
          created_at: string
          display_name: string | null
          id: string
          rescues_used: number
          total_won: number
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bankroll?: number
          created_at?: string
          display_name?: string | null
          id: string
          rescues_used?: number
          total_won?: number
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bankroll?: number
          created_at?: string
          display_name?: string | null
          id?: string
          rescues_used?: number
          total_won?: number
          updated_at?: string
          username?: string
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
      is_league_member: {
        Args: { _league: string; _user: string }
        Returns: boolean
      }
      place_bet: {
        Args: { _league_id: string; _market_ids: string[]; _stake: number }
        Returns: string
      }
      settle_match: { Args: { _match_id: string }; Returns: number }
      upsert_match: {
        Args: {
          _away: Json
          _home: Json
          _id: string
          _kickoff: string
          _score: Json
          _status: Database["public"]["Enums"]["match_status"]
          _tournament: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "user" | "admin"
      bet_status: "pending" | "won" | "lost" | "void"
      league_status: "open" | "locked" | "finished"
      match_status: "scheduled" | "live" | "finished" | "cancelled"
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
      app_role: ["user", "admin"],
      bet_status: ["pending", "won", "lost", "void"],
      league_status: ["open", "locked", "finished"],
      match_status: ["scheduled", "live", "finished", "cancelled"],
    },
  },
} as const
