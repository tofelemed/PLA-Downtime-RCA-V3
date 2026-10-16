"""Render Word-exported PDF pages with bundled Poppler for visual QA.

Every page uses a separate renderer; pypdf supplies independent text extraction.
"""
from pathlib import Path
import argparse
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--file', default='*.pdf')
parser.add_argument('--scale', type=float, default=1.5)
parser.add_argument('--output', default='final', help='QA subfolder for page images')
args = parser.parse_args()
qa = ROOT / 'test-results/manual-qa'
poppler = Path(sys.executable).parents[1] / 'native/poppler/Library/bin/pdftoppm.exe'
if not poppler.exists():
    raise SystemExit(f'Bundled Poppler not found: {poppler}')
for source in sorted(qa.glob(args.file)):
    folder = qa / args.output / source.stem
    folder.mkdir(parents=True, exist_ok=True)
    pdf = PdfReader(source)
    def render_page(number):
        output = folder / f'page-{number:03}'
        subprocess.run([str(poppler), '-f', str(number), '-l', str(number),
                        '-r', str(72 * args.scale), '-png', '-singlefile',
                        str(source), str(output)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    # Independent page processes keep failures attributable to a specific page.
    # Four workers bound memory while keeping the QA practical.
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(render_page, range(1, len(pdf.pages) + 1)))
    summary = []
    for i, page in enumerate(pdf.pages):
        text = page.extract_text() or ''
        output = folder / f'page-{i + 1:03}.png'
        (folder / f'page-{i + 1:03}.txt').write_text(text, encoding='utf-8')
        summary.append({'page': i + 1, 'characters': len(text), 'image': str(output), 'width': float(page.mediabox.width), 'height': float(page.mediabox.height)})
    (folder / 'pages.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(f'{source.name}: {len(summary)} pages')
