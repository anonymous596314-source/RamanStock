
import re

with open(r'c:\Users\PC\Desktop\APP開發\analysis.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the start of the grid
grid_marker = '<div class="analysis-grid">'
grid_start = content.find(grid_marker)
if grid_start == -1:
    print("Grid marker not found")
    exit(1)

# Find the end of the innerHTML assignment
end_marker = '`;'
assignment_end = content.find(end_marker, grid_start)
if assignment_end == -1:
    print("Assignment end not found")
    exit(1)

html = content[grid_start:assignment_end]

# Track div balance for each card
cards = re.split(r'<!-- \d+\..*? -->', html)
for i, card in enumerate(cards):
    if not card.strip(): continue
    
    opens = card.count('<div')
    closes = card.count('</div')
    
    # Try to find a title
    title_match = re.search(r'analysis-card-title">(.*?)</div>', card)
    title = title_match.group(1) if title_match else f"Card {i}"
    
    if opens != closes:
        print(f"[{title}] Unbalanced! Opens: {opens}, Closes: {closes} (Diff: {opens - closes})")
    else:
        print(f"[{title}] Balanced (Count: {opens})")
