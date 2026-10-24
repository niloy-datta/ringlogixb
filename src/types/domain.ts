/**
 * DockFlow AI Domain Types
 */

export type ReceivingStatusType =
  | 'SCHEDULED'
  | 'ARRIVAL_DETECTED'
  | 'MATCH_PENDING'
  | 'ARRIVED'
  | 'RECEIVING'
  | 'REVIEW_REQUIRED'
  | 'RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

export type UserRole = 'ADMIN' | 'RECEIVING_OPERATOR' | 'SHIFT_SUPERVISOR' | 'AUDITOR';

export type DockStatusType = 'IDLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';

export type ExceptionTypeEnum =
  | 'UNSCHEDULED_VEHICLE'
  | 'ARRIVAL_OVERDUE'
  | 'RECEIVING_OVERDUE'
  | 'DOCK_CONGESTION'
  | 'CAMERA_OFFLINE'
  | 'DISCREPANCY_FOUND';

export type ExceptionSeverityEnum = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ExceptionStatusEnum = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface CorrelationEvidence {
  dockMatch: {
    matched: boolean;
    dockNumber?: string;
    cameraId: string;
    scoreWeight: number;
    contribution: number;
  };
  timeWindowMatch: {
    matched: boolean;
    windowStart: string;
    windowEnd: string;
    eventTime: string;
    deviationMinutes: number;
    scoreWeight: number;
    contribution: number;
  };
  classificationMatch: {
    subType: string;
    isVehicle: boolean;
    scoreWeight: number;
    contribution: number;
  };
  historicalCarrierMatch?: {
    carrierName?: string;
    scoreWeight: number;
    contribution: number;
  };
  summaryReasoning: string[];
}

export interface CandidateMatch {
  deliveryId: string;
  purchaseOrderNumber: string;
  carrierName: string;
  dockNumber: string;
  expectedWindowStart: Date;
  expectedWindowEnd: Date;
  confidenceScore: number; // 0.0 to 1.0
  evidence: CorrelationEvidence;
}

export interface ProofOfReceipt {
  receiptNumber: string;
  deliveryId: string;
  purchaseOrderNumber: string;
  carrierName: string;
  dockNumber: string;
  actualArrivalTime: Date;
  receivedAt: Date;
  confirmedByUserId: string;
  confirmedByUserName: string;
  sealIntact: boolean;
  damagesReported: boolean;
  discrepancyCount: number;
  palletCountReceived: number;
  eventReferences: Array<{
    eventId: string;
    timestamp: Date;
    subType: string;
    snapshotUrl?: string;
  }>;
  exceptionHistory: Array<{
    id: string;
    type: string;
    severity: string;
    resolutionNotes?: string;
  }>;
  tamperProofHash: string; // SHA-256 of canonical JSON
  generatedAt: Date;
}
