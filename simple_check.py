
with open(r'c:\Users\PC\Desktop\APP開發\analysis.js', 'r', encoding='utf-8') as f:
    content = f.read()

marker = '<div class="analysis-grid">'
start = content.find(marker)
if start == -1:
    print("No grid found")
else:
    html = content[start:content.find('`;', start)]
    print(f"Total <div: {html.count('<div')}")
    print(f"Total </div: {html.count('</div')}")
    
    sections = html.split('<div class="analysis-card">')
    print(f"Total sections found: {len(sections)-1}")
    for i, s in enumerate(sections[1:]):
        o = s.count('<div') + 1 # +1 for the analysis-card itself
        c = s.count('</div')
        print(f"Section {i+1}: Opens={o}, Closes={c}, Diff={o-c}")
