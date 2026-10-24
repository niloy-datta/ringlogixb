import { describe, it, expect, vi } from 'vitest';
import { ringWebhookHandler } from '@/services/ring/webhook-handler';
import { ringSimulator } from '@/services/ring/simulator';
import { getAuthenticatedUser, AuthenticationError, hasPermission } from '@/lib/auth';
import { generateTamperProofHash } from '@/lib/crypto';
import { receivingService } from '@/services/receiving/receiving-service';
import { prisma } from '@/lib/prisma';

describe('Security, Replay Protection & Receipt Verification', () => {
  const secretKey = process.env.RING_WEBHOOK_SECRET || 'whsec_dockflow_production_grade_hmac_secret_2026';

  describe('Replay Attack & Signature Protection', () => {
    it('rejects webhooks with expired timestamps (>300 seconds old)', async () => {
      const pastDate = new Date(Date.now() - 350 * 1000); // 350 seconds ago
      const stalePayload = ringSimulator.generateOfficialJsonApiPayload({
        deviceId: 'ava1.ring.device.dock1',
        subType: 'vehicle',
        timestamp: pastDate,
      });

      const signed = ringSimulator.signPayload(stalePayload, secretKey);
      const result = await ringWebhookHandler.handleWebhook(
        Buffer.from(signed.rawBody, 'utf8'),
        signed.signatureHeader,
        'org_main_warehouse_01'
      );

      expect(result.statusCode).toBe(400);
      expect(result.body.message).toContain('older than 300 seconds');
    });

    it('rejects webhooks with invalid or missing HMAC signatures', async () => {
      const payload = ringSimulator.generateOfficialJsonApiPayload({
        deviceId: 'ava1.ring.device.dock1',
        subType: 'vehicle',
      });

      const result = await ringWebhookHandler.handleWebhook(
        Buffer.from(JSON.stringify(payload), 'utf8'),
        'invalid_hmac_signature_00000000000000000000000000000000',
        'org_main_warehouse_01'
      );

      expect(result.statusCode).toBe(401);
      expect(result.body.message).toContain('HMAC signature verification failed');
    });
  });

  describe('Production Authentication & Role-Based Authorization', () => {
    it('enforces role-based permissions correctly', () => {
      expect(hasPermission('ADMIN', 'ring:manage')).toBe(true);
      expect(hasPermission('ADMIN', 'deliveries:delete')).toBe(true);
      expect(hasPermission('RECEIVING_OPERATOR', 'deliveries:delete')).toBe(false);
      expect(hasPermission('RECEIVING_OPERATOR', 'receiving:execute')).toBe(true);
      expect(hasPermission('AUDITOR', 'receiving:execute')).toBe(false);
      expect(hasPermission('AUDITOR', 'audit:read')).toBe(true);
    });

    it('rejects unauthenticated requests in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        // Request without authorization header
        const req = new Request('http://localhost:3000/api/deliveries');
        expect(() => getAuthenticatedUser(req)).toThrow(AuthenticationError);
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it('accepts valid bearer token in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        const req = new Request('http://localhost:3000/api/deliveries', {
          headers: {
            authorization: 'Bearer dev-admin-prod-key',
          },
        });
        const user = getAuthenticatedUser(req);
        expect(user.role).toBe('ADMIN');
        expect(user.email).toBe('admin@dockflow.internal');
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });
  });

  describe('Cryptographic Proof of Receipt Recomputation', () => {
    it('verifies untampered canonical receipt hash', async () => {
      const canonicalPayload = {
        receiptNumber: 'REC-TEST-001',
        deliveryId: 'del_101',
        purchaseOrderNumber: 'PO-9911',
        carrier: 'Estes Express',
        dockNumber: 'BAY-01',
        expectedPallets: 8,
        receivedPallets: 8,
        sealIntact: true,
        damagesReported: false,
        discrepancyCount: 0,
        verifiedByUserId: 'usr_op_01',
        confirmedAt: '2026-10-24T18:00:00.000Z',
      };

      const validHash = generateTamperProofHash(canonicalPayload);

      // Mock prisma query for expected delivery and confirmation
      const findFirstSpy = vi.spyOn(prisma.expectedDelivery, 'findFirst').mockResolvedValueOnce({
        id: 'del_101',
        orgId: 'org_main_warehouse_01',
        purchaseOrderNumber: 'PO-9911',
        palletCount: 8,
        carrier: { name: 'Estes Express' },
        dock: { dockNumber: 'BAY-01' },
        receivingConfirmations: [
          {
            receiptNumber: 'REC-TEST-001',
            confirmedByUserId: 'usr_op_01',
            proofOfReceiptHash: validHash,
            sealIntact: true,
            damagesReported: false,
            discrepancyCount: 0,
            confirmedAt: new Date('2026-10-24T18:00:00.000Z'),
            receivingSession: { palletCountReceived: 8 },
            confirmedByUser: { name: 'Dave Jenkins' },
          },
        ],
      } as any);

      const verification = await receivingService.verifyReceipt('del_101', 'org_main_warehouse_01');

      expect(verification.success).toBe(true);
      expect(verification.isAuthentic).toBe(true);
      expect(verification.recomputedHash).toBe(validHash);

      findFirstSpy.mockRestore();
    });

    it('detects and flags tampered stored receipt hash', async () => {
      const canonicalPayload = {
        receiptNumber: 'REC-TEST-002',
        deliveryId: 'del_102',
        purchaseOrderNumber: 'PO-9922',
        carrier: 'Estes Express',
        dockNumber: 'BAY-02',
        expectedPallets: 10,
        receivedPallets: 10,
        sealIntact: true,
        damagesReported: false,
        discrepancyCount: 0,
        verifiedByUserId: 'usr_op_01',
        confirmedAt: '2026-10-24T18:30:00.000Z',
      };

      const correctHash = generateTamperProofHash(canonicalPayload);
      const forgedHash = 'tampered_or_corrupted_hash_e3b0c44298fc1c149afbf4c8996fb92427ae';

      const findFirstSpy = vi.spyOn(prisma.expectedDelivery, 'findFirst').mockResolvedValueOnce({
        id: 'del_102',
        orgId: 'org_main_warehouse_01',
        purchaseOrderNumber: 'PO-9922',
        palletCount: 10,
        carrier: { name: 'Estes Express' },
        dock: { dockNumber: 'BAY-02' },
        receivingConfirmations: [
          {
            receiptNumber: 'REC-TEST-002',
            confirmedByUserId: 'usr_op_01',
            proofOfReceiptHash: forgedHash, // Tampered!
            sealIntact: true,
            damagesReported: false,
            discrepancyCount: 0,
            confirmedAt: new Date('2026-10-24T18:30:00.000Z'),
            receivingSession: { palletCountReceived: 10 },
            confirmedByUser: { name: 'Dave Jenkins' },
          },
        ],
      } as any);

      const verification = await receivingService.verifyReceipt('del_102', 'org_main_warehouse_01');

      expect(verification.success).toBe(true);
      expect(verification.isAuthentic).toBe(false);
      expect(verification.storedHash).toBe(forgedHash);
      expect(verification.recomputedHash).toBe(correctHash);

      findFirstSpy.mockRestore();
    });
  });
});
