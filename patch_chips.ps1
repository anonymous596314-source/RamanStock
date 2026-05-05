$path = "c:\Users\PC\Desktop\APP開發\analysis.js"
$content = Get-Content -Path $path -Raw -Encoding UTF8

$target = "return { foreign, trust, dealer, institutionalTotal"
if ($content.Contains($target)) {
    $idx = $content.IndexOf($target)
    $lastNewline = $content.LastIndexOf("`n", $idx)
    $indent = $content.Substring($lastNewline + 1, $idx - $lastNewline - 1)
    
    $patch = @"
// --- 備援補完：股利歷史與發行股數 (zcb/zca) ---
$($indent)if (!divHistory || divHistory.length === 0) {
$($indent)    try {
$($indent)        const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
$($indent)        const bUrl = ``https://www.moneydj.com/z/zc/zcb/zcb_`${rawSymbol}.djhtm``;
$($indent)        const bHtml = await analysisFetchProxy(bUrl, false);
$($indent)        const bRows = bHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
$($indent)        divHistory = [];
$($indent)        for (let row of bRows) {
$($indent)            const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
$($indent)            if (cells.length >= 7 && /\d{4}/.test(row)) {
$($indent)                const cln = (c) => parseFloat(c.replace(/<[^>]*>/g, '').trim().replace(/,/g, ''));
$($indent)                divHistory.push({ date: cln(cells[0]) + "/01/01", cash: cln(cells[3]) || 0, stock: cln(cells[6]) || 0, amount: (cln(cells[3]) || 0) + (cln(cells[6]) || 0) });
$($indent)            }
$($indent)        }
$($indent)    } catch(e) {}
$($indent)}
$($indent)if (!sharesIssued) {
$($indent)    try {
$($indent)        const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
$($indent)        const aUrl = ``https://www.moneydj.com/z/zc/zca/zca_`${rawSymbol}.djhtm``;
$($indent)        const aHtml = await analysisFetchProxy(aUrl, false);
$($indent)        const m = aHtml.match(/發行股數[^<]*<\/td><td[^>]*>([\d,.]+)\s*百萬股/i);
$($indent)        if (m) sharesIssued = parseFloat(m[1].replace(/,/g,'')) * 1000000;
$($indent)    } catch(e) {}
$($indent)}

$($indent)return { 
$($indent)    foreign, trust, dealer, institutionalTotal, large, retail, exDivDate, exDivAmt, 
$($indent)    sharesIssued, divHistory, holderTrend, marginShortRatio, industry, 
$($indent)    stockName: stockNameFromAPI, isFallback: true 
$($indent)};
"@
    
    # 找到整行結束位置
    $endOfLine = $content.IndexOf("`n", $idx)
    if ($endOfLine -eq -1) { $endOfLine = $content.Length }
    
    $newContent = $content.Substring(0, $lastNewline + 1) + $patch + $content.Substring($endOfLine)
    
    [System.IO.File]::WriteAllText($path, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "Success: analysis.js patched via PowerShell."
} else {
    Write-Host "Error: Target not found."
}
