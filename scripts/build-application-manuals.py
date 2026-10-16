"""Build the four source-backed application manuals with the bundled Python runtime."""
from pathlib import Path
import argparse
import json
import re
from collections import defaultdict

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/manuals/source'
OUT = ROOT / 'docs/manuals'
BLACK = RGBColor(0, 0, 0)
SAVE_ONLY = None


def words_heading(text):
    return re.sub(r'\s+', ' ', re.sub(r'[^\w\s]', ' ', text.replace('_', ' '))).strip()


def field(p, instruction, placeholder=''):
    run = p.add_run()
    begin = OxmlElement('w:fldChar'); begin.set(qn('w:fldCharType'), 'begin')
    code = OxmlElement('w:instrText'); code.set(qn('xml:space'), 'preserve'); code.text = instruction
    separate = OxmlElement('w:fldChar'); separate.set(qn('w:fldCharType'), 'separate')
    value = OxmlElement('w:t'); value.text = placeholder
    end = OxmlElement('w:fldChar'); end.set(qn('w:fldCharType'), 'end')
    for element in (begin, code, separate, value, end): run._r.append(element)


def new_doc(title, subtitle, introduction):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Inches(8.5); sec.page_height = Inches(11)
    sec.top_margin = Inches(.7); sec.bottom_margin = Inches(.7)
    sec.left_margin = Inches(.75); sec.right_margin = Inches(.75)
    sec.header_distance = Inches(.28); sec.footer_distance = Inches(.3)
    for name in ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2', 'Heading 3', 'Heading 4', 'Header', 'Footer']:
        st = doc.styles[name]; st.font.name = 'Calibri'; st.font.color.rgb = BLACK
        st.font.underline = False
        rpr = st.element.get_or_add_rPr()
        for c in rpr.findall(qn('w:color')):
            for attr in ('themeColor', 'themeTint', 'themeShade'): c.attrib.pop(qn('w:' + attr), None)
        ppr = st.element.get_or_add_pPr()
        for border in list(ppr.findall(qn('w:pBdr'))): ppr.remove(border)
    normal = doc.styles['Normal']; normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.08
    for name, size in [('Title', 26), ('Subtitle', 14), ('Heading 1', 18), ('Heading 2', 14), ('Heading 3', 12), ('Heading 4', 11)]:
        st = doc.styles[name]; st.font.size = Pt(size)
        st.paragraph_format.space_before = Pt(14 if name != 'Title' else 0)
        st.paragraph_format.space_after = Pt(7)
        st.paragraph_format.keep_with_next = True
    doc.styles['Heading 1'].paragraph_format.page_break_before = False
    # The cover identifies the manual; the running footer provides date and page.
    # Omit a decorative repeated header to keep the Word/PDF export consistent.
    footer = sec.footer.paragraphs[0]; footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer.add_run('16 October 2026    |    Page ').font.size = Pt(9)
    field(footer, ' PAGE ', '1'); footer.add_run(' of '); field(footer, ' NUMPAGES ', '1')
    doc.add_paragraph(words_heading(title), 'Title')
    doc.add_paragraph(words_heading(subtitle), 'Subtitle')
    doc.add_paragraph('Application version documented on 16 October 2026')
    doc.add_paragraph('Product source revision 2f385d2    |    Local HDPE validation edition')
    doc.add_paragraph(introduction)
    doc.add_paragraph('Document set').runs[0].bold = True
    for item in ['1  Page and Field Manual', '2  Application Logic and Data Flows', '3  New Plant Setup Guide', '4  Operations and Verification Guide']:
        doc.add_paragraph(item)
    doc.add_paragraph('Use the navigation pane or the contents to find a module. Paths containing a colon identify a record parameter, such as :caseId; substitute the actual record identifier when using a URL. Examples use synthetic HDPE data unless explicitly described otherwise.')
    doc.add_paragraph('Suggested reading order: Application Logic for the overall model, New Plant Setup for commissioning, Page and Field Manual for individual controls, and Operations and Verification for routine work and troubleshooting.')
    toc_heading = doc.add_paragraph('Contents')
    toc_heading.paragraph_format.page_break_before = True
    toc_heading.paragraph_format.keep_with_next = True
    toc_heading.runs[0].bold = True; toc_heading.runs[0].font.size = Pt(18)
    field(doc.add_paragraph(), ' TOC \\o "1-2" \\h \\z \\u ', 'Contents update when opened in Word.')
    props = doc.core_properties
    props.title = words_heading(title); props.subject = subtitle
    props.author = 'Traverse Forge application documentation'; props.keywords = 'Traverse Forge ProAct HDPE application manual'
    return doc


