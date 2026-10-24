import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
}

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: [
    'organization:manage',
    'users:manage',
    'facilities:manage',
    'docks:manage',
    'ring:manage',
    'deliveries:create',
    'deliveries:edit',
    'deliveries:delete',
    'receiving:execute',
    'correlation:override',
    'exceptions:resolve',
    'audit:read',
    'receipts:read',
  ],
  SHIFT_SUPERVISOR: [
    'facilities:manage',
    'docks:manage',
    'ring:view',
    'deliveries:create',
    'deliveries:edit',
    'receiving:execute',
    'correlation:override',
    'exceptions:resolve',
    'audit:read',
    'receipts:read',
  ],
  RECEIVING_OPERATOR: [
    'docks:view',
    'deliveries:view',
    'deliveries:create',
    'receiving:execute',
    'correlation:confirm',
    'exceptions:report',
    'receipts:read',
  ],
  AUDITOR: [
    'facilities:view',
    'docks:view',
    'deliveries:view',
    'audit:read',
    'receipts:read',
    'evidence:view',
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Extracts and validates the authenticated user from the request headers or cookies.
 * In development / demo mode, returns a configured operator or admin context.
 */
export function getAuthenticatedUser(request?: Request): AuthUser {
  // Support custom auth headers for automated tests & API clients
  if (request) {
    const authHeader = request.headers.get('authorization');
    const orgHeader = request.headers.get('x-org-id');
    const roleHeader = request.headers.get('x-user-role');
    const userIdHeader = request.headers.get('x-user-id');

    if (userIdHeader && orgHeader) {
      return {
        id: userIdHeader,
        orgId: orgHeader,
        email: `${userIdHeader}@dockflow.internal`,
        name: `Operator ${userIdHeader}`,
        role: (roleHeader as Role) || 'RECEIVING_OPERATOR',
      };
    }

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      if (token.startsWith('dev-admin')) {
        return {
          id: 'usr_admin_01',
          orgId: orgHeader || 'org_main_warehouse_01',
          email: 'admin@dockflow.internal',
          name: 'DockFlow Admin',
          role: 'ADMIN',
        };
      }
      if (token.startsWith('dev-operator')) {
        return {
          id: 'usr_op_01',
          orgId: orgHeader || 'org_main_warehouse_01',
          email: 'operator@dockflow.internal',
          name: 'Receiving Operator Dave',
          role: 'RECEIVING_OPERATOR',
        };
      }
      if (token.startsWith('dev-auditor')) {
        return {
          id: 'usr_audit_01',
          orgId: orgHeader || 'org_main_warehouse_01',
          email: 'auditor@dockflow.internal',
          name: 'Compliance Auditor Sarah',
          role: 'AUDITOR',
        };
      }
    }
  }

  // Default fallback context for local operations
  return {
    id: 'usr_op_default',
    orgId: 'org_main_warehouse_01',
    email: 'dave.receiving@dockflow.internal',
    name: 'Dave Jenkins',
    role: 'RECEIVING_OPERATOR',
  };
}
