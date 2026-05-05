
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

# Split into lines for easier tracking
lines = html.splitlines()

stack = []
for i, line in enumerate(lines):
    # Find all <div and </div
    tags = re.findall(r'<(/?div)', line)
    for tag in tags:
        if tag == 'div':
            stack.append(i + 1)
        else:
            if stack:
                stack.pop()
            else:
                print(f"EXTRA CLOSING DIV at line {i + 1} of the block")

print(f"Total unclosed divs: {len(stack)}")
for s in stack[:10]:
    print(f"Unclosed div opened at line {s} of the block: {lines[s-1].strip()[:50]}")
