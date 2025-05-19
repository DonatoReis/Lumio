

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "internal";


ALTER SCHEMA "internal" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."feature_key_enum" AS ENUM (
    'prospecting_ai',
    'bots',
    'crm_sync',
    'analytics_plus',
    'priority_support',
    'mensagens_ilimitadas',
    'chamadas_audio_video',
    'grupos',
    'marketplace',
    'ia_prospeccao_avancada',
    'estatisticas_uso',
    'automacao_marketing',
    'bots_personalizados',
    'integracao_crm',
    'apis_exclusivas',
    'sla_dedicado',
    'suporte_24_7',
    'onboarding_personalizado',
    'gerente_conta_dedicado'
);


ALTER TYPE "public"."feature_key_enum" OWNER TO "postgres";


CREATE TYPE "public"."notification_frequency" AS ENUM (
    'instant',
    'daily',
    'weekly'
);


ALTER TYPE "public"."notification_frequency" OWNER TO "postgres";


CREATE TYPE "public"."notification_priority" AS ENUM (
    'low',
    'normal',
    'high',
    'critical'
);


ALTER TYPE "public"."notification_priority" OWNER TO "postgres";


CREATE TYPE "public"."notification_status" AS ENUM (
    'pending',
    'sent',
    'failed'
);


ALTER TYPE "public"."notification_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_type_enum" AS ENUM (
    'card',
    'pix',
    'bank_transfer',
    'boleto'
);


ALTER TYPE "public"."payment_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "internal"."is_participant_of"("_user_id" "uuid", "_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.conversation_participants cp
     WHERE cp.conversation_id = _conversation_id
       AND cp.user_id         = _user_id
  );
$$;


