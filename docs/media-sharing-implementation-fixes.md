# Media Sharing Implementation Fixes

This document outlines the issues found with the end-to-end encrypted media sharing implementation and provides detailed steps to fix them.

## 1. Missing Dependencies and Components

### Dependencies

1. **browser-image-compression**
   ```bash
   npm install browser-image-compression
   # or
   yarn add browser-image-compression
   ```

2. **ProgressWithLabel Component**
   The implementation references a `ProgressWithLabel` component that doesn't exist in the codebase. Create this component at `src/components/ui/progress-with-label.tsx`:

   ```tsx
   import * as React from "react";
   import { Progress } from "@/components/ui/progress";
   import { cn } from "@/lib/utils";

   export interface ProgressWithLabelProps extends React.ComponentPropsWithoutRef<typeof Progress> {
     label?: string;
     showValue?: boolean;
     valueFormat?: (value: number) => string;
   }

   const ProgressWithLabel = React.forwardRef<
     React.ElementRef<typeof Progress>,
     ProgressWithLabelProps
   >(({ className, value, label, showValue = true, valueFormat, ...props }, ref) => {
     const formattedValue = React.useMemo(() => {
       if (valueFormat && typeof value === 'number') {
         return valueFormat(value);
       }
       return `${Math.round(value || 0)}%`;
     }, [value, valueFormat]);

     return (
       <div className={cn("space-y-1", className)}>
         <div className="flex items-center justify-between text-xs">
           {label && <div className="text-muted-foreground">{label}</div>}
           {showValue && <div className="text-muted-foreground font-medium">{formattedValue}</div>}
         </div>
         <Progress ref={ref} value={value} {...props} />
       </div>
     );
   });

   ProgressWithLabel.displayName = "ProgressWithLabel";

   export { ProgressWithLabel };
   ```

### Component Fixes

1. **MediaUploader.tsx**
   - Fix import statements to use `@/components/ui/progress-with-label` instead of `@/components/ui/progress`
   - Remove duplicate imports (duplicate React, imageCompression imports)
   - Fix React.FC typing by using React.forwardRef pattern

2. **MediaViewer.tsx**
   - Add missing import for `RotateCw` icon from lucide-react
   - Fix import statements for ProgressWithLabel

## 2. Database Schema Changes

The implementation assumes the following columns exist in the `messages` table:

```sql
-- Run this SQL script to add the necessary columns
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'text',
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS encrypted_key TEXT,
ADD COLUMN IF NOT EXISTS iv TEXT,
ADD COLUMN IF NOT EXISTS thumbnail TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Create storage bucket for encrypted media
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('encrypted_media', 'encrypted_media', false, false)
ON CONFLICT DO NOTHING;

-- Set RLS policies for the bucket
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
    'Users can upload their own media',
    'encrypted_media',
    'INSERT',
    format('(bucket_id = %L) AND (auth.uid() = (storage.foldername(name))[1]::uuid)', 'encrypted_media')::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
    'Users can read media from their conversations',
    'encrypted_media',
    'SELECT',
    format('(bucket_id = %L) AND (auth.uid() IN (
        SELECT user_id FROM conversation_participants
        WHERE conversation_id = (storage.foldername(name))[1]
    ))', 'encrypted_media')::jsonb
)
ON CONFLICT DO NOTHING;
```

Apply these changes using:
1. The Supabase dashboard SQL editor
2. The migration file at `supabase/migrations/20250515000000_media_sharing.sql`
3. Directly connecting to the database and executing the SQL

## 3. TypeScript Fixes

### MediaUploader.tsx

1. **Component Definition**
   Change:
   ```tsx
   const MediaUploader: React.FC<MediaUploaderProps> = ({...
   ```
   To:
   ```tsx
   const MediaUploader = React.forwardRef<HTMLDivElement, MediaUploaderProps>(({...props}, ref) => {
   ```

2. **Import Error with ProgressWithLabel**
   Change:
   ```tsx
   import { ProgressWithLabel } from '@/components/ui/progress';
   ```
   To:
   ```tsx
   import { ProgressWithLabel } from '@/components/ui/progress-with-label';
   ```

