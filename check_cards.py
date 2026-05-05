
import re

with open(r'c:\Users\PC\Desktop\APP開發\analysis.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

card_starts = []
for i, line in enumerate(lines):
    if 'class="analysis-card"' in line:
        card_starts.append(i)

print(f"Total cards found: {len(card_starts)}")

for start_idx in card_starts:
    # Look for the title
    title = "Unknown"
    for j in range(start_idx, min(start_idx + 10, len(lines))):
        if 'analysis-card-title' in lines[j]:
            title = re.sub('<[^>]*>', '', lines[j]).strip()
            break
    
    # Look for the next analysis-card or the end of the block
    # Check if there is a </div> before the next card
    found_close = False
    next_card_idx = len(lines)
    for next_start in card_starts:
        if next_start > start_idx:
            next_card_idx = next_start
            break
            
    # Naive check: does the block [start_idx, next_card_idx] have balanced divs?
    block = "".join(lines[start_idx:next_card_idx])
    opens = block.count('<div')
    closes = block.count('</div')
    if opens > closes:
        print(f"Card '{title}' at line {start_idx+1} is UNBALANCED (Opens: {opens}, Closes: {closes})")
