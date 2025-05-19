-- Script to Fix Realtime Subscriptions for Messages Table
-- This script corrects RLS policies to ensure realtime subscriptions work properly

-- ============================================================
-- PART 1: CHECK AND ENABLE RLS FOR MESSAGES TABLE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE 'Checking if RLS is enabled for messages table...';
    
    -- Check if RLS is enabled for the messages table
    IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'messages' AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is already enabled for messages table';
    ELSE
        RAISE NOTICE 'RLS is NOT enabled for messages table, enabling...';
        
        -- Enable RLS for the messages table
        ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'RLS has been enabled for messages table';
    END IF;
END $$;

-- ============================================================
-- PART 2: DROP EXISTING POLICIES TO AVOID CONFLICTS
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE 'Removing existing RLS policies for messages table...';
    
    -- Drop all existing policies for the messages table
    DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
    DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
    DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
    DROP POLICY IF EXISTS "messages_update_policy" ON public.messages;
    DROP POLICY IF EXISTS "messages_delete_policy" ON public.messages;
    
    RAISE NOTICE 'All existing policies for messages table have been removed';
END $$;

-- ============================================================
-- PART 3: CREATE NEW SIMPLIFIED RLS POLICIES
-- ============================================================

DO $$
BEGIN
    -- 1. SELECT Policy: Users can view messages in conversations they are participants of
    -- Using a simplified policy that avoids recursion issues
    CREATE POLICY "messages_select_policy" ON public.messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE 
                conversation_participants.conversation_id = messages.conversation_id 
                AND conversation_participants.user_id = auth.uid()
        )
    );

    RAISE NOTICE 'Created SELECT policy for messages table';

    -- 2. INSERT Policy: Users can insert messages in conversations they are participants of
    CREATE POLICY "messages_insert_policy" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Users can only insert messages where they are the sender
        sender_id = auth.uid()
        AND
        -- And they must be a participant in the conversation
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE 
                conversation_participants.conversation_id = messages.conversation_id 
                AND conversation_participants.user_id = auth.uid()
        )
    );

    RAISE NOTICE 'Created INSERT policy for messages table';

    -- 3. UPDATE Policy: Users can update only their own messages
    CREATE POLICY "messages_update_policy" ON public.messages
    FOR UPDATE TO authenticated
    USING (
        -- Users can only update their own messages
        sender_id = auth.uid()
    );

    RAISE NOTICE 'Created UPDATE policy for messages table';

    -- 4. DELETE Policy: Users can delete only their own messages
    CREATE POLICY "messages_delete_policy" ON public.messages
    FOR DELETE TO authenticated
    USING (
        -- Users can only delete their own messages
        sender_id = auth.uid()
    );

    RAISE NOTICE 'Created DELETE policy for messages table';
END $$;

-- ============================================================
-- PART 4: VERIFY POLICIES ARE IN PLACE
-- ============================================================

-- Check that all policies have been successfully created
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual
FROM
    pg_policies
WHERE
    tablename = 'messages'
ORDER BY
    cmd;

-- ============================================================
-- PART 5: GRANT NECESSARY PERMISSIONS FOR PUBLICATIONS
-- ============================================================

-- Ensure the table is included in the realtime publication
-- This is necessary for Supabase realtime to work properly
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        -- Add the messages table to the supabase_realtime publication if it's not already included
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
            RAISE NOTICE 'Added messages table to supabase_realtime publication';
        ELSE
            RAISE NOTICE 'Messages table is already part of supabase_realtime publication';
        END IF;
    ELSE
        RAISE NOTICE 'supabase_realtime publication does not exist, creating...';
        CREATE PUBLICATION supabase_realtime FOR TABLE public.messages;
        RAISE NOTICE 'Created supabase_realtime publication for messages table';
    END IF;
END $$;

-- ============================================================
-- PART 6: VALIDATE REALTIME ACCESS THROUGH SUBSCRIPTION
-- ============================================================

-- For completeness, run this function to test realtime subscriptions
-- This function is for documentation purposes - it needs to be run from a client
/*
-- Client-side JavaScript code to test subscription:
const messagesSub = supabase
  .channel('custom-all-messages')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
  }, (payload) => {
    console.log('Change received!', payload)
  })
  .subscribe((status) => {
    console.log('Subscription status:', status)
  })
*/

-- ============================================================
-- PART 7: NOTES AND RECOMMENDATIONS
-- ============================================================

/*
IMPORTANT NOTES:

1. These policies are simplified to avoid recursion issues that can break realtime subscriptions.
   The SELECT policy no longer filters based on user preferences (is_deleted, messages_cleared_at),
   so client-side filtering may be necessary.

2. If realtime subscriptions still fail after applying these policies, check:
   - Network connections and WebSocket support
   - Supabase project settings (realtime enabled)
   - Client-side subscription code (channels correctly defined)

3. Maintain these policies when making changes to message-related functions to avoid
   breaking realtime functionality.
*/

