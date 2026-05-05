import sys
import os

file_path = r'c:\Users\PC\Desktop\APP開發\analysis.js'
try:
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    target = 'return { foreign, trust, dealer, institutionalTotal'
    if target in content:
        # 找到目標行的起始位置
        idx = content.find(target)
        # 找到該行之前的最後一個換行符，以確定縮排
        start_of_line = content.rfind('\n', 0, idx) + 1
        indent = content[start_of_line:idx]
        
        patch = f"""// --- 備援補完：股利歷史與發行股數 (zcb/zca) ---
{indent}if (!divHistory || divHistory.length === 0) {{
{indent}    try {{
{indent}        const rawSymbol = symbol.trim().replace(/\\.TW$/i, '').replace(/\\.TWO$/i, '');
{indent}        const bUrl = `https://www.moneydj.com/z/zc/zcb/zcb_${{rawSymbol}}.djhtm`;
{indent}        const bHtml = await analysisFetchProxy(bUrl, false);
{indent}        const bRows = bHtml.match(/<tr[^>]*>[\\s\\S]*?<\\/tr>/gi) || [];
{indent}        divHistory = [];
{indent}        for (let row of bRows) {{
{indent}            const cells = row.match(/<td[^>]*>([\\s\\S]*?)<\\/td>/gi) || [];
{indent}            if (cells.length >= 7 && /\\d{{4}}/.test(row)) {{
{indent}                const cln = (c) => parseFloat(c.replace(/<[^>]*>/g, '').trim().replace(/,/g, ''));
{indent}                divHistory.push({{ date: cln(cells[0]) + '/01/01', cash: cln(cells[3]) || 0, stock: cln(cells[6]) || 0, amount: (cln(cells[3]) || 0) + (cln(cells[6]) || 0) }});
{indent}            }}
{indent}        }}
{indent}    }} catch(e) {{}}
{indent}}}
{indent}if (!sharesIssued) {{
{indent}    try {{
{indent}        const rawSymbol = symbol.trim().replace(/\\.TW$/i, '').replace(/\\.TWO$/i, '');
{indent}        const aUrl = `https://www.moneydj.com/z/zc/zca/zca_${{rawSymbol}}.djhtm`;
{indent}        const aHtml = await analysisFetchProxy(aUrl, false);
{indent}        const m = aHtml.match(/發行股數[^<]*<\\/td><td[^>]*>([\\d,.]+)\\s*百萬股/i);
{indent}        if (m) sharesIssued = parseFloat(m[1].replace(/,/g,'')) * 1000000;
{indent}    }} catch(e) {{}}
{indent}}}

{indent}return {{ 
{indent}    foreign, trust, dealer, institutionalTotal, large, retail, exDivDate, exDivAmt, 
{indent}    sharesIssued, divHistory, holderTrend, marginShortRatio, industry, 
{indent}    stockName: stockNameFromAPI, isFallback: true 
{indent}}};
{indent}"""
        # 找到整行結束的位置
        end_of_line = content.find('\n', idx)
        if end_of_line == -1: end_of_line = len(content)
        
        new_content = content[:start_of_line] + patch + content[end_of_line:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Success: analysis.js patched.")
    else:
        print("Error: Target not found.")
except Exception as e:
    print(f"Critical Error: {str(e)}")
