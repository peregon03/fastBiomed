"""
Validacion manual de KPIs del dashboard contra SQLite.
Ejecutar: python validar_kpis.py
"""
import sqlite3
from datetime import date, datetime
from pathlib import Path

DB = Path(__file__).parent / "app" / "data" / "biomed.db"

def status_for(next_maintenance, pending=0):
    if not next_maintenance:
        return "Sin programacion"
    next_date = datetime.strptime(next_maintenance[:10], "%Y-%m-%d").date()
    delta = (next_date - date.today()).days
    if delta < 0:   return "Vencido"
    if pending:     return "Pendiente"
    if delta <= 30: return "Proximo a vencer"
    return "Vigente"

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
hoy = date.today()

print(f"\n{'='*60}")
print(f"  VALIDACION KPIs — {hoy}  |  DB: {DB.name}")
print(f"{'='*60}")

# 1. Total equipos
total = conn.execute("SELECT COUNT(*) FROM equipment").fetchone()[0]
print(f"\n1. TOTAL EQUIPOS\n   {total}")

# 2. Distribucion por status
print(f"\n2. DISTRIBUCION POR STATUS (calculado con status_for)")
filas = conn.execute(
    "SELECT id, name, plate, next_maintenance, pending_intervention FROM equipment ORDER BY area, name"
).fetchall()

from collections import Counter, defaultdict
status_map = {}
for r in filas:
    s = status_for(r["next_maintenance"], r["pending_intervention"])
    status_map[r["id"]] = s

counts = Counter(status_map.values())
for st in ["Vigente", "Proximo a vencer", "Vencido", "Pendiente", "Sin programacion"]:
    print(f"   {st:<24} {counts.get(st, 0)}")

print(f"\n   Detalle fila a fila:")
print(f"   {'Placa':<10} {'Nombre':<30} {'next_maint':<12} {'dias':>5}  {'Status'}")
print(f"   {'-'*80}")
for r in filas:
    nd = r["next_maintenance"]
    if nd:
        delta = (datetime.strptime(nd[:10], "%Y-%m-%d").date() - hoy).days
        dias = f"{delta:+d}"
    else:
        dias = "null"
    print(f"   {r['plate']:<10} {r['name']:<30} {nd or 'null':<12} {dias:>5}  {status_map[r['id']]}")

# 3. Realizados (equipos unicos con historial)
unicos = conn.execute("SELECT COUNT(DISTINCT equipment_id) FROM maintenance_history").fetchone()[0]
print(f"\n3. REALIZADOS (equipos únicos con historial)\n   {unicos}")

# 4. Total filas historial
filas_hist = conn.execute("SELECT COUNT(*) FROM maintenance_history").fetchone()[0]
print(f"\n4. TOTAL FILAS EN maintenance_history\n   {filas_hist}")

# 5. Equipos sin historial
sin_hist = conn.execute(
    "SELECT COUNT(*) FROM equipment WHERE id NOT IN (SELECT DISTINCT equipment_id FROM maintenance_history)"
).fetchone()[0]
print(f"\n5. EQUIPOS SIN NINGÚN REGISTRO EN HISTORIAL\n   {sin_hist}")

# Calculo final del dashboard
hist_ids = {h[0] for h in conn.execute("SELECT DISTINCT equipment_id FROM maintenance_history").fetchall()}
eq_rows  = conn.execute("SELECT id, next_maintenance, pending_intervention FROM equipment").fetchall()

completed = sum(1 for e in eq_rows if e["id"] in hist_ids)
scheduled = sum(1 for e in eq_rows if status_for(e["next_maintenance"], e["pending_intervention"]) == "Vigente")
overdue   = sum(1 for e in eq_rows if status_for(e["next_maintenance"], e["pending_intervention"]) == "Vencido")
due_soon  = sum(1 for e in eq_rows if status_for(e["next_maintenance"], e["pending_intervention"]) == "Proximo a vencer")
pending   = sum(1 for e in eq_rows if status_for(e["next_maintenance"], e["pending_intervention"]) == "Pendiente")
denom     = completed + overdue + due_soon + pending
compliance = round((completed / denom) * 100, 1) if denom > 0 else 0

print(f"\n{'='*60}")
print(f"  DASHBOARD KPIs ESPERADOS")
print(f"{'='*60}")
print(f"  Total equipos          {total}")
print(f"  Programados (Vigente)  {scheduled}")
print(f"  Próximos a vencer      {due_soon}")
print(f"  Vencidos               {overdue}")
print(f"  Pendiente              {pending}")
print(f"  Sin programación       {counts.get('Sin programacion', 0)}")
print(f"  Realizados (únicos)    {completed}   ← antes era {filas_hist} (filas brutas)")
print(f"  Denominador            {denom}  (completed+overdue+dueSoon+pending)")
print(f"  Cumplimiento           {compliance}%")
print(f"{'='*60}\n")

conn.close()
