import json
import re
import os

log_path = r'C:\Users\PC\.gemini\antigravity\brain\914fb94b-99e2-418c-b3d9-670f2fa74500\.system_generated\logs\overview.txt'
out_path = r'c:\Users\PC\Desktop\APP開發\scratch\recovered_analysis.js'

print(f"Reading log from: {log_path}")
if not os.path.exists(log_path):
    print("Log file not found!")
    exit(1)

with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Look for view_file responses
# The content is escaped in JSON
matches = re.findall(r'\"content\":\"(.*?)\"', content)

recovered_chunks = []
for m in matches:
    # Unescape the string
    try:
        # A simple way to unescape JSON strings
        unescaped = json.loads(f'"{m}"')
        if 'function renderAnalysis' in unescaped:
            recovered_chunks.append(unescaped)
            print(f"Found a chunk with renderAnalysis (length: {len(unescaped)})")
    except:
        # Fallback manual unescape
        unescaped = m.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')
        if 'function renderAnalysis' in unescaped:
            recovered_chunks.append(unescaped)
            print(f"Found a chunk with renderAnalysis (manual unescape, length: {len(unescaped)})")

if not recovered_chunks:
    print("No renderAnalysis chunks found.")
else:
    # Use the largest chunk found, as it's likely the full file view
    best_chunk = max(recovered_chunks, key=len)
    with open(out_path, 'w', encoding='utf-8') as out:
        out.write(best_chunk)
    print(f"Successfully recovered code to: {out_path}")
