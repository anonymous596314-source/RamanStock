async function fetchStockChips(symbol, rawSymbol) {
    let foreign = null, trust = null, dealer = null, institutionalTotal = null;
    let large = 0, retail = 0;
    let exDivDate = "N/A", exDivAmt = "N/A";
    let sharesIssued = 0;
    let divGrowth3y = null, divConsecutiveYears = 0, divHistory = [];
    let industry = "N/A", stockNameFromAPI = "";
    let holderTrend = [];
    let marginShortRatio = null;

    // 1. FinMind API 抓取
    const dLimit = new Date();
    dLimit.setDate(dLimit.getDate() - 365); 
    const startDate = dLimit.toISOString().split('T')[0];
    const chipsUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockHoldingSharesPer&data_id=${rawSymbol}&start_date=${startDate}`;
    
    const jsonHolders = await analysisFetchProxy(chipsUrl, true).catch(() => null);
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

    // 2. 神秘金字塔備援 (Norway)
    let norwayStatus = "N/A";
    if (holderTrend.length === 0) {
        try {
            const norwayUrl = `https://norway.twsthr.info/StockHolders.aspx?stock=${rawSymbol}&STEP=2`;
            const html = await analysisFetchProxy(norwayUrl, false).catch(() => null);
            if (html && html.length > 1000) {
                const datePattern = /(?:<td[^>]*>)(\d{8}|\d{4}\/\d{2}\/\d{2})(?:<\/td>)/gi;
                let match, tempTrend = [], dateMatches = [];
                while ((match = datePattern.exec(html)) !== null) {
                    dateMatches.push({ date: match[1], index: match.index });
                }
                for (let i = 0; i < dateMatches.length; i++) {
                    const m = dateMatches[i];
                    // 關鍵修復：先移除 HTML 中的逗號，再提取數字，避免千分位數字被切斷
                    const sub = html.substring(m.index, m.index + 5000).replace(/,/g, '');
                    const nums = sub.match(/[\d\.]+/g) || [];
                    
                    if (nums.length >= 46) {
                        let date = m.date.replace(/\//g, '-');
                        if (/^\d{8}$/.test(date)) date = `${date.substring(0,4)}-${date.substring(4,6)}-${date.substring(6,8)}`;
                        const n = (idx) => parseFloat(nums[idx] || 0);
                        // 3 欄位結構 (人, 股, %): 索引 3, 6, 9, 12, 15 是散戶; 36, 39, 42, 45 是大戶
                        const retail = n(3) + n(6) + n(9) + n(12) + n(15);
                        const large = n(36) + n(39) + n(42) + n(45);
                        if (large > 0) tempTrend.push({ date, large, retail });
                    }
                }
                if (tempTrend.length > 0) {
                    const uniqueMap = new Map();
                    tempTrend.forEach(t => uniqueMap.set(t.date, t));
                    holderTrend = Array.from(uniqueMap.values()).sort((a,b) => a.date.localeCompare(b.date));
                    norwayStatus = `OK (${holderTrend.length}w)`;
                } else {
                    norwayStatus = `Scan Null (${dateMatches.length}d)`;
                }
            } else {
                norwayStatus = html ? `Small HTML (${html.length}b)` : "Fetch Failed";
            }
        } catch(e) { norwayStatus = "Err: " + e.message.substring(0, 10); }
    }

    if (holderTrend.length > 0) {
        const latest = holderTrend[holderTrend.length - 1];
        large = latest.large; retail = latest.retail;
    }
    const apiRawCount = (jsonHolders && jsonHolders.data) ? jsonHolders.data.length : 0;
    if (institutionalTotal === null && foreign !== null) institutionalTotal = foreign + (trust || 0) + (dealer || 0);

    return { foreign, trust, dealer, institutionalTotal, large, retail, exDivDate, exDivAmt, sharesIssued, divGrowth3y, divConsecutiveYears, divHistory, holderTrend, marginShortRatio, industry, stockName: stockNameFromAPI, apiRawCount, norwayStatus };
}
