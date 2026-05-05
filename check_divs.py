
import re

with open(r'c:\Users\PC\Desktop\APP開發\analysis.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the renderAnalysis function body
match = re.search(r'function renderAnalysis\(.*?\)\s*\{', content)
if match:
    start_pos = match.end()
    # Find the HTML block
    html_match = re.search(r'analysisBody\.innerHTML\s*=\s*`', content[start_pos:])
    if html_match:
        html_start = start_pos + html_match.end()
        # Find the closing backtick
        # (This is naive but let's try)
        html_end = content.find('`;', html_start)
        html_content = content[html_start:html_end]
        
        open_divs = html_content.count('<div')
        close_divs = html_content.count('</div')
        print(f"Open divs: {open_divs}")
        print(f"Close divs: {close_divs}")
        
        cards = html_content.count('class="analysis-card"')
        print(f"Cards: {cards}")
        
        # Check balance of specific blocks
        # analysis-grid
        grid_pos = html_content.find('class="analysis-grid"')
        if grid_pos != -1:
             print("Grid found.")
