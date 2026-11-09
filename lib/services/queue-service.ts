import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  QueueTicketItem,
  LiveQueueDashboard,
  EnqueuePayload,
  QueuePriority,
  QueueStatus,
  RealtimeQueueEventPayload,
} from '@/types/queue';

const DEFAULT_BRANCH_ID =
  process.env.NEXT_PUBLIC_DEFAULT_BRANCH_ID || 'b0000000-0000-0000-0000-000000000001';

// Initial Mock Queue Tickets for Offline & Demo Simulation
const getTodayIso = () => new Date().toISOString().split('T')[0];

let MOCK_QUEUE_TICKETS: QueueTicketItem[] = [
  {
    id: 'f0000000-0000-0000-0000-000000000007',
    branchId: DEFAULT_BRANCH_ID,
    queueDate: getTodayIso(),
    queueNumber: 7,
    ticketCode: `LK-${getTodayIso().replace(/-/g, '')}-007`,
    queueType: 'appointment',
    customerId: 'c0000000-0000-0000-0000-000000000001',
    customerName: 'Nuwan Silva',
    customerPhone: '+94771234567',
    appointmentId: 'd0000000-0000-0000-0000-000000000001',
    staffId: 'c0000000-0000-0000-0000-000000000001',
    staffName: 'Master Kavi (Chair 01)',
    chairNumber: 1,
    serviceId: 'cut-beard',
    serviceName: 'Hair Cut + Beard Grooming',
    serviceSinhala: 'කොණ්ඩය සහ රැවුල',
    servicePriceLkr: 1800,
    durationMinutes: 45,
    priority: 'normal',
    status: 'in_service',
    estimatedWaitingTime: 0,
    gracePeriodMinutes: 0,
    calledAt: new Date(Date.now() - 900000).toISOString(),
    startedAt: new Date(Date.now() - 720000).toISOString(),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 720000).toISOString(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000008',
    branchId: DEFAULT_BRANCH_ID,
    queueDate: getTodayIso(),
    queueNumber: 8,
    ticketCode: `LK-${getTodayIso().replace(/-/g, '')}-008`,
    queueType: 'walk_in',
    walkInId: 'e0000000-0000-0000-0000-000000000001',
    customerName: 'Chaminda Bandara (Walk-in)',
    customerPhone: '+94719876543',
    staffId: 'c0000000-0000-0000-0000-000000000002',
    staffName: 'Sunil Shantha (Chair 02)',
    chairNumber: 2,
    serviceId: 'beard-trim',
    serviceName: 'Beard Sculpt & Razor Lineup',
    serviceSinhala: 'රැවුල හැඩගැන්වීම',
    servicePriceLkr: 800,
    durationMinutes: 20,
    priority: 'normal',
    status: 'in_service',
    estimatedWaitingTime: 0,
    gracePeriodMinutes: 0,
    calledAt: new Date(Date.now() - 480000).toISOString(),
    startedAt: new Date(Date.now() - 300000).toISOString(),
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000009',
    branchId: DEFAULT_BRANCH_ID,
    queueDate: getTodayIso(),
    queueNumber: 9,
    ticketCode: `LK-${getTodayIso().replace(/-/g, '')}-009`,
    queueType: 'appointment',
    customerId: 'c0000000-0000-0000-0000-000000000002',
    customerName: 'Dinesh Kumara',
    customerPhone: '+94765432109',
    staffId: 'c0000000-0000-0000-0000-000000000001',
    staffName: 'Master Kavi (Chair 01)',
    chairNumber: 1,
    serviceId: 'adult-cut',
    serviceName: 'Adult Hair Cut & Wash',
    serviceSinhala: 'වැඩිහිටි කොණ්ඩ කැපීම',
    servicePriceLkr: 1200,
    durationMinutes: 30,
    priority: 'vip',
    status: 'waiting',
    estimatedWaitingTime: 12,
    gracePeriodMinutes: 0,
    createdAt: new Date(Date.now() - 900000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000010',
    branchId: DEFAULT_BRANCH_ID,
    queueDate: getTodayIso(),
    queueNumber: 10,
    ticketCode: `LK-${getTodayIso().replace(/-/g, '')}-010`,
    queueType: 'walk_in',
    customerName: 'Kasun Perera',
    customerPhone: '+94772458901',
    chairNumber: 2,
    serviceId: 'style-cut',
    serviceName: 'Hair Style Cut',
    serviceSinhala: 'විලාසිතා කොණ්ඩ කැපීම',
    servicePriceLkr: 1400,
    durationMinutes: 35,
    priority: 'normal',
    status: 'waiting',
    estimatedWaitingTime: 22,
    gracePeriodMinutes: 0,
    createdAt: new Date(Date.now() - 600000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'f0000000-0000-0000-0000-000000000011',
    branchId: DEFAULT_BRANCH_ID,
    queueDate: getTodayIso(),
    queueNumber: 11,
    ticketCode: `LK-${getTodayIso().replace(/-/g, '')}-011`,
    queueType: 'walk_in',
    customerName: 'Asanka Rodrigo',
    customerPhone: '+94701122334',
    chairNumber: 1,
    serviceId: 'hair-dye',
    serviceName: 'Hair Dye & Black Wash',
    serviceSinhala: 'කොණ්ඩය ඩයි කිරීම',
    servicePriceLkr: 2200,
    durationMinutes: 40,
    priority: 'normal',
    status: 'waiting',
    estimatedWaitingTime: 38,
    gracePeriodMinutes: 0,
    createdAt: new Date(Date.now() - 300000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
  },
];

// Reactive in-memory event listeners for real-time frontend push
type QueueListener = (dashboard: LiveQueueDashboard) => void;
const queueListeners: Set<QueueListener> = new Set();

function notifyLocalListeners(dashboard: LiveQueueDashboard) {
  queueListeners.forEach((listener) => {
    try {
      listener(dashboard);
    } catch (e) {
      console.error('Error notifying queue listener:', e);
    }
  });
}

/**
 * Web Audio API Chime Generator
 * Synthesizes crisp bell/chime alerts in the browser without external audio files
 */
export function playSalonChime(type: 'call' | 'ding' | 'alert' = 'call') {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'call') {
      // Dual-tone airport/salon announcement chime: 587.33Hz (D5) -> 880Hz (A5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(587.33, now);
      osc2.frequency.setValueAtTime(880.0, now + 0.25);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.25);
      osc2.start(now + 0.25);
      osc2.stop(now + 1.2);
    } else {
      // Single high bell ding
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046.5, now); // C6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.8);
    }
  } catch (err) {
    console.warn('Web Audio chime playback suppressed:', err);
  }
}

