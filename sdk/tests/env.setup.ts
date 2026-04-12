/**
 * Environment setup for tests
 * This file loads environment variables before Jest runs
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Set default test environment variables if not provided
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Set default OAuth callback URL for testing if not provided
if (!process.env.ANAF_CALLBACK_URL) {
  process.env.ANAF_CALLBACK_URL = 'http://localhost:4040/callback';
}

// Ensure test mode is used for API calls
process.env.ANAF_TEST_MODE = 'true';

// Set test-specific timeouts
process.env.TEST_TIMEOUT = '30000';

// Log environment setup for debugging
if (process.env.NODE_ENV === 'test') {
  console.log('🧪 Test environment configured');
  console.log(`📊 OAuth Client ID: ${process.env.ANAF_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`🔐 OAuth Client Secret: ${process.env.ANAF_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`🔗 Callback URL: ${process.env.ANAF_CALLBACK_URL}`);
}