ALTER FUNCTION "internal"."is_participant_of"("_user_id" "uuid", "_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_payment_record"("p_user_id" "uuid", "p_transaction_id" "text", "p_amount" numeric, "p_currency" "text", "p_status" "text", "p_payment_method" "text", "p_description" "text" DEFAULT NULL::"text", "p_invoice_url" "text" DEFAULT NULL::"text", "p_invoice_pdf_url" "text" DEFAULT NULL::"text", "p_reference_period" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    payment_id UUID;
BEGIN
    INSERT INTO payment_history (
        user_id,
        transaction_id,
        amount,
        currency,
        status,
        payment_method,
        description,
        invoice_url,
        invoice_pdf_url,
        reference_period,
        metadata
    ) VALUES (
        p_user_id,
        p_transaction_id,
        p_amount,
        p_currency,
        p_status,
        p_payment_method,
        p_description,
        p_invoice_url,
        p_invoice_pdf_url,
        p_reference_period,
        p_metadata
    )
    RETURNING id INTO payment_id;
    
    RETURN payment_id;
END;
$$;


ALTER FUNCTION "public"."add_payment_record"("p_user_id" "uuid", "p_transaction_id" "text", "p_amount" numeric, "p_currency" "text", "p_status" "text", "p_payment_method" "text", "p_description" "text", "p_invoice_url" "text", "p_invoice_pdf_url" "text", "p_reference_period" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_conversation_access"("conversation_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM conversation_participants
    WHERE 
      conversation_id = $1 AND 
      user_id = auth.uid()
  );
END;
$_$;


ALTER FUNCTION "public"."check_conversation_access"("conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_meeting_access"("meeting_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM meeting_participants
    WHERE 
      meeting_id = $1 AND 
      user_id = auth.uid()
  );
END;
$_$;


ALTER FUNCTION "public"."check_meeting_access"("meeting_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "created_by" "uuid",
    "team_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meetings" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_other_users_meetings"("user_id" "uuid", "min_date" timestamp without time zone) RETURNS SETOF "public"."meetings"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
     SELECT m.* FROM meetings m
     WHERE m.created_by != user_id
     AND m.created_at > min_date
     AND (
       EXISTS (
         SELECT 1 FROM meeting_participants
         WHERE meeting_id = m.id AND user_id = auth.uid()
       )
       OR
       EXISTS (
         SELECT 1 FROM team_members
         WHERE team_id = m.team_id AND user_id = auth.uid()
       )
     );
   $$;


ALTER FUNCTION "public"."get_other_users_meetings"("user_id" "uuid", "min_date" timestamp without time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_notification_prefs"("p_user_id" "uuid") RETURNS TABLE("channel_id" "uuid", "channel_name" "text", "frequency" "public"."notification_frequency", "notify_types" "jsonb", "is_enabled" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        np.channel_id,
        nc.name as channel_name,
        np.frequency,
        np.notify_types,
        np.is_enabled
    FROM notification_preferences np
    JOIN notification_channels nc ON np.channel_id = nc.id
    WHERE np.user_id = p_user_id AND nc.is_active = true;
END;
$$;


ALTER FUNCTION "public"."get_user_notification_prefs"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_reputation"("p_user_id" "uuid") RETURNS TABLE("reputation_score" integer, "is_verified" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
    SELECT 
      CASE 
        WHEN EXISTS (SELECT 1 FROM user_kyc WHERE user_id = p_user_id AND verified = true) THEN 90
        WHEN EXISTS (SELECT 1 FROM user_kyc WHERE user_id = p_user_id) THEN 70
        ELSE 50
      END AS reputation_score,
      EXISTS (SELECT 1 FROM user_kyc WHERE user_id = p_user_id AND verified = true) AS is_verified;
END;
$$;


ALTER FUNCTION "public"."get_user_reputation"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_known_contact"("p_user_id" "uuid", "p_contact_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Check if users have exchanged messages
  RETURN EXISTS (
    SELECT 1 FROM messages m
    JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
    WHERE 
      (m.sender_id = p_user_id AND cp.user_id = p_contact_id)
      OR 
      (m.sender_id = p_contact_id AND cp.user_id = p_user_id)
  );
END;
$$;


ALTER FUNCTION "public"."is_known_contact"("p_user_id" "uuid", "p_contact_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_message_visible_to_user"("p_message_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_conversation_id UUID;
  v_message_created_at TIMESTAMP WITH TIME ZONE;
  v_user_id UUID;
  v_is_participant BOOLEAN;
  v_is_deleted BOOLEAN := FALSE;
  v_messages_cleared_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Get conversation_id and created_at for this message
  SELECT conversation_id, created_at 
  INTO v_conversation_id, v_message_created_at
  FROM messages
  WHERE id = p_message_id;
  
  IF v_conversation_id IS NULL THEN
    RETURN FALSE; -- Message doesn't exist
  END IF;
  
  -- Check if user is a participant in this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = v_conversation_id
    AND user_id = v_user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RETURN FALSE; -- User is not a participant
  END IF;
  
  -- Check user preferences for this conversation
  SELECT 
    is_deleted,
    messages_cleared_at
  INTO 
    v_is_deleted,
    v_messages_cleared_at
  FROM user_conversation_preferences
  WHERE conversation_id = v_conversation_id
  AND user_id = v_user_id;
  
  -- If conversation is deleted for this user, message is not visible
  IF v_is_deleted THEN
    RETURN FALSE;
  END IF;
  
  -- If messages were cleared, only show messages after that time
  IF v_messages_cleared_at IS NOT NULL AND v_message_created_at <= v_messages_cleared_at THEN
    RETURN FALSE;
  END IF;
  
  -- If we got here, the message is visible
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in is_message_visible_to_user: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."is_message_visible_to_user"("p_message_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Only allow if the current user is marking their own notifications
    IF p_user_id = auth.uid() THEN
        UPDATE notification_logs SET is_read = TRUE
        WHERE user_id = p_user_id AND is_read = FALSE;
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RETURN v_count;
    ELSE
        RETURN 0;
    END IF;
END;
$$;


ALTER FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_conversation_deleted"("p_conversation_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET is_deleted = TRUE, updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      is_deleted,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      TRUE,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in mark_conversation_deleted: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."mark_conversation_deleted"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_messages_cleared"("p_conversation_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET messages_cleared_at = NOW(), updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      messages_cleared_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in mark_messages_cleared: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."mark_messages_cleared"("p_conversation_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the user_id of the notification
    SELECT user_id INTO v_user_id FROM notification_logs
    WHERE id = p_notification_id;
    
    -- Only allow if the current user owns the notification
    IF v_user_id = auth.uid() THEN
        UPDATE notification_logs SET is_read = TRUE
        WHERE id = p_notification_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_conversation_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  participants RECORD;
BEGIN
  -- For INSERT and UPDATE operations
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Get all participants for this conversation
    FOR participants IN (
      SELECT user_id
      FROM conversation_participants
      WHERE conversation_id = NEW.conversation_id
    )
    LOOP
      -- If the participant has set up notification preferences, check them
      -- This would typically be used to filter notifications based on mute status, etc.
      PERFORM 1
      FROM user_conversation_preferences
      WHERE user_id = participants.user_id
      AND conversation_id = NEW.conversation_id
      AND is_muted = FALSE; -- Only notify if not muted
      
      -- If the participant should be notified, insert a notification record
      -- This assumes you have a notification system set up
      IF FOUND THEN
        -- For a first message in a conversation, special handling
        IF NOT EXISTS (
          SELECT 1 FROM messages 
          WHERE conversation_id = NEW.conversation_id 
          AND id != NEW.id
        ) THEN
          -- This is the first message in the conversation
          -- Insert a notification with a special type
          INSERT INTO notification_logs (
            user_id,
            channel,
            notification_type,
            title,
            body,
            payload
          ) VALUES (
            participants.user_id,
            'in-app',
            'new_conversation',
            'Nova conversa',
            SUBSTR(NEW.content, 1, 100),
            jsonb_build_object(
              'conversation_id', NEW.conversation_id,
              'message_id', NEW.id,
              'sender_id', NEW.sender_id
            )
          );
        ELSE
          -- This is a regular message
          INSERT INTO notification_logs (
            user_id,
            channel,
            notification_type,
            title,
            body,
            payload
          ) VALUES (
            participants.user_id,
            'in-app',
            'new_message',
            'Nova mensagem',
            SUBSTR(NEW.content, 1, 100),
            jsonb_build_object(
              'conversation_id', NEW.conversation_id,
              'message_id', NEW.id,
              'sender_id', NEW.sender_id
            )
          );
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  -- Return the appropriate record based on operation type
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."notify_conversation_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_reminder"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_payload" "jsonb", "p_run_at" timestamp with time zone, "p_channels" "jsonb" DEFAULT '["in-app"]'::"jsonb", "p_priority" "public"."notification_priority" DEFAULT 'normal'::"public"."notification_priority") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_reminder_id UUID;
BEGIN
    -- Only allow if the current user is creating their own reminder
    -- or it's the service role
    IF p_user_id = auth.uid() OR auth.role() = 'service_role' THEN
        INSERT INTO scheduled_reminders (
            user_id, title, body, payload, run_at, channels, priority
        ) VALUES (
            p_user_id, p_title, p_body, p_payload, p_run_at, p_channels, p_priority
        )
        RETURNING id INTO v_reminder_id;
        
        RETURN v_reminder_id;
    ELSE
        RAISE EXCEPTION 'You can only schedule reminders for yourself';
    END IF;
END;
$$;


ALTER FUNCTION "public"."schedule_reminder"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_payload" "jsonb", "p_run_at" timestamp with time zone, "p_channels" "jsonb", "p_priority" "public"."notification_priority") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_conversation_archived"("p_conversation_id" "uuid", "p_is_archived" boolean, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET is_archived = p_is_archived, updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      is_archived,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      p_is_archived,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in set_conversation_archived: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."set_conversation_archived"("p_conversation_id" "uuid", "p_is_archived" boolean, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_conversation_muted"("p_conversation_id" "uuid", "p_is_muted" boolean, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET is_muted = p_is_muted, updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      is_muted,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      p_is_muted,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in set_conversation_muted: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."set_conversation_muted"("p_conversation_id" "uuid", "p_is_muted" boolean, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_conversation_pinned"("p_conversation_id" "uuid", "p_is_pinned" boolean, "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_exists BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Verify user_id is valid (either provided or current user)
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user ID provided or authenticated';
  END IF;
  
  -- Check if the user is part of this conversation
  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF NOT v_exists THEN
    RAISE EXCEPTION 'User is not a participant in this conversation';
  END IF;
  
  -- Check if preference record already exists
  SELECT EXISTS(
    SELECT 1 FROM user_conversation_preferences
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Update existing preference
    UPDATE user_conversation_preferences
    SET is_pinned = p_is_pinned, updated_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND user_id = v_user_id;
  ELSE
    -- Create new preference record
    INSERT INTO user_conversation_preferences (
      user_id, 
      conversation_id, 
      is_pinned,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_conversation_id,
      p_is_pinned,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in set_conversation_pinned: %', SQLERRM;
    RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."set_conversation_pinned"("p_conversation_id" "uuid", "p_is_pinned" boolean, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_default_payment_method"("p_user_id" "uuid", "p_payment_method_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Remover o status padrão de todos os métodos de pagamento do usuário
    UPDATE payment_methods
    SET is_default = false
    WHERE user_id = p_user_id;
    
    -- Definir o método selecionado como padrão
    UPDATE payment_methods
    SET is_default = true
    WHERE id = p_payment_method_id AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."set_default_payment_method"("p_user_id" "uuid", "p_payment_method_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_payment_status"("p_transaction_id" "text", "p_status" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE payment_history
    SET 
        status = p_status,
        updated_at = now()
    WHERE 
        transaction_id = p_transaction_id;
        
    RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_payment_status"("p_transaction_id" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_notification_pref"("p_user_id" "uuid", "p_channel_id" "uuid", "p_settings" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_frequency notification_frequency;
    v_notify_types JSONB;
    v_is_enabled BOOLEAN;
    v_pref_id UUID;
BEGIN
    -- Extract values from settings
    v_frequency := (p_settings->>'frequency')::notification_frequency;
    v_notify_types := COALESCE(p_settings->'notify_types', '{}'::jsonb);
    v_is_enabled := COALESCE((p_settings->>'is_enabled')::boolean, TRUE);
    
    -- Upsert the preference
    INSERT INTO notification_preferences (
        user_id, channel_id, frequency, notify_types, is_enabled
    ) VALUES (
        p_user_id, p_channel_id, v_frequency, v_notify_types, v_is_enabled
    )
    ON CONFLICT (user_id, channel_id) DO UPDATE SET
        frequency = v_frequency,
        notify_types = v_notify_types,
        is_enabled = v_is_enabled,
        updated_at = NOW()
    RETURNING id INTO v_pref_id;
    
    RETURN v_pref_id;
END;
$$;


ALTER FUNCTION "public"."upsert_notification_pref"("p_user_id" "uuid", "p_channel_id" "uuid", "p_settings" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_conversation_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  -- Check if ID matches UUID format
  IF NEW.id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid conversation ID format. Must be a valid UUID.';
  END IF;
  
  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."validate_conversation_id"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."channel_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "cnpj" "text",
    "industry" "text",
    "size" "text",
    "about" "text",
    "website" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_a_id" "uuid",
    "company_b_id" "uuid",
    "compatibility_score" numeric(5,2),
    "match_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "company_id" "uuid",
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."connected_devices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_id" "text" NOT NULL,
    "device_name" "text",
    "os" "text",
    "browser" "text",
    "location" "text",
    "ip_address" "text",
    "last_active" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."connected_devices" OWNER TO "postgres";


COMMENT ON TABLE "public"."connected_devices" IS 'Stores information about devices that have accessed user accounts, including device details and access timestamps';



CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_message" "text",
    "last_message_time" timestamp with time zone
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "did" "text" NOT NULL,
    "public_key" "text" NOT NULL,
    "private_key_encrypted" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."digital_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feature_key" "text" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "operation" character varying(50) NOT NULL,
    "result" character varying(20) NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."maintenance_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."maintenance_logs" IS 'Logs for system maintenance operations like media cleanup';



COMMENT ON COLUMN "public"."maintenance_logs"."operation" IS 'Type of operation: media_cleanup, etc.';



COMMENT ON COLUMN "public"."maintenance_logs"."result" IS 'Result of operation: success, error, etc.';



COMMENT ON COLUMN "public"."maintenance_logs"."details" IS 'Detailed information about the operation';



CREATE TABLE IF NOT EXISTS "public"."meeting_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meeting_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meeting_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "sender_id" "uuid",
    "content" "text" NOT NULL,
    "content_encrypted" boolean DEFAULT false,
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "encrypted_content" "text",
    "is_encrypted" boolean DEFAULT false,
    "type" character varying(50) DEFAULT 'text'::character varying,
    "storage_path" "text",
    "encrypted_key" "text",
    "iv" "text",
    "thumbnail" "text",
    "expires_at" timestamp with time zone,
    "file_size" bigint
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."messages"."type" IS 'Message type: text, image, video, audio, document, file';



COMMENT ON COLUMN "public"."messages"."storage_path" IS 'Path to the encrypted file in Supabase Storage';



COMMENT ON COLUMN "public"."messages"."encrypted_key" IS 'Symmetrical encryption key, encrypted with the recipient''s public key';



COMMENT ON COLUMN "public"."messages"."iv" IS 'Initialization vector used for encryption';



COMMENT ON COLUMN "public"."messages"."thumbnail" IS 'Base64 encoded thumbnail for images and videos';



COMMENT ON COLUMN "public"."messages"."expires_at" IS 'Date when the media should be deleted';



COMMENT ON COLUMN "public"."messages"."file_size" IS 'Size of the file in bytes';



CREATE TABLE IF NOT EXISTS "public"."notification_channels" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "is_active" boolean DEFAULT true,
    "requires_subscription" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_channels" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_channels" IS 'Stores available notification channels (email, push, in-app, etc.)';



CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "notification_type" "text" NOT NULL,
    "title" "text",
    "body" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "is_read" boolean DEFAULT false,
    "is_encrypted" boolean DEFAULT false,
    "priority" "public"."notification_priority" DEFAULT 'normal'::"public"."notification_priority",
    "delivered_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."notification_status" DEFAULT 'sent'::"public"."notification_status",
    "error_msg" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_logs" IS 'Logs all notification activities for auditing and monitoring';



CREATE OR REPLACE VIEW "public"."notification_metrics" AS
 SELECT "date_trunc"('hour'::"text", "notification_logs"."created_at") AS "hour",
    "notification_logs"."channel",
    "notification_logs"."notification_type",
    "notification_logs"."priority",
    "notification_logs"."status",
    "count"(*) AS "total",
    "sum"(
        CASE
            WHEN ("notification_logs"."status" = 'sent'::"public"."notification_status") THEN 1
            ELSE 0
        END) AS "sent_count",
    "sum"(
        CASE
            WHEN ("notification_logs"."status" = 'failed'::"public"."notification_status") THEN 1
            ELSE 0
        END) AS "failed_count"
   FROM "public"."notification_logs"
  GROUP BY ("date_trunc"('hour'::"text", "notification_logs"."created_at")), "notification_logs"."channel", "notification_logs"."notification_type", "notification_logs"."priority", "notification_logs"."status";


ALTER TABLE "public"."notification_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "frequency" "public"."notification_frequency" DEFAULT 'instant'::"public"."notification_frequency",
    "notify_types" "jsonb" DEFAULT '{"teams": true, "system": true, "mentions": true, "messages": true, "security": true}'::"jsonb",
    "is_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_preferences" IS 'Stores user preferences for each notification channel';



CREATE TABLE IF NOT EXISTS "public"."payment_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_id" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'BRL'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "payment_method" "text" NOT NULL,
    "description" "text",
    "invoice_url" "text",
    "invoice_pdf_url" "text",
    "reference_period" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_history_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'succeeded'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."payment_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "payment_method_id" "text" NOT NULL,
    "payment_type" "public"."payment_type_enum" NOT NULL,
    "last_four_digits" "text",
    "expiry_date" "text",
    "brand" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_features" (
    "plan_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plan_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "stripe_price_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_monthly_price_id" "text",
    "stripe_yearly_price_id" "text"
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_plans" (
    "plan_name" "text" NOT NULL,
    "price_monthly" numeric NOT NULL,
    "price_annual" numeric NOT NULL
);


ALTER TABLE "public"."pricing_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "seller_id" "uuid",
    "image_url" "text",
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "company_name" "text",
    "position" "text",
    "cnpj" "text",
    "industry" "text",
    "about" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "avatar_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_reminders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "run_at" timestamp with time zone NOT NULL,
    "status" "public"."notification_status" DEFAULT 'pending'::"public"."notification_status",
    "retry_count" integer DEFAULT 0,
    "max_retries" integer DEFAULT 3,
    "channels" "jsonb" DEFAULT '["in-app"]'::"jsonb",
    "priority" "public"."notification_priority" DEFAULT 'normal'::"public"."notification_priority",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scheduled_reminders" OWNER TO "postgres";


COMMENT ON TABLE "public"."scheduled_reminders" IS 'Stores scheduled notifications and reminders to be sent in the future';



CREATE TABLE IF NOT EXISTS "public"."secure_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "encrypted_content" "text" NOT NULL,
    "public_key" "text",
    "hash" "text",
    "suspicious_level" integer DEFAULT 0,
    "blockchain_verified" boolean DEFAULT false,
    "blockchain_tx_id" "text",
    "blockchain_timestamp" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."secure_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid",
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_conversation_preferences" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "is_muted" boolean DEFAULT false,
    "is_pinned" boolean DEFAULT false,
    "is_archived" boolean DEFAULT false,
    "is_deleted" boolean DEFAULT false,
    "messages_cleared_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_conversation_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_conversation_preferences" IS 'User-specific preferences for conversations, including soft deletion, archiving, and muting';



COMMENT ON COLUMN "public"."user_conversation_preferences"."is_muted" IS 'Whether the user has muted notifications for this conversation';



COMMENT ON COLUMN "public"."user_conversation_preferences"."is_pinned" IS 'Whether the user has pinned this conversation to the top of their list';



COMMENT ON COLUMN "public"."user_conversation_preferences"."is_archived" IS 'Whether the user has archived this conversation';



COMMENT ON COLUMN "public"."user_conversation_preferences"."is_deleted" IS 'Whether the user has deleted this conversation (soft deletion)';



COMMENT ON COLUMN "public"."user_conversation_preferences"."messages_cleared_at" IS 'Timestamp when the user cleared their messages; only messages after this time will be shown';



CREATE OR REPLACE VIEW "public"."user_conversations" AS
 SELECT "c"."id",
    "c"."name",
    "c"."created_at",
    "c"."updated_at",
    "c"."last_message",
    "c"."last_message_time",
    "p"."user_id",
    COALESCE("up"."is_muted", false) AS "is_muted",
    COALESCE("up"."is_pinned", false) AS "is_pinned",
    COALESCE("up"."is_archived", false) AS "is_archived",
    COALESCE("up"."is_deleted", false) AS "is_deleted",
    "up"."messages_cleared_at"
   FROM (("public"."conversations" "c"
     JOIN "public"."conversation_participants" "p" ON (("c"."id" = "p"."conversation_id")))
     LEFT JOIN "public"."user_conversation_preferences" "up" ON ((("p"."conversation_id" = "up"."conversation_id") AND ("p"."user_id" = "up"."user_id"))))
  WHERE (COALESCE("up"."is_deleted", false) = false);


ALTER TABLE "public"."user_conversations" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_conversations" IS 'View of conversations for each user, including their preferences and filtering out deleted conversations';



CREATE TABLE IF NOT EXISTS "public"."user_features" (
    "user_id" "uuid" NOT NULL,
    "feature_key" "text" NOT NULL,
    "source" "text" DEFAULT 'plan'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_kyc" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "birth_date" "text",
    "nationality" "text",
    "address" "text",
    "tax_id_hash" "text",
    "level" "text" DEFAULT 'none'::"text",
    "verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_kyc" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_kyc_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "document_path" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_kyc_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_plans" (
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "start_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_date" timestamp with time zone,
    "stripe_subscription_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_plans_status_check" CHECK (("status" = ANY (ARRAY['trialing'::"text", 'active'::"text", 'past_due'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."user_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_public_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "key_id" "text" NOT NULL,
    "public_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_public_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_security_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "disable_preview_links" boolean DEFAULT false,
    "block_unknown_senders" boolean DEFAULT false,
    "block_threshold" integer DEFAULT 10,
    "hide_ip_address" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_security_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verifiable_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "text" NOT NULL,
    "issuer_did" "text" NOT NULL,
    "issuer_name" "text" NOT NULL,
    "subject_did" "text" NOT NULL,
    "types" "text" NOT NULL,
    "claims" "jsonb" NOT NULL,
    "issuance_date" timestamp with time zone NOT NULL,
    "expiration_date" timestamp with time zone,
    "proof" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."verifiable_credentials" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_cnpj_key" UNIQUE ("cnpj");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_matches"
    ADD CONSTRAINT "company_matches_company_a_id_company_b_id_key" UNIQUE ("company_a_id", "company_b_id");



ALTER TABLE ONLY "public"."company_matches"
    ADD CONSTRAINT "company_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_user_id_company_id_key" UNIQUE ("user_id", "company_id");



ALTER TABLE ONLY "public"."connected_devices"
    ADD CONSTRAINT "connected_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."connected_devices"
    ADD CONSTRAINT "connected_devices_user_id_device_id_key" UNIQUE ("user_id", "device_id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_identities"
    ADD CONSTRAINT "digital_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."features"
    ADD CONSTRAINT "features_feature_key_key" UNIQUE ("feature_key");



ALTER TABLE ONLY "public"."features"
    ADD CONSTRAINT "features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meeting_participants"
    ADD CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_channels"
    ADD CONSTRAINT "notification_channels_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."notification_channels"
    ADD CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_channel_id_key" UNIQUE ("user_id", "channel_id");



ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_pkey" PRIMARY KEY ("plan_id", "feature_key");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_stripe_price_id_key" UNIQUE ("stripe_price_id");



ALTER TABLE ONLY "public"."pricing_plans"
    ADD CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("plan_name");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_reminders"
    ADD CONSTRAINT "scheduled_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."secure_documents"
    ADD CONSTRAINT "secure_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "unique_payment_method_per_user" UNIQUE ("user_id", "payment_method_id");



ALTER TABLE ONLY "public"."user_public_keys"
    ADD CONSTRAINT "unique_user_key_id" UNIQUE ("user_id", "key_id");



ALTER TABLE ONLY "public"."user_conversation_preferences"
    ADD CONSTRAINT "user_conversation_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_conversation_preferences"
    ADD CONSTRAINT "user_conversation_preferences_user_id_conversation_id_key" UNIQUE ("user_id", "conversation_id");



ALTER TABLE ONLY "public"."user_features"
    ADD CONSTRAINT "user_features_pkey" PRIMARY KEY ("user_id", "feature_key");



ALTER TABLE ONLY "public"."user_kyc_documents"
    ADD CONSTRAINT "user_kyc_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_kyc"
    ADD CONSTRAINT "user_kyc_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_plans"
    ADD CONSTRAINT "user_plans_pkey" PRIMARY KEY ("user_id", "plan_id");



ALTER TABLE ONLY "public"."user_public_keys"
    ADD CONSTRAINT "user_public_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_security_settings"
    ADD CONSTRAINT "user_security_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verifiable_credentials"
    ADD CONSTRAINT "verifiable_credentials_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_connected_devices_device_id" ON "public"."connected_devices" USING "btree" ("device_id");



CREATE INDEX "idx_connected_devices_user_id" ON "public"."connected_devices" USING "btree" ("user_id");



CREATE INDEX "idx_maintenance_logs_created_at" ON "public"."maintenance_logs" USING "btree" ("created_at");



CREATE INDEX "idx_maintenance_logs_operation" ON "public"."maintenance_logs" USING "btree" ("operation");



CREATE INDEX "idx_messages_expires_at" ON "public"."messages" USING "btree" ("expires_at");



CREATE INDEX "idx_messages_type" ON "public"."messages" USING "btree" ("type");



CREATE INDEX "idx_notification_logs_is_read" ON "public"."notification_logs" USING "btree" ("is_read", "delivered_at" DESC);



CREATE INDEX "idx_notification_logs_notification_type" ON "public"."notification_logs" USING "btree" ("notification_type");



CREATE INDEX "idx_notification_logs_user_id" ON "public"."notification_logs" USING "btree" ("user_id");



CREATE INDEX "idx_notification_preferences_user_id" ON "public"."notification_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_payment_history_created_at" ON "public"."payment_history" USING "btree" ("created_at");



CREATE INDEX "idx_payment_history_status" ON "public"."payment_history" USING "btree" ("status");



CREATE INDEX "idx_payment_history_transaction_id" ON "public"."payment_history" USING "btree" ("transaction_id");



CREATE INDEX "idx_payment_history_user_id" ON "public"."payment_history" USING "btree" ("user_id");



CREATE INDEX "idx_payment_methods_is_default" ON "public"."payment_methods" USING "btree" ("is_default");



CREATE INDEX "idx_payment_methods_payment_type" ON "public"."payment_methods" USING "btree" ("payment_type");



CREATE INDEX "idx_payment_methods_user_id" ON "public"."payment_methods" USING "btree" ("user_id");



CREATE INDEX "idx_scheduled_reminders_run_at_status" ON "public"."scheduled_reminders" USING "btree" ("run_at", "status");



CREATE INDEX "idx_scheduled_reminders_user_id" ON "public"."scheduled_reminders" USING "btree" ("user_id");



CREATE INDEX "idx_user_conversation_preferences_conversation_id" ON "public"."user_conversation_preferences" USING "btree" ("conversation_id");



CREATE INDEX "idx_user_conversation_preferences_is_deleted" ON "public"."user_conversation_preferences" USING "btree" ("is_deleted");



CREATE INDEX "idx_user_conversation_preferences_user_id" ON "public"."user_conversation_preferences" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "check_conversation_id" BEFORE INSERT ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."validate_conversation_id"();



CREATE OR REPLACE TRIGGER "messages_notify_update" AFTER INSERT OR UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_conversation_update"();



CREATE OR REPLACE TRIGGER "set_timestamp_features" BEFORE UPDATE ON "public"."features" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_payment_history" BEFORE UPDATE ON "public"."payment_history" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_payment_methods" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_plans" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_stripe_events" BEFORE UPDATE ON "public"."stripe_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_user_plans" BEFORE UPDATE ON "public"."user_plans" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "update_companies_modtime" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_conversations_modtime" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_messages_modtime" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_notification_channels_updated_at" BEFORE UPDATE ON "public"."notification_channels" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_modtime" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_scheduled_reminders_updated_at" BEFORE UPDATE ON "public"."scheduled_reminders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_conversation_preferences_updated_at" BEFORE UPDATE ON "public"."user_conversation_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_members"
    ADD CONSTRAINT "channel_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_matches"
    ADD CONSTRAINT "company_matches_company_a_id_fkey" FOREIGN KEY ("company_a_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_matches"
    ADD CONSTRAINT "company_matches_company_b_id_fkey" FOREIGN KEY ("company_b_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_members"
    ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connected_devices"
    ADD CONSTRAINT "connected_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."digital_identities"
    ADD CONSTRAINT "digital_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."maintenance_logs"
    ADD CONSTRAINT "maintenance_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."meeting_participants"
    ADD CONSTRAINT "meeting_participants_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meeting_participants"
    ADD CONSTRAINT "meeting_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."meetings"
    ADD CONSTRAINT "meetings_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_history"
    ADD CONSTRAINT "payment_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_feature_key_fkey" FOREIGN KEY ("feature_key") REFERENCES "public"."features"("feature_key") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_reminders"
    ADD CONSTRAINT "scheduled_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."secure_documents"
    ADD CONSTRAINT "secure_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_conversation_preferences"
    ADD CONSTRAINT "user_conversation_preferences_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_conversation_preferences"
    ADD CONSTRAINT "user_conversation_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_features"
    ADD CONSTRAINT "user_features_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_kyc_documents"
    ADD CONSTRAINT "user_kyc_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_kyc"
    ADD CONSTRAINT "user_kyc_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_plans"
    ADD CONSTRAINT "user_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."user_plans"
    ADD CONSTRAINT "user_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_public_keys"
    ADD CONSTRAINT "user_public_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_security_settings"
    ADD CONSTRAINT "user_security_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verifiable_credentials"
    ADD CONSTRAINT "verifiable_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated can read profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Channel creators/admins can delete channels" ON "public"."channels" FOR DELETE USING ((("auth"."uid"() = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "channels"."team_id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text"))))));



CREATE POLICY "Channel creators/admins can update channels" ON "public"."channels" FOR UPDATE USING ((("auth"."uid"() = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "channels"."team_id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text"))))));



CREATE POLICY "Company admins can update their companies" ON "public"."companies" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "company_members"."id") AND ("company_members"."user_id" = "auth"."uid"()) AND ("company_members"."role" = 'admin'::"text")))));



CREATE POLICY "Company members can view matches" ON "public"."company_matches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE ((("company_members"."company_id" = "company_matches"."company_a_id") OR ("company_members"."company_id" = "company_matches"."company_b_id")) AND ("company_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Company members can view their companies" ON "public"."companies" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."company_members"
  WHERE (("company_members"."company_id" = "company_members"."id") AND ("company_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Devices are self-owned" ON "public"."connected_devices" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Insert de payment history apenas pelo sistema" ON "public"."payment_history" FOR INSERT WITH CHECK (false);



CREATE POLICY "Métodos de pagamento são visíveis apenas para o próprio usu" ON "public"."payment_methods" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Payment history não pode ser alterado ou excluído via cliente" ON "public"."payment_history" FOR UPDATE USING (false);



CREATE POLICY "Payment history não pode ser excluído via cliente" ON "public"."payment_history" FOR DELETE USING (false);



CREATE POLICY "Payment history é visível apenas para o próprio usuário" ON "public"."payment_history" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Sellers can delete their products" ON "public"."products" FOR DELETE USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "Sellers can update their products" ON "public"."products" FOR UPDATE USING (("auth"."uid"() = "seller_id"));



CREATE POLICY "Team admins can create channels" ON "public"."channels" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "channels"."team_id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text")))) OR ("auth"."uid"() = "created_by")));



CREATE POLICY "Team admins can delete teams" ON "public"."teams" FOR DELETE USING ((("auth"."uid"() = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "teams"."id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text"))))));



CREATE POLICY "Team admins can remove members" ON "public"."team_members" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."team_members" "tm"
  WHERE (("tm"."team_id" = "team_members"."team_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."role" = 'admin'::"text")))) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Team admins can update team members" ON "public"."team_members" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."team_members" "tm"
  WHERE (("tm"."team_id" = "team_members"."team_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."role" = 'admin'::"text")))));



CREATE POLICY "Team admins can update teams" ON "public"."teams" FOR UPDATE USING ((("auth"."uid"() = "created_by") OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "teams"."id") AND ("team_members"."user_id" = "auth"."uid"()) AND ("team_members"."role" = 'admin'::"text"))))));



CREATE POLICY "Team members can join channels" ON "public"."channel_members" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = ( SELECT "channels"."team_id"
           FROM "public"."channels"
          WHERE ("channels"."id" = "channel_members"."channel_id"))) AND ("team_members"."user_id" = "auth"."uid"())))) AND ("auth"."uid"() = "user_id")));



CREATE POLICY "Users can create products" ON "public"."products" FOR INSERT WITH CHECK (("auth"."uid"() = "seller_id"));



CREATE POLICY "Users can create teams" ON "public"."teams" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete their meeting responses" ON "public"."meeting_participants" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own preferences" ON "public"."user_conversation_preferences" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own secure documents" ON "public"."secure_documents" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert messages to their conversations" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own KYC data" ON "public"."user_kyc" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own KYC documents" ON "public"."user_kyc_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own digital identities" ON "public"."digital_identities" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own preferences" ON "public"."user_conversation_preferences" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own public keys" ON "public"."user_public_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own secure documents" ON "public"."secure_documents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own security settings" ON "public"."user_security_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own verifiable credentials" ON "public"."verifiable_credentials" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can join teams" ON "public"."team_members" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can respond to meeting invites" ON "public"."meeting_participants" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their meeting responses" ON "public"."meeting_participants" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own KYC data" ON "public"."user_kyc" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own digital identities" ON "public"."digital_identities" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own preferences" ON "public"."user_conversation_preferences" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own secure documents" ON "public"."secure_documents" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own security settings" ON "public"."user_security_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view all public keys" ON "public"."user_public_keys" FOR SELECT USING (true);



CREATE POLICY "Users can view channel members in their teams" ON "public"."channel_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."channels" "c"
     JOIN "public"."team_members" "tm" ON (("c"."team_id" = "tm"."team_id")))
  WHERE (("c"."id" = "channel_members"."channel_id") AND ("tm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view channels in their teams" ON "public"."channels" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "channels"."team_id") AND ("team_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view meeting invitations" ON "public"."meeting_participants" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."meetings"
  WHERE (("meetings"."id" = "meeting_participants"."meeting_id") AND ("meetings"."created_by" = "auth"."uid"()))))));



