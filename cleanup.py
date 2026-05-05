
import os

path = r'c:\Users\PC\Desktop\APP開發\analysis.js'
marker = '// === Indicators Encyclopedia'

def cleanup():
    if not os.path.exists(path):
        print('File not found')
        return
    
    with open(path, 'rb') as f:
        content = f.read().decode('utf-8', errors='ignore')
    
    idx = content.find(marker)
    if idx != -1:
        clean_content = content[:idx]
        with open(path, 'wb') as f:
            f.write(clean_content.encode('utf-8'))
        print('Truncated successfully')
    else:
        print('Marker not found')

if __name__ == '__main__':
    cleanup()
