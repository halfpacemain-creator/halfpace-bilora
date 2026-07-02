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
      companies: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          invoice_notes: string | null
          invoice_prefix: string | null
          invoice_terms: string | null
          invoice_theme: string
          legal_name: string | null
          logo_url: string | null
          name: string
          owner_id: string
          pan: string | null
          phone: string | null
          pincode: string | null
          signature_url: string | null
          state: string | null
          state_code: string | null
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          invoice_notes?: string | null
          invoice_prefix?: string | null
          invoice_terms?: string | null
          invoice_theme?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          signature_url?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          invoice_notes?: string | null
          invoice_prefix?: string | null
          invoice_terms?: string | null
          invoice_theme?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          pan?: string | null
          phone?: string | null
          pincode?: string | null
          signature_url?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          billing_address: string | null
          city: string | null
          company_id: string
          country: string | null
          created_at: string
          email: string | null
          gstin: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          pincode: string | null
          shipping_address: string | null
          state: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          city?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          shipping_address?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          city?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          shipping_address?: string | null
          state?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_events: {
        Row: {
          actor_id: string | null
          company_id: string
          created_at: string
          event_type: string
          id: string
          invoice_id: string
          message: string | null
          metadata: Json
        }
        Insert: {
          actor_id?: string | null
          company_id: string
          created_at?: string
          event_type: string
          id?: string
          invoice_id: string
          message?: string | null
          metadata?: Json
        }
        Update: {
          actor_id?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          invoice_id?: string
          message?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "invoice_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          cgst_amount: number
          created_at: string
          description: string | null
          gst_rate: number
          hsn_sac: string | null
          id: string
          igst_amount: number
          invoice_id: string
          name: string
          position: number
          product_id: string | null
          quantity: number
          rate: number
          sgst_amount: number
          taxable_amount: number
          total: number
          unit: string | null
        }
        Insert: {
          cgst_amount?: number
          created_at?: string
          description?: string | null
          gst_rate?: number
          hsn_sac?: string | null
          id?: string
          igst_amount?: number
          invoice_id: string
          name: string
          position?: number
          product_id?: string | null
          quantity?: number
          rate?: number
          sgst_amount?: number
          taxable_amount?: number
          total?: number
          unit?: string | null
        }
        Update: {
          cgst_amount?: number
          created_at?: string
          description?: string | null
          gst_rate?: number
          hsn_sac?: string | null
          id?: string
          igst_amount?: number
          invoice_id?: string
          name?: string
          position?: number
          product_id?: string | null
          quantity?: number
          rate?: number
          sgst_amount?: number
          taxable_amount?: number
          total?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          cgst_amount: number
          company_id: string
          created_at: string
          customer_billing_address: string | null
          customer_gstin: string | null
          customer_id: string | null
          customer_name: string | null
          customer_state: string | null
          customer_state_code: string | null
          discount_amount: number
          discount_type: string | null
          discount_value: number
          due_date: string | null
          id: string
          igst_amount: number
          invoice_date: string
          invoice_number: string
          invoice_theme: string | null
          is_interstate: boolean
          notes: string | null
          sgst_amount: number
          status: string
          subtotal: number
          terms: string | null
          theme: string
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          cgst_amount?: number
          company_id: string
          created_at?: string
          customer_billing_address?: string | null
          customer_gstin?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_state?: string | null
          customer_state_code?: string | null
          discount_amount?: number
          discount_type?: string | null
          discount_value?: number
          due_date?: string | null
          id?: string
          igst_amount?: number
          invoice_date?: string
          invoice_number: string
          invoice_theme?: string | null
          is_interstate?: boolean
          notes?: string | null
          sgst_amount?: number
          status?: string
          subtotal?: number
          terms?: string | null
          theme?: string
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          cgst_amount?: number
          company_id?: string
          created_at?: string
          customer_billing_address?: string | null
          customer_gstin?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_state?: string | null
          customer_state_code?: string | null
          discount_amount?: number
          discount_type?: string | null
          discount_value?: number
          due_date?: string | null
          id?: string
          igst_amount?: number
          invoice_date?: string
          invoice_number?: string
          invoice_theme?: string | null
          is_interstate?: boolean
          notes?: string | null
          sgst_amount?: number
          status?: string
          subtotal?: number
          terms?: string | null
          theme?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          mode: string
          notes: string | null
          payment_date: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          mode?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          mode?: string
          notes?: string | null
          payment_date?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          gst_rate: number
          hsn_sac: string | null
          id: string
          name: string
          selling_price: number
          stock: number | null
          track_inventory: boolean
          type: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          gst_rate?: number
          hsn_sac?: string | null
          id?: string
          name: string
          selling_price?: number
          stock?: number | null
          track_inventory?: boolean
          type?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          gst_rate?: number
          hsn_sac?: string | null
          id?: string
          name?: string
          selling_price?: number
          stock?: number | null
          track_inventory?: boolean
          type?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          currency: string
          dashboard_period: string
          date_format: string
          email_notifications: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          dashboard_period?: string
          date_format?: string
          email_notifications?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          dashboard_period?: string
          date_format?: string
          email_notifications?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          default_invoice_prefix: string
          default_invoice_theme: string
          default_payment_terms: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_invoice_prefix?: string
          default_invoice_theme?: string
          default_payment_terms?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_invoice_prefix?: string
          default_invoice_theme?: string
          default_payment_terms?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_user_onboarding: {
        Args: { _company_name?: string; _full_name: string }
        Returns: Json
      }
      next_invoice_number: { Args: { _company_id: string }; Returns: string }
      owns_company: { Args: { _company_id: string }; Returns: boolean }
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
