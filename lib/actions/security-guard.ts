import { cookies } from 'next/headers';
import { UserRole } from '@/types/salon';
import { AuthenticationError, ForbiddenError, AccountSuspendedError } from '@/lib/security/errors';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Server Action & Route Handler Role Guard
 * Enforces authenticated role capabilities securely on the server.
 */
export async function requireAuthRole(allowedRoles: UserRole[]) {
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value || cookieStore.get('smart_salon_auth')?.value;
  const roleCookie = cookieStore.get('smart_salon_role')?.value as UserRole | undefined;

  if (!token) {
    throw new AuthenticationError('Please log in to perform this operation.');
  }

  // Local development / demo bypass
  if (token === 'demo-token') {
    const role = roleCookie || 'owner';
    if (!allowedRoles.includes(role)) {
      throw new ForbiddenError(`Access denied: Requires ${allowedRoles.join(' or ')} permission.`);
    }
    return {
      userId: 'demo-user-id',
      role,
      status: 'active' as const,
    };
  }

  const supabase = createAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new AuthenticationError('Invalid or expired authentication session.');
  }

  // Check profile status and role from database
  const { data: profile } = (await supabase
    .from('profiles')
    .select('id, status, roles:role_id ( name )')
    .eq('user_id', user.id)
    .single()) as { data: any; error: any };

  const userRole = ((profile?.roles as unknown) as { name?: string })?.name as UserRole || 'customer';

  if (profile?.status === 'suspended') {
    throw new AccountSuspendedError();
  }

  if (!allowedRoles.includes(userRole)) {
    throw new ForbiddenError(`Access denied: Operation requires ${allowedRoles.join(' or ')} privileges.`);
  }

  return {
    userId: user.id,
    profileId: profile?.id,
    role: userRole,
    status: profile?.status || 'active',
  };
}

/**
 * Convenience guards
 */
export const requireOwner = () => requireAuthRole(['owner']);
export const requireStaffOrOwner = () => requireAuthRole(['owner', 'staff']);
export const requireAnyAuth = () => requireAuthRole(['owner', 'staff', 'customer']);