def para(doc, text, style=None):
    p = doc.add_paragraph(style=style)
    # Inline code is readable proportional text here; long identifiers can wrap.
    parts = re.split(r'(\*\*.*?\*\*|`[^`]+`)', str(text))
    for s in parts:
        r = p.add_run(s[2:-2] if s.startswith('**') else s[1:-1] if s.startswith('`') else s)
        if s.startswith('**'): r.bold = True
        if s.startswith('`'): r.font.name = 'Consolas'; r.font.size = Pt(9)
    return p


def table(doc, headers, rows, widths=None):
    if not rows: return
    t = doc.add_table(rows=1, cols=len(headers)); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    widths = widths or [7 / len(headers)] * len(headers)
    for col, width in zip(t.columns, widths): col.width = Inches(width)
    pr = t._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for edge in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        e = OxmlElement('w:' + edge); e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '4'); e.set(qn('w:color'), 'D9D9D9'); borders.append(e)
    pr.append(borders)
    margins = OxmlElement('w:tblCellMar')
    for edge, value in [('top', '80'), ('bottom', '80'), ('left', '100'), ('right', '100')]:
        e = OxmlElement('w:' + edge); e.set(qn('w:w'), value); e.set(qn('w:type'), 'dxa'); margins.append(e)
    pr.append(margins)
    repeat = OxmlElement('w:tblHeader'); t.rows[0]._tr.get_or_add_trPr().append(repeat)
    all_rows = [headers] + rows
    for idx, values in enumerate(all_rows):
        row = t.rows[0] if idx == 0 else t.add_row()
        row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        for j, value in enumerate(values):
            cell = row.cells[j]; cell.width = Inches(widths[j]); cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cell.text = str(value)
            for p in cell.paragraphs:
                p.paragraph_format.space_after = Pt(3); p.paragraph_format.line_spacing = 1.02
                if idx == 0: p.paragraph_format.keep_with_next = True
                for r in p.runs: r.font.size = Pt(10); r.font.color.rgb = BLACK
            if idx == 0:
                shade = OxmlElement('w:shd'); shade.set(qn('w:fill'), 'DCE6EF'); cell._tc.get_or_add_tcPr().append(shade)
                for r in cell.paragraphs[0].runs: r.bold = True
        # Keep normal rows together; Word still flows a row taller than one page.
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def md(doc, path):
    lines = path.read_text(encoding='utf-8').splitlines()
    in_code = False
    first_heading = True
    for line in lines:
        if line.startswith('```'): in_code = not in_code; continue
        if not line.strip(): continue
        if in_code:
            p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(4)
            r = p.add_run(line); r.font.name = 'Consolas'; r.font.size = Pt(9)
        elif line.startswith('#'):
            level = len(line) - len(line.lstrip('#'))
            heading = doc.add_paragraph(words_heading(line.lstrip('#').strip()), f'Heading {min(level, 4)}')
            if first_heading:
                heading.paragraph_format.page_break_before = True
                first_heading = False
        elif line.startswith('- '): para(doc, line[2:], 'List Bullet')
        else: para(doc, line)


def load_pages():
    pages = []
    for name in ['global', 'operations', 'administration', 'integration']:
        path = SOURCE / f'{name}-pages.json'
        if path.exists():
            for p in json.loads(path.read_text(encoding='utf-8-sig'))['pages']:
                p['_area'] = name; pages.append(p)
    return pages


def items(doc, values):
    for value in values:
        para(doc, value if isinstance(value, str) else json.dumps(value, ensure_ascii=False), 'List Bullet')


def field_details(f):
    chunks = [f"{f.get('control', '')}. {f.get('requirement', '')}"]
    for label, key in [('Default', 'default'), ('Options', 'options'), ('Validation', 'validation'), ('Behavior', 'behavior'), ('Example', 'example')]:
        value = f.get(key)
        if isinstance(value, list): value = '; '.join(str(x) for x in value)
        if value and value != 'No fixed example in the control.': chunks.append(f'{label}: {value}')
    return '\n'.join(chunks)


