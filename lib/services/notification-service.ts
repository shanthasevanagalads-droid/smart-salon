// ========================================================================
// SMART SALON LK - NOTIFICATION & WHATSAPP SERVICE
// Multi-Channel Engine: WhatsApp Cloud API, Click-to-Chat Deep Links & SMS Fallback
// ========================================================================

import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  NotificationTemplate,
  NotificationSettings,
  NotificationQueueItem,
  NotificationLogItem,
  NotificationAnalytics,
  EnqueueNotificationPayload,
  NotificationTemplateCode,
  NotificationLanguage,
} from '@/types/notification';

const DEFAULT_BRANCH_ID =
  process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID || 'b0000000-0000-0000-0000-000000000001';

// ------------------------------------------------------------------------
// DEFAULT SYSTEM TEMPLATES (Sinhala & English)
// ------------------------------------------------------------------------
export const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'tmpl-1-si',
    branchId: DEFAULT_BRANCH_ID,
    code: 'appointment_confirmed',
    name: 'Appointment Confirmed (Sinhala)',
    category: 'transactional',
    language: 'si',
    title: 'වෙන්කරවා ගැනීම තහවුරු විය',
    bodyTemplate:
      'ආයුබෝවන් {{customer_name}}, {{salon_name}} වෙත ඔබගේ වෙන්කරවා ගැනීම සාර්ථකව තහවුරු කර ඇත! ✂️\n\n' +
      '📅 දිනය: {{date}}\n' +
      '⏰ වේලාව: {{time}}\n' +
      '💈 කාර්ය මණ්ඩලය: {{barber_name}}\n' +
      '🔖 අංකය: {{appointment_number}}\n\n' +
      'කරුණාකර මිනිත්තු 5කට පෙර පැමිණෙන්න. ස්තුතියි!',
    variables: ['customer_name', 'salon_name', 'date', 'time', 'barber_name', 'appointment_number'],
    isActive: true,
  },
  {
    id: 'tmpl-1-en',
    branchId: DEFAULT_BRANCH_ID,
    code: 'appointment_confirmed',
    name: 'Appointment Confirmed (English)',
    category: 'transactional',
    language: 'en',
    title: 'Appointment Confirmed',
    bodyTemplate:
      'Hello {{customer_name}}, your booking at {{salon_name}} is confirmed! ✂️\n\n' +
      '📅 Date: {{date}}\n' +
      '⏰ Time: {{time}}\n' +
      '💈 Stylist: {{barber_name}}\n' +
      '🔖 Booking Ref: {{appointment_number}}\n\n' +
      'Please arrive 5 minutes before your scheduled slot. Thank you!',
    variables: ['customer_name', 'salon_name', 'date', 'time', 'barber_name', 'appointment_number'],
    isActive: true,
  },
  {
    id: 'tmpl-2-si',
    branchId: DEFAULT_BRANCH_ID,
    code: 'appointment_reminder',
    name: 'Appointment Reminder (Sinhala)',
    category: 'reminder',
    language: 'si',
    title: 'වෙන්කරවා ගැනීම පිළිබඳ මතක් කිරීම',
    bodyTemplate:
      'ආයුබෝවන් {{customer_name}}, {{salon_name}} හි ඔබගේ වෙන්කරවා ගැනීම අද දින {{time}} ට නියමිත බව මතක් කරමු. ⏰\n\n' +
      '💈 කප්පාදු ශිල්පී: {{barber_name}}\n\n' +
      'ඔබට පැමිණීමට නොහැකි නම් කරුණාකර අපට දන්වන්න. ස්තුතියි!',
    variables: ['customer_name', 'salon_name', 'time', 'barber_name'],
    isActive: true,
  },
  {
    id: 'tmpl-3-si',
    branchId: DEFAULT_BRANCH_ID,
    code: 'queue_position_update',
    name: 'Queue Position Update (Sinhala)',
    category: 'transactional',
    language: 'si',
    title: 'පෝලිමේ වත්මන් තත්ත්වය',
    bodyTemplate:
      'ආයුබෝවන් {{customer_name}}, {{salon_name}} සජීවී පෝලිමේ ඔබගේ ටෝකන් අංකය {{queue_number}} වේ. 💈\n\n' +
      '⏳ ඉදිරියෙන් සිටින ගනුදෙනුකරුවන්: {{ahead_count}}\n' +
      '⏱️ ඇස්තමේන්තුගත කාලය: මිනිත්තු {{estimated_wait_time}}\n\n' +
      'ඔබගේ වාරය ළඟාවෙමින් පවතී!',
    variables: ['customer_name', 'salon_name', 'queue_number', 'ahead_count', 'estimated_wait_time'],
    isActive: true,
  },
  {
    id: 'tmpl-4-si',
    branchId: DEFAULT_BRANCH_ID,
    code: 'now_serving',
    name: 'Now Serving Alert (Sinhala)',
    category: 'transactional',
    language: 'si',
    title: 'ඔබගේ වාරය පැමිණ ඇත!',
    bodyTemplate:
      '🔔 ආයුබෝවන් {{customer_name}}, ඔබගේ වාරය දැන් පැමිණ ඇත!\n\n' +
      '🔖 ටෝකන් අංකය: {{queue_number}}\n' +
      '💺 පුටු අංකය: {{chair_number}} ({{barber_name}})\n\n' +
      'කරුණාකර දැන් කප්පාදු අසුන වෙත පැමිණෙන්න. ස්තුතියි!',
    variables: ['customer_name', 'queue_number', 'chair_number', 'barber_name'],
    isActive: true,
  },
  {
    id: 'tmpl-5-si',
    branchId: DEFAULT_BRANCH_ID,
    code: 'service_completed',
    name: 'Service Completed (Sinhala)',
    category: 'transactional',
    language: 'si',
    title: 'සේවාව අවසන් විය',
    bodyTemplate:
      'ස්තුතියි {{customer_name}}, {{salon_name}} වෙතින් ලබාගත් සේවාව සාර්ථකව අවසන් විය! ✨\n\n' +
      'කරුණාකර බිල්පත ගෙවීම සඳහා මුදල් කවුන්ටරය (POS) වෙත යොමුවන්න.',
    variables: ['customer_name', 'salon_name'],
    isActive: true,
  },
  {
    id: 'tmpl-6-si',
    branchId: DEFAULT_BRANCH_ID,
    code: 'payment_confirmed',
    name: 'Payment & Invoice Delivery (Sinhala)',
    category: 'transactional',
    language: 'si',
    title: 'ගෙවීම තහවුරු විය සහ බිල්පත',
    bodyTemplate:
      'ආයුබෝවන් {{customer_name}}, {{salon_name}} වෙත ඔබගේ ගෙවීම සාර්ථකව ලැබුණි! 🧾\n\n' +
      '🧾 ඉන්වොයිස් අංකය: {{invoice_number}}\n' +
      '💰 ගෙවූ මුදල: LKR {{payment_amount}}\n' +
      '💳 ගෙවූ ක්‍රමය: {{payment_method}}\n\n' +
      'ඔබගේ ඩිජිටල් බිල්පත බැලීමට: {{receipt_url}}\n\n' +
      'අප වෙත නැවත පැමිණෙන්න! සුභ දවසක්!',
    variables: ['customer_name', 'salon_name', 'invoice_number', 'payment_amount', 'payment_method', 'receipt_url'],
    isActive: true,
  },
  {
    id: 'tmpl-7-si',
    branchId: DEFAULT_BRANCH_ID,
    code: 'appointment_cancelled',
    name: 'Appointment Cancelled (Sinhala)',
    category: 'transactional',
    language: 'si',
    title: 'වෙන්කරවා ගැනීම අවලංගු විය',
    bodyTemplate:
      'ආයුබෝවන් {{customer_name}}, {{salon_name}} හි ඔබගේ වෙන්කරවා ගැනීම ({{appointment_number}}) අවලංගු කර ඇත.\n\n' +
      'නැවත වෙන්කරවා ගැනීම සඳහා අප අමතන්න. ස්තුතියි!',
    variables: ['customer_name', 'salon_name', 'appointment_number'],
    isActive: true,
  },
];

