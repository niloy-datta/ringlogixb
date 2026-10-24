import { describe, it, expect } from 'vitest';
import { generateTamperProofHash } from '@/lib/crypto';
import { bedrockAnalyzer } from '@/lib/bedrock';

describe('Receipt Sealing & Cryptographic Audit Verification', () => {
  const sampleReceiptData = {
    receiptNumber: 'REC-2026-CH-9901',
    deliveryId: 'del_uuid_123',
    purchaseOrderNumber: 'PO-98421',
    carrier: 'FedEx Freight',
    dockNumber: 'BAY-01',
    expectedPallets: 10,
    receivedPallets: 10,
    sealIntact: true,
    damagesReported: false,
    discrepancyCount: 0,
    verifiedByUserId: 'usr_op_01',
    confirmedAt: '2026-10-24T15:00:00.000Z',
  };

  it('generates a valid 256-bit tamper-proof SHA-256 hash for proof of receipt', () => {
    const hash = generateTamperProofHash(sampleReceiptData);
    expect(hash).toBeDefined();
    expect(hash).toHaveLength(64);
  });

  it('detects tampering: modifying pallet count changes cryptographic hash completely', () => {
    const originalHash = generateTamperProofHash(sampleReceiptData);

    const tamperedData = {
      ...sampleReceiptData,
      receivedPallets: 9, // Tampered count!
    };
    const tamperedHash = generateTamperProofHash(tamperedData);

    expect(tamperedHash).not.toBe(originalHash);
  });

  it('detects tampering: changing seal condition changes cryptographic hash', () => {
    const originalHash = generateTamperProofHash(sampleReceiptData);

    const tamperedSeal = {
      ...sampleReceiptData,
      sealIntact: false,
    };
    const tamperedHash = generateTamperProofHash(tamperedSeal);

    expect(tamperedHash).not.toBe(originalHash);
  });

  describe('Bedrock Receiving Analyzer', () => {
    it('scores clean receiving session as 0 risk with clean receipt recommendation', async () => {
      const analysis = await bedrockAnalyzer.analyzeReceivingSession({
        carrierName: 'FedEx Freight',
        expectedPallets: 10,
        receivedPallets: 10,
        sealIntact: true,
        damagesReported: false,
      });

      expect(analysis.riskScore).toBe(0);
      expect(analysis.flags.sealCompromised).toBe(false);
      expect(analysis.flags.quantityMismatchDetected).toBe(false);
      expect(analysis.recommendedActions[0]).toContain('Clean receipt');
    });

    it('identifies broken trailer seals and pallet shortages with elevated risk scores', async () => {
      const analysis = await bedrockAnalyzer.analyzeReceivingSession({
        carrierName: 'Old Dominion Freight',
        expectedPallets: 12,
        receivedPallets: 10, // Shortage of 2
        sealIntact: false,  // Broken seal
        damagesReported: true,
        damageNotes: 'Corner pallets crushed on top layer.',
      });

      expect(analysis.riskScore).toBeGreaterThanOrEqual(60);
      expect(analysis.flags.sealCompromised).toBe(true);
      expect(analysis.flags.quantityMismatchDetected).toBe(true);
      expect(analysis.recommendedActions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('broken seal'),
          expect.stringContaining('damaged freight'),
          expect.stringContaining('OSD'),
        ])
      );
    });
  });
});
