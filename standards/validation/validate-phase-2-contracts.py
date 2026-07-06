#!/usr/bin/env python3
import json, re, sys, zipfile
from pathlib import Path
import jsonschema

ROOT = Path(__file__).resolve().parents[1]
REQ_GROUPS = ['surface','border','text','accent','status','focus','shadow','spacing','radius','typography','motion','zIndex','density','charts','code']
REQ_CATS = ['shell','navigation','surface','layout','forms','tables','filters','feedback','status','overlays','data-visualization','workflow','engineering-artifacts','code-and-logs','content']
ID_RE = re.compile(r'^CMP-[A-Z0-9]+(-[A-Z0-9]+)+$')
REF_RE = re.compile(r'^\{semantic\.([A-Za-z0-9_.]+)\}$')
COLOR_RE = re.compile(r'#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(')

def load(rel):
    return json.loads((ROOT/rel).read_text())

def resolve_semantic(tokens, ref):
    m = REF_RE.match(ref)
    if not m:
        return False
    cur = tokens['semantic']
    for part in m.group(1).split('.'):
        if not isinstance(cur, dict) or part not in cur:
            return False
        cur = cur[part]
    return isinstance(cur, dict) and 'value' in cur

def walk_tokens(obj, path=''):
    if isinstance(obj, dict) and {'value','type','description','usage','status'} <= set(obj):
        yield path, obj
    elif isinstance(obj, dict):
        for k,v in obj.items():
            yield from walk_tokens(v, f'{path}.{k}' if path else k)

errors=[]
tokens=load('tokens.json')
manifest=load('component-manifest.json')
jsonschema.validate(tokens, load('schemas/tokens.schema.json'))
jsonschema.validate(manifest, load('schemas/component-manifest.schema.json'))
for group in REQ_GROUPS:
    if group not in tokens['semantic']:
        errors.append(f'Missing semantic group: {group}')
for path, obj in walk_tokens(tokens['semantic'], 'semantic'):
    for field in ['value','description','usage','status']:
        if not str(obj.get(field,'')).strip():
            errors.append(f'Empty token field {field}: {path}')
ids=[]
for c in manifest['components']:
    ids.append(c['id'])
    if not ID_RE.match(c['id']): errors.append(f'Bad component ID: {c["id"]}')
    if not c.get('coverage'): errors.append(f'Missing coverage: {c["id"]}')
    if not c.get('tokenReferences'): errors.append(f'Missing token refs: {c["id"]}')
    for ref in c.get('tokenReferences',[]):
        if COLOR_RE.search(ref): errors.append(f'Raw color in component token reference {c["id"]}: {ref}')
        if not resolve_semantic(tokens, ref): errors.append(f'Unresolved token reference {c["id"]}: {ref}')
    if any(x in c.get('coverage',[]) for x in ['inferred-engineering-need','reserved-for-future-validation']) or c.get('status') == 'reserved':
        blob = ' '.join(c.get('implementationNotes',[]) + c.get('validation',[])).lower()
        if not any(word in blob for word in ['later validation','later project validation','phase 3','requires later validation','deeper']):
            errors.append(f'Reserved/inferred component lacks unresolved-behavior note: {c["id"]}')
if len(ids) != len(set(ids)): errors.append('Duplicate component IDs')
if len(ids) < 40: errors.append('Fewer than 40 components')
cats={c['id'] for c in manifest['categories']}
for cat in REQ_CATS:
    if cat not in cats: errors.append(f'Missing category: {cat}')
if tokens['meta'].get('mockupPosture') != 'app-visual-calibration-not-exhaustive-standard': errors.append('Bad token mockup posture')
if manifest['meta'].get('mockupPosture') != 'app-visual-calibration-not-exhaustive-standard': errors.append('Bad manifest mockup posture')
if errors:
    print('\n'.join(errors))
    sys.exit(1)
print('PASS')
print(f'components={len(ids)}')
print(f'semantic_token_count={sum(1 for _ in walk_tokens(tokens["semantic"], "semantic"))}')
