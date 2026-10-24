import { CandidateMatch, CorrelationEvidence } from '@/types/domain';
import { NormalizedRingEvent } from '@/types/ring';

export interface DeliveryCandidateRecord {
  id: string;
  purchaseOrderNumber: string;
  carrierName: string;
  dockId?: string | null;
  dockNumber?: string | null;
  windowStart: Date;
  windowEnd: Date;
  status: string;
}

export interface CameraDockInfo {
  dockId: string;
  dockNumber: string;
  facilityId: string;
}

export class DeterministicMatchingEngine {
  /**
   * Evaluates candidate deliveries against a normalized Ring event.
   * Returns candidates sorted by confidence score (highest first).
   */
  evaluateCandidates(
    event: NormalizedRingEvent,
    associatedDock: CameraDockInfo | null,
    candidateDeliveries: DeliveryCandidateRecord[]
  ): CandidateMatch[] {
    const results: CandidateMatch[] = [];

    for (const delivery of candidateDeliveries) {
      const reasoning: string[] = [];
      let totalScore = 0;

      // 1. Dock Correlation Factor (Weight: 0.40)
      const dockWeight = 0.4;
      let dockContribution = 0;
      let dockMatched = false;

      if (associatedDock && delivery.dockId === associatedDock.dockId) {
        dockContribution = dockWeight;
        dockMatched = true;
        reasoning.push(
          `Camera is mapped to Dock ${associatedDock.dockNumber}, matching delivery assignment.`
        );
      } else if (associatedDock && !delivery.dockId) {
        // Delivery is unassigned to a specific bay, potential float candidate
        dockContribution = 0.15;
        reasoning.push(
          `Delivery has no reserved dock; event occurred at Dock ${associatedDock.dockNumber}.`
        );
      } else {
        reasoning.push(`Dock mismatch or unmapped camera.`);
      }
      totalScore += dockContribution;

      // 2. Time Window Factor (Weight: 0.35)
      const timeWeight = 0.35;
      let timeContribution = 0;
      let timeMatched = false;

      const eventTimeMs = event.startedAt.getTime();
      const startMs = delivery.windowStart.getTime();
      const endMs = delivery.windowEnd.getTime();

      let deviationMinutes = 0;

      if (eventTimeMs >= startMs && eventTimeMs <= endMs) {
        timeContribution = timeWeight;
        timeMatched = true;
        reasoning.push('Event timestamp is strictly inside the scheduled delivery window.');
      } else {
        // Calculate grace window deviation (up to 60 mins before or after)
        const diffBefore = (startMs - eventTimeMs) / (1000 * 60);
        const diffAfter = (eventTimeMs - endMs) / (1000 * 60);
        deviationMinutes = Math.max(diffBefore, diffAfter);

        if (deviationMinutes <= 30) {
          timeContribution = timeWeight * 0.7; // 70% of weight if within 30 mins
          timeMatched = true;
          reasoning.push(`Arrival is within a 30-minute grace window (${deviationMinutes.toFixed(0)} min delta).`);
        } else if (deviationMinutes <= 60) {
          timeContribution = timeWeight * 0.35;
          reasoning.push(`Arrival is slightly outside window (${deviationMinutes.toFixed(0)} min delta).`);
        } else {
          reasoning.push(`Event timestamp deviates by ${deviationMinutes.toFixed(0)} minutes from schedule.`);
        }
      }
      totalScore += timeContribution;

      // 3. Classification Factor (Weight: 0.25)
      // Never identify a vehicle solely from generic motion
      const classWeight = 0.25;
      let classContribution = 0;
      const isVehicle = event.subType === 'vehicle';

      if (isVehicle) {
        classContribution = classWeight;
        reasoning.push('Ring Smart Alerts verified vehicle motion signature.');
      } else if (event.subType === 'motion') {
        classContribution = 0.08;
        reasoning.push('Generic motion detected without smart vehicle classification.');
      } else if (event.subType === 'human') {
        classContribution = 0.04;
        reasoning.push('Human motion detected (operator or driver on foot, not physical trailer).');
      } else {
        reasoning.push(`Non-vehicle event classification: ${event.subType}.`);
      }
      totalScore += classContribution;

      const evidence: CorrelationEvidence = {
        dockMatch: {
          matched: dockMatched,
          dockNumber: associatedDock?.dockNumber,
          cameraId: event.deviceId,
          scoreWeight: dockWeight,
          contribution: dockContribution,
        },
        timeWindowMatch: {
          matched: timeMatched,
          windowStart: delivery.windowStart.toISOString(),
          windowEnd: delivery.windowEnd.toISOString(),
          eventTime: event.startedAt.toISOString(),
          deviationMinutes,
          scoreWeight: timeWeight,
          contribution: timeContribution,
        },
        classificationMatch: {
          subType: event.subType,
          isVehicle,
          scoreWeight: classWeight,
          contribution: classContribution,
        },
        summaryReasoning: reasoning,
      };

      // Round to 2 decimal places
      const finalScore = Math.min(1.0, Math.round(totalScore * 100) / 100);

      results.push({
        deliveryId: delivery.id,
        purchaseOrderNumber: delivery.purchaseOrderNumber,
        carrierName: delivery.carrierName,
        dockNumber: associatedDock?.dockNumber || delivery.dockNumber || 'UNASSIGNED',
        expectedWindowStart: delivery.windowStart,
        expectedWindowEnd: delivery.windowEnd,
        confidenceScore: finalScore,
        evidence,
      });
    }

    // Sort descending by score
    return results.sort((a, b) => b.confidenceScore - a.confidenceScore);
  }
}

export const matchingEngine = new DeterministicMatchingEngine();
