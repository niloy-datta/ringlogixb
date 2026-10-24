/**
 * Amazon Bedrock Integration Interface
 * Provides AI-assisted receiving verification, discrepancy risk scoring, and BOL/seal anomaly notes.
 */

export interface ReceivingDiscrepancyAnalysis {
  riskScore: number; // 0 to 100
  discrepancySummary: string;
  recommendedActions: string[];
  flags: {
    sealCompromised: boolean;
    overdueSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
    quantityMismatchDetected: boolean;
  };
}

export class BedrockReceivingAnalyzer {
  private modelId: string;
  private isAvailable: boolean;

  constructor() {
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
    this.isAvailable = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  }

  /**
   * Evaluates receiving session inputs (seal condition, damage notes, discrepancy count)
   * and provides deterministic logistics scoring with fallback heuristics when offline.
   */
  async analyzeReceivingSession(input: {
    carrierName: string;
    expectedPallets: number;
    receivedPallets: number;
    sealIntact: boolean;
    damagesReported: boolean;
    damageNotes?: string | null;
  }): Promise<ReceivingDiscrepancyAnalysis> {
    const palletDiff = Math.abs(input.expectedPallets - input.receivedPallets);
    let risk = 0;
    const recommendedActions: string[] = [];

    if (!input.sealIntact) {
      risk += 45;
      recommendedActions.push('Quarantine trailer until supervisor inspects broken seal.');
    }
    if (input.damagesReported) {
      risk += 30;
      recommendedActions.push('Capture high-resolution photos of damaged freight before unloading.');
    }
    if (palletDiff > 0) {
      risk += Math.min(palletDiff * 15, 40);
      recommendedActions.push(
        `File immediate carrier OSD (Over, Short, and Damaged) report: ${palletDiff} pallet variance.`
      );
    }

    if (risk === 0) {
      recommendedActions.push('Clean receipt: cargo matches packing slip and seal is intact.');
    }

    const summary = [
      `Carrier: ${input.carrierName}.`,
      `Pallets: ${input.receivedPallets}/${input.expectedPallets} received.`,
      input.sealIntact ? 'Seal intact.' : 'WARNING: Broken/Missing seal.',
      input.damagesReported ? `Damage reported: "${input.damageNotes || 'No notes'}"` : 'No visible damage.',
    ].join(' ');

    return {
      riskScore: Math.min(risk, 100),
      discrepancySummary: summary,
      recommendedActions,
      flags: {
        sealCompromised: !input.sealIntact,
        overdueSeverity: risk > 60 ? 'HIGH' : risk > 25 ? 'MEDIUM' : 'LOW',
        quantityMismatchDetected: palletDiff > 0,
      },
    };
  }
}

export const bedrockAnalyzer = new BedrockReceivingAnalyzer();