3. **Payment Sessions Query**
   Replace the database query with a simple boolean state variable:
   ```tsx
   // Add this to state variables
   const [paymentCompleted, setPaymentCompleted] = useState(false);

   // Replace the query in checkPaymentStatus
   const checkPaymentStatus = async (sessionId: string): Promise<boolean> => {
     try {
       // In a real implementation, query the payment provider
       console.log('Checking payment status for session:', sessionId);
       return paymentCompleted;
     } catch (error) {
       console.error('Error checking payment status:', error);
       return false;
     }
   };

   // In the payment simulation, add:
   setPaymentCompleted(true);
   ```

4. **File Size Formatting Error**
   Fix:
   ```tsx
   {(selectedFile?.size || 0) / (1024 * 1024).toFixed(2)}
   ```
   To:
   ```tsx
   {((selectedFile?.size || 0) / (1024 * 1024)).toFixed(2)}
   ```

### useEncryptedMedia.ts

1. **Type Safety for Database Results**
   Add proper null checking and type assertions:
   ```tsx
   // After fetching data
   if (!data) {
     throw new Error('Media not found');
   }

   // Type assertion to allow property access
   const messageData = data as {
     storage_path: string;
     encrypted_key: string;
     iv: string;
     type?: string;
     content?: string;
     thumbnail?: string;
     // other fields
   };

   // Then use messageData instead of data
   const storagePath = messageData.storage_path;
   ```

2. **Safer Property Access**
   Replace direct property access with optional chaining and nullish coalescing:
   ```tsx
   // Instead of
   data.type || 'application/octet-stream'
   
   // Use
   data?.type || 'application/octet-stream'
   ```

## 4. Testing After Fixes

1. **Database Setup Verification**
   ```sql
   -- Check if columns were added
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'messages';

   -- Check if bucket exists
   SELECT * FROM storage.buckets WHERE name = 'encrypted_media';

   -- Check if policies exist
   SELECT * FROM storage.policies WHERE bucket_id = 'encrypted_media';
   ```

2. **Component Testing**

   a. **Upload Test**
   - Navigate to a conversation
   - Click the attachment icon
   - Select image/document
   - Verify upload progress is shown
   - Verify thumbnail generation
   - Verify message appears in conversation with correct icon/thumbnail

   b. **Download Test**
   - Click on a media message
   - Verify download progress is shown
   - Verify media opens in viewer
   - Verify download button works

3. **Security Testing**
   - Verify file is encrypted before upload (check network tab)
   - Attempt to access file directly via URL (should fail without auth)
   - Verify metadata in database doesn't contain plaintext content

4. **Error Handling Test**
   - Upload with network disconnected
   - Upload file exceeding size limit
   - Upload unsupported file type
   - Verify appropriate error messages are shown

## 5. Common Issues and Troubleshooting

1. **"Module not found" Errors**
   - Ensure all dependencies are installed
   - Restart the development server

2. **"Property does not exist on type" Errors**
   - Check database schema to ensure columns exist
   - Add proper type assertions and null checks

3. **"Maximum call stack size exceeded" Errors**
   - Check for infinite loops in useEffect hooks
   - Verify dependencies arrays in React hooks

4. **Storage Errors**
   - Verify Supabase Storage bucket exists
   - Check RLS policies allow the current user to upload/download
   - Verify Storage API keys and permissions

5. **Encryption Errors**
   - Ensure Web Crypto API is available (HTTPS context)
   - Check key format and algorithm compatibility
   - Verify IV (initialization vector) is correctly handled

## 6. Next Steps

Once all fixes are implemented and tests pass, consider these enhancements:

1. Add chunked uploading for large files
2. Implement Web Workers for encryption/decryption to prevent UI freezing
3. Add media gallery view for conversation media
4. Implement custom expiry controls for sensitive media
5. Add proper Stripe integration for large file payments
6. Create E2E tests covering the full media sharing flow

---

For any further questions or issues, refer to the full documentation at `docs/encrypted-media-sharing.md`.

