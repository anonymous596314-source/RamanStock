
import sys
import os

filepath = r'c:\Users\PC\Desktop\APP開發\analysis.js'
if os.path.exists(filepath):
    print(f"File exists: {filepath}")
    with open(filepath, 'rb') as f:
        data = f.read(100)
        print(f"First 100 bytes: {data}")
else:
    print(f"File NOT found: {filepath}")
