-- Adicionar transição direta de concluído para em_atendimento para facilitar reabertura
INSERT INTO ticket_status_transitions (from_status, to_status, reason, allowed) 
VALUES ('concluido', 'em_atendimento', 'Reabrir e iniciar atendimento direto', true);