CREATE POLICY "Users can view products" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Users can view teams they are members of" ON "public"."teams" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "teams"."id") AND ("team_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their conversations" ON "public"."conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "conversations"."id") AND ("cp"."user_id" = "auth"."uid"()) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."user_conversation_preferences" "pref"
          WHERE (("pref"."conversation_id" = "pref"."id") AND ("pref"."user_id" = "auth"."uid"()) AND ("pref"."is_deleted" = true)))))))));



CREATE POLICY "Users can view their own KYC data" ON "public"."user_kyc" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own KYC documents" ON "public"."user_kyc_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own digital identities" ON "public"."digital_identities" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own preferences" ON "public"."user_conversation_preferences" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own secure documents" ON "public"."secure_documents" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own security settings" ON "public"."user_security_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own verifiable credentials" ON "public"."verifiable_credentials" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their team memberships" ON "public"."team_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."team_members" "tm"
  WHERE (("tm"."team_id" = "team_members"."team_id") AND ("tm"."user_id" = "auth"."uid"()) AND ("tm"."role" = 'admin'::"text"))))));



CREATE POLICY "Usuários podem adicionar seus próprios métodos de pagamento" ON "public"."payment_methods" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuários podem atualizar seus próprios métodos de pagamento" ON "public"."payment_methods" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Usuários podem remover seus próprios métodos de pagamento" ON "public"."payment_methods" FOR DELETE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."channel_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."connected_devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_participants_delete" ON "public"."conversation_participants" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "conversation_participants_insert" ON "public"."conversation_participants" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "conversation_participants_select" ON "public"."conversation_participants" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_delete" ON "public"."conversations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "conversations_insert" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "conversations_select" ON "public"."conversations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "conversations_update" ON "public"."conversations" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."digital_identities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_maintenance_logs" ON "public"."maintenance_logs" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR ("auth"."uid"() IN ( SELECT "admins"."id"
   FROM "public"."admins"))));



