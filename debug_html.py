
import sys

try:
    with open(r'c:\Users\PC\Desktop\APP開發\analysis.js', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find analysisBody.innerHTML assignment
    marker = 'analysisBody.innerHTML = `'
    start = content.find(marker)
    if start == -1:
        print("Marker not found")
        sys.exit(0)
        
    start += len(marker)
    end = content.find('`;', start)
    if end == -1:
        print("Closing `; not found")
        sys.exit(0)
        
    html = content[start:end]
    
    opens = html.count('<div')
    closes = html.count('</div')
    
    print(f"Opens: {opens}")
    print(f"Closes: {closes}")
    
    if opens != closes:
        print(f"DIFF: {opens - closes}")
except Exception as e:
    print(f"Error: {e}")
