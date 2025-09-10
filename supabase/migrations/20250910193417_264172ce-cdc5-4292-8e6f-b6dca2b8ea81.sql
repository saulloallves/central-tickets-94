-- Create internal notifications system tables
CREATE TABLE public.internal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT,
  type TEXT CHECK (type IN ('ticket', 'sla', 'alert', 'info', 'crisis')) NOT NULL,
  equipe_id UUID REFERENCES public.equipes(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.internal_notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES public.internal_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Enable RLS
ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notification_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for internal_notifications
CREATE POLICY "Users can view notifications for their teams"
ON public.internal_notifications
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'diretoria'::app_role) OR
  (equipe_id IS NOT NULL AND is_active_member_of_equipe(auth.uid(), equipe_id))
);

CREATE POLICY "Admins and diretoria can manage notifications"
ON public.internal_notifications
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'diretoria'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'diretoria'::app_role)
);

-- RLS Policies for internal_notification_recipients
CREATE POLICY "Users can view their own notification status"
ON public.internal_notification_recipients
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification status"
ON public.internal_notification_recipients
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notification recipients"
ON public.internal_notification_recipients
FOR INSERT
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_internal_notifications_equipe_id ON public.internal_notifications(equipe_id);
CREATE INDEX idx_internal_notifications_created_at ON public.internal_notifications(created_at DESC);
CREATE INDEX idx_internal_notification_recipients_user_id ON public.internal_notification_recipients(user_id);
CREATE INDEX idx_internal_notification_recipients_unread ON public.internal_notification_recipients(user_id, is_read) WHERE is_read = false;

-- Enable realtime
ALTER publication supabase_realtime ADD TABLE public.internal_notifications;
ALTER publication supabase_realtime ADD TABLE public.internal_notification_recipients;