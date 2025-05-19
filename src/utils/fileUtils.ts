/**
 * Utility functions for working with files in the application
 */

/**
 * Enum representing different types of media
 */
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  UNKNOWN = 'unknown',
}

/**
 * Determines the media type from a MIME type
 * @param mimeType - The MIME type of the file
 * @returns The corresponding MediaType
 */
export function getMediaTypeFromMime(mimeType: string): MediaType {
  if (!mimeType) return MediaType.UNKNOWN;
  
  const type = mimeType.split('/')[0].toLowerCase();
  
  switch (type) {
    case 'image':
      return MediaType.IMAGE;
    case 'video':
      return MediaType.VIDEO;
    case 'audio':
      return MediaType.AUDIO;
    default:
      // Check for specific document types
      if (
        mimeType.includes('pdf') ||
        mimeType.includes('document') ||
        mimeType.includes('sheet') ||
        mimeType.includes('presentation') ||
        mimeType.includes('text')
      ) {
        return MediaType.DOCUMENT;
      }
      return MediaType.UNKNOWN;
  }
}

/**
 * Gets the file extension from a file name
 * @param fileName - The name of the file
 * @returns The file extension (without the dot)
 */
export function getFileExtension(fileName: string): string {
  if (!fileName) return '';
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Gets a file extension from a MIME type
 * @param mimeType - The MIME type
 * @returns The corresponding file extension
 */
export function getExtensionFromMime(mimeType: string): string {
  if (!mimeType) return '';
  
  const commonTypes: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'js',
    'application/json': 'json',
  };
  
  return commonTypes[mimeType] || mimeType.split('/')[1] || '';
}

/**
 * Get a simple file type description from a MIME type
 * @param mimeType - The MIME type
 * @returns A simple file type description
 */
export function fileTypeFromMimeType(mimeType: string): string {
  if (!mimeType) return 'File';
  
  if (mimeType.startsWith('image/')) {
    return 'Image';
  } else if (mimeType.startsWith('video/')) {
    return 'Video';
  } else if (mimeType.startsWith('audio/')) {
    return 'Audio';
  } else if (mimeType === 'application/pdf') {
    return 'PDF';
  } else if (mimeType.includes('word') || mimeType === 'application/msword') {
    return 'Word Document';
  } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return 'Spreadsheet';
  } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
    return 'Presentation';
  } else if (mimeType.startsWith('text/')) {
    return 'Text Document';
  }
  
  return 'File';
}

/**
 * Formats a file size in bytes to a human-readable string
 * @param bytes - The size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted size string with units
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Checks if a file type is allowed based on its MIME type
 * @param mimeType - The MIME type to check
 * @param allowedTypes - Array of allowed MIME types (can include wildcards like 'image/*')
 * @returns Boolean indicating if the type is allowed
 */
export function isAllowedFileType(mimeType: string, allowedTypes: string[]): boolean {
  if (!mimeType || !allowedTypes || allowedTypes.length === 0) return false;
  
  return allowedTypes.some(allowedType => {
    // Handle wildcards like 'image/*'
    if (allowedType.endsWith('/*')) {
      const typePrefix = allowedType.split('/')[0];
      return mimeType.startsWith(`${typePrefix}/`);
    }
    return mimeType === allowedType;
  });
}

/**
 * Checks if a file's size is within the allowed limit
 * @param fileSize - The size of the file in bytes
 * @param maxSizeInBytes - The maximum allowed size in bytes
 * @returns Boolean indicating if the file size is within limits
 */
export function isFileSizeAllowed(fileSize: number, maxSizeInBytes: number): boolean {
  return fileSize <= maxSizeInBytes;
}