CREATE POLICY "insert_messages_media" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "sender_id") AND ("auth"."uid"() IN ( SELECT "conversation_participants"."user_id"
   FROM "public"."conversation_participants"
  WHERE ("conversation_participants"."conversation_id" = "messages"."conversation_id")))));



ALTER TABLE "public"."maintenance_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meeting_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meetings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "meetings_delete" ON "public"."meetings" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "meetings_insert" ON "public"."meetings" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "meetings_select" ON "public"."meetings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "meetings_update" ON "public"."meetings" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages:select:visible" ON "public"."messages" FOR SELECT USING ((("auth"."uid"() IN ( SELECT "conversation_participants"."user_id"
   FROM "public"."conversation_participants"
  WHERE ("conversation_participants"."conversation_id" = "messages"."conversation_id"))) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."user_conversation_preferences"
  WHERE (("user_conversation_preferences"."user_id" = "auth"."uid"()) AND ("user_conversation_preferences"."conversation_id" = "messages"."conversation_id") AND ("user_conversation_preferences"."is_deleted" = true))))) AND (NOT (EXISTS ( SELECT 1
   FROM "public"."user_conversation_preferences"
  WHERE (("user_conversation_preferences"."user_id" = "auth"."uid"()) AND ("user_conversation_preferences"."conversation_id" = "messages"."conversation_id") AND ("user_conversation_preferences"."messages_cleared_at" IS NOT NULL) AND ("messages"."created_at" <= "user_conversation_preferences"."messages_cleared_at")))))));



