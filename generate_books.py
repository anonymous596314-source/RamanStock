import urllib.request
import re
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

books = [
    ("Alice's Adventures in Wonderland", "https://www.gutenberg.org/cache/epub/11/pg11.txt"),
    ("Pride and Prejudice", "https://www.gutenberg.org/cache/epub/1342/pg1342.txt"),
    ("Frankenstein", "https://www.gutenberg.org/cache/epub/84/pg84.txt"),
    ("A Tale of Two Cities", "https://www.gutenberg.org/cache/epub/98/pg98.txt"),
    ("The Time Machine", "https://www.gutenberg.org/cache/epub/35/pg35.txt"),
    ("The War of the Worlds", "https://www.gutenberg.org/cache/epub/36/pg36.txt"),
    ("Moby Dick", "https://www.gutenberg.org/cache/epub/2701/pg2701.txt"),
    ("Great Expectations", "https://www.gutenberg.org/cache/epub/1400/pg1400.txt"),
    ("Jane Eyre", "https://www.gutenberg.org/cache/epub/1260/pg1260.txt"),
    ("Dracula", "https://www.gutenberg.org/cache/epub/345/pg345.txt"),
    ("The Adventures of Sherlock Holmes", "https://www.gutenberg.org/cache/epub/1661/pg1661.txt"),
    ("Treasure Island", "https://www.gutenberg.org/cache/epub/120/pg120.txt")
]

articles = []

for title, url in books:
    if len(articles) >= 300:
        break
    try:
        print(f"Downloading {title}...")
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            text = response.read().decode('utf-8')
        
        start_match = re.search(r'\*\*\* START OF THE PROJECT GUTENBERG EBOOK.*?\*\*\*', text)
        end_match = re.search(r'\*\*\* END OF THE PROJECT GUTENBERG EBOOK.*?\*\*\*', text)
        
        if start_match and end_match:
            text = text[start_match.end():end_match.start()]
        
        # Chapters can be identified by CHAPTER or Chapter
        chapters = re.split(r'\bCHAPTER\s+[IVXLCDM0-9]+', text, flags=re.IGNORECASE)
        
        for i, chapter in enumerate(chapters[1:], 1):
            if len(articles) >= 300:
                break
            
            cleaned = chapter.strip()
            cleaned = re.sub(r'\r\n', '\n', cleaned)
            cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
            
            if len(cleaned) > 500: 
                articles.append({
                    "title": f"{title} - Chapter {i}",
                    "text": cleaned[:15000] # Cap length to avoid freezing browser, 15000 chars is plenty for a reading session
                })
    except Exception as e:
        print(f"Error downloading {title}: {e}")

# If we still don't have 300, duplicate some to reach 300
original_len = len(articles)
while len(articles) < 300 and original_len > 0:
    idx = len(articles)
    base_article = articles[idx % original_len]
    articles.append({
        "title": f"{base_article['title']} (Part {idx//original_len + 1})",
        "text": base_article['text']
    })

if len(articles) == 0:
    for i in range(1, 301):
        articles.append({
            "title": f"Story Chapter {i}",
            "text": "This is a placeholder story chapter. The internet download failed."
        })

print(f"Collected {len(articles)} articles.")

with open('long_articles.js', 'w', encoding='utf-8') as f:
    f.write("window.LONG_ARTICLES_DB = " + json.dumps(articles, ensure_ascii=False, indent=2) + ";\n")
print("Saved to long_articles.js")
