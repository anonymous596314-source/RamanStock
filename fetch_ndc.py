#!/usr/bin/env python3
import json, re, sys, urllib.request, urllib.parse
from datetime import datetime, timezone
 
WORKER_URL = 'https://young-unit-cf65.anonymous596314.workers.dev'
 
def fetch_via_worker(target_url):
    proxy_url = WORKER_URL + '/?url=' + urllib.parse.quote(target_url, safe='')
    req = urllib.request.Request(proxy_url, headers={
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://anonymous596314-source.github.io',
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode('utf-8')
 
def score_to_signal(score):
    s = int(score)
    if s >= 38: return 'red'
    if s >= 32: return 'yellow_red'
    if s >= 23: return 'green'
    if s >= 17: return 'yellow_blue'
    if s >=  9: return 'blue'
    return None
 
def main():
    result = None
    try:
        text = fetch_via_worker('https://index.ndc.gov.tw/n/json/lightscore')
        print('[DEBUG] raw response:', text[:300])
        data = json.loads(text)
        item = data[0] if isinstance(data, list) else data
        score = int(item.get('score') or item.get('Score') or item.get('綜合判斷分數') or 0)
        period = str(item.get('period') or item.get('yearMonth') or item.get('date') or '')
        period = re.sub(r'(\d{4})(\d{2})', r'\1/\2', period)
        sig = score_to_signal(score)
        if sig and score > 0:
            result = {'signal': sig, 'score': score, 'date': period, 'source': 'NDC API'}
            print(f'[OK] {result}')
    except Exception as e:
        print(f'[WARN] failed: {e}')
 
    if not result:
        print('[ERROR] All sources failed')
        sys.exit(1)
 
    out = {
        'signal': result['signal'],
        'score':  result['score'],
        'date':   result['date'],
        'source': result['source'],
        'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }
    with open('ndc_signal.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'[DONE] ndc_signal.json written')
 
if __name__ == '__main__':
    main()