export class QueueService {
  /**
   * Subscribe to live queue updates via Supabase Realtime + local reactive bus
   */
  static subscribeToLiveQueue(
    branchId: string = DEFAULT_BRANCH_ID,
    onUpdate: (dashboard: LiveQueueDashboard) => void
  ): () => void {
    // 1. Register local listener
    queueListeners.add(onUpdate);

    // 2. Register Supabase Realtime WebSocket channel if configured
    let channel: any = null;
    if (isSupabaseConfigured()) {
      try {
        channel = supabase
          .channel(`salon-live-queue-${branchId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'queue',
              filter: `branch_id=eq.${branchId}`,
            },
            async () => {
              const updatedDashboard = await QueueService.getLiveQueueDashboard(branchId);
              onUpdate(updatedDashboard);
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime channel subscription error:', err);
      }
    }

    // Unsubscribe cleanup function
    return () => {
      queueListeners.delete(onUpdate);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }

  /**
   * Get the complete Live Queue Dashboard (Now Serving, Next, Waiting, Counters)
   */
  static async getLiveQueueDashboard(
    branchId: string = DEFAULT_BRANCH_ID
  ): Promise<LiveQueueDashboard> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_get_live_queue_dashboard', {
          p_branch_id: branchId,
        });

        if (!error && data) {
          const mapTicket = (raw: any): QueueTicketItem | null => {
            if (!raw || !raw.queue_id) return null;
            return {
              id: raw.queue_id,
              branchId,
              queueDate: getTodayIso(),
              queueNumber: raw.queue_number,
              ticketCode: raw.ticket_code,
              queueType: raw.queue_type || 'walk_in',
              customerName: raw.customer_name,
              customerPhone: raw.customer_phone || '',
              staffName: raw.barber_name,
              chairNumber: raw.chair_number || 1,
              serviceName: raw.service_name || 'Haircut',
              servicePriceLkr: raw.service_price || 1200,
              durationMinutes: raw.duration || 30,
              priority: raw.priority || 'normal',
              status: raw.status || 'waiting',
              estimatedWaitingTime: raw.estimated_waiting_time || 0,
              gracePeriodMinutes: raw.grace_period_minutes || 0,
              calledAt: raw.called_at,
              startedAt: raw.started_at,
              completedAt: raw.completed_at,
              createdAt: raw.created_at || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          };

          return {
            chair1Active: mapTicket(data.chair1_active),
            chair2Active: mapTicket(data.chair2_active),
            nextInLine: mapTicket(data.next_in_line),
            waitingList: (data.waiting_list || []).map(mapTicket).filter(Boolean) as QueueTicketItem[],
            summary: {
              totalServedToday: data.summary?.total_served_today || 0,
              inServiceCount: data.summary?.in_service_count || 0,
              waitingCount: data.summary?.waiting_count || 0,
              skippedCount: data.summary?.skipped_count || 0,
              walkInCount: data.summary?.walk_in_count || 0,
              appointmentCount: data.summary?.appointment_count || 0,
              avgWaitMinutes: data.summary?.avg_wait_minutes || 15,
            },
          };
        }
      } catch (err) {
        console.warn('Supabase getLiveQueueDashboard fallback to mock store:', err);
      }
    }

    // Local In-Memory Fallback Dashboard
    const today = getTodayIso();
    const todayTickets = MOCK_QUEUE_TICKETS.filter((t) => t.queueDate === today);

    const chair1Active =
      todayTickets.find(
        (t) =>
          (t.status === 'called' || t.status === 'in_service' || t.status === 'in_chair') &&
          t.chairNumber === 1
      ) || null;

    const chair2Active =
      todayTickets.find(
        (t) =>
          (t.status === 'called' || t.status === 'in_service' || t.status === 'in_chair') &&
          t.chairNumber === 2
      ) || null;

    // Waiting list sorted by: Priority (emergency -> vip -> priority -> normal), position, queue number
    const priorityWeight: Record<QueuePriority, number> = {
      emergency: 1,
      vip: 2,
      priority: 3,
      normal: 4,
    };

    const waitingList = todayTickets
      .filter((t) => t.status === 'waiting')
      .sort((a, b) => {
        const pA = priorityWeight[a.priority] || 4;
        const pB = priorityWeight[b.priority] || 4;
        if (pA !== pB) return pA - pB;
        if (a.position != null && b.position != null) return a.position - b.position;
        return a.queueNumber - b.queueNumber;
      });

    const nextInLine = waitingList[0] || null;

    return {
      chair1Active,
      chair2Active,
      nextInLine,
      waitingList,
      summary: {
        totalServedToday: todayTickets.filter((t) => t.status === 'completed').length + 24, // demo baseline
        inServiceCount: (chair1Active ? 1 : 0) + (chair2Active ? 1 : 0),
        waitingCount: waitingList.length,
        skippedCount: todayTickets.filter((t) => t.status === 'skipped').length,
        walkInCount: todayTickets.filter((t) => t.queueType === 'walk_in').length,
        appointmentCount: todayTickets.filter((t) => t.queueType === 'appointment').length,
        avgWaitMinutes: waitingList.length > 0 ? Math.round((waitingList.length * 20) / 2) : 0,
      },
    };
  }

  /**
   * Find a specific ticket by ticketCode or ID
   */
  static async getTicketByCode(ticketCode: string): Promise<QueueTicketItem | null> {
    const dashboard = await this.getLiveQueueDashboard();
    const all = [
      dashboard.chair1Active,
      dashboard.chair2Active,
      ...dashboard.waitingList,
      ...MOCK_QUEUE_TICKETS,
    ].filter(Boolean) as QueueTicketItem[];

    const cleanCode = ticketCode.trim().toUpperCase();
    return all.find((t) => t.ticketCode.toUpperCase() === cleanCode || t.id === ticketCode) || null;
  }

  /**
   * Enqueue a new Customer (Walk-in or Appointment)
   */
  static async enqueueCustomer(
    payload: EnqueuePayload
  ): Promise<{ ticket: QueueTicketItem; message: string }> {
    const branchId = payload.branchId || DEFAULT_BRANCH_ID;

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_enqueue_customer', {
          p_branch_id: branchId,
          p_queue_type: payload.queueType,
          p_customer_id: null,
          p_walk_in_id: null,
          p_appointment_id: payload.appointmentId || null,
          p_service_id: null,
          p_staff_id: payload.preferredStaffId || null,
          p_priority: payload.priority || 'normal',
        });

        if (!error && data?.success) {
          const dashboard = await this.getLiveQueueDashboard(branchId);
          notifyLocalListeners(dashboard);
          return {
            ticket: {
              id: data.queue_id,
              branchId,
              queueDate: getTodayIso(),
              queueNumber: data.queue_number,
              ticketCode: data.ticket_code,
              queueType: payload.queueType,
              customerName: payload.customerName,
              customerPhone: payload.customerPhone || '',
              chairNumber: 1,
              serviceName: 'Hair Cut & Grooming',
              servicePriceLkr: 1200,
              durationMinutes: 30,
              priority: payload.priority || 'normal',
              status: 'waiting',
              estimatedWaitingTime: data.estimated_waiting_time || 15,
              gracePeriodMinutes: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            message: `Token #${data.queue_number} issued successfully!`,
          };
        }
      } catch (err) {
        console.warn('Supabase enqueue fallback to mock:', err);
      }
    }

