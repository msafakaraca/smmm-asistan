/**
 * Supabase Storage Helpers
 *
 * Functions for managing files in Supabase Storage with tenant isolation.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

const BUCKET_NAME = 'smmm-documents';

/**
 * Generate storage path for a file
 *
 * Format: {tenantId}/{customerId}/{year}/{month}/{filename}
 */
export function generateStoragePath(
  tenantId: string,
  customerId: string,
  year: number | string,
  month: number | string,
  filename: string
): string {
  const monthPadded = String(month).padStart(2, '0');
  return `${tenantId}/${customerId}/${year}/${monthPadded}/${filename}`;
}

/**
 * Upload file to Supabase Storage
 *
 * @param path - Storage path (use generateStoragePath)
 * @param file - File buffer or Blob
 * @param contentType - MIME type
 */
export async function uploadFile(
  path: string,
  file: Buffer | Blob,
  contentType: string = 'application/pdf'
) {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      contentType,
      upsert: false, // Don't overwrite existing files
    });

  if (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }

  return data;
}

/**
 * Download file from Supabase Storage
 *
 * @param path - Storage path
 * @returns File blob
 */
export async function downloadFile(path: string) {
  // Use admin client to bypass RLS for file downloads
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path);

  if (error) {
    console.error(`[Storage] Download error for ${path}:`, error);
    throw new Error(`File download failed: ${JSON.stringify(error)}`);
  }

  return data;
}

/**
 * Get signed URL for temporary file access
 *
 * @param path - Storage path
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL
 */
export async function getSignedUrl(path: string, expiresIn: number = 3600) {
  // Admin client kullan — dosyalar adminUploadFile ile yüklendiğinden
  // user-scoped client RLS nedeniyle erişemeyebilir
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Signed URL creation failed: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete file from Supabase Storage
 *
 * @param path - Storage path
 */
export async function deleteFile(path: string) {
  const supabase = await createClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`File deletion failed: ${error.message}`);
  }
}

/**
 * List files in a folder
 *
 * @param folderPath - Folder path (e.g., "tenantId/customerId/2024/01")
 */
export async function listFiles(folderPath: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(folderPath, {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    throw new Error(`File listing failed: ${error.message}`);
  }

  return data;
}

/**
 * Move file to new location
 *
 * @param fromPath - Current path
 * @param toPath - New path
 */
export async function moveFile(fromPath: string, toPath: string) {
  const supabase = await createClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .move(fromPath, toPath);

  if (error) {
    throw new Error(`File move failed: ${error.message}`);
  }
}

/**
 * Admin function: Upload file with service role (bypasses RLS)
 *
 * Use for migrations or admin operations
 */
export async function adminUploadFile(
  path: string,
  file: Buffer | Blob,
  contentType: string = 'application/pdf'
) {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Admin upload failed: ${error.message}`);
  }

  return data;
}

/**
 * Check if file exists
 *
 * @param path - Storage path
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(path.split('/').slice(0, -1).join('/'));

    if (error) return false;

    const filename = path.split('/').pop();
    return data.some(file => file.name === filename);
  } catch {
    return false;
  }
}
