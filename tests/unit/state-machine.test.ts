import { describe, it, expect } from 'vitest';
import { stateMachine, VALID_TRANSITIONS } from '@/services/workflow/state-machine';
import { ReceivingStatus } from '@prisma/client';
import { hasPermission } from '@/lib/auth';

describe('Receiving Workflow State Machine & RBAC Guards', () => {
  it('allows valid progressive transitions in the receiving lifecycle', () => {
    expect(stateMachine.canTransition(ReceivingStatus.SCHEDULED, ReceivingStatus.ARRIVAL_DETECTED)).toBe(true);
    expect(stateMachine.canTransition(ReceivingStatus.ARRIVAL_DETECTED, ReceivingStatus.ARRIVED)).toBe(true);
    expect(stateMachine.canTransition(ReceivingStatus.ARRIVED, ReceivingStatus.RECEIVING)).toBe(true);
    expect(stateMachine.canTransition(ReceivingStatus.RECEIVING, ReceivingStatus.RECEIVED)).toBe(true);
    expect(stateMachine.canTransition(ReceivingStatus.RECEIVED, ReceivingStatus.CLOSED)).toBe(true);
  });

  it('rejects invalid state transitions', () => {
    // Cannot skip directly from SCHEDULED to RECEIVED without verification
    expect(stateMachine.canTransition(ReceivingStatus.SCHEDULED, ReceivingStatus.RECEIVED)).toBe(false);
    // Cannot transition from CLOSED back to RECEIVING
    expect(stateMachine.canTransition(ReceivingStatus.CLOSED, ReceivingStatus.RECEIVING)).toBe(false);
    // Cannot transition from CANCELLED to ARRIVED
    expect(stateMachine.canTransition(ReceivingStatus.CANCELLED, ReceivingStatus.ARRIVED)).toBe(false);
  });

  it('treats identical state transition as idempotent no-op', () => {
    expect(stateMachine.canTransition(ReceivingStatus.RECEIVING, ReceivingStatus.RECEIVING)).toBe(true);
    expect(stateMachine.canTransition(ReceivingStatus.ARRIVED, ReceivingStatus.ARRIVED)).toBe(true);
  });

  describe('RBAC Authorization Rules', () => {
    it('grants full operational and override permissions to ADMIN', () => {
      expect(hasPermission('ADMIN', 'deliveries:create')).toBe(true);
      expect(hasPermission('ADMIN', 'receiving:execute')).toBe(true);
      expect(hasPermission('ADMIN', 'correlation:override')).toBe(true);
      expect(hasPermission('ADMIN', 'exceptions:resolve')).toBe(true);
    });

    it('grants dock execution permissions to RECEIVING_OPERATOR but prohibits override', () => {
      expect(hasPermission('RECEIVING_OPERATOR', 'receiving:execute')).toBe(true);
      expect(hasPermission('RECEIVING_OPERATOR', 'correlation:confirm')).toBe(true);
      // Operator cannot perform manager correlation overrides
      expect(hasPermission('RECEIVING_OPERATOR', 'correlation:override')).toBe(false);
      // Operator cannot manage users
      expect(hasPermission('RECEIVING_OPERATOR', 'users:manage')).toBe(false);
    });

    it('grants read-only audit permissions to AUDITOR without write capabilities', () => {
      expect(hasPermission('AUDITOR', 'audit:read')).toBe(true);
      expect(hasPermission('AUDITOR', 'receipts:read')).toBe(true);
      expect(hasPermission('AUDITOR', 'evidence:view')).toBe(true);
      // Auditor cannot start receiving or create deliveries
      expect(hasPermission('AUDITOR', 'receiving:execute')).toBe(false);
      expect(hasPermission('AUDITOR', 'deliveries:create')).toBe(false);
    });
  });
});
