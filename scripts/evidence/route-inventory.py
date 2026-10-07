"""Generate the backend route inventory with guard status (Phase 0.1 evidence).
Usage: python scripts/evidence/route-inventory.py [output]
"""
import os, re, sys
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'server', 'pro-act-backend', 'src')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'plans', 'evidence', 'routes-v1.txt')
rows = []
for root, _, files in os.walk(ROOT):
    for f in files:
        if not f.endswith('.controller.ts'):
            continue
        p = os.path.join(root, f)
        s = open(p, encoding='utf-8').read()
        m = re.search(r"@Controller\(\s*['\"]([^'\"]*)['\"]", s)
        base = m.group(1) if m else ''
        guarded = 'UseGuards' in s
        rel = os.path.relpath(p, os.path.join(ROOT, '..')).replace(os.sep, '/')
        for mm in re.finditer(r"@(Get|Post|Put|Patch|Delete)\(\s*(?:['\"]([^'\"]*)['\"])?\s*\)", s):
            path = ('/api/' + base + '/' + (mm.group(2) or '')).replace('//', '/').rstrip('/')
            rows.append((path, mm.group(1).upper(), guarded, rel))
rows.sort()
with open(OUT, 'w', encoding='utf-8') as o:
    o.write(f"# Backend route inventory — {len(rows)} routes, {len({r[3] for r in rows})} controllers\n")
    o.write("# METHOD PATH guard=Y/N  controller file\n")
    for path, method, guarded, rel in rows:
        o.write(f"{method:6} {path:70} guard={'Y' if guarded else 'N'}  {rel}\n")
unguarded = sorted({r[3] for r in rows if not r[2]})
print(f"routes={len(rows)} controllers={len({r[3] for r in rows})} unguarded_controllers={len(unguarded)}")
for u in unguarded: print('  unguarded:', u)
