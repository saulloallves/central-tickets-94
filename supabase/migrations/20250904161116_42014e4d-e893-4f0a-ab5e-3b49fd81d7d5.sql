-- Adicionar rota de notificação para ticket_created
INSERT INTO public.notification_routes (
  type,
  destination_value,
  destination_label,
  priority,
  is_active,
  unit_id,
  description
) VALUES (
  'ticket_created',
  '120363185213602323-group',
  'Grupo Respostas - 00a4ce0f-b4c7-4f19-a7ef-c87b354604f5',
  0,
  true,
  '00a4ce0f-b4c7-4f19-a7ef-c87b354604f5',
  'Notificação de novos tickets criados'
);