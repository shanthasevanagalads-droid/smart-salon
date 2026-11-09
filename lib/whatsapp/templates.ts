/**
 * Smart Salon LK - WhatsApp Communication Engine
 * Specially designed for Sri Lankan rural barbershops with bilingual (Sinhala + English) templates.
 */

export interface WhatsAppNotificationPayload {
  customerName: string;
  customerPhone: string;
  salonName: string;
  salonPhone: string;
  salonAddress: string;
  tokenNumber?: number;
  ticketCode?: string;
  serviceName?: string;
  barberName?: string;
  chairNumber?: number;
  dateStr?: string;
  timeSlot?: string;
  estWaitMinutes?: number;
  invoiceNumber?: string;
  totalLkr?: number;
  paymentMethod?: string;
}

/**
 * Format local Sri Lankan mobile numbers into standard international format (e.g. 94771234567)
 */
export function formatSriLankanPhoneNumber(rawPhone: string): string {
  let cleaned = rawPhone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '94' + cleaned.substring(1);
  } else if (!cleaned.startsWith('94')) {
    cleaned = '94' + cleaned;
  }
  return cleaned;
}

/**
 * Build wa.me direct click-to-chat URL with pre-filled message
 */
export function createWhatsAppChatUrl(phone: string, message: string): string {
  const formattedPhone = formatSriLankanPhoneNumber(phone);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}

export const WhatsAppTemplates = {
  /**
   * 1. Booking Confirmation Message
   */
  bookingConfirmation: (p: WhatsAppNotificationPayload): string => {
    return `💈 *${p.salonName}* (ස්මාර්ට් සැලූන්)
━━━━━━━━━━━━━━━━━━━━
ආයුබෝවන් ${p.customerName}, ඔබගේ වේලාව සාර්ථකව වෙන් කරගන්නා ලදී!

📅 දිනය (Date): *${p.dateStr}*
⏰ වේලාව (Time): *${p.timeSlot}*
✂️ සේවාව (Service): *${p.serviceName}*
🧔 බාබර් (Stylist): *${p.barberName || 'Any Available'}*
🎫 ටෝකන් අංකය (Token): *#${p.tokenNumber}*

📍 ස්ථානය: ${p.salonAddress}
📞 දුරකථන: ${p.salonPhone}

කරුණාකර වේලාවට විනාඩි 5කට පෙර සැලූනයට පැමිණෙන්න. ස්තූතියි!`;
  },

  /**
   * 2. Live Queue Calling ("Now Your Turn") Notification
   */
  queueCallAlert: (p: WhatsAppNotificationPayload): string => {
    return `🔔 *${p.salonName} - දැන් ඔබේ වාරයයි!*
━━━━━━━━━━━━━━━━━━━━
මහත්මයාණෙනි, ඔබගේ ටෝකන් අංකය *#${p.tokenNumber}* දැන් සූදානම් කර ඇත.

🪑 පුටු අංකය (Chair): *Chair 0${p.chairNumber || 1}*
✂️ බාබර් (Stylist): *${p.barberName}*
🎫 ටිකට් කේතය: *${p.ticketCode}*

කරුණාකර දැන්ම කවුන්ටරය වෙත පැමිණෙන්න. 
ඔබ විනාඩි 5ක් ඇතුළත නොපැමිණියහොත් ඊළඟ අංකය කැඳවනු ලැබේ.

ස්තූතියි, ${p.salonName}`;
  },

  /**
   * 3. Queue Advance Reminder (When 1-2 customers left ahead)
   */
  queueApproachingAlert: (p: WhatsAppNotificationPayload): string => {
    return `⏳ *${p.salonName} - පෝලිමේ මතක් කිරීම*
━━━━━━━━━━━━━━━━━━━━
ආයුබෝවන් ${p.customerName}, ඔබගේ ටෝකන් අංකය *#${p.tokenNumber}* ළඟා වෙමින් පවතී.

🚶‍♂️ ඔබ ඉදිරියෙන්: *තව පාරිභෝගිකයින් 1 අයෙක් පමණි*
⏱️ ඇස්තමේන්තුගත වේලාව: *විනාඩි ~${p.estWaitMinutes || 10}*

කරුණාකර සැලූනය වෙත පැමිණ වායුසමනය කළ විවේකාගාරයේ රැඳී සිටින්න.`;
  },

  /**
   * 4. Digital Invoice & LankaQR Receipt Sharing
   */
  digitalReceipt: (p: WhatsAppNotificationPayload): string => {
    return `🧾 *${p.salonName} - ඩිජිටල් රිසිට්පත*
━━━━━━━━━━━━━━━━━━━━
ස්තුතියි අපගේ සේවය ලබා ගැනීම ගැන!

🧾 ඉන්වොයිස් අංකය: *${p.invoiceNumber}*
📅 දිනය: *${p.dateStr || new Date().toLocaleDateString('si-LK')}*
✂️ සේවාව: *${p.serviceName}*
💵 ගෙවූ මුදල: *LKR ${p.totalLkr?.toLocaleString()}.00*
📱 ගෙවීම් ක්‍රමය: *${p.paymentMethod?.toUpperCase()} (LankaQR / Cash)*

නැවත ඔබව පිළිගැනීමට බලාපොරොත්තු වෙමු!
💈 *${p.salonName} - Kiribathgoda*`;
  },

  /**
   * 5. Appointment Cancellation Message
   */
  cancellationAlert: (p: WhatsAppNotificationPayload): string => {
    return `⚠️ *${p.salonName} - වෙන්කිරීම අවලංගු කිරීම*
━━━━━━━━━━━━━━━━━━━━
ආයුබෝවන් ${p.customerName}, ඔබගේ ටෝකන් අංක *#${p.tokenNumber}* දරන වෙන්කිරීම සාර්ථකව අවලංගු කරන ලදී.

ඔබට වෙනත් වේලාවක් වෙන්කර ගැනීමට අවශ්‍ය නම් අප හා සම්බන්ධ වන්න.
📞 ${p.salonPhone}`;
  },
};

