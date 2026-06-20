-- =============================================================
-- SEED DE DEMOSTRACIÓN — cubre todos los estados del sistema
-- Fecha de referencia: 2026-06-20
--
-- Estado calculado por statusFor():
--   Vencido          → next_maintenance < 2026-06-20   (delta < 0)
--   Próximo a vencer → next_maintenance entre 2026-06-20 y 2026-07-20 (delta 0-30)
--   Vigente          → next_maintenance > 2026-07-20   (delta > 30)
--   Pendiente        → pending_intervention = true  AND delta >= 0
--   Sin programación → next_maintenance IS NULL
--
-- Ejecutar en: Supabase → SQL Editor
-- Es seguro re-ejecutar: usa ON CONFLICT DO UPDATE
-- =============================================================

insert into public.equipment
  (name, plate, serial_number, location, area, last_maintenance, next_maintenance, frequency_months, pending_intervention)
values

  -- ── UCI ────────────────────────────────────────────────────
  -- Vencido: próximo fue hace 15 días
  ('Monitor multiparámetro',  'UCI-001', 'SN-MON-9001', 'Cubículo 1',       'UCI',       '2025-12-05', '2026-06-05', 6,  false),
  -- Próximo a vencer: 8 días restantes (2026-06-28)
  ('Ventilador mecánico',     'UCI-002', 'SN-VM-7821',  'Cubículo 3',       'UCI',       '2025-12-28', '2026-06-28', 6,  false),
  -- Vigente: 7 meses para el próximo
  ('Bomba de infusión',       'UCI-003', 'SN-BI-1220',  'Estación central', 'UCI',       '2026-01-05', '2027-01-05', 12, false),

  -- ── URGENCIAS ──────────────────────────────────────────────
  -- Vencido: próximo fue hace 32 días
  ('Desfibrilador',           'URG-001', 'SN-DES-3112', 'Sala reanimación', 'Urgencias', '2025-11-19', '2026-05-19', 6,  false),
  -- Próximo a vencer: 18 días restantes (2026-07-08)
  ('Electrocardiógrafo',      'URG-002', 'SN-ECG-8172', 'Consultorio 2',    'Urgencias', '2026-01-08', '2026-07-08', 6,  false),
  -- Vigente: 5 meses para el próximo
  ('Nebulizador hospitalario','URG-003', 'SN-NEB-2390', 'Observación',      'Urgencias', '2026-05-18', '2026-11-18', 6,  false),

  -- ── CIRUGÍA ────────────────────────────────────────────────
  -- Próximo a vencer: 5 días restantes (2026-06-25)
  ('Lámpara cielítica',       'CIR-001', 'SN-LC-4400',  'Quirófano 1',      'Cirugia',   '2025-12-25', '2026-06-25', 6,  false),
  -- Sin programación: sin fecha de mantenimiento
  ('Máquina de anestesia',    'CIR-002', 'SN-AN-2318',  'Quirófano 2',      'Cirugia',   null,         null,         6,  false),
  -- Pendiente de intervención: tiene fecha futura pero requiere atención urgente
  ('Mesa quirúrgica',         'CIR-003', 'SN-MQ-6404',  'Quirófano 3',      'Cirugia',   '2025-12-30', '2026-08-30', 6,  true),
  -- Vigente: 6 meses para el próximo
  ('Aspirador quirúrgico',    'CIR-004', 'SN-AQ-7741',  'Quirófano 1',      'Cirugia',   '2026-06-05', '2026-12-05', 6,  false)

on conflict (plate) do update set
  name                = excluded.name,
  serial_number       = excluded.serial_number,
  location            = excluded.location,
  area                = excluded.area,
  last_maintenance    = excluded.last_maintenance,
  next_maintenance    = excluded.next_maintenance,
  frequency_months    = excluded.frequency_months,
  pending_intervention = excluded.pending_intervention;

-- =============================================================
-- Historial de mantenimientos realizados
-- (se insertan solo si no existe ya un registro igual)
-- =============================================================

insert into public.maintenance_history
  (equipment_id, performed_at, previous_next_date, new_next_date, notes)
select e.id, '2025-12-05'::date, '2025-12-05'::date, '2026-06-05'::date,
       'Mantenimiento semestral realizado'
from public.equipment e where e.plate = 'UCI-001'
and not exists (
  select 1 from public.maintenance_history h
  where h.equipment_id = e.id and h.performed_at = '2025-12-05'::date
)

union all

select e.id, '2026-01-05'::date, '2026-01-05'::date, '2027-01-05'::date,
       'Mantenimiento anual realizado'
from public.equipment e where e.plate = 'UCI-003'
and not exists (
  select 1 from public.maintenance_history h
  where h.equipment_id = e.id and h.performed_at = '2026-01-05'::date
)

union all

select e.id, '2026-01-08'::date, '2026-01-08'::date, '2026-07-08'::date,
       'Mantenimiento preventivo realizado'
from public.equipment e where e.plate = 'URG-002'
and not exists (
  select 1 from public.maintenance_history h
  where h.equipment_id = e.id and h.performed_at = '2026-01-08'::date
)

union all

select e.id, '2026-05-18'::date, '2026-05-18'::date, '2026-11-18'::date,
       'Mantenimiento preventivo realizado'
from public.equipment e where e.plate = 'URG-003'
and not exists (
  select 1 from public.maintenance_history h
  where h.equipment_id = e.id and h.performed_at = '2026-05-18'::date
)

union all

select e.id, '2026-06-05'::date, '2026-06-05'::date, '2026-12-05'::date,
       'Mantenimiento semestral realizado'
from public.equipment e where e.plate = 'CIR-004'
and not exists (
  select 1 from public.maintenance_history h
  where h.equipment_id = e.id and h.performed_at = '2026-06-05'::date
);

-- =============================================================
-- RESULTADO ESPERADO EN EL DASHBOARD
-- ┌─────────────────────────────────────────────────────────┐
-- │  Total equipos    │ 10                                  │
-- │  Programados      │  3  (UCI-003, URG-003, CIR-004)    │
-- │  Próximos         │  3  (UCI-002, URG-002, CIR-001)    │
-- │  Vencidos         │  2  (UCI-001, URG-001)              │
-- │  Pendiente        │  1  (CIR-003)                       │
-- │  Sin programación │  1  (CIR-002)                       │
-- │  Realizados       │  5  registros en historial          │
-- └─────────────────────────────────────────────────────────┘
-- =============================================================
