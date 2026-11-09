export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'owner' | 'staff' | 'customer';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type AppLanguage = 'si' | 'en' | 'ta';
export type StaffAvailability = 'available' | 'busy' | 'on_break' | 'on_leave' | 'off_duty';
export type ServiceCategory = 'haircut' | 'beard' | 'treatment' | 'combo' | 'special';
export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'waiting'
  | 'in_service'
  | 'in_chair'
  | 'completed'
  | 'cancelled'
  | 'no_show';
export type BookingSource = 'online_pwa' | 'whatsapp' | 'walk_in' | 'phone_call';
export type QueueStatus = 'waiting' | 'called' | 'in_service' | 'in_chair' | 'completed' | 'cancelled' | 'skipped';
export type QueueTicketType = 'walk_in' | 'appointment';
export type QueuePriority = 'normal' | 'priority' | 'vip' | 'emergency';
export type PaymentMethod = 'cash' | 'card' | 'lankaqr' | 'online_gateway';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'void';
export type NotificationChannel = 'whatsapp' | 'sms' | 'push' | 'in_app';
export type NotificationCategory =
  | 'appointment_confirmation'
  | 'appointment_reminder'
  | 'queue_call'
  | 'queue_approaching'
  | 'invoice_receipt'
  | 'cancellation'
  | 'promotion';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'click_to_chat';
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE';

export interface AuditFields {
  id: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
  deleted_at?: string | null;
}