def page_chapter(doc, p, setup=False):
    doc.add_paragraph(words_heading(p['title']), 'Heading 2')
    para(doc, 'Address: ' + ' | '.join(p.get('routes', [])))
    para(doc, p.get('purpose', ''))
    if p.get('access'): para(doc, 'Access: ' + ' '.join(p['access']))
    flow = p.get('setup' if setup else 'workflow', [])
    if flow:
        doc.add_paragraph('Procedure', 'Heading 3')
        for i, text in enumerate(flow, 1): para(doc, f'{i}. {text}')
    if p.get('sections'): para(doc, 'Sections: ' + '; '.join(map(str, p['sections'])))
    grouped = defaultdict(list)
    for f in p.get('fields', []): grouped[f.get('section', 'Fields')].append(f)
    for section, fields in grouped.items():
        doc.add_paragraph(words_heading(section), 'Heading 3')
        # Readouts retain every label; remove only boilerplate repeated within the same section.
        reads = [f for f in fields if re.search(r'read[ -]?only', f.get('control', ''), re.I)]
        inputs = [f for f in fields if f not in reads]
        if inputs: table(doc, ['Field', 'Entry and behavior'], [[f['label'], field_details(f)] for f in inputs], [1.65, 5.35])
        if reads:
            grouped_reads = defaultdict(list)
            for f in reads: grouped_reads[field_details(f)].append(f['label'])
            table(doc, ['Displayed field', 'Meaning and behavior'], [['; '.join(labels), detail] for detail, labels in grouped_reads.items()], [2, 5])
    if p.get('filters'):
        doc.add_paragraph('Filters', 'Heading 3')
        table(doc, ['Filter', 'Effect and query'], [[f['label'], '\n'.join(str(f.get(k, '')) for k in ['behavior', 'query'] if f.get(k))] for f in p['filters']], [1.65, 5.35])
    if p.get('actions'):
        doc.add_paragraph('Actions', 'Heading 3')
        for action in p['actions']:
            para(doc, '**' + action['label'] + '**. ' + str(action.get('preconditions', '')) + ' ' + str(action.get('result', '')))
            if action.get('request'): para(doc, 'Request: ' + str(action['request']))
    if p.get('logic'):
        doc.add_paragraph('Working logic', 'Heading 3'); items(doc, p['logic'])
    if p.get('states'): para(doc, 'States to recognize: ' + '; '.join(map(str, p['states'])))
    sources = list(dict.fromkeys(re.sub(r':\d+(?::\d+)?$', '', str(source)) for source in p.get('sources', []) + [f.get('source', '') for f in p.get('fields', [])]))
    sources = [str(x) for x in sources if x]
    if sources:
        psrc = para(doc, 'Source reference: ' + '; '.join(sources))
        for r in psrc.runs: r.font.size = Pt(8)


def role_matrix(doc):
    text = (ROOT / 'src/features/auth/server-role-sets.ts').read_text(encoding='utf-8')
    rows = []
    for name, array in re.findall(r'export const (\w+) = \[([^\]]+)\] as const', text):
        roles = re.findall(r"'([^']+)'", array)
        rows.append([name.replace('_', ' ').title(), ', '.join(roles)])
    doc.add_paragraph('Operation role reference', 'Heading 1')
    para(doc, 'These are explicit scope role sets used by the current UI and checked against the server in tests. Global role inheritance and legacy role mapping are applied separately. Holding a role does not waive independence, scope, record status or required evidence checks.')
    table(doc, ['Operation set', 'Explicit roles'], rows, [2.4, 4.6])


def schema_index(doc):
    groups = defaultdict(list)
    base = ROOT / 'server/pro-act-backend/src'
    for path in sorted(base.rglob('*.entity.ts')):
        text = path.read_text(encoding='utf-8')
        match = re.search(r"@Entity\(\s*(?:\{\s*name\s*:\s*)?['\"]([^'\"]+)['\"]", text)
        if match:
            groups[path.relative_to(base).parts[0]].append(match.group(1))
    doc.add_paragraph('Database entity index', 'Heading 1')
    para(doc, 'This index maps the current source entity modules to their explicitly named tables. It includes retained legacy and migration modules as well as current workflows; a table name alone does not imply a current user-facing feature. Migrations remain the schema authority. Use the module path under server/pro-act-backend/src to inspect its entity fields and relationships.')
    table(doc, ['Source module', 'Named tables'], [[key, ', '.join(sorted(set(values)))] for key, values in sorted(groups.items())], [2.1, 4.9])


