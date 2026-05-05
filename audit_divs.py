
import re
import sys

def check_divs():
    try:
        with open(r'c:\Users\PC\Desktop\APP開發\analysis.js', 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Read error: {e}")
        return

    # Find the start of the grid
    marker = '<div class="analysis-grid">'
    start = content.find(marker)
    if start == -1:
        print("No grid found")
        return

    assignment_end = content.find('`;', start)
    if assignment_end == -1:
        print("Assignment end not found")
        return

    html = content[start:assignment_end]
    
    # Identify cards
    card_marker = '<div class="analysis-card">'
    card_starts = [m.start() for m in re.finditer(card_marker, html)]
    
    print(f"Found {len(card_starts)} cards in the grid block.")
    
    for i, pos in enumerate(card_starts):
        next_pos = card_starts[i+1] if i+1 < len(card_starts) else len(html)
        block = html[pos:next_pos]
        
        opens = block.count('<div')
        closes = block.count('</div')
        
        # Try to find a title
        title_match = re.search(r'analysis-card-title">(.*?)</div>', block)
        title = title_match.group(1) if title_match else f"Card {i+1}"
        title = re.sub('<[^>]*>', '', title).strip()[:30]
        
        if opens != closes:
            print(f"[{title}] UNBALANCED at index {pos}. Opens: {opens}, Closes: {closes}, Diff: {opens-closes}")
        else:
            print(f"[{title}] Balanced (Count: {opens})")

    # Check the whole block
    total_opens = html.count('<div')
    total_closes = html.count('</div')
    print(f"\nTOTAL GRID BLOCK: Opens={total_opens}, Closes={total_closes}, Diff={total_opens - total_closes}")

if __name__ == "__main__":
    check_divs()
