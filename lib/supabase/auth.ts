import { supabase, isSupabaseConfigured } from './client';
import { UserRole, UserProfile } from '@/types/salon';

/**
 * Normalizes Sri Lankan phone numbers:
 * '0771234567', '771234567', '94771234567' -> '+94771234567'
 */
export function formatSriLankanPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+94')) return cleaned;
  if (cleaned.startsWith('94')) return `+${cleaned}`;
  if (cleaned.startsWith('0')) return `+94${cleaned.slice(1)}`;
  if (cleaned.length === 9) return `+94${cleaned}`;
  return cleaned;
}

export interface AuthSessionData {
  userId: string;
  phone: string;
  role: UserRole;
  profile: UserProfile | null;
}

/**
 * Send Phone OTP via Supabase Auth
 */
export async function sendPhoneOtp(phone: string): Promise<{ success: boolean; message: string; error?: string }> {
  const formattedPhone = formatSriLankanPhone(phone);
  if (!formattedPhone || formattedPhone.length < 11) {
    return { success: false, message: 'Invalid Sri Lankan phone number. Use 07X XXX XXXX format.' };
  }

  if (!isSupabaseConfigured()) {
    // Demo / mock mode fallback
    return {
      success: true,
      message: 'Demo mode: Use verification code 123456 to log in.',
    };
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone: formattedPhone,
  });

  if (error) {
    return { success: false, message: error.message, error: error.message };
  }

  return { success: true, message: `OTP sent to ${formattedPhone}` };
}

/**
 * Verify Phone OTP
 */
export async function verifyPhoneOtp(
  phone: string,
  token: string
): Promise<{ success: boolean; session?: AuthSessionData; message: string }> {
  const formattedPhone = formatSriLankanPhone(phone);

  // Demo fallback
  if (!isSupabaseConfigured()) {
    if (token === '123456' || token === '000000') {
      const isOwnerPhone = formattedPhone.includes('722759020') || formattedPhone.includes('722759020');
      const mockRole: UserRole = isOwnerPhone ? 'owner' : 'customer';
      return {
        success: true,
        session: {
          userId: 'mock-user-uuid',
          phone: formattedPhone,
          role: mockRole,
          profile: {
            id: 'mock-profile-uuid',
            branchId: 'b0000000-0000-0000-0000-000000000001',
            roleId: mockRole,
            fullName: isOwnerPhone ? 'Salon Owner' : 'Salon Customer',
            phoneNumber: formattedPhone,
            whatsappNumber: formattedPhone,
            status: 'active',
            language: 'si',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        message: 'Successfully authenticated (Demo mode)',
      };
    }
    return { success: false, message: 'Invalid OTP code. In demo mode, use 123456.' };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone: formattedPhone,
    token,
    type: 'sms',
  });

  if (error || !data.user) {
    return { success: false, message: error?.message || 'Verification failed.' };
  }

  // Fetch user profile and role
  const profileData = await fetchUserProfile(data.user.id);

  return {
    success: true,
    session: {
      userId: data.user.id,
      phone: formattedPhone,
      role: profileData?.role || 'customer',
      profile: profileData?.profile || null,
    },
    message: 'Login successful.',
  };
}

/**
 * Fetch profile and role from Supabase DB
 */
export async function fetchUserProfile(userId: string): Promise<{ profile: UserProfile | null; role: UserRole } | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = (await supabase
    .from('profiles')
    .select(`
      id,
      branch_id,
      full_name,
      phone_number,
      whatsapp_number,
      status,
      language,
      roles:role_id ( name )
    `)
    .eq('user_id', userId)
    .single()) as { data: any; error: any };

  if (error || !data) {
    return { profile: null, role: 'customer' };
  }

  const roleName = ((data.roles as unknown) as { name?: string })?.name as UserRole || 'customer';

  return {
    role: roleName,
    profile: {
      id: data.id,
      branchId: data.branch_id,
      roleId: roleName,
      fullName: data.full_name,
      phoneNumber: data.phone_number,
      whatsappNumber: data.whatsapp_number,
      status: data.status,
      language: data.language,
      createdAt: '',
      updatedAt: '',
    },
  };
}

/**
 * Sign Out
 */
export async function logOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut();
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('smart_salon_auth');
    localStorage.removeItem('smart_salon_role');
  }
}