    // Local In-Memory Enqueue
    const nextNum = Math.max(0, ...MOCK_QUEUE_TICKETS.map((t) => t.queueNumber)) + 1;
    const ticketCode = `LK-${getTodayIso().replace(/-/g, '')}-${nextNum.toString().padStart(3, '0')}`;
    const estWait = Math.round((MOCK_QUEUE_TICKETS.filter((t) => t.status === 'waiting').length * 22) / 2) + 5;

    const newTicket: QueueTicketItem = {
      id: `queue-${Date.now()}`,
      branchId,
      queueDate: getTodayIso(),
      queueNumber: nextNum,
      ticketCode,
      queueType: payload.queueType,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone || '',
      appointmentId: payload.appointmentId,
      chairNumber: 1,
      serviceName: 'Hair Cut & Grooming',
      servicePriceLkr: 1200,
      durationMinutes: 30,
      priority: payload.priority || 'normal',
      status: 'waiting',
      estimatedWaitingTime: estWait,
      gracePeriodMinutes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    MOCK_QUEUE_TICKETS.push(newTicket);
    const dashboard = await this.getLiveQueueDashboard(branchId);
    notifyLocalListeners(dashboard);
    playSalonChime('ding');

    return {
      ticket: newTicket,
      message: `Token #${nextNum} generated! Customer placed into live waiting list.`,
    };
  }

