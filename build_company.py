#!/usr/bin/env python3
"""Generate company.html (company-wide instance) from index.html.

The company page:
- uses namespaced localStorage keys ('r4mall_*') so it NEVER shares state with
  the Florida page (both run on the file:// origin, which shares storage)
- seeds its subdivision library from company_subs.json (curated FL library +
  every deduped Customer Zone from the Geotab zones export)
- is orange-themed and titled "Company" so the two pages can't be confused

Re-run after any index.html change:  python3 build_company.py
"""
import json, re, sys

src = open('index.html', encoding='utf-8').read()
seed = open('company_subs.json', encoding='utf-8').read().strip()
json.loads(seed)  # validate

out = src
# 1. isolate storage
n_keys = out.count("'r4m_")
out = out.replace("'r4m_", "'r4mall_")
# 2. seed the sub library
out, n_seed = re.subn(r'const SUBS_SEED = .*?;\n',
                      'const SUBS_SEED = ' + seed + ';\n', out, count=1, flags=re.S)
# 3. identity
out = out.replace('<title>Route4Me Workaround</title>',
                  '<title>Route4Me Workaround — Company</title>')
out = out.replace('<h1>Route4Me Workaround</h1>',
                  '<h1>Route4Me Workaround — Company</h1>')
out, n_ver = re.subn(r"const APP_VERSION='([^']*)';",
                     r"const APP_VERSION='\1 · COMPANY';", out, count=1)
# 4. orange accent so the pages look unmistakably different
out = out.replace('#2563eb', '#ea580c').replace('#1d4ed8', '#c2410c').replace('#eef6ff', '#ffedd5')

assert n_keys == 9, f'expected 9 storage keys, saw {n_keys}'
assert n_seed == 1, 'SUBS_SEED not found'
assert n_ver == 1, 'APP_VERSION not found'
open('company.html', 'w', encoding='utf-8').write(out)
print(f'company.html written: {len(out)//1024} KB · {n_keys} storage keys namespaced · seed {len(json.loads(seed))} subs')
