insert into public.equipment
  (name, plate, serial_number, location, area, last_maintenance, next_maintenance, frequency_months, pending_intervention)
values
  ('Monitor multiparametro', 'UCI-001', 'SN-MON-9001', 'Cubiculo 1', 'UCI', '2026-02-10', '2026-08-10', 6, false),
  ('Ventilador mecanico', 'UCI-002', 'SN-VM-7821', 'Cubiculo 3', 'UCI', '2025-11-20', '2026-05-20', 6, true),
  ('Bomba de infusion', 'UCI-003', 'SN-BI-1220', 'Estacion central', 'UCI', '2026-01-05', '2027-01-05', 12, false),
  ('Desfibrilador', 'URG-001', 'SN-DES-3112', 'Sala de reanimacion', 'Urgencias', '2025-12-01', '2026-06-01', 6, false),
  ('Electrocardiografo', 'URG-002', 'SN-ECG-8172', 'Consultorio 2', 'Urgencias', '2026-03-22', '2026-09-22', 6, false),
  ('Nebulizador hospitalario', 'URG-003', 'SN-NEB-2390', 'Observacion adultos', 'Urgencias', '2026-05-28', '2026-11-28', 6, false),
  ('Lampara cielitica', 'CIR-001', 'SN-LC-4400', 'Quirofano 1', 'Cirugia', '2025-09-15', '2026-09-15', 12, false),
  ('Maquina de anestesia', 'CIR-002', 'SN-AN-2318', 'Quirofano 2', 'Cirugia', null, null, 6, false),
  ('Mesa quirurgica', 'CIR-003', 'SN-MQ-6404', 'Quirofano 3', 'Cirugia', '2026-05-30', '2026-11-30', 6, false),
  ('Aspirador quirurgico', 'CIR-004', 'SN-AQ-7741', 'Quirofano 1', 'Cirugia', '2026-06-05', '2026-12-05', 6, false)
on conflict (plate) do update set
  name = excluded.name,
  serial_number = excluded.serial_number,
  location = excluded.location,
  area = excluded.area,
  last_maintenance = excluded.last_maintenance,
  next_maintenance = excluded.next_maintenance,
  frequency_months = excluded.frequency_months,
  pending_intervention = excluded.pending_intervention;

insert into public.maintenance_history
  (equipment_id, performed_at, previous_next_date, new_next_date, notes)
select id, '2026-02-10'::date, '2026-02-10'::date, '2026-08-10'::date, 'Mantenimiento preventivo realizado'
from public.equipment where plate = 'UCI-001'
union all
select id, '2026-01-05'::date, '2026-01-05'::date, '2027-01-05'::date, 'Mantenimiento anual realizado'
from public.equipment where plate = 'UCI-003'
union all
select id, '2026-03-22'::date, '2026-03-22'::date, '2026-09-22'::date, 'Mantenimiento preventivo realizado'
from public.equipment where plate = 'URG-002'
union all
select id, '2026-05-28'::date, '2026-05-28'::date, '2026-11-28'::date, 'Mantenimiento preventivo realizado'
from public.equipment where plate = 'URG-003'
union all
select id, '2026-05-30'::date, '2026-05-30'::date, '2026-11-30'::date, 'Mantenimiento preventivo realizado'
from public.equipment where plate = 'CIR-003'
union all
select id, '2026-06-05'::date, '2026-06-05'::date, '2026-12-05'::date, 'Mantenimiento preventivo realizado'
from public.equipment where plate = 'CIR-004';
