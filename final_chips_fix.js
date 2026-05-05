async function fetchStockChips(symbol, rawSymbol) {
    let foreign = null, trust = null, dealer = null, institutionalTotal = null;
    let large = 0, retail = 0;
    let exDivDate = "N/A", exDivAmt = "N/A";
    let sharesIssued = 0;
    let divGrowth3y = null, divConsecutiveYears = 0, divHistory = [];
    let industry = "N/A", stockNameFromAPI = "";
    let holderTrend = [];
    let marginShortRatio = null;

    // --- 1. FinMind 籌碼結構 ---
    const dLimit = new Date(); dLimit.setDate(dLimit.getDate() - 365);
    const urlHolders = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockHoldingSharesPer&data_id=${rawSymbol}&start_date=${dLimit.toISOString().split('T')[0]}`;
    const jsonHolders = await analysisFetchProxy(urlHolders, true).catch(() => null);
    if (jsonHolders && jsonHolders.data && jsonHolders.data.length > 0) {
        const dates = [...new Set(jsonHolders.data.map(x => x.date || x.Date))].sort().filter(d => d);
        holderTrend = dates.map(d => {
            const dayData = jsonHolders.data.filter(x => (x.date || x.Date) === d);
            const getLvl = (x) => parseInt(x.HoldingSharesLevel || x.Level || 0);
            const getPct = (x) => {
                const val = x.Percent || x.Ratio || 0;
                return typeof val === 'string' ? parseFloat(val.replace(/%/g, '')) : val;
            };
            const l = dayData.filter(x => getLvl(x) >= 11 || getLvl(x) >= 400).reduce((s, x) => s + getPct(x), 0);
            const r = dayData.filter(x => getLvl(x) <= 7 || (getLvl(x) > 0 && getLvl(x) <= 50)).reduce((s, x) => s + getPct(x), 0);
            return { date: d, large: l, retail: r };
        }).filter(x => x && (x.large > 0 || x.retail > 0));
    }

    // --- 2. 備援：神秘金字塔 (Norway) ---
    let norwayStatus = "N/A";
    if (holderTrend.length === 0) {
        try {
            const norwayUrl = `https://norway.twsthr.info/StockHolders.aspx?stock=${rawSymbol}&STEP=2`;
            const html = await analysisFetchProxy(norwayUrl, false).catch(() => null);
            if (html && html.length > 1000) {
                // 精確 TR 切割
                const rows = html.split(/<tr[^>]*>/i);
                let tempTrend = [];
                for (let rowRaw of rows) {
                    const row = rowRaw.split(/<\/tr>/i)[0];
                    const dateMatch = row.match(/(\d{8}|\d{4}\/\d{2}\/\d{2})/);
                    if (!dateMatch) continue;
                    
                    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
                    if (cells.length < 15) continue;

                    const vals = cells.map(td => {
                        const txt = td.replace(/<[^>]*>/g, '').replace(/[,%\s]/g, '');
                        return parseFloat(txt) || 0;
                    });

                    const dStr = dateMatch[1].replace(/[\/\-]/g, '');
                    const b = vals.findIndex(v => v.toString().includes(dStr));
                    if (b === -1) continue;

                    let date = dateMatch[1].replace(/\//g, '-');
                    if (/^\d{8}$/.test(date)) date = `${date.substring(0,4)}-${date.substring(4,6)}-${date.substring(6,8)}`;

                    // 根據瀏覽器實測：b+1~b+5 是散戶 %，b+12~b+15 是大戶 %
                    const n = (idx) => (vals[b + idx] || 0);
                    const r = n(1) + n(2) + n(3) + n(4) + n(5);
                    const l = n(12) + n(13) + n(14) + n(15);

                    if (l > 0) tempTrend.push({ date, large: l, retail: r, bIndex: b, vCount: vals.length });
                }
                if (tempTrend.length > 0) {
                    const uniqueMap = new Map();
                    tempTrend.forEach(t => uniqueMap.set(t.date, t));
                    holderTrend = Array.from(uniqueMap.values()).sort((a,b) => a.date.localeCompare(b.date));
                    const last = tempTrend[tempTrend.length - 1];
                    norwayStatus = `OK (${holderTrend.length}w, b:${last.bIndex}, v:${last.vCount})`;
                } else { norwayStatus = `Scan Null (${rows.length}r)`; }
            } else { norwayStatus = html ? `Small HTML (${html.length}b)` : "Fetch Failed"; }
        } catch(e) { norwayStatus = "Err: " + e.message.substring(0, 10); }
    }

    if (holderTrend.length > 0) {
        const latest = holderTrend[holderTrend.length - 1];
        large = latest.large; retail = latest.retail;
    }

    // --- 3. 信用交易與基本資訊 (簡化版) ---
    const apiRawCount = (jsonHolders && jsonHolders.data) ? jsonHolders.data.length : 0;
    return { foreign, trust, dealer, institutionalTotal, large, retail, exDivDate, exDivAmt, sharesIssued, divGrowth3y, divConsecutiveYears, divHistory, holderTrend, marginShortRatio, industry, stockName: stockNameFromAPI, apiRawCount, norwayStatus };
}
