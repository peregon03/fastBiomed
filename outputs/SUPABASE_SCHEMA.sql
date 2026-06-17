create extension if not exists pgcrypto;

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plate text not null unique,
  serial_number text not null,
  location text not null,
  area text not null check (area in ('UCI', 'Urgencias', 'Cirugia')),
  last_maintenance date,
  next_maintenance date,
  frequency_months integer not null check (frequency_months in (6, 12)),
  pending_intervention boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_history (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  performed_at date not null,
  previous_next_date date,
  new_next_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at
before update on public.equipment
for each row
execute function public.set_updated_at();

alter table public.equipment enable row level security;
alter table public.maintenance_history enable row level security;

drop policy if exists "Usuarios autenticados pueden leer equipos" on public.equipment;
create policy "Usuarios autenticados pueden leer equipos"
on public.equipment for select
to authenticated
using (true);

drop policy if exists "Usuarios autenticados pueden crear equipos" on public.equipment;
create policy "Usuarios autenticados pueden crear equipos"
on public.equipment for insert
to authenticated
with check (true);

drop policy if exists "Usuarios autenticados pueden actualizar equipos" on public.equipment;
create policy "Usuarios autenticados pueden actualizar equipos"
on public.equipment for update
to authenticated
using (true)
with check (true);

drop policy if exists "Usuarios autenticados pueden eliminar equipos" on public.equipment;
create policy "Usuarios autenticados pueden eliminar equipos"
on public.equipment for delete
to authenticated
using (true);

drop policy if exists "Usuarios autenticados pueden leer historial" on public.maintenance_history;
create policy "Usuarios autenticados pueden leer historial"
on public.maintenance_history for select
to authenticated
using (true);

drop policy if exists "Usuarios autenticados pueden crear historial" on public.maintenance_history;
create policy "Usuarios autenticados pueden crear historial"
on public.maintenance_history for insert
to authenticated
with check (true);

drop policy if exists "Usuarios autenticados pueden actualizar historial" on public.maintenance_history;
create policy "Usuarios autenticados pueden actualizar historial"
on public.maintenance_history for update
to authenticated
using (true)
with check (true);

drop policy if exists "Usuarios autenticados pueden eliminar historial" on public.maintenance_history;
create policy "Usuarios autenticados pueden eliminar historial"
on public.maintenance_history for delete
to authenticated
using (true);
