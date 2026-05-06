import os

def fix_file(path):
    with open(path, 'rb') as f:
        content = f.read().decode('utf-8', 'ignore')
    
    replacements = {
        "'毛利??": "'毛利率'",
        "毛利??": "毛利率",
        "殖利??": "殖利率",
        "本益??": "本益比",
        "?? ": "倍",
        "?收?長": "營收成長",
        "???": "本益比",
        "?收?長": "營收成長",
        "???": "本益比",
        "📈 ?利?力": "📈 獲利能力",
        "💰 ????": "💰 現金與效率",
        "🔍 ???長": "🔍 估值與增長",
        "? ??建議": "💡 診斷建議",
        "?? QTvͶ": "📊 獲利三率趨勢",
        "Q": "毛利",
        "bQ": "淨利"
    }
    
    for old, new in replacements.items():
        content = content.replace(old, new)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    fix_file('analysis.js')
