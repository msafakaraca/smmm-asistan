/**
 * Email Sync Services Index
 */

// Named exports to avoid conflicts
export { syncGmailConnection, initialSync as gmailInitialSync, deltaSync as gmailDeltaSync } from './gmail-sync';
export { syncOutlookConnection, initialSync as outlookInitialSync, deltaSync as outlookDeltaSync } from './outlook-sync';

import { syncGmailConnection } from './gmail-sync';
import { syncOutlookConnection } from './outlook-sync';
import type { email_oauth_connections } from '@prisma/client';
type EmailOAuthConnection = email_oauth_connections;

/**
 * Sync an email connection based on provider
 */
export async function syncConnection(connection: EmailOAuthConnection): Promise<{
  success: boolean;
  synced: number;
  error?: string;
}> {
  switch (connection.provider) {
    case 'gmail':
      return syncGmailConnection(connection);
    case 'outlook':
      return syncOutlookConnection(connection);
    default:
      return {
        success: false,
        synced: 0,
        error: `Unknown provider: ${connection.provider}`,
      };
  }
}
