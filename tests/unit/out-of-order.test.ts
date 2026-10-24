import { describe, it, expect } from 'vitest';
import { stateMachine } from '@/services/workflow/state-machine';
import { ReceivingStatus } from '@prisma/client';

describe('Out-of-Order Events & Concurrent Webhook Handling', () => {
  it('prevents retrograde state transitions if older out-of-order event arrives', () => {
    // If a delivery is already in RECEIVING, an out-of-order ARRIVAL_DETECTED or SCHEDULED must not push it back
    expect(stateMachine.canTransition(ReceivingStatus.RECEIVING, ReceivingStatus.ARRIVAL_DETECTED)).toBe(false);
    expect(stateMachine.canTransition(ReceivingStatus.RECEIVING, ReceivingStatus.SCHEDULED)).toBe(false);
  });

  it('allows advancing from ARRIVAL_DETECTED to ARRIVED even if intermediate state was delayed', () => {
    expect(stateMachine.canTransition(ReceivingStatus.ARRIVAL_DETECTED, ReceivingStatus.ARRIVED)).toBe(true);
  });

  it('rejects state mutation after receiving session is CLOSED', () => {
    expect(stateMachine.canTransition(ReceivingStatus.CLOSED, ReceivingStatus.ARRIVED)).toBe(false);
    expect(stateMachine.canTransition(ReceivingStatus.CLOSED, ReceivingStatus.RECEIVING)).toBe(false);
    expect(stateMachine.canTransition(ReceivingStatus.CLOSED, ReceivingStatus.CANCELLED)).toBe(false);
  });
});
