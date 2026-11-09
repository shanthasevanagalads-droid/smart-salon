/**
 * SMART SALON LK - ENTERPRISE DATA VALIDATION & SANITIZATION ENGINE
 * Built specifically for Sri Lankan men's barber salon operations.
 */

// Regular expression for validating UUID v4
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Regular expression for validating Sri Lankan mobile operators:
// 070, 071 (Mobitel), 072, 078 (Hutch), 074, 076, 077 (Dialog), 075 (Airtel)
export const SL_PHONE_REGEX = /^(?:\+94|94|0)?(7[01245678]\d{7})$/;

// Standard RFC 5322 compliant email regex
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates a string as UUID v4
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  return UUID_V4_REGEX.test(uuid.trim());
}

/**
 * Validates and normalizes Sri Lankan phone number to E.164 (+947XXXXXXXX)
 */
export function validateAndFormatSLPhone(phone: string): { isValid: boolean; formatted: string; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, formatted: '', error: 'Phone number is required / දුරකථන අංකය අවශ්‍යයි' };
  }

  // Remove spaces, hyphens, parentheses
  const cleaned = phone.replace(/[^0-9+]/g, '');
  const match = cleaned.match(SL_PHONE_REGEX);

  if (!match) {
    return {
      isValid: false,
      formatted: '',
      error: 'Invalid Sri Lankan mobile number. Enter a valid 07X XXX XXXX number.',
    };
  }

  const nationalNumber = match[1]; // e.g. "771234567"
  const formatted = `+94${nationalNumber}`;

  return { isValid: true, formatted };
}

/**
 * Validates email address
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

/**
 * Strips script tags, HTML entities, and potential XSS vectors
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // remove script tags
    .replace(/[<>]/g, '') // strip < and >
    .trim();
}

/**
 * Validates required text fields
 */
export function validateRequiredString(
  value: string | undefined | null,
  fieldName: string,
  minLength = 1,
  maxLength = 255
): { isValid: boolean; sanitized: string; error?: string } {
  if (!value || typeof value !== 'string') {
    return { isValid: false, sanitized: '', error: `${fieldName} is required.` };
  }

  const sanitized = sanitizeInput(value);
  if (sanitized.length < minLength) {
    return { isValid: false, sanitized, error: `${fieldName} must be at least ${minLength} characters.` };
  }
  if (sanitized.length > maxLength) {
    return { isValid: false, sanitized, error: `${fieldName} cannot exceed ${maxLength} characters.` };
  }

  return { isValid: true, sanitized };
}

/**
 * Validates appointment booking request payload
 */
export interface AppointmentValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  data?: {
    customerName: string;
    customerPhone: string;
    barberId?: string;
    serviceIds: string[];
    date: string;
    time: string;
  };
}

export function validateAppointmentPayload(body: Record<string, unknown>): AppointmentValidationResult {
  const errors: Record<string, string> = {};

  const nameVal = validateRequiredString(body.customerName as string, 'Customer Name', 2, 100);
  if (!nameVal.isValid) errors.customerName = nameVal.error!;

  const phoneVal = validateAndFormatSLPhone(body.customerPhone as string);
  if (!phoneVal.isValid) errors.customerPhone = phoneVal.error!;

  if (body.barberId && !isValidUUID(body.barberId as string)) {
    errors.barberId = 'Invalid Barber UUID.';
  }

  const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds : [];
  if (serviceIds.length === 0) {
    errors.serviceIds = 'At least one service must be selected.';
  }

  const dateStr = body.date as string;
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    errors.date = 'Valid date (YYYY-MM-DD) is required.';
  }

  const timeStr = body.time as string;
  if (!timeStr || !/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    errors.time = 'Valid time (HH:MM) is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: Object.keys(errors).length === 0 ? {
      customerName: nameVal.sanitized,
      customerPhone: phoneVal.formatted,
      barberId: body.barberId as string | undefined,
      serviceIds: serviceIds as string[],
      date: dateStr,
      time: timeStr,
    } : undefined,
  };
}

