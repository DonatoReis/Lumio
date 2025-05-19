# Real-Time Bidirectional Messaging System

This document explains the architecture and implementation of the improved real-time bidirectional messaging system, which addresses several synchronization issues and ensures a smooth user experience with consistent message delivery and conversation management.

## 🔍 Problems Addressed

1. **First Message Notification Issues**
   - First messages were not generating notifications
   - Messages were not appearing in real-time until page refresh
   - Actions like deletion and archiving were not synchronized between interfaces

2. **Duplicate Conversation Problems**
   - When a user deleted a conversation locally and sent a new message, a new conversation was created for the other user
   - Multiple conversations could exist between the same users, fragmenting conversation history

3. **Empty Conversation Creation**
   - Empty conversations were being created in the database before any message was sent

## 💡 Solution Architecture

### 1. Deterministic Conversation IDs

To prevent duplication of conversations between the same participants, we implemented a deterministic ID generation system:

```typescript
// Generates a deterministic conversation ID based on participants
const generateConversationId = async (userIds: string[]): Promise<string> => {
  // Sort UIDs to ensure consistent order regardless of who initiates
  const sortedUserIds = [...userIds].sort();
  // Join with a separator
  const joinedIds = sortedUserIds.join(':');
  // Calculate a consistent hash
  const hash = await calculateHash(joinedIds);
  // Format as UUID-like string
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
};
```

This approach ensures that:
- The same conversation ID is always generated for the same participants
- Conversation IDs are deterministic but appear to be regular UUIDs
- When a conversation is deleted and recreated, it uses the same ID

### 2. User-Specific Preferences with Soft Deletion

We use a `user_conversation_preferences` table to store user-specific settings:

```sql
CREATE TABLE user_conversation_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  messages_cleared_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  UNIQUE(user_id, conversation_id)
);
```

This allows:
- **Soft Deletion**: When a user "deletes" a conversation, we set `is_deleted=true` only for that user
- **Message Clearing**: When a user clears messages, we record the timestamp in `messages_cleared_at` and filter accordingly
- **Personalized Views**: Each user can have their own settings for muting, pinning, and archiving

### 3. Delayed Conversation Creation

Conversations are created only when a user sends the first message:

1. UI initially shows a "local" conversation with temporary ID
2. When the first message is sent:
   - The system generates a deterministic conversation ID
   - Checks if a conversation with this ID already exists
   - Creates the conversation if it doesn't
   - Creates and adds participants
   - Sends the message using the real conversation ID

### 4. Enhanced Real-Time Subscriptions

Realtime channels are set up to handle all events:

```typescript
// Configure channel with event handlers
channel
  .on('postgres_changes', 
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, 
    handleInsert
  )
  .on('postgres_changes', 
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, 
    handleUpdate
  )
  .on('postgres_changes', 
    {
      event: 'DELETE',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, 
    handleDelete
  );
```

Additional channels monitor global events to ensure first messages are detected:

```typescript
// Global subscription for catching first messages
globalChannel
  .on('postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    },
    async (payload) => {
      // Check if current user is a participant
      // Handle first message notification
    }
  )
```

### 5. Database-Side Notification Trigger

A database trigger automatically creates notifications for new messages:

```sql
CREATE TRIGGER messages_notify_update
AFTER INSERT OR UPDATE ON messages
FOR EACH ROW EXECUTE PROCEDURE notify_conversation_update();
```

This ensures:
- Every message (including first ones) generates proper notifications
- Notifications respect user preferences like muting
- Special handling for the first message in a conversation

## 📊 Row-Level Security (RLS) Policies

RLS policies ensure data security and respect user preferences:

```sql
-- Only show messages from conversations that aren't deleted for the user
CREATE POLICY "messages:select:visible" ON messages
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM conversation_participants WHERE conversation_id = messages.conversation_id
  )
  AND
  NOT EXISTS (
    SELECT 1 FROM user_conversation_preferences
    WHERE user_id = auth.uid()
    AND conversation_id = messages.conversation_id
    AND is_deleted = TRUE
  )
  AND
  NOT EXISTS (
    SELECT 1 FROM user_conversation_preferences
    WHERE user_id = auth.uid()
    AND conversation_id = messages.conversation_id
    AND messages_cleared_at IS NOT NULL
    AND messages.created_at <= messages_cleared_at
  )
);
```

## 🔄 Message Flow and Synchronization

### When User A Sends a Message:

1. User A's client generates a deterministic conversation ID
2. Creates the conversation in DB if it doesn't exist
3. Sends the message with this conversation ID
4. The message INSERT triggers a notification for all participants
5. User B's client receives the message via WebSocket subscription
6. User B's UI updates in real-time with the new message

### When User A Deletes a Conversation:

1. User A's client sets `is_deleted=true` in their preferences
2. The conversation disappears from User A's UI
3. The conversation remains visible to User B
4. If User A sends a new message to User B, the system:
   - Finds the existing conversation (using deterministic ID)
   - Sets `is_deleted=false` for User A
   - Uses the original conversation, not creating a duplicate

## 🧪 Testing Scenarios

To verify the system works correctly, test these scenarios:

1. **First Message Delivery**: Ensure first messages appear immediately with notifications
2. **Conversation Reuse**: Delete a conversation, send a new message, verify it reuses the same conversation
3. **Multi-device Sync**: Open the same account on two devices, verify all actions sync properly
4. **Message Clearing**: Test clearing messages on one side doesn't affect the other user
5. **Cross-User Actions**: Verify actions like pinning/archiving are user-specific

## 🔧 Technical Implementation Details

### Modified Files:

- `src/utils/conversationUtils.ts`: Added for deterministic ID generation
- `src/hooks/useConversations.ts`: Enhanced with soft deletion and improved real-time handling
- `src/hooks/useMessages.ts`: Updated message sending and subscription logic
- `supabase/migrations/20250525000000_user_conversation_preferences/migration.sql`: New database structure

### Database Schema Changes:

1. New `user_conversation_preferences` table
2. SQL functions for common operations (delete, archive, clear, etc.)
3. Trigger function to handle notifications
4. View for easy access to user-specific conversation information

## 📝 Conclusion

With these changes, the messaging system now provides:

- **Reliability**: Messages are delivered consistently with proper notifications
- **Consistency**: Conversation history remains intact without duplication
- **User Autonomy**: Users can manage their view without affecting others
- **Real-Time Updates**: All actions sync immediately across devices and users
- **Efficiency**: Only actual conversations are stored in the database

