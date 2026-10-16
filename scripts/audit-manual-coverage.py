"""Check documented route declarations and structured field inventory completeness."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/manuals/source'
OUT = ROOT / 'test-results/manual-qa'
OUT.mkdir(parents=True, exist_ok=True)
pages = []
inventories = []
missing_fields = []
missing_sources = []
required_page = ['key', 'title', 'routes', 'sources', 'purpose', 'access', 'workflow', 'sections', 'fields', 'actions', 'filters', 'logic', 'states', 'setup']
required_field = ['label', 'section', 'control', 'requirement', 'default', 'options', 'validation', 'behavior', 'example', 'source']
for path in sorted(SOURCE.glob('*-pages.json')):
    payload = json.loads(path.read_text(encoding='utf-8-sig'))
    inventories.append({'file': path.name, 'pages': len(payload['pages']), 'fields': sum(len(x.get('fields', [])) for x in payload['pages'])})
    for p in payload['pages']:
        pages.append(p)
        for key in required_page:
            if key not in p: missing_fields.append(f"{p.get('key')}: page property {key}")
        for i, field in enumerate(p.get('fields', [])):
            for key in required_field:
                if key not in field: missing_fields.append(f"{p['key']} field {i}: {key}")
        for value in p.get('sources', []) + [f.get('source', '') for f in p.get('fields', [])]:
            for match in re.finditer(r'(?:src|server|scripts|docs)/[^\s;,()]+?\.(?:tsx?|md|json|ps1|sql)(?=[:\s;,()]|$)', str(value)):
                candidate = match.group(0)
                if not (ROOT / candidate).exists(): missing_sources.append({'page': p['key'], 'source': candidate})


def normalize(route):
    route = route.split('?')[0].rstrip('/') or '/'
    return re.sub(r':[^/]+', ':id', route)


documented = {normalize(r) for p in pages for r in p.get('routes', []) if r.startswith('/')}
routes = []
for path in sorted((ROOT / 'src/app/routes').glob('*.tsx')):
    for route in re.findall(r"path:\s*['\"]([^'\"]+)['\"]", path.read_text(encoding='utf-8')):
        r = normalize(route)
        covered = r in documented or (r.endswith('/*') and any(x == r[:-2] or x.startswith(r[:-1]) for x in documented))
        routes.append({'route': route, 'source': str(path.relative_to(ROOT)).replace('\\', '/'), 'covered': covered})
report = {'inventories': inventories, 'pageGroups': len(pages), 'fieldEntries': sum(x['fields'] for x in inventories), 'routeDeclarations': len(routes), 'coveredDeclarations': sum(x['covered'] for x in routes), 'missingRoutes': [x for x in routes if not x['covered']], 'missingProperties': missing_fields, 'missingSources': missing_sources, 'routes': routes, 'scope': 'Static route and schema/source-path reconciliation. Control-level coverage is separately reconciled by each inventory owner; this check is not a claim of exhaustive runtime-state testing.'}
(OUT / 'coverage.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k != 'routes'}, indent=2))
if missing_fields or missing_sources or report['missingRoutes']: raise SystemExit(1)
