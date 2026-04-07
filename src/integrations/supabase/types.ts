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
      aktiviteter: {
        Row: {
          aktivitet_kilde: string | null
          beskrivelse: string
          created_at: string
          dato: string
          deltakere: string[] | null
          ekstern_id: string | null
          ekstern_provider: string | null
          id: string
          kontakt_id: string | null
          lead_id: string | null
          moetenotater: string | null
          partner_id: string | null
          prosjekt_id: string | null
          salgsmulighet_id: string | null
          selskap_id: string | null
          slutt_tid: string | null
          start_tid: string | null
          tittel: string | null
          type: Database["public"]["Enums"]["aktivitet_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          aktivitet_kilde?: string | null
          beskrivelse?: string
          created_at?: string
          dato?: string
          deltakere?: string[] | null
          ekstern_id?: string | null
          ekstern_provider?: string | null
          id?: string
          kontakt_id?: string | null
          lead_id?: string | null
          moetenotater?: string | null
          partner_id?: string | null
          prosjekt_id?: string | null
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          slutt_tid?: string | null
          start_tid?: string | null
          tittel?: string | null
          type: Database["public"]["Enums"]["aktivitet_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          aktivitet_kilde?: string | null
          beskrivelse?: string
          created_at?: string
          dato?: string
          deltakere?: string[] | null
          ekstern_id?: string | null
          ekstern_provider?: string | null
          id?: string
          kontakt_id?: string | null
          lead_id?: string | null
          moetenotater?: string | null
          partner_id?: string | null
          prosjekt_id?: string | null
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          slutt_tid?: string | null
          start_tid?: string | null
          tittel?: string | null
          type?: Database["public"]["Enums"]["aktivitet_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aktiviteter_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aktiviteter_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aktiviteter_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partnere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aktiviteter_prosjekt_id_fkey"
            columns: ["prosjekt_id"]
            isOneToOne: false
            referencedRelation: "prosjekter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aktiviteter_salgsmulighet_id_fkey"
            columns: ["salgsmulighet_id"]
            isOneToOne: false
            referencedRelation: "salgsmuligheter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aktiviteter_selskap_id_fkey"
            columns: ["selskap_id"]
            isOneToOne: false
            referencedRelation: "selskaper"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_changelog: {
        Row: {
          created_at: string
          entity_id: string
          entity_name: string
          entity_type: string
          event_type: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          related_entity_id: string | null
          related_entity_name: string | null
          related_entity_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_name?: string
          entity_type: string
          event_type: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          related_entity_id?: string | null
          related_entity_name?: string | null
          related_entity_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_name?: string
          entity_type?: string
          event_type?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          related_entity_id?: string | null
          related_entity_name?: string | null
          related_entity_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deleted_items: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          id: string
          record_data: Json
          record_id: string
          restored_at: string | null
          table_name: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          record_data: Json
          record_id: string
          restored_at?: string | null
          table_name: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          record_data?: Json
          record_id?: string
          restored_at?: string | null
          table_name?: string
        }
        Relationships: []
      }
      email_contacts: {
        Row: {
          all_emails: string[]
          created_at: string
          display_name: string
          domain: string
          first_seen_at: string
          id: string
          kontakt_id: string | null
          last_activity_type: string | null
          last_contacted_at: string | null
          lead_id: string | null
          partner_id: string | null
          primary_email: string
          salgsmulighet_id: string | null
          selskap_id: string | null
          total_emails_received: number
          total_emails_sent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          all_emails?: string[]
          created_at?: string
          display_name?: string
          domain?: string
          first_seen_at?: string
          id?: string
          kontakt_id?: string | null
          last_activity_type?: string | null
          last_contacted_at?: string | null
          lead_id?: string | null
          partner_id?: string | null
          primary_email: string
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          total_emails_received?: number
          total_emails_sent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          all_emails?: string[]
          created_at?: string
          display_name?: string
          domain?: string
          first_seen_at?: string
          id?: string
          kontakt_id?: string | null
          last_activity_type?: string | null
          last_contacted_at?: string | null
          lead_id?: string | null
          partner_id?: string | null
          primary_email?: string
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          total_emails_received?: number
          total_emails_sent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          calendar_id: string
          created_at: string
          gmail_history_id: string | null
          gmail_last_synced_at: string | null
          gmail_sync_enabled: boolean
          id: string
          last_synced_at: string | null
          refresh_token: string
          sync_token: string | null
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          calendar_id?: string
          created_at?: string
          gmail_history_id?: string | null
          gmail_last_synced_at?: string | null
          gmail_sync_enabled?: boolean
          id?: string
          last_synced_at?: string | null
          refresh_token: string
          sync_token?: string | null
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          calendar_id?: string
          created_at?: string
          gmail_history_id?: string | null
          gmail_last_synced_at?: string | null
          gmail_sync_enabled?: boolean
          id?: string
          last_synced_at?: string | null
          refresh_token?: string
          sync_token?: string | null
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          rolle_i_firma: string | null
          sist_aktivitet: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          telefon: string | null
          updated_at: string
          use_case: string | null
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
          rolle_i_firma?: string | null
          sist_aktivitet?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          telefon?: string | null
          updated_at?: string
          use_case?: string | null
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
          rolle_i_firma?: string | null
          sist_aktivitet?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          telefon?: string | null
          updated_at?: string
          use_case?: string | null
        }
        Relationships: []
      }
      oppgaver: {
        Row: {
          ansvarlig: string | null
          created_at: string
          frist: string | null
          id: string
          kontakt_id: string | null
          lead_id: string | null
          notater: string | null
          oppgave: string
          paaminnelse: boolean | null
          prioritet: Database["public"]["Enums"]["prioritet"] | null
          salgsmulighet_id: string | null
          selskap_id: string | null
          status: Database["public"]["Enums"]["oppgave_status"] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ansvarlig?: string | null
          created_at?: string
          frist?: string | null
          id?: string
          kontakt_id?: string | null
          lead_id?: string | null
          notater?: string | null
          oppgave: string
          paaminnelse?: boolean | null
          prioritet?: Database["public"]["Enums"]["prioritet"] | null
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          status?: Database["public"]["Enums"]["oppgave_status"] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ansvarlig?: string | null
          created_at?: string
          frist?: string | null
          id?: string
          kontakt_id?: string | null
          lead_id?: string | null
          notater?: string | null
          oppgave?: string
          paaminnelse?: boolean | null
          prioritet?: Database["public"]["Enums"]["prioritet"] | null
          salgsmulighet_id?: string | null
          selskap_id?: string | null
          status?: Database["public"]["Enums"]["oppgave_status"] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oppgaver_kontakt_id_fkey"
            columns: ["kontakt_id"]
            isOneToOne: false
            referencedRelation: "kontakter"
            referencedColumns: ["id"]
          },
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
      ringeliste: {
        Row: {
          ansvarlig: string | null
          created_at: string
          e_post: string | null
          id: string
          kanal: string
          kilde_segment: string
          kontakt_id: string | null
          navn: string
          notater: string | null
          partner_id: string | null
          partnertype_segment: string
          prioritet: string | null
          ringeliste_id: string | null
          rolle: string | null
          salgsmulighet_id: string | null
          segment: string
          selskap: string | null
          selskap_id: string | null
          sist_kontaktet: string | null
          status: string | null
          telefon: string | null
          underkilde: string
          updated_at: string
          user_id: string | null
          utfall: string | null
        }
        Insert: {
          ansvarlig?: string | null
          created_at?: string
          e_post?: string | null
          id?: string
          kanal?: string
          kilde_segment?: string
          kontakt_id?: string | null
          navn: string
          notater?: string | null
          partner_id?: string | null
          partnertype_segment?: string
          prioritet?: string | null
          ringeliste_id?: string | null
          rolle?: string | null
          salgsmulighet_id?: string | null
          segment?: string
          selskap?: string | null
          selskap_id?: string | null
          sist_kontaktet?: string | null
          status?: string | null
          telefon?: string | null
          underkilde?: string
          updated_at?: string
          user_id?: string | null
          utfall?: string | null
        }
        Update: {
          ansvarlig?: string | null
          created_at?: string
          e_post?: string | null
          id?: string
          kanal?: string
          kilde_segment?: string
          kontakt_id?: string | null
          navn?: string
          notater?: string | null
          partner_id?: string | null
          partnertype_segment?: string
          prioritet?: string | null
          ringeliste_id?: string | null
          rolle?: string | null
          salgsmulighet_id?: string | null
          segment?: string
          selskap?: string | null
          selskap_id?: string | null
          sist_kontaktet?: string | null
          status?: string | null
          telefon?: string | null
          underkilde?: string
          updated_at?: string
          user_id?: string | null
          utfall?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ringeliste_ringeliste_id_fkey"
            columns: ["ringeliste_id"]
            isOneToOne: false
            referencedRelation: "ringelister"
            referencedColumns: ["id"]
          },
        ]
      }
      ringelister: {
        Row: {
          ansvarlig: string | null
          created_at: string
          id: string
          kanal: string
          kilde_segment: string
          navn: string
          notater: string | null
          partnertype_segment: string
          segment: string
          underkilde: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ansvarlig?: string | null
          created_at?: string
          id?: string
          kanal?: string
          kilde_segment?: string
          navn: string
          notater?: string | null
          partnertype_segment?: string
          segment?: string
          underkilde?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ansvarlig?: string | null
          created_at?: string
          id?: string
          kanal?: string
          kilde_segment?: string
          navn?: string
          notater?: string | null
          partnertype_segment?: string
          segment?: string
          underkilde?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      salgsmuligheter: {
        Row: {
          ansvarlig: string | null
          created_at: string
          e_post: string | null
          forventet_lukkedato: string | null
          forventet_mrr: number | null
          id: string
          kilde: Database["public"]["Enums"]["kilde"] | null
          kontakt_id: string | null
          kontaktperson: string | null
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
          rolle_i_firma: string | null
          sannsynlighet: number | null
          selskap_id: string | null
          sist_aktivitet: string | null
          sla: number | null
          status: Database["public"]["Enums"]["salgsmulighet_status"] | null
          tapsaarsak: Database["public"]["Enums"]["tapsaarsak"] | null
          tapt_dato: string | null
          telefon: string | null
          updated_at: string
          use_case: string | null
          vunnet_dato: string | null
        }
        Insert: {
          ansvarlig?: string | null
          created_at?: string
          e_post?: string | null
          forventet_lukkedato?: string | null
          forventet_mrr?: number | null
          id?: string
          kilde?: Database["public"]["Enums"]["kilde"] | null
          kontakt_id?: string | null
          kontaktperson?: string | null
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
          rolle_i_firma?: string | null
          sannsynlighet?: number | null
          selskap_id?: string | null
          sist_aktivitet?: string | null
          sla?: number | null
          status?: Database["public"]["Enums"]["salgsmulighet_status"] | null
          tapsaarsak?: Database["public"]["Enums"]["tapsaarsak"] | null
          tapt_dato?: string | null
          telefon?: string | null
          updated_at?: string
          use_case?: string | null
          vunnet_dato?: string | null
        }
        Update: {
          ansvarlig?: string | null
          created_at?: string
          e_post?: string | null
          forventet_lukkedato?: string | null
          forventet_mrr?: number | null
          id?: string
          kilde?: Database["public"]["Enums"]["kilde"] | null
          kontakt_id?: string | null
          kontaktperson?: string | null
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
          rolle_i_firma?: string | null
          sannsynlighet?: number | null
          selskap_id?: string | null
          sist_aktivitet?: string | null
          sla?: number | null
          status?: Database["public"]["Enums"]["salgsmulighet_status"] | null
          tapsaarsak?: Database["public"]["Enums"]["tapsaarsak"] | null
          tapt_dato?: string | null
          telefon?: string | null
          updated_at?: string
          use_case?: string | null
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
      selskap_innsikt: {
        Row: {
          beskrivelse: string | null
          bransje: string | null
          created_at: string
          domene: string
          estimert_ansatte: string | null
          estimert_omsetning: string | null
          firmanavn: string
          id: string
          kilde_data: Json | null
          orgnr: string | null
          stoerrelse: string | null
          updated_at: string
        }
        Insert: {
          beskrivelse?: string | null
          bransje?: string | null
          created_at?: string
          domene?: string
          estimert_ansatte?: string | null
          estimert_omsetning?: string | null
          firmanavn?: string
          id?: string
          kilde_data?: Json | null
          orgnr?: string | null
          stoerrelse?: string | null
          updated_at?: string
        }
        Update: {
          beskrivelse?: string | null
          bransje?: string | null
          created_at?: string
          domene?: string
          estimert_ansatte?: string | null
          estimert_omsetning?: string | null
          firmanavn?: string
          id?: string
          kilde_data?: Json | null
          orgnr?: string | null
          stoerrelse?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      selskaper: {
        Row: {
          arr: number | null
          bransje: string | null
          created_at: string
          domene: string
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
          orgnr: string
          partner_id: string | null
          sist_aktivitet: string | null
          updated_at: string
        }
        Insert: {
          arr?: number | null
          bransje?: string | null
          created_at?: string
          domene?: string
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
          orgnr?: string
          partner_id?: string | null
          sist_aktivitet?: string | null
          updated_at?: string
        }
        Update: {
          arr?: number | null
          bransje?: string | null
          created_at?: string
          domene?: string
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
          orgnr?: string
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      varsler: {
        Row: {
          beskrivelse: string
          created_at: string
          fra_user_id: string | null
          id: string
          lenke: string | null
          lest: boolean
          oppgave_id: string | null
          tittel: string
          type: string
          user_id: string
        }
        Insert: {
          beskrivelse?: string
          created_at?: string
          fra_user_id?: string | null
          id?: string
          lenke?: string | null
          lest?: boolean
          oppgave_id?: string | null
          tittel: string
          type?: string
          user_id: string
        }
        Update: {
          beskrivelse?: string
          created_at?: string
          fra_user_id?: string | null
          id?: string
          lenke?: string | null
          lest?: boolean
          oppgave_id?: string | null
          tittel?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "varsler_oppgave_id_fkey"
            columns: ["oppgave_id"]
            isOneToOne: false
            referencedRelation: "oppgaver"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      aktivitet_type:
        | "Telefonsamtale"
        | "E-post"
        | "LinkedIn-melding"
        | "SMS"
        | "Møte"
        | "Notat"
      app_role: "admin" | "user" | "viewer"
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
        | "Organisk"
        | "Facebook ads"
        | "Instantly kald e-post"
        | "Google ads"
        | "Kasoleads"
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
        | "Ny partnermulighet"
        | "Introduksjon"
        | "Demo / gjennomgang"
        | "Forhandling"
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
        | "Behov avklart"
        | "Løsning presentert"
        | "Beslutning"
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
      aktivitet_type: [
        "Telefonsamtale",
        "E-post",
        "LinkedIn-melding",
        "SMS",
        "Møte",
        "Notat",
      ],
      app_role: ["admin", "user", "viewer"],
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
        "Organisk",
        "Facebook ads",
        "Instantly kald e-post",
        "Google ads",
        "Kasoleads",
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
        "Ny partnermulighet",
        "Introduksjon",
        "Demo / gjennomgang",
        "Forhandling",
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
        "Behov avklart",
        "Løsning presentert",
        "Beslutning",
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