  /**
   * Call Next Customer in line to a specific Chair
   */
  static async callNextCustomer(
    chairNumber: number,
    staffId?: string,
    branchId: string = DEFAULT_BRANCH_ID
  ): Promise<{ ticket: QueueTicketItem | null; message: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_call_next_customer', {
          p_branch_id: branchId,
          p_staff_id: staffId || null,
          p_chair_number: chairNumber,
        });

        if (!error && data?.success) {
          playSalonChime('call');
          const dashboard = await this.getLiveQueueDashboard(branchId);
          notifyLocalListeners(dashboard);
          return {
            ticket: dashboard.chair1Active?.chairNumber === chairNumber ? dashboard.chair1Active : dashboard.chair2Active,
            message: `Token #${data.queue_number} (${data.customer_name}) called to Chair 0${chairNumber}!`,
          };
        } else if (data && !data.success) {
          return { ticket: null, message: data.message || 'No waiting customers.' };
        }
      } catch (err) {
        console.warn('Supabase callNext fallback:', err);
      }
    }

    // Local In-Memory Call Next
    const dashboard = await this.getLiveQueueDashboard(branchId);
    const nextTicket = dashboard.waitingList[0];

    if (!nextTicket) {
      return { ticket: null, message: 'No customers waiting in line right now.' };
    }

    // Free up chair if occupied
    MOCK_QUEUE_TICKETS.forEach((t) => {
      if (t.chairNumber === chairNumber && (t.status === 'called' || t.status === 'in_service')) {
        t.status = 'completed';
        t.completedAt = new Date().toISOString();
      }
    });

    // Update target ticket
    const ticketIdx = MOCK_QUEUE_TICKETS.findIndex((t) => t.id === nextTicket.id);
    if (ticketIdx !== -1) {
      MOCK_QUEUE_TICKETS[ticketIdx] = {
        ...MOCK_QUEUE_TICKETS[ticketIdx],
        status: 'called',
        chairNumber,
        calledAt: new Date().toISOString(),
        staffName: chairNumber === 1 ? 'Master Kavi (Chair 01)' : 'Sunil Shantha (Chair 02)',
      };
    }

    playSalonChime('call');
    const updated = await this.getLiveQueueDashboard(branchId);
    notifyLocalListeners(updated);

    return {
      ticket: MOCK_QUEUE_TICKETS[ticketIdx],
      message: `Token #${nextTicket.queueNumber} (${nextTicket.customerName}) called to Chair 0${chairNumber}!`,
    };
  }

  /**
   * Start Service (In Chair)
   */
  static async startService(
    queueId: string,
    staffId?: string
  ): Promise<{ success: boolean; message: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_start_service', {
          p_queue_id: queueId,
          p_staff_id: staffId || null,
        });
        if (!error && data?.success) {
          const dashboard = await this.getLiveQueueDashboard();
          notifyLocalListeners(dashboard);
          return { success: true, message: 'Service started in chair.' };
        }
      } catch (err) {
        console.warn('Supabase startService fallback:', err);
      }
    }

    const t = MOCK_QUEUE_TICKETS.find((item) => item.id === queueId);
    if (t) {
      t.status = 'in_service';
      t.startedAt = new Date().toISOString();
      t.updatedAt = new Date().toISOString();
    }

    const dashboard = await this.getLiveQueueDashboard();
    notifyLocalListeners(dashboard);
    return { success: true, message: `Service started for Token #${t?.queueNumber || ''}!` };
  }

  /**
   * Complete Service
   */
  static async completeService(queueId: string): Promise<{ success: boolean; message: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_complete_service', {
          p_queue_id: queueId,
        });
        if (!error && data?.success) {
          const dashboard = await this.getLiveQueueDashboard();
          notifyLocalListeners(dashboard);
          return { success: true, message: 'Service completed! Ready for invoice & payment.' };
        }
      } catch (err) {
        console.warn('Supabase completeService fallback:', err);
      }
    }

    const t = MOCK_QUEUE_TICKETS.find((item) => item.id === queueId);
    if (t) {
      t.status = 'completed';
      t.completedAt = new Date().toISOString();
      t.updatedAt = new Date().toISOString();
    }

    const dashboard = await this.getLiveQueueDashboard();
    notifyLocalListeners(dashboard);
    return {
      success: true,
      message: `Service completed for Token #${t?.queueNumber || ''}! Transferred to POS invoice.`,
    };
  }

  /**
   * Skip Customer
   */
  static async skipCustomer(
    queueId: string,
    reason: string = 'Absent when called',
    graceMinutes: number = 10
  ): Promise<{ success: boolean; message: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_skip_customer', {
          p_queue_id: queueId,
          p_reason: reason,
          p_grace_minutes: graceMinutes,
        });
        if (!error && data?.success) {
          const dashboard = await this.getLiveQueueDashboard();
          notifyLocalListeners(dashboard);
          return { success: true, message: `Customer marked as skipped (${reason}).` };
        }
      } catch (err) {
        console.warn('Supabase skipCustomer fallback:', err);
      }
    }

    const t = MOCK_QUEUE_TICKETS.find((item) => item.id === queueId);
    if (t) {
      t.status = 'skipped';
      t.skippedAt = new Date().toISOString();
      t.skipReason = reason;
      t.gracePeriodMinutes = graceMinutes;
    }

    const dashboard = await this.getLiveQueueDashboard();
    notifyLocalListeners(dashboard);
    return { success: true, message: `Customer #${t?.queueNumber} skipped. Grace period active.` };
  }

  /**
   * Recall Customer
   */
  static async recallCustomer(queueId: string): Promise<{ success: boolean; message: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_recall_customer', {
          p_queue_id: queueId,
        });
        if (!error && data?.success) {
          playSalonChime('call');
          const dashboard = await this.getLiveQueueDashboard();
          notifyLocalListeners(dashboard);
          return { success: true, message: 'Customer recalled to chair!' };
        }
      } catch (err) {
        console.warn('Supabase recallCustomer fallback:', err);
      }
    }

    const t = MOCK_QUEUE_TICKETS.find((item) => item.id === queueId);
    if (t) {
      t.status = 'called';
      t.calledAt = new Date().toISOString();
    }

    playSalonChime('call');
    const dashboard = await this.getLiveQueueDashboard();
    notifyLocalListeners(dashboard);
    return { success: true, message: `Customer #${t?.queueNumber} recalled to chair!` };
  }

  /**
   * Revert / Undo Accidental Call
   */
  static async revertCustomer(queueId: string): Promise<{ success: boolean; message: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_revert_previous_customer', {
          p_queue_id: queueId,
        });
        if (!error && data?.success) {
          const dashboard = await this.getLiveQueueDashboard();
          notifyLocalListeners(dashboard);
          return { success: true, message: 'Customer returned to waiting queue.' };
        }
      } catch (err) {
        console.warn('Supabase revertCustomer fallback:', err);
      }
    }

    const t = MOCK_QUEUE_TICKETS.find((item) => item.id === queueId);
    if (t) {
      t.status = 'waiting';
      t.calledAt = null;
      t.startedAt = null;
    }

    const dashboard = await this.getLiveQueueDashboard();
    notifyLocalListeners(dashboard);
    return { success: true, message: `Customer #${t?.queueNumber} returned to waiting line.` };
  }

  /**
   * Set Priority (VIP, Emergency, Priority, Normal)
   */
  static async setPriority(
    queueId: string,
    priority: QueuePriority,
    reason: string = 'Owner priority bump'
  ): Promise<{ success: boolean; message: string }> {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await (supabase as any).rpc('fn_set_queue_priority', {
          p_queue_id: queueId,
          p_priority: priority,
          p_reason: reason,
        });
        if (!error && data?.success) {
          const dashboard = await this.getLiveQueueDashboard();
          notifyLocalListeners(dashboard);
          return { success: true, message: `Priority set to ${priority.toUpperCase()}` };
        }
      } catch (err) {
        console.warn('Supabase setPriority fallback:', err);
      }
    }

    const t = MOCK_QUEUE_TICKETS.find((item) => item.id === queueId);
    if (t) {
      t.priority = priority;
    }

    const dashboard = await this.getLiveQueueDashboard();
    notifyLocalListeners(dashboard);
    return {
      success: true,
      message: `Token #${t?.queueNumber} priority updated to ${priority.toUpperCase()}!`,
    };
  }

  /**
   * Add Grace Period (+10 mins) when Customer is running late
   */
  static async addGracePeriod(
    queueId: string,
    additionalMinutes: number = 10
  ): Promise<{ newWaitTime: number; message: string }> {
    const t = MOCK_QUEUE_TICKETS.find((item) => item.id === queueId);
    if (t) {
      t.gracePeriodMinutes += additionalMinutes;
      t.estimatedWaitingTime += additionalMinutes;
    }

    const dashboard = await this.getLiveQueueDashboard();
    notifyLocalListeners(dashboard);

    return {
      newWaitTime: t?.estimatedWaitingTime || 25,
      message: `Grace period of +${additionalMinutes} mins saved! Your seat has been held.`,
    };
  }
}
