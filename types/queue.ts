export type QueueStatus =
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'in_chair'
  | 'completed'
  | 'skipped'
  | 'cancelled';

export type QueuePriority = 'normal' | 'priority' | 'vip' | 'emergency';

export type QueueTicketType = 'walk_in' | 'appointment';

export interface QueueTicketItem {
  id: string;
  branchId: string;
  queueDate: string; // YYYY-MM-DD
  queueNumber: number; // 1, 2, 3...
  ticketCode: string; // e.g. LK-20261102-007
  queueType: QueueTicketType;
  customerId?: string | null;
  walkInId?: string | null;
  customerName: string;
  customerPhone: string;
  appointmentId?: string | null;
  staffId?: string | null;
  staffName?: string;
  chairNumber: number; // 1 or 2
  serviceId?: string | null;
  serviceName: string;
  serviceSinhala?: string;
  servicePriceLkr: number;
  durationMinutes: number;
  priority: QueuePriority;
  status: QueueStatus;
  estimatedWaitingTime: number; // minutes
  gracePeriodMinutes: number;
  calledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  skippedAt?: string | null;
  skipReason?: string | null;
  position?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiveQueueSummary {
  totalServedToday: number;
  inServiceCount: number;
  waitingCount: number;
  skippedCount: number;
  walkInCount: number;
  appointmentCount: number;
  avgWaitMinutes: number;
}

export interface LiveQueueDashboard {
  chair1Active: QueueTicketItem | null;
  chair2Active: QueueTicketItem | null;
  nextInLine: QueueTicketItem | null;
  waitingList: QueueTicketItem[];
  summary: LiveQueueSummary;
}

export interface EnqueuePayload {
  branchId?: string;
  queueType: QueueTicketType;
  customerName: string;
  customerPhone?: string;
  serviceId?: string;
  preferredStaffId?: string;
  appointmentId?: string;
  priority?: QueuePriority;
  notes?: string;
}

export interface RealtimeQueueEventPayload {
  eventType:
    | 'TICKET_ENQUEUED'
    | 'CUSTOMER_CALLED'
    | 'SERVICE_STARTED'
    | 'SERVICE_COMPLETED'
    | 'CUSTOMER_SKIPPED'
    | 'CUSTOMER_RECALLED'
    | 'PRIORITY_CHANGED'
    | 'QUEUE_REORDERED';
  queueId: string;
  queueNumber: number;
  ticketCode?: string;
  chairNumber?: number;
  priority?: QueuePriority;
  customerName?: string;
  serviceTitle?: string;
  timestamp: string;
}

