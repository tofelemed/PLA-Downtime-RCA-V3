"""Check final DOCX structure and inventory preservation; visual QA is separate."""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
import re
from lxml import etree
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / 'test-results/manual-qa'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}


def heading(value):
    return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', ' ', value.replace('_', ' '))).strip()


def details(field):
    chunks = [f"{field['control']}. {field['requirement']}"]
    for label, key in [('Default', 'default'), ('Options', 'options'), ('Validation', 'validation'), ('Behavior', 'behavior'), ('Example', 'example')]:
        value = field.get(key)
        if isinstance(value, list): value = '; '.join(str(x) for x in value)
        if value and value != 'No fixed example in the control.': chunks.append(f'{label}: {value}')
    return ''.join(chunks)


def field_content_errors(xml):
    """Reconcile the full field description within its page and section."""
    tag = '{' + NS['w'] + '}'
    chapter = section = ''
    rows = {}
    for node in xml.find(tag + 'body'):
        if node.tag == tag + 'p':
            style = node.find('./' + tag + 'pPr/' + tag + 'pStyle')
            value = style.get(tag + 'val') if style is not None else ''
            if value == 'Heading2': chapter = ''.join(node.xpath('.//w:t/text()', namespaces=NS))
            if value == 'Heading3': section = ''.join(node.xpath('.//w:t/text()', namespaces=NS))
        elif node.tag == tag + 'tbl':
            for row in node.findall(tag + 'tr')[1:]:
                cells = row.findall(tag + 'tc')
                if len(cells) == 2:
                    rows.setdefault((chapter, section), []).append(tuple(''.join(c.xpath('.//w:t/text()', namespaces=NS)) for c in cells))
    missing = []
    for inventory in sorted((ROOT / 'docs/manuals/source').glob('*-pages.json')):
        for page in json.loads(inventory.read_text(encoding='utf-8-sig'))['pages']:
            for item in page['fields']:
                candidates = rows.get((heading(page['title']), heading(item['section'])), [])
                expected = details(item)
                if not any(item['label'] in label and expected == detail for label, detail in candidates):
                    missing.append({'page': page['key'], 'section': item['section'], 'field': item['label']})
    return missing


reports = []
for path in sorted((ROOT / 'docs/manuals').glob('0[1-5]_*.docx')):
    with ZipFile(path) as archive:
        xml = etree.fromstring(archive.read('word/document.xml'))
        strings = xml.xpath('//w:t/text()', namespaces=NS)
        text = ' '.join(strings)
        instructions = xml.xpath('//w:instrText/text()', namespaces=NS)
        errors = []
        if not any('TOC ' in x for x in instructions): errors.append('Missing contents field')
        for prohibited in ['Error! Bookmark', 'Error! Reference', 'Persona-2026!demo', 'demo123']:
            if prohibited in text: errors.append(f'Prohibited result or credential: {prohibited}')
        if path.name.startswith('01_'):
            normalize = lambda value: re.sub(r'\s+', ' ', value).strip()
            full = normalize(text)
            missing = []
            for inventory in sorted((ROOT / 'docs/manuals/source').glob('*-pages.json')):
                for page in json.loads(inventory.read_text(encoding='utf-8-sig'))['pages']:
                    for item in page['fields']:
                        if normalize(item['label']) not in full: missing.append([page['key'], item['label']])
            if missing: errors.append({'missingFieldLabels': missing})
            content_mismatches = field_content_errors(xml)
            if content_mismatches: errors.append({'fieldContentMismatches': content_mismatches})
        if path.name.startswith('05_'):
            personas = json.loads((ROOT / 'docs/manuals/source/persona-responsibilities.json').read_text(encoding='utf-8'))
            missing_people = [p['login'] for p in personas['personaRoster'] if p['login'] not in text or p['name'] not in text]
            if missing_people: errors.append({'missingPersonas': missing_people})
            missing_workflows = [row['workflow'] for row in personas['responsibilityMatrix']['rows'] if row['workflow'] not in text]
            if missing_workflows: errors.append({'missingResponsibilityFamilies': missing_workflows})
        pdf = PdfReader(QA / (path.stem + '.pdf'))
        sparse = []
        for number, page in enumerate(pdf.pages, 1):
            content = page.extract_text() or ''
            if not re.search(rf'Page\s+{number}\s+of\s+{len(pdf.pages)}', content): errors.append(f'Missing page footer {number}')
            if len(content.strip()) < 400: sparse.append(number)
        reports.append({'document': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'pages': len(pdf.pages), 'wordsApproximate': len(text.split()),
                        'tables': len(xml.xpath('//w:tbl', namespaces=NS)),
                        'sparsePagesForVisualReview': sparse, 'errors': errors})
(QA / 'document-validation.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')
print(json.dumps(reports, indent=2))
if any(report['errors'] for report in reports): raise SystemExit(1)
