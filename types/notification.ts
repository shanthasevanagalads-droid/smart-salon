// ========================================================================
// SMART SALON LK - DOMAIN TYPES: NOTIFICATION & WHATSAPP ENGINE
// ========================================================================

export type NotificationTemplateCode =
  | 'appointment_created'
  | 'appointment_confirmed'
  | 'appointment_reminder'
  | 'queue_joined'
  | 'queue_position_update'
  | 'now_serving'
  | 'service_completed'
  | 'payment_confirmed'
  | 'invoice_delivery'
  | 'appointment_cancelled'
  | 'marketing_campaign';

export type NotificationChannel = 'whatsapp' | 'sms' | 'push';

export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low';

export type NotificationStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export type NotificationLanguage = 'si' | 'en' | 'ta';

export type WhatsAppProvider =
  | 'meta_cloud_api'
  | 'twilio'
  | 'click_to_chat'
  | 'simulated';

export interface NotificationTemplate {
  id: string;
  branchId: string;
  code: NotificationTemplateCode;
  name: string;
  category: 'transactional' | 'reminder' | 'marketing';
  language: NotificationLanguage;
  title?: string;
  bodyTemplate: string;
  variables: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationSettings {
  id?: string;
  branchId: string;
  enableAppointmentMessages: boolean;
  enableQueueMessages: boolean;
  enableInvoiceMessages: boolean;
  enableMarketingMessages: boolean;
  enableReminderMessages: boolean;
  reminderLeadMinutes: number;
  smsFallbackEnabled: boolean;
  whatsappProvider: WhatsAppProvider;
  senderPhoneNumber?: string;
  updatedAt?: string;
}

export interface NotificationQueueItem {
  id: string;
  branchId: string;
  recipientPhone: string;
  customerId?: string | null;
  customerName?: string;
  templateCode: NotificationTemplateCode;
  language: NotificationLanguage;
  channel: NotificationChannel;
  priority: NotificationPriority;
  idempotencyKey: string;
  variables: Record<string, string | number | undefined>;
  renderedBody?: string;
  status: NotificationStatus;
  retryCount: number;
  maxRetries: number;
  scheduledFor: string;
  errorMessage?: string;
  createdAt: string;
}

export interface NotificationLogItem {
  id: string;
  branchId: string;
  queueId?: string;
  customerId?: string | null;
  customerName?: string;
  recipientPhone: string;
  templateCode: NotificationTemplateCode;
  language: NotificationLanguage;
  channel: NotificationChannel;
  messageBody: string;
  variables?: Record<string, any>;
  status: NotificationStatus;
  providerMessageId?: string;
  deliveryTime?: string;
  readTime?: string;
  failureReason?: string;
  createdAt: string;
}

export interface ChannelMetric {
  channel: string;
  count: number;
}

export interface TemplateMetric {
  template_code: string;
  count: number;
}

export interface NotificationAnalytics {
  startDate: string;
  endDate: string;
  totalSent: number;
  delivered: number;
  read: number;
  failed: number;
  pendingQueue: number;
  deliveryRate: number;
  channelBreakdown: ChannelMetric[];
  templatesBreakdown: TemplateMetric[];
}

export interface EnqueueNotificationPayload {
  branchId?: string;
  recipientPhone: string;
  customerId?: string | null;
  customerName?: string;
  templateCode: NotificationTemplateCode;
  language?: NotificationLanguage;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  variables: Record<string, string | number | undefined>;
  idempotencyKey?: string;
  scheduledFor?: string;
}

