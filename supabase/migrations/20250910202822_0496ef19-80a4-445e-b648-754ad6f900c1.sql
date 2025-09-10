-- ===== COMPREHENSIVE SYSTEM IMPROVEMENTS - PART 1 =====
-- Remove dependent triggers first, then functions

-- 1. DROP DEPENDENT TRIGGERS FIRST
DROP TRIGGER IF EXISTS trg_tickets_after_insert_check_crisis ON public.tickets;
DROP TRIGGER IF EXISTS check_and_activate_crisis_trigger ON public.tickets;

-- 2. NOW DROP THE FUNCTIONS SAFELY
DROP FUNCTION IF EXISTS public.check_and_activate_crisis() CASCADE;
DROP FUNCTION IF EXISTS public.activate_crisis(uuid, text, uuid, text[]) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_crisis(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.log_crisis_action(uuid, text, uuid, jsonb) CASCADE;

-- 3. FIX RLS POLICIES
-- Fix internal_notification_recipients INSERT policy to be more secure
DROP POLICY IF EXISTS "System can insert notification recipients" ON public.internal_notification_recipients;
DROP POLICY IF EXISTS "Users can insert their own notification recipients" ON public.internal_notification_recipients;

CREATE POLICY "Users can insert their own notification recipients" ON public.internal_notification_recipients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow system functions to insert notifications (for edge functions)
CREATE POLICY "System can insert notification recipients" ON public.internal_notification_recipients
  FOR INSERT WITH CHECK (
    auth.uid() IS NULL OR auth.uid() = user_id
  );

-- 4. ENABLE REALTIME FOR CRITICAL TABLES
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER TABLE public.crise_ticket_links REPLICA IDENTITY FULL;
ALTER TABLE public.internal_notification_recipients REPLICA IDENTITY FULL;
ALTER TABLE public.crises REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_mensagens REPLICA IDENTITY FULL;