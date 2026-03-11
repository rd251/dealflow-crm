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
      kontakter: {
        Row: {
          created_at: string
          e_post: string | null
          id: string
          linkedin: string | null
          navn: string
          notater: string | null
          rolle: string | null
          selskap_id: string | null
          telefon: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          e_post?: string | null
          id?: string
          linkedin?: string | null
          navn: string
          notater?: string | null
          rolle?: string | null
          selskap_id?: string | null
          telefon?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          e_post?: string | null
          id?: string
          linkedin?: string | null
          navn?: string
          notater?: string | null
          rolle?: string | null
          selskap_id?: string | null
          telefon?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kontakter_selskap_id_fkey"
            columns: ["selskap_id"]
            isOneToOne: false
            referencedRelation: "selskaper"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ansvarlig: string | null
          created_at: string
          e_post: string | null
          firmanavn: string
          id: string
          kilde: Database["public"]["Enums"]["lead_kilde"] | null
          kontaktperson: string | null
          konvertert_dato: string | null
          neste_steg: string | null
          notater: string | null
          opprettet_dato: string | null
          sist_aktivitet: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          telefon: string | null
          updated_at: string
        }
        Insert: {
          ansvarlig?: string | null
          created_at?: string
          e_post?: string | null
          firmanavn: string
          id?: string
          kilde?: Database["public"]["Enums"]["lead_kilde"] | null
          kontaktperson?: string | null
          konvertert_dato?: string | null
          neste_steg?: string | null
          notater?: string | null
          opprettet_dato?: string | null
          sist_aktivitet?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          telefon?: string | null
          updated_at?: string
        }
        Update: {
          ansvarlig?: string | null
          created_at?: string
          e_post?: string | null
          firmanavn?: string
          id?: string
          kilde?: Database["public"]["Enums"]["lead_kilde"] | null
          kontaktperson?: string | null
          konvertert_dato?: string | null
          neste_steg?: string | null
          notater?: string | null
          opprettet_dato?: string | null
          sist_aktivitet?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          telefon?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      oppgaver: {
        Row: {
          ansvarlig: string | null
          created_at: string
          frist: string | null
          id: string
          lead_id: string | null
          notater: string | null
          oppgave: string
          paaminnelse: boolean | null
          prioritet: Database["public"]["Enums"]["prioritet"] | null
          salgsmulighet_id: string | null
          selskap_id: string | null
          status: Database["public"]["Enums"]["oppgave_status"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ansvarlig?: string | null
          created_at?: string
          frist?: string | null
          id?: string
          lead_id?: string | null
          notater?: string | null
          oppgave: string
          paaminnelse?: boolean | null
          prioritet?: Database["public"]["Enums"]["prioritet"] | null
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          status?: Database["public"]["Enums"]["oppgave_status"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ansvarlig?: string | null
          created_at?: string
          frist?: string | null
          id?: string
          lead_id?: string | null
          notater?: string | null
          oppgave?: string
          paaminnelse?: boolean | null
          prioritet?: Database["public"]["Enums"]["prioritet"] | null
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          status?: Database["public"]["Enums"]["oppgave_status"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oppgaver_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgaver_salgsmulighet_id_fkey"
            columns: ["salgsmulighet_id"]
            isOneToOne: false
            referencedRelation: "salgsmuligheter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oppgaver_selskap_id_fkey"
            columns: ["selskap_id"]
            isOneToOne: false
            referencedRelation: "selskaper"
            referencedColumns: ["id"]
          },
        ]
      }
      partnere: {
        Row: {
          ansvarlig: string | null
          created_at: string
          e_post: string | null
          id: string
          kontaktperson: string | null
          notater: string | null
          opprettet_dato: string | null
          partnernavn: string
          partnerstatus: Database["public"]["Enums"]["partnerstatus"] | null
          partnertype: Database["public"]["Enums"]["partnertype"] | null
          pipeline_status:
            | Database["public"]["Enums"]["partner_pipeline_status"]
            | null
          provisjonsprosent: number | null
          provisjonstype: Database["public"]["Enums"]["provisjonstype"] | null
          selskap_id: string | null
          sist_aktivitet: string | null
          telefon: string | null
          updated_at: string
        }
        Insert: {
          ansvarlig?: string | null
          created_at?: string
          e_post?: string | null
          id?: string
          kontaktperson?: string | null
          notater?: string | null
          opprettet_dato?: string | null
          partnernavn: string
          partnerstatus?: Database["public"]["Enums"]["partnerstatus"] | null
          partnertype?: Database["public"]["Enums"]["partnertype"] | null
          pipeline_status?:
            | Database["public"]["Enums"]["partner_pipeline_status"]
            | null
          provisjonsprosent?: number | null
          provisjonstype?: Database["public"]["Enums"]["provisjonstype"] | null
          selskap_id?: string | null
          sist_aktivitet?: string | null
          telefon?: string | null
          updated_at?: string
        }
        Update: {
          ansvarlig?: string | null
          created_at?: string
          e_post?: string | null
          id?: string
          kontaktperson?: string | null
          notater?: string | null
          opprettet_dato?: string | null
          partnernavn?: string
          partnerstatus?: Database["public"]["Enums"]["partnerstatus"] | null
          partnertype?: Database["public"]["Enums"]["partnertype"] | null
          pipeline_status?:
            | Database["public"]["Enums"]["partner_pipeline_status"]
            | null
          provisjonsprosent?: number | null
          provisjonstype?: Database["public"]["Enums"]["provisjonstype"] | null
          selskap_id?: string | null
          sist_aktivitet?: string | null
          telefon?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnere_selskap_id_fkey"
            columns: ["selskap_id"]
            isOneToOne: false
            referencedRelation: "selskaper"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prosjekter: {
        Row: {
          ansvarlig: string | null
          created_at: string
          forventet_go_live: string | null
          go_live_dato: string | null
          id: string
          integrasjon: Database["public"]["Enums"]["integrasjon"] | null
          notater: string | null
          oppstart_betalt: boolean | null
          oppstart_faktura_dato: string | null
          oppstart_fakturert: boolean | null
          oppstartskostnad: number | null
          prosjektnavn: string
          salgsmulighet_id: string | null
          selskap_id: string | null
          startdato: string | null
          status: Database["public"]["Enums"]["prosjekt_status"] | null
          updated_at: string
        }
        Insert: {
          ansvarlig?: string | null
          created_at?: string
          forventet_go_live?: string | null
          go_live_dato?: string | null
          id?: string
          integrasjon?: Database["public"]["Enums"]["integrasjon"] | null
          notater?: string | null
          oppstart_betalt?: boolean | null
          oppstart_faktura_dato?: string | null
          oppstart_fakturert?: boolean | null
          oppstartskostnad?: number | null
          prosjektnavn: string
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          startdato?: string | null
          status?: Database["public"]["Enums"]["prosjekt_status"] | null
          updated_at?: string
        }
        Update: {
          ansvarlig?: string | null
          created_at?: string
          forventet_go_live?: string | null
          go_live_dato?: string | null
          id?: string
          integrasjon?: Database["public"]["Enums"]["integrasjon"] | null
          notater?: string | null
          oppstart_betalt?: boolean | null
          oppstart_faktura_dato?: string | null
          oppstart_fakturert?: boolean | null
          oppstartskostnad?: number | null
          prosjektnavn?: string
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          startdato?: string | null
          status?: Database["public"]["Enums"]["prosjekt_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prosjekter_salgsmulighet_id_fkey"
            columns: ["salgsmulighet_id"]
            isOneToOne: false
            referencedRelation: "salgsmuligheter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prosjekter_selskap_id_fkey"
            columns: ["selskap_id"]
            isOneToOne: false
            referencedRelation: "selskaper"
            referencedColumns: ["id"]
          },
        ]
      }
      salgsmuligheter: {
        Row: {
          ansvarlig: string | null
          created_at: string
          forventet_lukkedato: string | null
          forventet_mrr: number | null
          id: string
          kilde: Database["public"]["Enums"]["kilde"] | null
          kontakt_id: string | null
          kontraktslengde_mnd: number | null
          navn: string
          neste_steg: string | null
          netto_inntekt: number | null
          notater: string | null
          opprettet_dato: string | null
          oppstartskostnad: number | null
          partner_id: string | null
          partner_kostnad: number | null
          partner_provisjon: number | null
          sannsynlighet: number | null
          selskap_id: string | null
          sist_aktivitet: string | null
          sla: number | null
          status: Database["public"]["Enums"]["salgsmulighet_status"] | null
          tapsaarsak: Database["public"]["Enums"]["tapsaarsak"] | null
          tapt_dato: string | null
          updated_at: string
          vunnet_dato: string | null
        }
        Insert: {
          ansvarlig?: string | null
          created_at?: string
          forventet_lukkedato?: string | null
          forventet_mrr?: number | null
          id?: string
          kilde?: Database["public"]["Enums"]["kilde"] | null
          kontakt_id?: string | null
          kontraktslengde_mnd?: number | null
          navn: string
          neste_steg?: string | null
          netto_inntekt?: number | null
          notater?: string | null
          opprettet_dato?: string | null
          oppstartskostnad?: number | null
          partner_id?: string | null
          partner_kostnad?: number | null
          partner_provisjon?: number | null
          sannsynlighet?: number | null
          selskap_id?: string | null
          sist_aktivitet?: string | null
          sla?: number | null
          status?: Database["public"]["Enums"]["salgsmulighet_status"] | null
          tapsaarsak?: Database["public"]["Enums"]["tapsaarsak"] | null
          tapt_dato?: string | null
          updated_at?: string
          vunnet_dato?: string | null
        }
        Update: {
          ansvarlig?: string | null
          created_at?: string
          forventet_lukkedato?: string | null
          forventet_mrr?: number | null
          id?: string
          kilde?: Database["public"]["Enums"]["kilde"] | null
          kontakt_id?: string | null
          kontraktslengde_mnd?: number | null
          navn?: string
          neste_steg?: string | null
          netto_inntekt?: number | null
          notater?: string | null
          opprettet_dato?: string | null
          oppstartskostnad?: number | null
          partner_id?: string | null
          partner_kostnad?: number | null
          partner_provisjon?: number | null
          sannsynlighet?: number | null
          selskap_id?: string | null
          sist_aktivitet?: string | null
          sla?: number | null
          status?: Database["public"]["Enums"]["salgsmulighet_status"] | null
          tapsaarsak?: Database["public"]["Enums"]["tapsaarsak"] | null
          tapt_dato?: string | null
          updated_at?: string
          vunnet_dato?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salgsmuligheter_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salgsmuligheter_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partnere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salgsmuligheter_selskap_id_fkey"
            columns: ["selskap_id"]
            isOneToOne: false
            referencedRelation: "selskaper"
            referencedColumns: ["id"]
          },
        ]
      }
      selskaper: {
        Row: {
          arr: number | null
          bransje: string | null
          created_at: string
          firmanavn: string
          go_live_dato: string | null
          id: string
          kanselleringsaarsak:
            | Database["public"]["Enums"]["kanselleringsaarsak"]
            | null
          kanselleringsnotat: string | null
          kansellert_dato: string | null
          kilde: Database["public"]["Enums"]["kilde"] | null
          kundeansvarlig: string | null
          kundestatus: Database["public"]["Enums"]["kundestatus"]
          kundetilstand: Database["public"]["Enums"]["kundetilstand"] | null
          live_status: boolean | null
          lukkedato: string | null
          mrr: number | null
          neste_steg: string | null
          notater: string | null
          onboarding_status:
            | Database["public"]["Enums"]["onboarding_status"]
            | null
          oppstartskostnad: number | null
          partner_id: string | null
          sist_aktivitet: string | null
          updated_at: string
        }
        Insert: {
          arr?: number | null
          bransje?: string | null
          created_at?: string
          firmanavn: string
          go_live_dato?: string | null
          id?: string
          kanselleringsaarsak?:
            | Database["public"]["Enums"]["kanselleringsaarsak"]
            | null
          kanselleringsnotat?: string | null
          kansellert_dato?: string | null
          kilde?: Database["public"]["Enums"]["kilde"] | null
          kundeansvarlig?: string | null
          kundestatus?: Database["public"]["Enums"]["kundestatus"]
          kundetilstand?: Database["public"]["Enums"]["kundetilstand"] | null
          live_status?: boolean | null
          lukkedato?: string | null
          mrr?: number | null
          neste_steg?: string | null
          notater?: string | null
          onboarding_status?:
            | Database["public"]["Enums"]["onboarding_status"]
            | null
          oppstartskostnad?: number | null
          partner_id?: string | null
          sist_aktivitet?: string | null
          updated_at?: string
        }
        Update: {
          arr?: number | null
          bransje?: string | null
          created_at?: string
          firmanavn?: string
          go_live_dato?: string | null
          id?: string
          kanselleringsaarsak?:
            | Database["public"]["Enums"]["kanselleringsaarsak"]
            | null
          kanselleringsnotat?: string | null
          kansellert_dato?: string | null
          kilde?: Database["public"]["Enums"]["kilde"] | null
          kundeansvarlig?: string | null
          kundestatus?: Database["public"]["Enums"]["kundestatus"]
          kundetilstand?: Database["public"]["Enums"]["kundetilstand"] | null
          live_status?: boolean | null
          lukkedato?: string | null
          mrr?: number | null
          neste_steg?: string | null
          notater?: string | null
          onboarding_status?:
            | Database["public"]["Enums"]["onboarding_status"]
            | null
          oppstartskostnad?: number | null
          partner_id?: string | null
          sist_aktivitet?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_selskaper_partner"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partnere"
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
    }
    Enums: {
      app_role: "admin" | "user"
      integrasjon:
        | "Ingen"
        | "GastroPlanner"
        | "HubSpot"
        | "Lime"
        | "Salesforce"
        | "API"
        | "Annet"
      kanselleringsaarsak:
        | "Pris"
        | "Lav bruk"
        | "Teknisk utfordring"
        | "Manglende verdi"
        | "Byttet leverandør"
        | "Midlertidig stopp"
        | "Annet"
      kilde: "Direkte salg" | "Partner" | "Inbound" | "Outbound"
      kundestatus: "Ikke kunde" | "Pilot" | "Live" | "Pause" | "Kansellert"
      kundetilstand: "Bra" | "Usikker" | "Risiko"
      lead_kilde:
        | "Nettside"
        | "LinkedIn"
        | "Partner"
        | "Referanse"
        | "Kald outbound"
        | "E-post"
        | "Telefon"
        | "Annet"
      lead_status:
        | "Ny"
        | "Kontaktet"
        | "Kvalifisert"
        | "Ikke aktuelt"
        | "Konvertert til salg"
        | "Konvertert til partner"
      onboarding_status:
        | "Ikke startet"
        | "Pågår"
        | "Venter på kunde"
        | "Klar for live"
        | "Ferdig"
      oppgave_status: "Åpen" | "Pågår" | "Ferdig"
      partner_pipeline_status:
        | "Ny partner"
        | "Introduksjon"
        | "Demo / gjennomgang"
        | "Avtale"
        | "Aktiv partner"
      partnerstatus: "Aktiv" | "Under onboarding" | "Inaktiv"
      partnertype:
        | "Provisjonspartner"
        | "Integrasjonspartner"
        | "Salgspartner"
        | "Strategisk partner"
      prioritet: "Lav" | "Medium" | "Høy"
      prosjekt_status:
        | "Ny"
        | "I produksjon"
        | "Test med kunde"
        | "Live"
        | "Blokkert"
      provisjonstype: "Engangsprovisjon" | "Løpende provisjon" | "Hybrid"
      salgsmulighet_status:
        | "Ny mulighet"
        | "Møte booket"
        | "Demo gjennomført"
        | "Tilbud sendt"
        | "Forhandling"
        | "Vunnet"
        | "Tapt"
      tapsaarsak:
        | "Pris"
        | "Ikke riktig timing"
        | "Valgte annen leverandør"
        | "Ikke behov"
        | "Teknisk / integrasjon"
        | "Annet"
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
      integrasjon: [
        "Ingen",
        "GastroPlanner",
        "HubSpot",
        "Lime",
        "Salesforce",
        "API",
        "Annet",
      ],
      kanselleringsaarsak: [
        "Pris",
        "Lav bruk",
        "Teknisk utfordring",
        "Manglende verdi",
        "Byttet leverandør",
        "Midlertidig stopp",
        "Annet",
      ],
      kilde: ["Direkte salg", "Partner", "Inbound", "Outbound"],
      kundestatus: ["Ikke kunde", "Pilot", "Live", "Pause", "Kansellert"],
      kundetilstand: ["Bra", "Usikker", "Risiko"],
      lead_kilde: [
        "Nettside",
        "LinkedIn",
        "Partner",
        "Referanse",
        "Kald outbound",
        "E-post",
        "Telefon",
        "Annet",
      ],
      lead_status: [
        "Ny",
        "Kontaktet",
        "Kvalifisert",
        "Ikke aktuelt",
        "Konvertert til salg",
        "Konvertert til partner",
      ],
      onboarding_status: [
        "Ikke startet",
        "Pågår",
        "Venter på kunde",
        "Klar for live",
        "Ferdig",
      ],
      oppgave_status: ["Åpen", "Pågår", "Ferdig"],
      partner_pipeline_status: [
        "Ny partner",
        "Introduksjon",
        "Demo / gjennomgang",
        "Avtale",
        "Aktiv partner",
      ],
      partnerstatus: ["Aktiv", "Under onboarding", "Inaktiv"],
      partnertype: [
        "Provisjonspartner",
        "Integrasjonspartner",
        "Salgspartner",
        "Strategisk partner",
      ],
      prioritet: ["Lav", "Medium", "Høy"],
      prosjekt_status: [
        "Ny",
        "I produksjon",
        "Test med kunde",
        "Live",
        "Blokkert",
      ],
      provisjonstype: ["Engangsprovisjon", "Løpende provisjon", "Hybrid"],
      salgsmulighet_status: [
        "Ny mulighet",
        "Møte booket",
        "Demo gjennomført",
        "Tilbud sendt",
        "Forhandling",
        "Vunnet",
        "Tapt",
      ],
      tapsaarsak: [
        "Pris",
        "Ikke riktig timing",
        "Valgte annen leverandør",
        "Ikke behov",
        "Teknisk / integrasjon",
        "Annet",
      ],
    },
  },
} as const
