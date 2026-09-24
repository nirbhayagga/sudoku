#!/usr/bin/env python3
"""Prepare pinned external research samples; never add them to the playable bank."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request
import zipfile

REVISION = 'af426180dc53aef89b82868e7b3fdfcf42165654'
URL = f'https://raw.githubusercontent.com/t-dillon/tdoku/{REVISION}/data.zip'
ARCHIVE_SHA256 = '9be0601c721ac4e702e3fe097576f025fcb99b216aabfe9dbea37cac43e6bc4f'
MEMBERS = ['data/puzzles3_magictour_top1465', 'data/puzzles5_forum_hardest_1905_11+']
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--archive', type=Path, help='Existing pinned Tdoku data.zip; otherwise download it')
parser.add_argument('--out', type=Path, required=True, help='New directory for ignored assessment inputs')
parser.add_argument('--count', type=int, default=40, help='Evenly spaced puzzles per collection')
args = parser.parse_args()
if not 1 <= args.count <= 10000:
    parser.error('count must be 1–10000')
if args.out.exists():
    parser.error('choose a new output directory')
args.out.mkdir(parents=True)
archive = args.archive or args.out / 'tdoku-data.zip'
if not args.archive:
    with urllib.request.urlopen(URL, timeout=60) as response, archive.open('xb') as output:
        total = 0
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > 90 * 1024 * 1024:
                raise ValueError('Archive exceeds expected size')
            output.write(chunk)
if hashlib.sha256(archive.read_bytes()).hexdigest() != ARCHIVE_SHA256:
    raise ValueError('Archive hash mismatch')
metadata = {'source': URL, 'revision': REVISION, 'archiveSha256': ARCHIVE_SHA256, 'collections': []}
selected = []
with zipfile.ZipFile(archive) as bundle:
    for member in MEMBERS:
        data = bundle.read(member)
        boards = [line[:81].replace('.', '0') for line in data.decode('ascii').splitlines() if line.strip() and not line.startswith('#')]
        if any(len(p) != 81 or any(d not in '0123456789' for d in p) for p in boards):
            raise ValueError('Unexpected puzzle format')
        count = min(args.count, len(boards))
        indices = [0 if count == 1 else i * (len(boards) - 1) // (count - 1) for i in range(count)]
        selected.extend(boards[i] for i in indices)
        metadata['collections'].append({'member': member, 'sha256': hashlib.sha256(data).hexdigest(), 'total': len(boards), 'zeroBasedIndices': indices})
selected = list(dict.fromkeys(selected))
text = '\n'.join(selected) + '\n'
metadata['selected'] = len(selected)
metadata['inputSha256'] = hashlib.sha256(text.encode()).hexdigest()
(args.out / 'puzzles.txt').write_text(text)
(args.out / 'provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(f'Prepared {len(selected)} unique puzzles. No bank modifications.')
