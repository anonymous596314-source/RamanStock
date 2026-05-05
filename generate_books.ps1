$books = @(
    @{title="Alice's Adventures in Wonderland"; url="https://www.gutenberg.org/cache/epub/11/pg11.txt"},
    @{title="Peter Pan"; url="https://www.gutenberg.org/cache/epub/16/pg16.txt"},
    @{title="The Secret Garden"; url="https://www.gutenberg.org/cache/epub/113/pg113.txt"},
    @{title="The Wonderful Wizard of Oz"; url="https://www.gutenberg.org/cache/epub/55/pg55.txt"},
    @{title="Black Beauty"; url="https://www.gutenberg.org/cache/epub/271/pg271.txt"},
    @{title="Treasure Island"; url="https://www.gutenberg.org/cache/epub/120/pg120.txt"},
    @{title="The Adventures of Tom Sawyer"; url="https://www.gutenberg.org/cache/epub/74/pg74.txt"},
    @{title="Anne of Green Gables"; url="https://www.gutenberg.org/cache/epub/45/pg45.txt"},
    @{title="The Wind in the Willows"; url="https://www.gutenberg.org/cache/epub/289/pg289.txt"},
    @{title="Little Women"; url="https://www.gutenberg.org/cache/epub/514/pg514.txt"}
)

$articles = @()

foreach ($book in $books) {
    try {
        Write-Host "Downloading $($book.title)..."
        $response = Invoke-WebRequest -Uri $book.url -UseBasicParsing
        $text = $response.Content
        
        $startIndex = $text.IndexOf("*** START OF THE PROJECT GUTENBERG EBOOK")
        $endIndex = $text.IndexOf("*** END OF THE PROJECT GUTENBERG EBOOK")
        
        if ($startIndex -ge 0 -and $endIndex -gt $startIndex) {
            $text = $text.Substring($startIndex, $endIndex - $startIndex)
        }
        
        # Split by Chapter heading at the start of a line
        $chapters = $text -split "(?im)^CHAPTER\s+[IVXLCDM0-9]+"
        
        $realChapterCount = 1
        for ($i = 1; $i -lt $chapters.Count; $i++) {
            $chapter = $chapters[$i].Trim() -replace "`r`n", "`n" -replace "`n{3,}", "`n`n"
            
            # If the chunk is long enough, it's a real chapter and not a TOC entry
            if ($chapter.Length -gt 1000) {
                $articles += @{
                    title = "$($book.title) - Chapter $realChapterCount"
                    text = $chapter
                }
                $realChapterCount++
            }
        }
    } catch {
        Write-Host "Error downloading $($book.title)"
    }
}

Write-Host "Downloaded $($articles.Count) unique chapters."

$json = $articles | ConvertTo-Json -Depth 5 -Compress
[IO.File]::WriteAllText("$PWD\long_articles.js", "window.LONG_ARTICLES_DB = $json;", [System.Text.Encoding]::UTF8)

Write-Host "Saved all articles to long_articles.js"