// ------------------------------------------------------------------------
// IN-MEMORY FALLBACK STORE (Offline & Local Demo Resilience)
// ------------------------------------------------------------------------
let LOCAL_SETTINGS: NotificationSettings = {
  branchId: DEFAULT_BRANCH_ID,
  enableAppointmentMessages: true,
  enableQueueMessages: true,
  enableInvoiceMessages: true,
  enableMarketingMessages: false,
  enableReminderMessages: true,
  reminderLeadMinutes: 60,
  smsFallbackEnabled: true,
  whatsappProvider: 'click_to_chat',
  senderPhoneNumber: '+94770000000',
  updatedAt: new Date().toISOString(),
};

let LOCAL_QUEUE: NotificationQueueItem[] = [];

let LOCAL_LOGS: NotificationLogItem[] = [
  {
    id: 'log-101',
    branchId: DEFAULT_BRANCH_ID,
    customerName: 'Kasun Perera',
    recipientPhone: '+94771234567',
    templateCode: 'payment_confirmed',
    language: 'si',
    channel: 'whatsapp',
    messageBody:
      'ආයුබෝවන් Kasun Perera, The Royal Blade වෙත ඔබගේ ගෙවීම සාර්ථකව ලැබුණි! 🧾\n\n' +
      '🧾 ඉන්වොයිස් අංකය: INV-2026-000001\n' +
      '💰 ගෙවූ මුදල: LKR 1,800.00\n' +
      '💳 ගෙවූ ක්‍රමය: CASH\n\n' +
      'ස්තුතියි, නැවත එන්න!',
    status: 'read',
    deliveryTime: new Date(Date.now() - 3600000).toISOString(),
    readTime: new Date(Date.now() - 3400000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'log-102',
    branchId: DEFAULT_BRANCH_ID,
    customerName: 'Ruwan Pradeep',
    recipientPhone: '+94712345678',
    templateCode: 'now_serving',
    language: 'si',
    channel: 'whatsapp',
    messageBody:
      '🔔 ආයුබෝවන් Ruwan Pradeep, ඔබගේ වාරය දැන් පැමිණ ඇත!\n\n' +
      '🔖 ටෝකන් අංකය: #08\n' +
      '💺 පුටු අංකය: 02 (Sunil Shantha)\n\n' +
      'කරුණාකර කප්පාදු අසුන වෙත පැමිණෙන්න.',
    status: 'delivered',
    deliveryTime: new Date(Date.now() - 1800000).toISOString(),
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'log-103',
    branchId: DEFAULT_BRANCH_ID,
    customerName: 'Dinesh Kumara',
    recipientPhone: '+94761234567',
    templateCode: 'appointment_confirmed',
    language: 'en',
    channel: 'whatsapp',
    messageBody:
      'Hello Dinesh Kumara, your booking at The Royal Blade is confirmed! ✂️\n\n' +
      '📅 Date: 2026-11-03\n' +
      '⏰ Time: 10:30 AM\n' +
      '💈 Stylist: Master Kavi',
    status: 'sent',
    deliveryTime: new Date(Date.now() - 600000).toISOString(),
    createdAt: new Date(Date.now() - 600000).toISOString(),
  },
];

// ------------------------------------------------------------------------
// NOTIFICATION SERVICE IMPLEMENTATION
// ------------------------------------------------------------------------
export class NotificationService {
  /**
   * Render dynamic message template by interpolating {{variable}} keys
   */
  static renderTemplate(templateStr: string, variables: Record<string, string | number | undefined>): string {
    let result = templateStr;
    for (const [key, val] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(val ?? ''));
    }
    return result;
  }

  /**
   * Format phone number to clean Sri Lankan international format (+947XXXXXXXX)
   */
  static cleanPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '94' + cleaned.substring(1);
    } else if (!cleaned.startsWith('94') && cleaned.length === 9) {
      cleaned = '94' + cleaned;
    }
    return '+' + cleaned;
  }

  /**
   * Generate wa.me deep link for instant client-side or web dispatch
   */
  static generateWhatsAppUrl(phone: string, message: string): string {
    const cleanDigits = this.cleanPhoneNumber(phone).replace(/\D/g, '');
    return `https://wa.me/${cleanDigits}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Enqueue a notification with idempotency check
   */
  static async enqueueNotification(payload: EnqueueNotificationPayload): Promise<{
    success: boolean;
    queueId?: string;
    renderedBody?: string;
    whatsappUrl?: string;
    isDuplicate?: boolean;
    error?: string;
  }> {
    const branchId = payload.branchId || DEFAULT_BRANCH_ID;
    const cleanPhone = this.cleanPhoneNumber(payload.recipientPhone);
    const lang = payload.language || 'si';

    // Check setting toggles
    if (
      (payload.templateCode.startsWith('appointment_') && !LOCAL_SETTINGS.enableAppointmentMessages) ||
      (payload.templateCode.startsWith('queue_') && !LOCAL_SETTINGS.enableQueueMessages) ||
      (payload.templateCode.startsWith('now_serving') && !LOCAL_SETTINGS.enableQueueMessages) ||
      (payload.templateCode.startsWith('payment_') && !LOCAL_SETTINGS.enableInvoiceMessages)
    ) {
      return { success: false, error: 'Notification category is disabled in owner settings.' };
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_enqueue_notification', {
          p_branch_id: branchId,
          p_recipient_phone: cleanPhone,
          p_template_code: payload.templateCode,
          p_variables: payload.variables,
          p_customer_id: payload.customerId || null,
          p_language: lang,
          p_channel: payload.channel || 'whatsapp',
          p_priority: payload.priority || 'normal',
          p_idempotency_key: payload.idempotencyKey || null,
          p_scheduled_for: payload.scheduledFor || new Date().toISOString(),
        });

        if (!error && data && data.success) {
          const waUrl = this.generateWhatsAppUrl(cleanPhone, data.rendered_body);
          return {
            success: true,
            queueId: data.queue_id,
            renderedBody: data.rendered_body,
            whatsappUrl: waUrl,
            isDuplicate: data.is_duplicate,
          };
        }
      } catch (err: any) {
        console.warn('[NotificationService] enqueue RPC error, falling back:', err.message);
      }
    }

    // Local / Offline Queue Simulation
    const tmpl =
      DEFAULT_TEMPLATES.find((t) => t.code === payload.templateCode && t.language === lang) ||
      DEFAULT_TEMPLATES.find((t) => t.code === payload.templateCode) ||
      DEFAULT_TEMPLATES[0];

    const rendered = this.renderTemplate(tmpl.bodyTemplate, {
      salon_name: 'The Royal Blade',
      ...payload.variables,
    });

    const queueId = `queue-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const item: NotificationQueueItem = {
      id: queueId,
      branchId,
      recipientPhone: cleanPhone,
      customerId: payload.customerId,
      customerName: payload.customerName,
      templateCode: payload.templateCode,
      language: lang,
      channel: payload.channel || 'whatsapp',
      priority: payload.priority || 'normal',
      idempotencyKey: payload.idempotencyKey || `IDEM-${Date.now()}`,
      variables: payload.variables,
      renderedBody: rendered,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      scheduledFor: payload.scheduledFor || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    LOCAL_QUEUE.unshift(item);

    // Auto-deliver immediately in local demo mode
    const logItem: NotificationLogItem = {
      id: `log-${Date.now()}`,
      branchId,
      queueId,
      customerName: payload.customerName,
      recipientPhone: cleanPhone,
      templateCode: payload.templateCode,
      language: lang,
      channel: payload.channel || 'whatsapp',
      messageBody: rendered,
      status: 'delivered',
      deliveryTime: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    LOCAL_LOGS.unshift(logItem);

    return {
      success: true,
      queueId,
      renderedBody: rendered,
      whatsappUrl: this.generateWhatsAppUrl(cleanPhone, rendered),
    };
  }

  /**
   * Process all pending messages in queue
   */
  static async processQueue(batchSize: number = 10): Promise<{
    success: boolean;
    processedCount: number;
    failedCount: number;
  }> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_process_notification_queue', {
          p_branch_id: DEFAULT_BRANCH_ID,
          p_batch_size: batchSize,
        });
        if (!error && data) {
          return {
            success: true,
            processedCount: data.processed_count || 0,
            failedCount: data.failed_count || 0,
          };
        }
      } catch (err: any) {
        console.warn('[NotificationService] processQueue error:', err.message);
      }
    }

    // Local queue flush
    let count = 0;
    LOCAL_QUEUE.forEach((q) => {
      if (q.status === 'pending') {
        q.status = 'sent';
        count++;
      }
    });

    return { success: true, processedCount: count, failedCount: 0 };
  }

  /**
   * Fetch Realtime Notification Analytics & Delivery Rates
   */
  static async getAnalytics(startDate?: string, endDate?: string): Promise<NotificationAnalytics> {
    const today = new Date().toISOString().split('T')[0];
    const sDate = startDate || today;
    const eDate = endDate || today;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.rpc('fn_get_notification_analytics', {
          p_branch_id: DEFAULT_BRANCH_ID,
          p_start_date: sDate,
          p_end_date: eDate,
        });
        if (!error && data) {
          return {
            startDate: data.start_date,
            endDate: data.end_date,
            totalSent: Number(data.total_sent || 0),
            delivered: Number(data.delivered || 0),
            read: Number(data.read || 0),
            failed: Number(data.failed || 0),
            pendingQueue: Number(data.pending_queue || 0),
            deliveryRate: Number(data.delivery_rate || 100),
            channelBreakdown: data.channel_breakdown || [{ channel: 'whatsapp', count: 0 }],
            templatesBreakdown: data.templates_breakdown || [],
          };
        }
      } catch (err: any) {
        console.warn('[NotificationService] analytics error:', err.message);
      }
    }

    // Fallback analytics
    const total = LOCAL_LOGS.length;
    const delivered = LOCAL_LOGS.filter((l) => l.status === 'delivered' || l.status === 'read').length;
    const read = LOCAL_LOGS.filter((l) => l.status === 'read').length;
    const failed = LOCAL_LOGS.filter((l) => l.status === 'failed').length;

    return {
      startDate: sDate,
      endDate: eDate,
      totalSent: total,
      delivered,
      read,
      failed,
      pendingQueue: LOCAL_QUEUE.filter((q) => q.status === 'pending').length,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 100,
      channelBreakdown: [
        { channel: 'whatsapp', count: total },
        { channel: 'sms', count: 0 },
      ],
      templatesBreakdown: [
        { template_code: 'appointment_confirmed', count: 12 },
        { template_code: 'now_serving', count: 8 },
        { template_code: 'payment_confirmed', count: 6 },
        { template_code: 'queue_position_update', count: 4 },
      ],
    };
  }

  /**
   * Fetch All Templates
   */
  static async getTemplates(): Promise<NotificationTemplate[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('notification_templates')
          .select('*')
          .eq('is_active', true)
          .order('code', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((t: any) => ({
            id: t.id,
            branchId: t.branch_id,
            code: t.code,
            name: t.name,
            category: t.category,
            language: t.language,
            title: t.title,
            bodyTemplate: t.body_template,
            variables: t.variables || [],
            isActive: t.is_active,
          }));
        }
      } catch (err: any) {
        console.warn('[NotificationService] getTemplates error:', err.message);
      }
    }

    return DEFAULT_TEMPLATES;
  }

  /**
   * Update or Save Template
   */
  static async saveTemplate(template: Partial<NotificationTemplate>): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured() && supabase && template.code) {
      try {
        const { error } = await supabase.from('notification_templates').upsert({
          branch_id: template.branchId || DEFAULT_BRANCH_ID,
          code: template.code,
          name: template.name || template.code,
          language: template.language || 'si',
          title: template.title,
          body_template: template.bodyTemplate,
          variables: template.variables || [],
          is_active: template.isActive ?? true,
          updated_at: new Date().toISOString(),
        });
        if (!error) return { success: true };
      } catch (err: any) {
        console.warn('[NotificationService] saveTemplate error:', err.message);
      }
    }

    // Local update
    const idx = DEFAULT_TEMPLATES.findIndex((t) => t.code === template.code && t.language === template.language);
    if (idx >= 0 && template.bodyTemplate) {
      DEFAULT_TEMPLATES[idx].bodyTemplate = template.bodyTemplate;
      if (template.title) DEFAULT_TEMPLATES[idx].title = template.title;
    }
    return { success: true };
  }

  /**
   * Get Owner Notification Settings
   */
  static async getSettings(): Promise<NotificationSettings> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('notification_settings')
          .select('*')
          .eq('branch_id', DEFAULT_BRANCH_ID)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            branchId: data.branch_id,
            enableAppointmentMessages: data.enable_appointment_messages,
            enableQueueMessages: data.enable_queue_messages,
            enableInvoiceMessages: data.enable_invoice_messages,
            enableMarketingMessages: data.enable_marketing_messages,
            enableReminderMessages: data.enable_reminder_messages,
            reminderLeadMinutes: data.reminder_lead_minutes,
            smsFallbackEnabled: data.sms_fallback_enabled,
            whatsappProvider: data.whatsapp_provider,
            senderPhoneNumber: data.sender_phone_number,
            updatedAt: data.updated_at,
          };
        }
      } catch (err: any) {
        console.warn('[NotificationService] getSettings error:', err.message);
      }
    }

    return LOCAL_SETTINGS;
  }

  /**
   * Save Owner Notification Settings
   */
  static async saveSettings(settings: Partial<NotificationSettings>): Promise<{ success: boolean; error?: string }> {
    LOCAL_SETTINGS = { ...LOCAL_SETTINGS, ...settings, updatedAt: new Date().toISOString() };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.rpc('fn_save_notification_settings', {
          p_branch_id: DEFAULT_BRANCH_ID,
          p_enable_appointments: LOCAL_SETTINGS.enableAppointmentMessages,
          p_enable_queue: LOCAL_SETTINGS.enableQueueMessages,
          p_enable_invoices: LOCAL_SETTINGS.enableInvoiceMessages,
          p_enable_marketing: LOCAL_SETTINGS.enableMarketingMessages,
          p_reminder_lead_minutes: LOCAL_SETTINGS.reminderLeadMinutes,
          p_sms_fallback: LOCAL_SETTINGS.smsFallbackEnabled,
          p_whatsapp_provider: LOCAL_SETTINGS.whatsappProvider,
        });
        if (!error) return { success: true };
      } catch (err: any) {
        console.warn('[NotificationService] saveSettings error:', err.message);
      }
    }

    return { success: true };
  }

  /**
   * Search / List Notification Logs
   */
  static async searchLogs(query?: string, status?: string, channel?: string): Promise<NotificationLogItem[]> {
    let list = [...LOCAL_LOGS];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (l) =>
          l.recipientPhone.toLowerCase().includes(q) ||
          l.customerName?.toLowerCase().includes(q) ||
          l.templateCode.toLowerCase().includes(q) ||
          l.messageBody.toLowerCase().includes(q)
      );
    }
    if (status && status !== 'all') {
      list = list.filter((l) => l.status === status);
    }
    if (channel && channel !== 'all') {
      list = list.filter((l) => l.channel === channel);
    }
    return list;
  }

  /**
   * Send Direct Test Message
   */
  static async sendTestMessage(
    phone: string,
    templateCode: NotificationTemplateCode,
    language: NotificationLanguage = 'si'
  ): Promise<{ success: boolean; whatsappUrl: string; renderedBody: string }> {
    return this.enqueueNotification({
      recipientPhone: phone,
      templateCode,
      language,
      variables: {
        customer_name: 'Test Customer (පරීක්ෂණ)',
        salon_name: 'The Royal Blade',
        date: new Date().toISOString().split('T')[0],
        time: '11:00 AM',
        barber_name: 'Master Kavi (Chair 01)',
        appointment_number: 'APT-TEST-001',
        queue_number: '#07',
        chair_number: '01',
        ahead_count: '2',
        estimated_wait_time: '25',
        invoice_number: 'INV-TEST-001',
        payment_amount: '1,800.00',
        payment_method: 'LankaQR',
        receipt_url: 'https://smartsalon.lk/receipt/test',
      },
    }) as any;
  }
}