def environment(doc):
    data = json.loads((SOURCE / 'environment-fields.json').read_text(encoding='utf-8'))
    doc.add_paragraph('Deployment field reference', 'Heading 1')
    para(doc, 'Values below come from the repository configuration, not from the running machine secrets. Required secrets are placeholders. A field absent from the root Compose file may require an explicit service environment entry or deployment override; simply adding any name to .env does not automatically pass it into a container.')
    table(doc, ['Setting', 'Default and purpose'], [[x['name'], x['detail']] for x in data], [2.1, 4.9])


def save(doc, name):
    if SAVE_ONLY and not name.startswith(SAVE_ONLY + '_'): return
    path = OUT / name; doc.save(path); print(path)


def persona_manual():
    data = json.loads((SOURCE / 'persona-responsibilities.json').read_text(encoding='utf-8'))
    doc = new_doc(data['title'], data['subtitle'], data['purpose'])
    # This supplement was requested after the four core manuals.
    for paragraph in doc.paragraphs:
        if paragraph.text == 'Document set': paragraph.text = 'Core document set'
    heading = doc.add_paragraph('Responsibilities and approval authority', 'Heading 1')
    heading.paragraph_format.page_break_before = True
    for value in data['overview']: para(doc, value)
    doc.add_paragraph('Role code legend', 'Heading 1')
    para(doc, 'The codes below keep the workflow and named-persona tables readable. A technical permission is not a requirement that one person perform every permitted task. The recommended accountability column describes a practical plant handoff.')
    table(doc, ['Code', 'Role and accountability', 'Permitted work and limits'], [
        [r['code'], r['role'] + '\n' + r['recommendedAccountability'], r['technicalWork'] + '\n' + r['limits']]
        for r in data['roleLegend']], [.6, 2.7, 3.7])
    doc.add_paragraph('Legacy and global roles', 'Heading 1')
    table(doc, ['Stored role', 'Effective authority', 'Boundary'], [
        [r['storedRole'] + ' (' + r['code'] + ')', r['effective'], r['boundary']]
        for r in data['legacyAndGlobalMappings']], [1.3, 2.85, 2.85])
    doc.add_paragraph('How authority is decided', 'Heading 1')
    for rule in data['authorityRules']:
        doc.add_paragraph(words_heading(rule['title']), 'Heading 2'); para(doc, rule['text'])
    doc.add_paragraph('Workflow responsibility matrix', 'Heading 1')
    para(doc, data['responsibilityMatrix']['legend'])
    table(doc, ['Workflow', 'Prepare and execute', 'Review approve or close', 'Independence and scope'], [
        [r['workflow'] + '\n' + r['recommendedOwner'], r['prepare'] + '\n' + r['submitOrExecute'], r['reviewApproveRejectClose'], r['restrictions']]
        for r in data['responsibilityMatrix']['rows']], [1.4, 1.9, 1.7, 2])
    doc.add_paragraph('Worked handoffs using HDPE personas', 'Heading 1')
    for flow in data['workedHandoffs']:
        doc.add_paragraph(words_heading(flow['title']), 'Heading 2'); para(doc, flow['example'])
        for i, step in enumerate(flow['steps'], 1): para(doc, f'{i}. {step}')
    doc.add_paragraph('All named HDPE personas', 'Heading 1')
    summary = data['rosterSummary']
    para(doc, f"The seeded catalogue contains {summary['namedUsers']} named people and {summary['distinctExplicitGrants']} distinct explicit grants. {summary['wholePlantUsers']} people have whole-plant readability and {summary['unit100OnlyUsers']} are restricted to unit100. This is the documented seed baseline; subsequent membership edits or temporary delegations can change current access.")
    for note in summary['notes']: para(doc, note, 'List Bullet')
    table(doc, ['Person and login', 'Stored role and effective codes', 'Scope and explicit grants'], [
        [r['name'] + '\n' + r['login'], r['storedRole'] + '\nEffective: ' + ', '.join(r['effectiveRoleCodes']), r['scope'] + '\nGrants: ' + ', '.join(sorted(set(g['role'] for g in r['explicitGrants'])))]
        for r in data['personaRoster']], [2.8, 1.9, 2.3])
    doc.add_paragraph('Staffing and permission nuances', 'Heading 1')
    for note in data['staffingNotes'] + data['knownPermissionNuances']: para(doc, note, 'List Bullet')
    doc.add_paragraph('Source and maintenance reference', 'Heading 1')
    para(doc, 'This guide documents the role model, controller admission, service independence checks and deterministic HDPE seed catalogue for product revision 2f385d2. Use the effective role and affected unit together when assigning work. A successful login or visible button is not proof that a decision will pass its service checks.')
    para(doc, 'Primary references: src/features/auth/server-role-sets.ts; server/pro-act-backend/src/auth/roles/role-model.ts; server/pro-act-backend/scripts/demo-personas/hdpe-personas.ts; server/pro-act-backend/scripts/demo-personas/seed-users.ts. Per-workflow controller and service references are retained in docs/manuals/source/persona-responsibilities.json.')
    save(doc, '05_Persona_Responsibilities_and_Approvals.docx')


