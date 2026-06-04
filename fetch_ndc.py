#!/usr/bin/env python3
"""
每月自動抓取國發會景氣燈號，寫入 ndc_signal.json
GitHub Actions 每月 25 日執行
"""
import json, re, sys
from datetime import datetime
import urllib.request, urllib.error
 
def fetch(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, */*',
        'Referer': 'https://index.ndc.gov.tw/n/zh_tw',
        'X-Requested-With': 'XMLHttpRequest',
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
 
    # 方法 1：NDC JSON API
    try:
        text = fetch('https://index.ndc.gov.tw/n/json/lightscore')
        data = json.loads(text)
        item = data[0] if isinstance(data, list) else data
        score = int(item.get('score') or item.get('Score') or item.get('綜合判斷分數') or 0)
        period = str(item.get('period') or item.get('yearMonth') or item.get('date') or '')
        period = re.sub(r'(\d{4})(\d{2})', r'\1/\2', period)
        sig = score_to_signal(score)
        if sig:
            result = {'signal': sig, 'score': score, 'date': period, 'source': 'NDC API'}
            print(f'[OK] NDC API: {result}')
    except Exception as e:
        print(f'[WARN] NDC API failed: {e}')
 
    # 方法 2：抓 NDC 新聞稿頁面（純 HTML，有分數）
    if not result:
        try:
            html = fetch('https://index.ndc.gov.tw/n/zh_tw/data/news',
                         {'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html'})
            m = re.search(r'綜合判斷分數.*?(\d{1,2})\s*分', html)
            if m:
                score = int(m.group(1))
                now = datetime.now()
                period = f'{now.year}/{now.month - 1:02d}' if now.month > 1 else f'{now.year - 1}/12'
                sig = score_to_signal(score)
                if sig:
                    result = {'signal': sig, 'score': score, 'date': period, 'source': 'NDC news'}
                    print(f'[OK] NDC news: {result}')
        except Exception as e:
            print(f'[WARN] NDC news failed: {e}')
 
    if not result:
        print('[ERROR] All sources failed, keeping existing data')
        sys.exit(1)
 
    # 寫入 JSON
    out = {
        'signal': result['signal'],
        'score':  result['score'],
        'date':   result['date'],
        'source': result['source'],
        'updated': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    }
    with open('ndc_signal.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'[DONE] Written ndc_signal.json: {out}')
 
if __name__ == '__main__':
    main()
