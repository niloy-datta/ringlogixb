import { PrismaClient, Role, DockStatus, ReceivingStatus, ExceptionType, ExceptionSeverity, ExceptionStatus } from '@prisma/client';
import { generateTamperProofHash } from '../src/lib/crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting DockFlow AI database seed...');

  const orgId = 'org_main_warehouse_01';

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { id: orgId },
    create: {
      id: orgId,
      name: 'Global Logistics Metro Distribution',
      code: 'GLM-WAREHOUSE',
      slug: 'global-logistics-metro',
      retentionDays: 365,
    },
    update: {},
  });

  // 2. Users
  const admin = await prisma.user.upsert({
    where: { orgId_email: { orgId, email: 'admin@dockflow.internal' } },
    create: {
      id: 'usr_admin_01',
      orgId,
      email: 'admin@dockflow.internal',
      name: 'Alex Miller (Admin)',
      passwordHash: 'argon2_hashed_placeholder_admin',
      role: Role.ADMIN,
    },
    update: {},
  });

  const operator = await prisma.user.upsert({
    where: { orgId_email: { orgId, email: 'dave.receiving@dockflow.internal' } },
    create: {
      id: 'usr_op_01',
      orgId,
      email: 'dave.receiving@dockflow.internal',
      name: 'Dave Jenkins (Receiving Lead)',
      passwordHash: 'argon2_hashed_placeholder_operator',
      role: Role.RECEIVING_OPERATOR,
    },
    update: {},
  });

  await prisma.user.upsert({
    where: { orgId_email: { orgId, email: 'supervisor@dockflow.internal' } },
    create: {
      id: 'usr_sup_01',
      orgId,
      email: 'supervisor@dockflow.internal',
      name: 'Elena Rostova (Shift Supervisor)',
      passwordHash: 'argon2_hashed_placeholder_supervisor',
      role: Role.SHIFT_SUPERVISOR,
    },
    update: {},
  });

  // 3. Facility
  const facility = await prisma.facility.upsert({
    where: { orgId_code: { orgId, code: 'ORD-HUB-01' } },
    create: {
      id: 'fac_chicago_01',
      orgId,
      name: 'Chicago Regional Inbound Hub',
      code: 'ORD-HUB-01',
      timezone: 'America/Chicago',
      address: '7400 Logistics Blvd, Des Plaines, IL 60018',
    },
    update: {},
  });

  // 4. Docks
  const dock1 = await prisma.dock.upsert({
    where: { facilityId_dockNumber: { facilityId: facility.id, dockNumber: 'BAY-01' } },
    create: {
      id: 'dock_bay_01',
      orgId,
      facilityId: facility.id,
      dockNumber: 'BAY-01',
      name: 'Bay 1 - Heavy Pallets High-Capacity',
      status: DockStatus.IDLE,
    },
    update: {},
  });

  const dock2 = await prisma.dock.upsert({
    where: { facilityId_dockNumber: { facilityId: facility.id, dockNumber: 'BAY-02' } },
    create: {
      id: 'dock_bay_02',
      orgId,
      facilityId: facility.id,
      dockNumber: 'BAY-02',
      name: 'Bay 2 - Refrigerated Cold Chain',
      status: DockStatus.OCCUPIED,
    },
    update: {},
  });

  const dock3 = await prisma.dock.upsert({
    where: { facilityId_dockNumber: { facilityId: facility.id, dockNumber: 'BAY-03' } },
    create: {
      id: 'dock_bay_03',
      orgId,
      facilityId: facility.id,
      dockNumber: 'BAY-03',
      name: 'Bay 3 - Fast-Turn Parcel Inbound',
      status: DockStatus.IDLE,
    },
    update: {},
  });

  const dock4 = await prisma.dock.upsert({
    where: { facilityId_dockNumber: { facilityId: facility.id, dockNumber: 'BAY-04' } },
    create: {
      id: 'dock_bay_04',
      orgId,
      facilityId: facility.id,
      dockNumber: 'BAY-04',
      name: 'Bay 4 - High-Value Secure Freight',
      status: DockStatus.RESERVED,
    },
    update: {},
  });

  const dock5 = await prisma.dock.upsert({
    where: { facilityId_dockNumber: { facilityId: facility.id, dockNumber: 'BAY-05' } },
    create: {
      id: 'dock_bay_05',
      orgId,
      facilityId: facility.id,
      dockNumber: 'BAY-05',
      name: 'Bay 5 - Bulk Inbound Staging',
      status: DockStatus.IDLE,
    },
    update: {},
  });

  // 5. Ring Cameras
  const cam1 = await prisma.ringCameraConnection.upsert({
    where: { orgId_deviceId: { orgId, deviceId: 'ava1.ring.device.dock1' } },
    create: {
      id: 'cam_dock_01',
      orgId,
      facilityId: facility.id,
      deviceId: 'ava1.ring.device.dock1',
      deviceName: 'Ring Spotlight Cam Pro - Bay 1 Approach',
      deviceType: 'spotlight_cam',
      batteryStatus: '100% (Hardwired AC)',
      isOnline: true,
      lastSeenAt: new Date(),
    },
    update: {},
  });

  const cam2 = await prisma.ringCameraConnection.upsert({
    where: { orgId_deviceId: { orgId, deviceId: 'ava1.ring.device.dock2' } },
    create: {
      id: 'cam_dock_02',
      orgId,
      facilityId: facility.id,
      deviceId: 'ava1.ring.device.dock2',
      deviceName: 'Ring Floodlight Cam Wired - Bay 2 Bay View',
      deviceType: 'floodlight_cam',
      batteryStatus: 'Hardwired AC',
      isOnline: true,
      lastSeenAt: new Date(),
    },
    update: {},
  });

  const cam3 = await prisma.ringCameraConnection.upsert({
    where: { orgId_deviceId: { orgId, deviceId: 'ava1.ring.device.dock3' } },
    create: {
      id: 'cam_dock_03',
      orgId,
      facilityId: facility.id,
      deviceId: 'ava1.ring.device.dock3',
      deviceName: 'Ring Stick Up Cam Elite - Bay 3 Staging',
      deviceType: 'stickup_cam',
      batteryStatus: 'PoE Powered',
      isOnline: true,
      lastSeenAt: new Date(),
    },
    update: {},
  });

  const cam4 = await prisma.ringCameraConnection.upsert({
    where: { orgId_deviceId: { orgId, deviceId: 'ava1.ring.device.dock4' } },
    create: {
      id: 'cam_dock_04',
      orgId,
      facilityId: facility.id,
      deviceId: 'ava1.ring.device.dock4',
      deviceName: 'Ring Outdoor Cam Pro - Bay 4 Secure',
      deviceType: 'outdoor_cam',
      batteryStatus: 'Hardwired AC',
      isOnline: true,
      lastSeenAt: new Date(),
    },
    update: {},
  });

  const cam5 = await prisma.ringCameraConnection.upsert({
    where: { orgId_deviceId: { orgId, deviceId: 'ava1.ring.device.dock5' } },
    create: {
      id: 'cam_dock_05',
      orgId,
      facilityId: facility.id,
      deviceId: 'ava1.ring.device.dock5',
      deviceName: 'Ring Pan-Tilt Cam - Bay 5 Overview',
      deviceType: 'pan_tilt_cam',
      batteryStatus: 'Hardwired AC',
      isOnline: true,
      lastSeenAt: new Date(),
    },
    update: {},
  });

  // 6. Camera-to-Dock Mappings
  await prisma.cameraDockMapping.upsert({
    where: { cameraId_dockId: { cameraId: cam1.id, dockId: dock1.id } },
    create: {
      orgId,
      cameraId: cam1.id,
      dockId: dock1.id,
      isPrimary: true,
      viewAngle: 'TRAILER_APPROACH',
    },
    update: {},
  });

  await prisma.cameraDockMapping.upsert({
    where: { cameraId_dockId: { cameraId: cam2.id, dockId: dock2.id } },
    create: {
      orgId,
      cameraId: cam2.id,
      dockId: dock2.id,
      isPrimary: true,
      viewAngle: 'DOOR_SEAL_VIEW',
    },
    update: {},
  });

  await prisma.cameraDockMapping.upsert({
    where: { cameraId_dockId: { cameraId: cam3.id, dockId: dock3.id } },
    create: {
      orgId,
      cameraId: cam3.id,
      dockId: dock3.id,
      isPrimary: true,
      viewAngle: 'RAMP_SAFETY_VIEW',
    },
    update: {},
  });

  await prisma.cameraDockMapping.upsert({
    where: { cameraId_dockId: { cameraId: cam4.id, dockId: dock4.id } },
    create: {
      orgId,
      cameraId: cam4.id,
      dockId: dock4.id,
      isPrimary: true,
      viewAngle: 'PERIMETER_SURVEILLANCE',
    },
    update: {},
  });

  await prisma.cameraDockMapping.upsert({
    where: { cameraId_dockId: { cameraId: cam5.id, dockId: dock5.id } },
    create: {
      orgId,
      cameraId: cam5.id,
      dockId: dock5.id,
      isPrimary: true,
      viewAngle: 'BAY_APRON_WIDE',
    },
    update: {},
  });

  // 7. Carriers
  const fedex = await prisma.carrier.upsert({
    where: { orgId_name: { orgId, name: 'FedEx Freight' } },
    create: {
      orgId,
      name: 'FedEx Freight',
      scacCode: 'FXFE',
      contactPhone: '1-800-463-3339',
      contactEmail: 'freight_dispatch@fedex.internal',
    },
    update: {},
  });

  const odfl = await prisma.carrier.upsert({
    where: { orgId_name: { orgId, name: 'Old Dominion Freight Line' } },
    create: {
      orgId,
      name: 'Old Dominion Freight Line',
      scacCode: 'ODFL',
      contactPhone: '1-800-432-6335',
      contactEmail: 'dispatch@odfl.internal',
    },
    update: {},
  });

  const jbhunt = await prisma.carrier.upsert({
    where: { orgId_name: { orgId, name: 'J.B. Hunt Transport' } },
    create: {
      orgId,
      name: 'J.B. Hunt Transport',
      scacCode: 'JBHT',
      contactPhone: '1-800-452-4868',
      contactEmail: 'fleet_support@jbhunt.internal',
    },
    update: {},
  });

  // 8. Expected Deliveries
  const now = new Date();
  const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 13, 0, 0);
  const todayAfternoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0);

  // Delivery 1: Scheduled for Bay 1 today
  const delivery1 = await prisma.expectedDelivery.create({
    data: {
      orgId,
      facilityId: facility.id,
      dockId: dock1.id,
      carrierId: fedex.id,
      purchaseOrderNumber: 'PO-2026-8801',
      bolNumber: 'BOL-FX-994821',
      trackingNumber: 'FX-TRK-771829',
      expectedArrivalWindowStart: todayMorning,
      expectedArrivalWindowEnd: todayNoon,
      palletCount: 14,
      itemDescription: 'Industrial Automation Sensors & Motor Drives',
      status: ReceivingStatus.SCHEDULED,
    },
  });

  await prisma.shipmentReference.createMany({
    data: [
      { expectedDeliveryId: delivery1.id, referenceType: 'PO', referenceValue: 'PO-2026-8801' },
      { expectedDeliveryId: delivery1.id, referenceType: 'BOL', referenceValue: 'BOL-FX-994821' },
    ],
  });

  // Delivery 2: Arrived at Bay 2, receiving in progress
  const delivery2 = await prisma.expectedDelivery.create({
    data: {
      orgId,
      facilityId: facility.id,
      dockId: dock2.id,
      carrierId: odfl.id,
      purchaseOrderNumber: 'PO-2026-8802',
      bolNumber: 'BOL-OD-55102',
      expectedArrivalWindowStart: todayMorning,
      expectedArrivalWindowEnd: todayAfternoon,
      actualArrivalTime: new Date(Date.now() - 45 * 60 * 1000), // arrived 45 mins ago
      palletCount: 8,
      itemDescription: 'Temperature-Sensitive Pharmaceuticals & Cool Packs',
      status: ReceivingStatus.RECEIVING,
    },
  });

  const session2 = await prisma.receivingSession.create({
    data: {
      orgId,
      expectedDeliveryId: delivery2.id,
      dockId: dock2.id,
      startedByUserId: operator.id,
      status: 'IN_PROGRESS',
      startedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  });

  // Delivery 3: Completed with cryptographic proof of receipt
  const delivery3 = await prisma.expectedDelivery.create({
    data: {
      orgId,
      facilityId: facility.id,
      dockId: dock3.id,
      carrierId: jbhunt.id,
      purchaseOrderNumber: 'PO-2026-8799',
      bolNumber: 'BOL-JB-10029',
      expectedArrivalWindowStart: new Date(Date.now() - 4 * 60 * 60 * 1000),
      expectedArrivalWindowEnd: new Date(Date.now() - 2 * 60 * 60 * 1000),
      actualArrivalTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      palletCount: 22,
      itemDescription: 'Consumer Electronics & Display Monitors',
      status: ReceivingStatus.RECEIVED,
    },
  });

  const session3 = await prisma.receivingSession.create({
    data: {
      orgId,
      expectedDeliveryId: delivery3.id,
      dockId: dock3.id,
      startedByUserId: operator.id,
      status: 'COMPLETED',
      startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      endedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      palletCountReceived: 22,
    },
  });

  const receiptNumber3 = 'REC-2026-CHICAGO-8799';
  const receiptPayload = {
    receiptNumber: receiptNumber3,
    deliveryId: delivery3.id,
    purchaseOrderNumber: delivery3.purchaseOrderNumber,
    carrier: 'J.B. Hunt Transport',
    dockNumber: 'BAY-03',
    expectedPallets: 22,
    receivedPallets: 22,
    sealIntact: true,
    damagesReported: false,
    discrepancyCount: 0,
    verifiedByUserId: operator.id,
    confirmedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  };

  const receiptHash3 = generateTamperProofHash(receiptPayload);

  await prisma.receivingConfirmation.create({
    data: {
      orgId,
      receivingSessionId: session3.id,
      expectedDeliveryId: delivery3.id,
      confirmedByUserId: operator.id,
      receiptNumber: receiptNumber3,
      discrepancyCount: 0,
      sealIntact: true,
      damagesReported: false,
      proofOfReceiptHash: receiptHash3,
      confirmedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  // Delivery 4: Reserved for Bay 4 (High-Value Secured)
  await prisma.expectedDelivery.create({
    data: {
      orgId,
      facilityId: facility.id,
      dockId: dock4.id,
      carrierId: fedex.id,
      purchaseOrderNumber: 'PO-2026-8804',
      bolNumber: 'BOL-FX-77042',
      expectedArrivalWindowStart: todayNoon,
      expectedArrivalWindowEnd: todayAfternoon,
      palletCount: 6,
      itemDescription: 'High-Value Aerospace Avionics Components',
      status: ReceivingStatus.SCHEDULED,
    },
  });

  // Delivery 5: Bulk Inbound Staging at Bay 5
  await prisma.expectedDelivery.create({
    data: {
      orgId,
      facilityId: facility.id,
      dockId: dock5.id,
      carrierId: odfl.id,
      purchaseOrderNumber: 'PO-2026-8805',
      bolNumber: 'BOL-OD-88190',
      expectedArrivalWindowStart: todayMorning,
      expectedArrivalWindowEnd: todayNoon,
      actualArrivalTime: new Date(Date.now() - 10 * 60 * 1000), // arrived 10 mins ago
      palletCount: 18,
      itemDescription: 'Industrial Hardware & Raw Fasteners',
      status: ReceivingStatus.ARRIVED,
    },
  });

  // 9. Operational Exception
  await prisma.operationalException.create({
    data: {
      orgId,
      facilityId: facility.id,
      dockId: dock2.id,
      expectedDeliveryId: delivery2.id,
      exceptionType: ExceptionType.DOCK_CONGESTION,
      severity: ExceptionSeverity.MEDIUM,
      title: 'Dock Congestion Advisory: Bay 2',
      details: 'Unloading rate is currently at 45 minutes; adjacent trailer in queue.',
      status: ExceptionStatus.OPEN,
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log(`- Org: ${org.name}`);
  console.log(`- Facility: ${facility.name}`);
  console.log(`- Docks: BAY-01, BAY-02, BAY-03, BAY-04, BAY-05 (5 Loading Bays)`);
  console.log(`- Ring Cameras: 5 Cameras registered & mapped`);
  console.log(`- Expected Deliveries: 5 Shipments seeded with full event correlation`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