export interface Database {
  public: {
    Tables: {
      branches: {
        Row: AuditFields & {
          branch_number: string;
          name: string;
          sinhala_name: string | null;
          slug: string;
          address: string;
          city: string;
          district: string;
          phone: string;
          whatsapp_number: string;
          email: string | null;
          is_main_branch: boolean;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['branches']['Insert']>;
      };
      roles: {
        Row: AuditFields & {
          name: UserRole;
          display_name: string;
          description: string | null;
          permissions: Json;
        };
        Insert: Omit<Database['public']['Tables']['roles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['roles']['Insert']>;
      };
      profiles: {
        Row: AuditFields & {
          user_id: string | null;
          branch_id: string | null;
          role_id: string | null;
          full_name: string;
          phone_number: string;
          whatsapp_number: string | null;
          profile_photo_url: string | null;
          status: UserStatus;
          language: AppLanguage;
          last_login_at: string | null;
          last_login_ip: string | null;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      staff: {
        Row: AuditFields & {
          branch_id: string;
          profile_id: string | null;
          staff_number: string;
          full_name: string;
          sinhala_name: string | null;
          position: string;
          chair_number: number;
          availability: StaffAvailability;
          working_hours: Json;
          commission_percentage: number;
          photo_url: string | null;
          rating: number;
          reviews_count: number;
          is_active: boolean;
          phone: string | null;
          whatsapp: string | null;
          joining_date: string | null;
          status: 'active' | 'inactive' | 'suspended';
        };
        Insert: Omit<Database['public']['Tables']['staff']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['staff']['Insert']>;
      };
      staff_services: {
        Row: {
          id: string;
          branch_id: string;
          staff_id: string;
          service_id: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['staff_services']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['staff_services']['Insert']>;
      };
      staff_schedules: {
        Row: {
          id: string;
          branch_id: string;
          staff_id: string;
          day_of_week: number;
          day_name: string;
          start_time: string;
          end_time: string;
          break_start: string;
          break_end: string;
          is_working_day: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['staff_schedules']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['staff_schedules']['Insert']>;
      };
      staff_leaves: {
        Row: AuditFields & {
          branch_id: string;
          staff_id: string;
          leave_type: 'annual' | 'medical' | 'personal';
          start_date: string;
          end_date: string;
          days_count: number;
          reason: string;
          status: 'pending' | 'approved' | 'rejected' | 'cancelled';
          approved_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['staff_leaves']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['staff_leaves']['Insert']>;
      };
      customers: {
        Row: AuditFields & {
          branch_id: string;
          profile_id: string | null;
          customer_number: string;
          name: string;
          mobile: string;
          whatsapp: string | null;
          date_of_birth: string | null;
          last_visit: string | null;
          total_visits: number;
          total_spending: number;
          preferred_barber_id: string | null;
          notes: string | null;
          is_vip: boolean;
          status: 'active' | 'inactive' | 'blocked';
          address: string | null;
          preferred_language: AppLanguage;
          profile_photo_url: string | null;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      services: {
        Row: AuditFields & {
          branch_id: string;
          code: string;
          name: string;
          sinhala_name: string;
          description: string | null;
          category: ServiceCategory;
          price: number;
          duration: number;
          icon_name: string;
          display_order: number;
          active_status: boolean;
          is_popular: boolean;
        };
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['services']['Insert']>;
      };
      appointments: {
        Row: AuditFields & {
          branch_id: string;
          appointment_number: string;
          customer_id: string;
          barber_id: string | null;
          appointment_date: string;
          appointment_time: string;
          expected_end_time: string;
          status: AppointmentStatus;
          booking_source: BookingSource;
          total_amount: number;
          cancellation_reason: string | null;
          notes: string | null;
          check_in_time?: string | null;
          started_time?: string | null;
          completed_time?: string | null;
          buffer_minutes?: number;
          reminder_sent?: boolean;
          whatsapp_sent?: boolean;
        };
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>;
      };
      appointment_status_history: {
        Row: {
          id: string;
          appointment_id: string;
          from_status: string | null;
          to_status: string;
          changed_by: string | null;
          change_reason: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['appointment_status_history']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['appointment_status_history']['Insert']>;
      };
      appointment_notes: {
        Row: {
          id: string;
          appointment_id: string;
          author_id: string | null;
          author_name: string | null;
          note: string;
          is_internal: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['appointment_notes']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['appointment_notes']['Insert']>;
      };
      appointment_services: {
        Row: AuditFields & {
          appointment_id: string;
          service_id: string;
          price: number;
          duration_minutes: number;
          staff_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['appointment_services']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['appointment_services']['Insert']>;
      };
      walk_in_customers: {
        Row: AuditFields & {
          branch_id: string;
          walk_in_number: string;
          customer_id?: string | null;
          name: string;
          mobile: string | null;
          whatsapp_number: string | null;
          service_id?: string | null;
          staff_id?: string | null;
          queue_id?: string | null;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['walk_in_customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['walk_in_customers']['Insert']>;
      };
      queue: {
        Row: AuditFields & {
          branch_id: string;
          queue_date: string;
          queue_number: number;
          ticket_code: string;
          queue_type: QueueTicketType;
          customer_id: string | null;
          walk_in_id: string | null;
          appointment_id: string | null;
          staff_id: string | null;
          service_id: string | null;
          priority: QueuePriority;
          status: QueueStatus;
          estimated_waiting_time: number;
          grace_period_minutes: number;
          chair_number?: number;
          position?: number | null;
          called_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          skipped_at?: string | null;
          skip_reason?: string | null;
        };
        Insert: Omit<Database['public']['Tables']['queue']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['queue']['Insert']>;
      };
      queue_history: {
        Row: {
          id: string;
          queue_id: string;
          branch_id: string | null;
          from_status: string | null;
          to_status: string;
          staff_id: string | null;
          chair_number: number | null;
          action_by: string;
          reason: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['queue_history']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['queue_history']['Insert']>;
      };
      queue_events: {
        Row: {
          id: string;
          branch_id: string;
          event_type: string;
          queue_id: string;
          payload: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['queue_events']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['queue_events']['Insert']>;
      };
      realtime_logs: {
        Row: {
          id: string;
          channel: string;
          event: string;
          payload: Json;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['realtime_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['realtime_logs']['Insert']>;
      };
      invoices: {
        Row: AuditFields & {
          branch_id: string;
          invoice_number: string;
          customer_id: string | null;
          walk_in_id: string | null;
          appointment_id: string | null;
          queue_id: string | null;
          staff_id: string | null;
          subtotal: number;
          discount: number;
          tax: number;
          grand_total: number;
          payment_status: PaymentStatus;
          barcode_value: string;
          qr_code_value: string | null;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['invoices']['Insert']>;
      };
      invoice_items: {
        Row: AuditFields & {
          invoice_id: string;
          service_id: string | null;
          item_name: string;
          quantity: number;
          unit_price: number;
          discount: number;
          total: number;
        };
        Insert: Omit<Database['public']['Tables']['invoice_items']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['invoice_items']['Insert']>;
      };
      payments: {
        Row: AuditFields & {
          branch_id: string;
          invoice_id: string;
          reference_number: string;
          payment_method: PaymentMethod;
          amount: number;
          status: PaymentStatus;
          paid_time: string;
          transaction_metadata: Json;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      business_settings: {
        Row: AuditFields & {
          branch_id: string;
          salon_name: string;
          sinhala_name: string | null;
          address: string;
          city: string;
          phone: string;
          whatsapp: string;
          email: string | null;
          logo_url: string | null;
          opening_time: string;
          closing_time: string;
          currency: string;
          time_zone: string;
          invoice_prefix: string;
          queue_prefix: string;
          barcode_prefix: string;
          tax_percentage: number;
          enable_card_payments: boolean;
          enable_lankaqr: boolean;
          enable_walk_ins: boolean;
          enable_notifications: boolean;
          language: AppLanguage;
          lankaqr_merchant_id: string | null;
          lankaqr_account_number: string | null;
        };
        Insert: Omit<Database['public']['Tables']['business_settings']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['business_settings']['Insert']>;
      };
      working_hours: {
        Row: AuditFields & {
          branch_id: string;
          day_name: string;
          day_index: number;
          opening_time: string;
          closing_time: string;
          is_closed: boolean;
          break_start: string | null;
          break_end: string | null;
        };
        Insert: Omit<Database['public']['Tables']['working_hours']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['working_hours']['Insert']>;
      };
      holidays: {
        Row: AuditFields & {
          branch_id: string;
          holiday_date: string;
          reason: string;
          closed: boolean;
        };
        Insert: Omit<Database['public']['Tables']['holidays']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['holidays']['Insert']>;
      };
      notifications: {
        Row: AuditFields & {
          branch_id: string;
          user_id: string | null;
          customer_id: string | null;
          type: NotificationCategory;
          channel: NotificationChannel;
          title: string;
          message: string;
          status: NotificationStatus;
          metadata: Json;
          sent_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      whatsapp_logs: {
        Row: AuditFields & {
          branch_id: string;
          customer_id: string | null;
          recipient: string;
          message_type: NotificationCategory;
          message: string;
          delivery_status: NotificationStatus;
          provider_message_id: string | null;
          timestamp: string;
        };
        Insert: Omit<Database['public']['Tables']['whatsapp_logs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['whatsapp_logs']['Insert']>;
      };
      reports_cache: {
        Row: AuditFields & {
          branch_id: string;
          report_type: string;
          report_date: string;
          report_period: string;
          data: Json;
          generated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reports_cache']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['reports_cache']['Insert']>;
      };
      audit_logs: {
        Row: AuditFields & {
          table_name: string;
          record_id: string | null;
          action: AuditAction;
          old_data: Json | null;
          new_data: Json | null;
          changed_by: string | null;
          changed_at: string;
          ip_address: string | null;
          user_agent: string | null;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      memberships: {
        Row: AuditFields & {
          branch_id: string;
          customer_id: string;
          membership_number: string;
          tier_name: string;
          discount_percentage: number;
          start_date: string;
          expiry_date: string;
          status: string;
        };
        Insert: Omit<Database['public']['Tables']['memberships']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['memberships']['Insert']>;
      };
      loyalty_points: {
        Row: AuditFields & {
          branch_id: string;
          customer_id: string;
          points_balance: number;
          lifetime_points_earned: number;
          last_earned_at: string | null;
          last_redeemed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['loyalty_points']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['loyalty_points']['Insert']>;
      };
      inventory: {
        Row: AuditFields & {
          branch_id: string;
          item_code: string;
          item_name: string;
          category: string;
          unit: string;
          quantity_in_stock: number;
          min_reorder_level: number;
          unit_cost: number;
          retail_price: number | null;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>;
      };
      suppliers: {
        Row: AuditFields & {
          branch_id: string;
          supplier_code: string;
          company_name: string;
          contact_person: string | null;
          phone: string;
          email: string | null;
          address: string | null;
        };
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>;
      };
      purchases: {
        Row: AuditFields & {
          branch_id: string;
          supplier_id: string | null;
          purchase_number: string;
          invoice_number: string | null;
          purchase_date: string;
          total_amount: number;
          payment_status: PaymentStatus;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['purchases']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['purchases']['Insert']>;
      };
      expenses: {
        Row: AuditFields & {
          branch_id: string;
          expense_number: string;
          category: string;
          amount: number;
          payment_method: PaymentMethod;
          expense_date: string;
          description: string | null;
          approved_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      log_security_event: {
        Args: {
          p_action: string;
          p_record_id?: string | null;
          p_details?: Json;
          p_table_name?: string;
          p_user_id?: string | null;
          p_ip_address?: string | null;
          p_user_agent?: string | null;
        };
        Returns: string;
      };
      search_salon_customers: {
        Args: {
          p_branch_id: string;
          p_query?: string | null;
          p_status?: string | null;
          p_limit?: number;
        };
        Returns: Array<{
          id: string;
          customer_number: string;
          name: string;
          mobile: string;
          whatsapp: string;
          status: string;
          total_visits: number;
          total_spending: number;
          last_visit: string | null;
          preferred_barber_name: string | null;
          notes: string | null;
          is_vip: boolean;
        }>;
      };
      upsert_salon_customer: {
        Args: {
          p_branch_id: string;
          p_name: string;
          p_phone: string;
          p_whatsapp?: string | null;
          p_preferred_barber_id?: string | null;
          p_notes?: string | null;
          p_address?: string | null;
          p_date_of_birth?: string | null;
          p_language?: string | null;
          p_status?: string | null;
        };
        Returns: {
          success: boolean;
          is_new: boolean;
          customer: Json;
        };
      };
      get_customer_dashboard_profile: {
        Args: {
          p_customer_id: string;
        };
        Returns: {
          profile: {
            id: string;
            customer_number: string;
            name: string;
            mobile: string;
            whatsapp: string;
            date_of_birth: string | null;
            address: string | null;
            preferred_language: string;
            status: string;
            notes: string | null;
            is_vip: boolean;
            preferred_barber_id: string | null;
            preferred_barber_name: string | null;
            created_at: string;
          };
          metrics: {
            total_spending: number;
            total_visits: number;
            last_visit: string | null;
            upcoming_appointments: number;
            completed_visits: number;
            cancelled_visits: number;
            favourite_service: string | null;
          };
          visit_history: Array<{
            invoice_id: string;
            invoice_number: string;
            visit_date: string;
            grand_total: number;
            payment_method: string;
            barber_name: string;
            services: string[];
          }>;
          error?: string;
        };
      };
      get_crm_customer_analytics: {
        Args: {
          p_branch_id: string;
        };
        Returns: {
          overview: {
            total_customers: number;
            new_this_month: number;
            returning_customers: number;
            retention_rate_pct: number;
            active_customers: number;
            inactive_customers: number;
            blocked_customers: number;
          };
          most_valuable_customers: Array<{
            id: string;
            customer_number: string;
            name: string;
            mobile: string;
            total_spending: number;
            total_visits: number;
            last_visit: string | null;
          }>;
          most_frequent_customers: Array<{
            id: string;
            customer_number: string;
            name: string;
            mobile: string;
            total_visits: number;
            total_spending: number;
            last_visit: string | null;
          }>;
        };
      };
      revoke_user_sessions: {
        Args: {
          p_target_user_id?: string | null;
        };
        Returns: {
          success: boolean;
          user_id: string;
          message: string;
        };
      };
      update_staff_availability: {
        Args: {
          p_staff_id: string;
          p_availability: StaffAvailability;
        };
        Returns: {
          success: boolean;
          staff_id: string;
          full_name: string;
          chair_number: number;
          availability: StaffAvailability;
          message: string;
        };
      };
      get_barber_station_dashboard: {
        Args: {
          p_staff_id: string;
        };
        Returns: {
          staff: any;
          active_ticket: any;
          waiting_queue: any[];
          today_appointments: any[];
          today_stats: {
            completed_jobs: number;
            revenue_lkr: number;
            commission_lkr: number;
            avg_chair_duration_minutes: number;
            cash_collected_lkr: number;
            lankaqr_collected_lkr: number;
          };
        };
      };
      calculate_monthly_staff_commission: {
        Args: {
          p_staff_id: string;
          p_year?: number;
          p_month?: number;
        };
        Returns: {
          staff_id: string;
          staff_number: string;
          staff_name: string;
          position: string;
          chair_number: number;
          commission_percentage: number;
          month: string;
          total_services_count: number;
          gross_revenue_lkr: number;
          net_commission_earned_lkr: number;
          breakdown_by_service: any[];
        };
      };
      generate_available_time_slots: {
        Args: {
          p_branch_id: string;
          p_date: string;
          p_duration_minutes?: number;
          p_barber_id?: string | null;
        };
        Returns: {
          slot_time: string;
          slot_label: string;
          barber_id: string;
          barber_name: string;
          chair_number: number;
          is_available: boolean;
          conflict_reason: string | null;
        }[];
      };
      recommend_barber: {
        Args: {
          p_branch_id: string;
          p_customer_id?: string | null;
          p_service_ids?: string[];
          p_date?: string;
        };
        Returns: {
          recommended_barber_id: string;
          recommended_barber_name: string;
          chair_number: number;
          recommendation_reason: string;
          recommendation_reason_sinhala: string;
          active_appointments_count: number;
          earliest_available_slot: string | null;
        }[];
      };
      check_in_appointment_to_queue: {
        Args: {
          p_appointment_id: string;
        };
        Returns: {
          success: boolean;
          queue_id?: string;
          queue_number?: number;
          ticket_code?: string;
          appointment_number?: string;
          customer_name?: string;
          already_registered?: boolean;
        };
      };
      fn_enqueue_customer: {
        Args: {
          p_branch_id: string;
          p_queue_type: string;
          p_customer_id?: string | null;
          p_walk_in_id?: string | null;
          p_appointment_id?: string | null;
          p_service_id?: string | null;
          p_staff_id?: string | null;
          p_priority?: string;
        };
        Returns: {
          success: boolean;
          queue_id: string;
          queue_number: number;
          ticket_code: string;
          estimated_waiting_time: number;
        };
      };
      fn_call_next_customer: {
        Args: {
          p_branch_id: string;
          p_staff_id?: string | null;
          p_chair_number?: number;
        };
        Returns: {
          success: boolean;
          queue_id?: string;
          queue_number?: number;
          ticket_code?: string;
          chair_number?: number;
          customer_name?: string;
          service_title?: string;
          message?: string;
        };
      };
      fn_start_service: {
        Args: {
          p_queue_id: string;
          p_staff_id?: string | null;
        };
        Returns: {
          success: boolean;
          queue_id: string;
          message?: string;
        };
      };
      fn_complete_service: {
        Args: {
          p_queue_id: string;
        };
        Returns: {
          success: boolean;
          queue_id: string;
          message?: string;
        };
      };
      fn_skip_customer: {
        Args: {
          p_queue_id: string;
          p_reason?: string;
          p_grace_minutes?: number;
        };
        Returns: {
          success: boolean;
          queue_id: string;
          message?: string;
        };
      };
      fn_recall_customer: {
        Args: {
          p_queue_id: string;
        };
        Returns: {
          success: boolean;
          queue_id: string;
          message?: string;
        };
      };
      fn_revert_previous_customer: {
        Args: {
          p_queue_id: string;
        };
        Returns: {
          success: boolean;
          queue_id: string;
          message?: string;
        };
      };
      fn_set_queue_priority: {
        Args: {
          p_queue_id: string;
          p_priority: string;
          p_reason?: string;
        };
        Returns: {
          success: boolean;
          queue_id: string;
          priority: string;
        };
      };
      calculate_queue_estimated_wait_time: {
        Args: {
          p_branch_id: string;
          p_queue_id?: string | null;
        };
        Returns: number;
      };
      fn_get_live_queue_dashboard: {
        Args: {
          p_branch_id: string;
        };
        Returns: {
          chair1_active: any;
          chair2_active: any;
          next_in_line: any;
          waiting_list: any[];
          summary: {
            total_served_today: number;
            in_service_count: number;
            waiting_count: number;
            skipped_count: number;
            walk_in_count: number;
            appointment_count: number;
            avg_wait_minutes: number;
          };
        };
      };
      fn_create_invoice_and_settle: {
        Args: {
          p_branch_id: string;
          p_customer_id?: string | null;
          p_queue_id?: string | null;
          p_appointment_id?: string | null;
          p_walk_in_id?: string | null;
          p_staff_id?: string | null;
          p_items: any[];
          p_discount_amount?: number;
          p_discount_type?: string;
          p_discount_reason?: string | null;
          p_tax_percentage?: number;
          p_payment_method?: string;
          p_cash_tendered?: number;
          p_card_last_four?: string | null;
          p_notes?: string | null;
        };
        Returns: any;
      };
      fn_search_invoices: {
        Args: {
          p_branch_id: string;
          p_query?: string | null;
          p_start_date?: string | null;
          p_end_date?: string | null;
          p_payment_method?: string | null;
          p_payment_status?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: any[];
      };
      fn_get_pos_daily_kpis: {
        Args: {
          p_branch_id: string;
          p_date?: string;
        };
        Returns: any;
      };
      fn_record_refund: {
        Args: {
          p_branch_id: string;
          p_invoice_id: string;
          p_amount: number;
          p_reason: string;
          p_approved_by?: string | null;
        };
        Returns: any;
      };
      fn_register_push_subscription: {
        Args: {
          p_branch_id: string;
          p_endpoint: string;
          p_p256dh: string;
          p_auth: string;
          p_user_agent?: string | null;
          p_device_type?: string;
          p_platform?: string;
          p_user_id?: string | null;
          p_customer_id?: string | null;
        };
        Returns: any;
      };
      fn_process_pwa_offline_batch: {
        Args: {
          p_branch_id: string;
          p_actions: any;
        };
        Returns: any;
      };
      fn_get_pwa_health_metrics: {
        Args: {
          p_branch_id: string;
        };
        Returns: any;
      };
    };
  };
}