CREATE POLICY "messages_delete_policy" ON "public"."messages" FOR DELETE TO "authenticated" USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "messages_insert_policy" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"()))))));



CREATE POLICY "messages_realtime_policy" ON "public"."messages" FOR SELECT TO "authenticated" USING (("conversation_id" IN ( SELECT "conversation_participants"."conversation_id"
   FROM "public"."conversation_participants"
  WHERE ("conversation_participants"."user_id" = "auth"."uid"()))));



CREATE POLICY "messages_select_policy" ON "public"."messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "messages_update_policy" ON "public"."messages" FOR UPDATE TO "authenticated" USING (("sender_id" = "auth"."uid"()));



ALTER TABLE "public"."notification_channels" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_channels:delete:service_role" ON "public"."notification_channels" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "notification_channels:insert:service_role" ON "public"."notification_channels" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "notification_channels:select:all" ON "public"."notification_channels" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "notification_channels:update:service_role" ON "public"."notification_channels" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."notification_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_logs:insert:service_role" ON "public"."notification_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "notification_logs:select:own" ON "public"."notification_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_logs:update:own" ON "public"."notification_logs" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_logs:update:service_role" ON "public"."notification_logs" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_preferences:all:service_role" ON "public"."notification_preferences" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "notification_preferences:delete:own" ON "public"."notification_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_preferences:insert:own" ON "public"."notification_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_preferences:select:own" ON "public"."notification_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "notification_preferences:update:own" ON "public"."notification_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."payment_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_reminders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scheduled_reminders:all:service_role" ON "public"."scheduled_reminders" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "scheduled_reminders:delete:own" ON "public"."scheduled_reminders" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "scheduled_reminders:insert:own" ON "public"."scheduled_reminders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "scheduled_reminders:select:own" ON "public"."scheduled_reminders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "scheduled_reminders:update:own" ON "public"."scheduled_reminders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."secure_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_maintenance_logs" ON "public"."maintenance_logs" FOR SELECT USING (((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text") OR ("auth"."uid"() IN ( SELECT "admins"."id"
   FROM "public"."admins"))));



