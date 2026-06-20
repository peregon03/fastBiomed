-- =============================================================
-- RESET + DATOS DE PRUEBA — Fast Biomed
-- Fecha de referencia: 2026-06-20
--
-- Ejecutar en: Supabase → SQL Editor
-- ADVERTENCIA: elimina TODOS los datos existentes antes de insertar
--
-- Resultado esperado en el dashboard:
--   Total equipos    12
--   Programados       4  (Vigente, delta > 30 días)
--   Próximos          3  (delta 0–30 días)
--   Vencidos          2  (fecha ya pasó)
--   Reportado         1  (pending_intervention = true)
--   Sin programar     2  (tarjeta gris aparece)
--   Realizados        6  (equipos únicos con historial)
--   Este mes          2  (registros en junio 2026)
--   Cumplimiento     50% (6 / (6+2+3+1))
-- =============================================================

-- 1. LIMPIAR DATOS EXISTENTES
TRUNCATE TABLE public.maintenance_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.equipment           RESTART IDENTITY CASCADE;

-- 2. INSERTAR EQUIPOS
INSERT INTO public.equipment
  (name, plate, serial_number, location, area,
   last_maintenance, next_maintenance, frequency_months, pending_intervention)
VALUES

  -- ── VENCIDOS (next_maintenance < 2026-06-20) ──────────────
  ('Monitor multiparámetro',   'UCI-001', 'SN-MON-001', 'Cubículo 1',        'UCI',       '2025-11-10', '2026-05-10', 6,  false),
  ('Desfibrilador',            'URG-001', 'SN-DES-001', 'Sala reanimación',  'Urgencias', '2025-12-01', '2026-06-01', 6,  false),

  -- ── PRÓXIMOS A VENCER (delta 0–30 días) ───────────────────
  ('Ventilador mecánico',      'UCI-002', 'SN-VM-001',  'Cubículo 3',        'UCI',       '2025-12-25', '2026-06-25', 6,  false),
  ('Electrocardiógrafo',       'URG-002', 'SN-ECG-001', 'Consultorio 2',     'Urgencias', '2026-01-05', '2026-07-05', 6,  false),
  ('Lámpara cielítica',        'CIR-001', 'SN-LC-001',  'Quirófano 1',       'Cirugia',   '2025-12-15', '2026-07-15', 6,  false),

  -- ── VIGENTES (delta > 30 días) ────────────────────────────
  ('Bomba de infusión',        'UCI-003', 'SN-BI-001',  'Estación central',  'UCI',       '2026-06-20', '2026-12-20', 6,  false),
  ('Nebulizador hospitalario', 'URG-003', 'SN-NEB-001', 'Observación',       'Urgencias', '2026-05-15', '2026-11-15', 6,  false),
  ('Mesa quirúrgica',          'CIR-002', 'SN-MQ-001',  'Quirófano 2',       'Cirugia',   '2026-03-01', '2026-09-01', 6,  false),
  ('Máquina de anestesia',     'CIR-003', 'SN-AN-001',  'Quirófano 3',       'Cirugia',   '2026-06-20', '2027-06-20', 12, false),

  -- ── REPORTADO (pending_intervention = true, delta >= 0) ───
  ('Aspirador quirúrgico',     'UCI-004', 'SN-AQ-001',  'Cubículo 4',        'UCI',       '2026-02-01', '2026-08-01', 6,  true),

  -- ── SIN PROGRAMACIÓN (next_maintenance IS NULL) ───────────
  ('Equipo de rayos X',        'URG-004', 'SN-RX-001',  'Radiología',        'Urgencias', null,         null,         6,  false),
  ('Autoclave',                'CIR-004', 'SN-AC-001',  'Esterilización',    'Cirugia',   null,         null,         6,  false);

-- 3. INSERTAR HISTORIAL DE MANTENIMIENTOS
--    (6 equipos únicos → Realizados = 6)
--    (2 registros en junio 2026 → Este mes = 2)

INSERT INTO public.maintenance_history
  (equipment_id, performed_at, previous_next_date, new_next_date, notes)

-- UCI-003: realizado hoy (cuenta en "este mes")
SELECT id, '2026-06-20'::date, '2026-06-20'::date, '2026-12-20'::date, 'Mantenimiento semestral'
FROM public.equipment WHERE plate = 'UCI-003'

UNION ALL

-- CIR-003: realizado hoy (cuenta en "este mes")
SELECT id, '2026-06-20'::date, '2026-06-20'::date, '2027-06-20'::date, 'Mantenimiento anual'
FROM public.equipment WHERE plate = 'CIR-003'

UNION ALL

-- URG-003: realizado en mayo
SELECT id, '2026-05-15'::date, '2026-05-15'::date, '2026-11-15'::date, 'Mantenimiento semestral'
FROM public.equipment WHERE plate = 'URG-003'

UNION ALL

-- CIR-002: realizado en marzo
SELECT id, '2026-03-01'::date, '2026-03-01'::date, '2026-09-01'::date, 'Mantenimiento semestral'
FROM public.equipment WHERE plate = 'CIR-002'

UNION ALL

-- UCI-002: realizado en diciembre (está próximo a vencer de nuevo)
SELECT id, '2025-12-25'::date, '2025-12-25'::date, '2026-06-25'::date, 'Mantenimiento semestral'
FROM public.equipment WHERE plate = 'UCI-002'

UNION ALL

-- URG-002: realizado en enero (está próximo a vencer de nuevo)
SELECT id, '2026-01-05'::date, '2026-01-05'::date, '2026-07-05'::date, 'Mantenimiento semestral'
FROM public.equipment WHERE plate = 'URG-002';

-- =============================================================
-- VERIFICACIÓN — pega esta query aparte para confirmar
-- =============================================================
/*
WITH s AS (
  SELECT id,
    CASE
      WHEN next_maintenance IS NULL                                      THEN 'Sin programacion'
      WHEN next_maintenance::date < CURRENT_DATE                        THEN 'Vencido'
      WHEN pending_intervention = true                                   THEN 'Pendiente'
      WHEN next_maintenance::date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Proximo a vencer'
      ELSE 'Vigente'
    END AS status
  FROM equipment
),
h AS (SELECT DISTINCT equipment_id FROM maintenance_history),
hm AS (SELECT equipment_id FROM maintenance_history
       WHERE performed_at >= date_trunc('month', CURRENT_DATE))
SELECT
  COUNT(*)                                               AS total,
  COUNT(*) FILTER (WHERE s.status = 'Vigente')           AS programados,
  COUNT(*) FILTER (WHERE s.status = 'Proximo a vencer')  AS proximos,
  COUNT(*) FILTER (WHERE s.status = 'Vencido')           AS vencidos,
  COUNT(*) FILTER (WHERE s.status = 'Pendiente')         AS reportado,
  COUNT(*) FILTER (WHERE s.status = 'Sin programacion')  AS sin_programar,
  COUNT(*) FILTER (WHERE h.equipment_id IS NOT NULL)     AS realizados,
  COUNT(DISTINCT hm.equipment_id)                        AS este_mes
FROM s
LEFT JOIN h  ON h.equipment_id  = s.id
LEFT JOIN hm ON hm.equipment_id = s.id;
*/
