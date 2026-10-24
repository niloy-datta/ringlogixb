// Vitest setup file
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dockflow_user:dockflow_pass@localhost:5432/dockflow_db?schema=public';
process.env.RING_WEBHOOK_SECRET = process.env.RING_WEBHOOK_SECRET || 'test_whsec_dummy_signature_key_for_testing';
process.env.RING_API_BASE_URL = process.env.RING_API_BASE_URL || 'https://api.amazonvision.com';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dockflow-test-jwt-secret-1234567890';
