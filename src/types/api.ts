import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'RECEIVING_OPERATOR', 'SHIFT_SUPERVISOR', 'AUDITOR']);
export const ReceivingStatusSchema = z.enum([
  'SCHEDULED',
  'ARRIVAL_DETECTED',
  'MATCH_PENDING',
  'ARRIVED',
  'RECEIVING',
  'REVIEW_REQUIRED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
]);

export const CreateFacilitySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters').toUpperCase(),
  timezone: z.string().default('UTC'),
  address: z.string().optional(),
});

export const CreateDockSchema = z.object({
  facilityId: z.string().uuid(),
  dockNumber: z.string().min(1, 'Dock number is required'),
  name: z.string().min(1, 'Dock name is required'),
});

export const ConnectRingCameraSchema = z.object({
  facilityId: z.string().uuid(),
  deviceId: z.string().min(3, 'Valid Ring device identifier required'),
  deviceName: z.string().min(1, 'Camera name required'),
  deviceType: z.string().default('camera'),
  token: z.string().optional(),
});

export const MapCameraToDockSchema = z.object({
  cameraId: z.string().uuid(),
  dockId: z.string().uuid(),
  isPrimary: z.boolean().default(true),
  viewAngle: z.string().default('FRONT_BAY'),
});

export const CreateDeliverySchema = z.object({
  facilityId: z.string().uuid(),
  dockId: z.string().uuid().optional().nullable(),
  carrierName: z.string().min(2, 'Carrier name is required'),
  carrierScac: z.string().optional().nullable(),
  purchaseOrderNumber: z.string().min(2, 'PO Number is required'),
  bolNumber: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  expectedArrivalWindowStart: z.string().datetime(),
  expectedArrivalWindowEnd: z.string().datetime(),
  palletCount: z.number().int().positive().default(1),
  itemDescription: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const UpdateDeliveryStatusSchema = z.object({
  status: ReceivingStatusSchema,
  notes: z.string().optional(),
  overrideReason: z.string().optional(),
});

export const ConfirmCorrelationSchema = z.object({
  correlationId: z.string().uuid(),
  action: z.enum(['CONFIRM', 'REJECT', 'OVERRIDE']),
  assignedDeliveryId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const StartReceivingSessionSchema = z.object({
  expectedDeliveryId: z.string().uuid(),
  dockId: z.string().uuid(),
});

export const CompleteReceivingSessionSchema = z.object({
  palletCountReceived: z.number().int().nonnegative(),
  sealIntact: z.boolean().default(true),
  damagesReported: z.boolean().default(false),
  damageNotes: z.string().optional().nullable(),
  discrepancyCount: z.number().int().nonnegative().default(0),
  signatureData: z.string().optional(),
  notes: z.string().optional(),
});

export const ResolveExceptionSchema = z.object({
  resolutionNotes: z.string().min(3, 'Resolution notes are required'),
  action: z.enum(['RESOLVE', 'DISMISS']),
});

export const RingWebhookInputSchema = z.object({
  meta: z.object({
    request_id: z.string().min(1),
    timestamp: z.string(),
    account_id: z.string().optional(),
  }),
  event_type: z.enum(['motion', 'device_status_changed', 'doorbell_press', 'live_view']),
  device_id: z.string().min(1),
  data: z.object({
    event_id: z.string().optional(),
    sub_type: z.enum(['human', 'vehicle', 'package_delivery', 'other_motion', 'motion']).optional(),
    confidence: z.number().optional(),
    snapshot_url: z.string().optional(),
    started_at: z.string(),
    ended_at: z.string().optional(),
    online: z.boolean().optional(),
  }).passthrough(),
});