def main():
    global SAVE_ONLY
    parser = argparse.ArgumentParser()
    parser.add_argument('--core-only', action='store_true')
    parser.add_argument('--only', choices=['01', '02', '03', '04', '05'])
    args = parser.parse_args()
    SAVE_ONLY = args.only
    OUT.mkdir(parents=True, exist_ok=True)
    if args.only == '05':
        persona_manual()
        return
    pages = load_pages()
    if not args.core_only:
        for name in ['operations', 'administration', 'integration']:
            if not (SOURCE / f'{name}-pages.json').exists(): raise SystemExit(f'Missing {name} inventory')
        d = new_doc('Traverse Forge Page and Field Manual', 'Every page subpage field filter and action', 'This manual explains the application screen by screen. Use each field entry to understand what to enter, how validation works, which values are optional and what the action changes. It includes conditional forms, detail pages, advanced sections and read-only results for the documented application revision.')
        for area, title in [('global', 'Sign in and shared controls'), ('operations', 'Production planning accounting and reliability'), ('administration', 'Administration master data and finance'), ('integration', 'Connections intake and source governance')]:
            heading = d.add_paragraph(title, 'Heading 1')
            if area == 'global': heading.paragraph_format.page_break_before = True
            for p in pages:
                if p['_area'] == area: page_chapter(d, p)
        d.add_paragraph('Route index', 'Heading 1')
        table(d, ['Address or state', 'Manual section'], [[r, p['title']] for p in pages for r in p.get('routes', [])], [3.6, 3.4])
        save(d, '01_Page_and_Field_Manual.docx')
    d = new_doc('Traverse Forge Application Logic and Data Flows', 'Business rules architecture and data lifecycle', 'This guide explains how records move through the application and why its figures, approvals and restrictions behave as they do. It connects configuration, ingestion, production accounting, finance and RCA so an operator, engineer or administrator can trace a result back to its evidence.')
    md(d, SOURCE / 'application-logic.md'); role_matrix(d); schema_index(d)
    save(d, '02_Application_Logic_and_Data_Flows.docx')
    d = new_doc('Traverse Forge New Plant Setup Guide', 'Installation configuration commissioning and acceptance', 'This guide takes a new site from infrastructure and first administrator through a complete approved production period, month close and RCA. Follow the stages in order and then use the field procedures to complete every relevant input. The HDPE hierarchy is a worked example; actual plant owners must approve the operating values.')
    md(d, SOURCE / 'new-plant-setup.md'); environment(d)
    if not args.core_only:
        d.add_paragraph('Configuration and commissioning field procedures', 'Heading 1')
        para(d, 'The following procedures repeat the complete applicable screen fields so setup does not depend on remembering an undocumented default. Read-only values are verification outputs. Optional advanced features are included and should be explicitly marked not applicable when the plant does not use them.')
        for p in sorted(pages, key=lambda page: ['global', 'administration', 'integration', 'operations'].index(page['_area'])):
            if p.get('setup') and p['_area'] != 'global': page_chapter(d, p, setup=True)
    save(d, '03_New_Plant_Setup_Guide.docx')
    if (SOURCE / 'operations-verification.md').exists():
        d = new_doc('Traverse Forge Operations and Verification Guide', 'Daily work recovery acceptance and known limits', 'This guide explains how to operate the configured application, investigate failures and verify the main personas. It also records the validation evidence and remaining limitations of the HDPE campaign, so a reader can distinguish tested behavior from site acceptance still required.')
        md(d, SOURCE / 'operations-verification.md')
        save(d, '04_Operations_and_Verification_Guide.docx')
    if (SOURCE / 'persona-responsibilities.json').exists(): persona_manual()


if __name__ == '__main__': main()