CREATE POLICY "select_messages_media" ON "public"."messages" FOR SELECT USING (("auth"."uid"() IN ( SELECT "conversation_participants"."user_id"
   FROM "public"."conversation_participants"
  WHERE ("conversation_participants"."conversation_id" = "messages"."conversation_id"))));



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_conversation_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_conversation_preferences:delete:own" ON "public"."user_conversation_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_conversation_preferences:insert:own" ON "public"."user_conversation_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_conversation_preferences:select:own" ON "public"."user_conversation_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_conversation_preferences:update:own" ON "public"."user_conversation_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_kyc" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_kyc_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_public_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_security_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verifiable_credentials" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "internal"."is_participant_of"("_user_id" "uuid", "_conversation_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."add_payment_record"("p_user_id" "uuid", "p_transaction_id" "text", "p_amount" numeric, "p_currency" "text", "p_status" "text", "p_payment_method" "text", "p_description" "text", "p_invoice_url" "text", "p_invoice_pdf_url" "text", "p_reference_period" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."add_payment_record"("p_user_id" "uuid", "p_transaction_id" "text", "p_amount" numeric, "p_currency" "text", "p_status" "text", "p_payment_method" "text", "p_description" "text", "p_invoice_url" "text", "p_invoice_pdf_url" "text", "p_reference_period" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_payment_record"("p_user_id" "uuid", "p_transaction_id" "text", "p_amount" numeric, "p_currency" "text", "p_status" "text", "p_payment_method" "text", "p_description" "text", "p_invoice_url" "text", "p_invoice_pdf_url" "text", "p_reference_period" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_conversation_access"("conversation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_conversation_access"("conversation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_conversation_access"("conversation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_meeting_access"("meeting_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_meeting_access"("meeting_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_meeting_access"("meeting_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."meetings" TO "anon";
GRANT ALL ON TABLE "public"."meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."meetings" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_other_users_meetings"("user_id" "uuid", "min_date" timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_other_users_meetings"("user_id" "uuid", "min_date" timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_other_users_meetings"("user_id" "uuid", "min_date" timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_notification_prefs"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_notification_prefs"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_notification_prefs"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_reputation"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_reputation"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_reputation"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_known_contact"("p_user_id" "uuid", "p_contact_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_known_contact"("p_user_id" "uuid", "p_contact_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_known_contact"("p_user_id" "uuid", "p_contact_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_message_visible_to_user"("p_message_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_message_visible_to_user"("p_message_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_message_visible_to_user"("p_message_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_conversation_deleted"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_conversation_deleted"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_conversation_deleted"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_messages_cleared"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_messages_cleared"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_messages_cleared"("p_conversation_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_conversation_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_conversation_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_conversation_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."schedule_reminder"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_payload" "jsonb", "p_run_at" timestamp with time zone, "p_channels" "jsonb", "p_priority" "public"."notification_priority") TO "anon";
GRANT ALL ON FUNCTION "public"."schedule_reminder"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_payload" "jsonb", "p_run_at" timestamp with time zone, "p_channels" "jsonb", "p_priority" "public"."notification_priority") TO "authenticated";
GRANT ALL ON FUNCTION "public"."schedule_reminder"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_payload" "jsonb", "p_run_at" timestamp with time zone, "p_channels" "jsonb", "p_priority" "public"."notification_priority") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_conversation_archived"("p_conversation_id" "uuid", "p_is_archived" boolean, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_conversation_archived"("p_conversation_id" "uuid", "p_is_archived" boolean, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_conversation_archived"("p_conversation_id" "uuid", "p_is_archived" boolean, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_conversation_muted"("p_conversation_id" "uuid", "p_is_muted" boolean, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_conversation_muted"("p_conversation_id" "uuid", "p_is_muted" boolean, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_conversation_muted"("p_conversation_id" "uuid", "p_is_muted" boolean, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_conversation_pinned"("p_conversation_id" "uuid", "p_is_pinned" boolean, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_conversation_pinned"("p_conversation_id" "uuid", "p_is_pinned" boolean, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_conversation_pinned"("p_conversation_id" "uuid", "p_is_pinned" boolean, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_default_payment_method"("p_user_id" "uuid", "p_payment_method_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_default_payment_method"("p_user_id" "uuid", "p_payment_method_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_default_payment_method"("p_user_id" "uuid", "p_payment_method_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_payment_status"("p_transaction_id" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_payment_status"("p_transaction_id" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_payment_status"("p_transaction_id" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_notification_pref"("p_user_id" "uuid", "p_channel_id" "uuid", "p_settings" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_notification_pref"("p_user_id" "uuid", "p_channel_id" "uuid", "p_settings" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_notification_pref"("p_user_id" "uuid", "p_channel_id" "uuid", "p_settings" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_conversation_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_conversation_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_conversation_id"() TO "service_role";


















GRANT ALL ON TABLE "public"."admins" TO "anon";
GRANT ALL ON TABLE "public"."admins" TO "authenticated";
GRANT ALL ON TABLE "public"."admins" TO "service_role";



GRANT ALL ON TABLE "public"."channel_members" TO "anon";
GRANT ALL ON TABLE "public"."channel_members" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_members" TO "service_role";



GRANT ALL ON TABLE "public"."channels" TO "anon";
GRANT ALL ON TABLE "public"."channels" TO "authenticated";
GRANT ALL ON TABLE "public"."channels" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_matches" TO "anon";
GRANT ALL ON TABLE "public"."company_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."company_matches" TO "service_role";



GRANT ALL ON TABLE "public"."company_members" TO "anon";
GRANT ALL ON TABLE "public"."company_members" TO "authenticated";
GRANT ALL ON TABLE "public"."company_members" TO "service_role";



GRANT ALL ON TABLE "public"."connected_devices" TO "anon";
GRANT ALL ON TABLE "public"."connected_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."connected_devices" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."digital_identities" TO "anon";
GRANT ALL ON TABLE "public"."digital_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."digital_identities" TO "service_role";



GRANT ALL ON TABLE "public"."features" TO "anon";
GRANT ALL ON TABLE "public"."features" TO "authenticated";
GRANT ALL ON TABLE "public"."features" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_logs" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_logs" TO "service_role";



GRANT ALL ON TABLE "public"."meeting_participants" TO "anon";
GRANT ALL ON TABLE "public"."meeting_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."meeting_participants" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_channels" TO "anon";
GRANT ALL ON TABLE "public"."notification_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_channels" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notification_metrics" TO "anon";
GRANT ALL ON TABLE "public"."notification_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."payment_history" TO "anon";
GRANT ALL ON TABLE "public"."payment_history" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_history" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."plan_features" TO "anon";
GRANT ALL ON TABLE "public"."plan_features" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_features" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_plans" TO "anon";
GRANT ALL ON TABLE "public"."pricing_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_plans" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_reminders" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."secure_documents" TO "anon";
GRANT ALL ON TABLE "public"."secure_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."secure_documents" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_events" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."user_conversation_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_conversation_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_conversation_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_conversations" TO "anon";
GRANT ALL ON TABLE "public"."user_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."user_features" TO "anon";
GRANT ALL ON TABLE "public"."user_features" TO "authenticated";
GRANT ALL ON TABLE "public"."user_features" TO "service_role";



GRANT ALL ON TABLE "public"."user_kyc" TO "anon";
GRANT ALL ON TABLE "public"."user_kyc" TO "authenticated";
GRANT ALL ON TABLE "public"."user_kyc" TO "service_role";



GRANT ALL ON TABLE "public"."user_kyc_documents" TO "anon";
GRANT ALL ON TABLE "public"."user_kyc_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."user_kyc_documents" TO "service_role";



GRANT ALL ON TABLE "public"."user_plans" TO "anon";
GRANT ALL ON TABLE "public"."user_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."user_plans" TO "service_role";



GRANT ALL ON TABLE "public"."user_public_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_public_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_public_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_security_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_security_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_security_settings" TO "service_role";



GRANT ALL ON TABLE "public"."verifiable_credentials" TO "anon";
GRANT ALL ON TABLE "public"."verifiable_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."verifiable_credentials" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























RESET ALL;
