-- Drop e recriar view tickets_with_sla_info com novo campo sla_minutos_uteis_decorridos
DROP VIEW IF EXISTS tickets_with_sla_info;

CREATE VIEW tickets_with_sla_info AS
SELECT 
  t.*,
  calcular_minutos_uteis_restantes(t.data_limite_sla) as sla_minutos_restantes_calculado,
  -- ✅ NOVO CAMPO: Minutos úteis decorridos desde abertura
  calcular_minutos_uteis_entre_datas(t.data_abertura, NOW()) as sla_minutos_uteis_decorridos,
  CASE 
    WHEN t.data_limite_sla IS NULL THEN 'sem_sla'
    WHEN calcular_minutos_uteis_restantes(t.data_limite_sla) < 0 THEN 'vencido'
    WHEN calcular_minutos_uteis_restantes(t.data_limite_sla) <= 60 THEN 'critico'
    WHEN calcular_minutos_uteis_restantes(t.data_limite_sla) <= 120 THEN 'atencao'
    ELSE 'normal'
  END as status_sla_calculado,
  CASE 
    WHEN t.data_limite_sla IS NULL THEN false
    WHEN calcular_minutos_uteis_restantes(t.data_limite_sla) < 0 THEN true
    ELSE false
  END as is_overdue_calculated
FROM tickets t;