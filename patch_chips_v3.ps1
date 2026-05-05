$path = "c:\Users\PC\Desktop\APP開發\analysis.js"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$content = [System.IO.File]::ReadAllText($path, $utf8NoBom)

$target = "return { foreign, trust, dealer, institutionalTotal"
if ($content.Contains($target)) {
    $idx = $content.IndexOf($target)
    # 搜尋最後一個換行
    $lastNewline = $content.LastIndexOf("`n", $idx)
    if ($lastNewline -eq -1) { $lastNewline = 0 }
    $indent = $content.Substring($lastNewline + 1, $idx - $lastNewline - 1)
    
    $patch = "// --- 備援補完：股利歷史與發行股數 (zcb/zca) ---`n" + `
            $indent + "if (!divHistory || divHistory.length === 0) {`n" + `
            $indent + "    try {`n" + `
            $indent + "        const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');`n" + `
            $indent + "        const bUrl = 'https://www.moneydj.com/z/zc/zcb/zcb_' + rawSymbol + '.djhtm';`n" + `
            $indent + "        const bHtml = await analysisFetchProxy(bUrl, false);`n" + `
            $indent + "        const bRows = bHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];`n" + `
            $indent + "        divHistory = [];`n" + `
            $indent + "        for (let row of bRows) {`n" + `
            $indent + "            const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];`n" + `
            $indent + "            if (cells.length >= 7 && /\d{4}/.test(row)) {`n" + `
            $indent + "                const cln = (c) => parseFloat(c.replace(/<[^>]*>/g, '').trim().replace(/,/g, ''));`n" + `
            $indent + "                divHistory.push({ date: cln(cells[0]) + '/01/01', cash: cln(cells[3]) || 0, stock: cln(cells[6]) || 0, amount: (cln(cells[3]) || 0) + (cln(cells[6]) || 0) });`n" + `
            $indent + "            }`n" + `
            $indent + "        }`n" + `
            $indent + "    } catch(e) {}`n" + `
            $indent + "}`n" + `
            $indent + "if (!sharesIssued) {`n" + `
            $indent + "    try {`n" + `
            $indent + "        const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');`n" + `
            $indent + "        const aUrl = 'https://www.moneydj.com/z/zc/zca/zca_' + rawSymbol + '.djhtm';`n" + `
            $indent + "        const bHtml2 = await analysisFetchProxy(aUrl, false);`n" + `
            $indent + "        const m = bHtml2.match(/發行股數[^<]*<\/td><td[^>]*>([\d,.]+)\s*百萬股/i);`n" + `
            $indent + "        if (m) sharesIssued = parseFloat(m[1].replace(/,/g,'')) * 1000000;`n" + `
            $indent + "    } catch(e) {}`n" + `
            $indent + "}`n`n" + `
            $indent + "return { `n" + `
            $indent + "    foreign, trust, dealer, institutionalTotal, large, retail, exDivDate, exDivAmt, `n" + `
            $indent + "    sharesIssued, divHistory, holderTrend, marginShortRatio, industry, `n" + `
            $indent + "    stockName: stockNameFromAPI, isFallback: true `n" + `
            $indent + "};"

    $endOfLine = $content.IndexOf("`n", $idx)
    if ($endOfLine -eq -1) { $endOfLine = $content.Length }
    
    $newContent = $content.Substring(0, $lastNewline + 1) + $patch + $content.Substring($endOfLine)
    
    [System.IO.File]::WriteAllText($path, $newContent, $utf8NoBom)
    Write-Host "Success: analysis.js patched via .NET method."
} else {
    Write-Host "Error: Target not found."
}
