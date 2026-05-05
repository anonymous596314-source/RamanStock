import os

file_path = r'c:\Users\PC\Desktop\APP開發\analysis.js'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
target_found = False
for line in lines:
    if 'return { foreign, trust, dealer, institutionalTotal' in line and not target_found:
        indent = line[:line.find('return')]
        new_lines.append(f"{indent}// --- 備援補完：股利歷史與發行股數 (zcb/zca) ---\n")
        new_lines.append(f"{indent}if (!divHistory || divHistory.length === 0) {{\n")
        new_lines.append(f"{indent}    try {{\n")
        new_lines.append(f"{indent}        const rawSymbol = symbol.trim().replace(/\\.TW$/i, '').replace(/\\.TWO$/i, '');\n")
        new_lines.append(f"{indent}        const bUrl = `https://www.moneydj.com/z/zc/zcb/zcb_${{rawSymbol}}.djhtm`;\n")
        new_lines.append(f"{indent}        const bHtml = await analysisFetchProxy(bUrl, false);\n")
        new_lines.append(f"{indent}        const bRows = bHtml.match(/<tr[^>]*>[\\s\\S]*?<\\/tr>/gi) || [];\n")
        new_lines.append(f"{indent}        divHistory = [];\n")
        new_lines.append(f"{indent}        for (let row of bRows) {{\n")
        new_lines.append(f"{indent}            const cells = row.match(/<td[^>]*>([\\s\\S]*?)<\\/td>/gi) || [];\n")
        new_lines.append(f"{indent}            if (cells.length >= 7 && /\\d{{4}}/.test(row)) {{\n")
        new_lines.append(f"{indent}                const cln = (c) => parseFloat(c.replace(/<[^>]*>/g, '').trim().replace(/,/g, ''));\n")
        new_lines.append(f"{indent}                divHistory.push({{ date: cln(cells[0]) + '/01/01', cash: cln(cells[3]) || 0, stock: cln(cells[6]) || 0, amount: (cln(cells[3]) || 0) + (cln(cells[6]) || 0) }});\n")
        new_lines.append(f"{indent}            }}\n")
        new_lines.append(f"{indent}        }}\n")
        new_lines.append(f"{indent}    }} catch(e) {{}}\n")
        new_lines.append(f"{indent}}}\n")
        new_lines.append(f"{indent}if (!sharesIssued) {{\n")
        new_lines.append(f"{indent}    try {{\n")
        new_lines.append(f"{indent}        const rawSymbol = symbol.trim().replace(/\\.TW$/i, '').replace(/\\.TWO$/i, '');\n")
        new_lines.append(f"{indent}        const aUrl = `https://www.moneydj.com/z/zc/zca/zca_${{rawSymbol}}.djhtm`;\n")
        new_lines.append(f"{indent}        const aHtml = await analysisFetchProxy(aUrl, false);\n")
        new_lines.append(f"{indent}        const m = aHtml.match(/發行股數[^<]*<\\/td><td[^>]*>([\\d,.]+)\\s*百萬股/i);\n")
        new_lines.append(f"{indent}        if (m) sharesIssued = parseFloat(m[1].replace(/,/g,'')) * 1000000;\n")
        new_lines.append(f"{indent}    }} catch(e) {{}}\n")
        new_lines.append(f"{indent}}}\n\n")
        new_lines.append(f"{indent}return {{ \n")
        new_lines.append(f"{indent}    foreign, trust, dealer, institutionalTotal, large, retail, exDivDate, exDivAmt, \n")
        new_lines.append(f"{indent}    sharesIssued, divHistory, holderTrend, marginShortRatio, industry, \n")
        new_lines.append(f"{indent}    stockName: stockNameFromAPI, isFallback: true \n")
        new_lines.append(f"{indent}}};\n")
        target_found = True
    else:
        new_lines.append(line)

if target_found:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully patched analysis.js")
else:
    print("Target line not found in analysis.js")
