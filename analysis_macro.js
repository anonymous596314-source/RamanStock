/**
 * analysis_macro.js  v2
 * 總經專區 (Macro Dashboard) — 所有資料、fetch、render 邏輯
 * 公開介面：window.loadMacroDashboard(force = false)
 */

//  常數 

const MACRO_CACHE_KEY    = 'twStockMacroDashboardCacheV3';
const MACRO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// section 用於 UI 分區
const DAILY_MACRO_SYMBOLS = [
    //  美股指數 
    { id: 'sp500',   section: '美股指數', name: 'S&P 500',         symbol: '^GSPC',      stooq: '^spx',   historyUrl: 'https://historyofmarket.com/api/sp500/price.json',     kind: 'index', note: '全球風險胃納溫度計，台股外資行為與其相關性超過 0.7' },
    { id: 'nasdaq',  section: '美股指數', name: '那斯達克',         symbol: '^IXIC',      stooq: '^ndq',   historyUrl: 'https://historyofmarket.com/api/nasdaq/composite.json', kind: 'index', note: '科技股情緒領先指標，台積電 ADR 漲跌與此高度連動' },
    { id: 'dow',     section: '美股指數', name: '道瓊工業',         symbol: '^DJI',       stooq: '^dji',   historyUrl: 'https://historyofmarket.com/api/dow/century.json',      kind: 'index', note: '景氣循環股代表，道瓊強勁代表傳產需求健康' },
    { id: 'sox',     section: '美股指數', name: '費城半導體',       symbol: '^SOX',       stooq: '^sox',   historyUrl: 'https://historyofmarket.com/api/semi/price.json',       kind: 'index', note: '台股電子權值股最強連動指數，領先台積電走勢 1–2 天' },
    { id: 'rut',     section: '美股指數', name: '羅素 2000',        symbol: '^RUT',       stooq: 'rut.us',                                                                       kind: 'index', note: '美國中小型股代表，反映內需景氣；羅素轉強代表風險偏好擴散至全市場' },
    { id: 'smh',     section: '美股指數', name: '半導體 ETF (SMH)', symbol: 'SMH',        stooq: 'smh.us',                                                                     kind: 'index', note: '追蹤台積電、輝達、英特爾等半導體龍頭，是費半的 ETF 代理版本' },

    //  亞太股市 
    { id: 'nikkei',  section: '亞太股市', name: '日經 225',         symbol: '^N225',      stooq: 'n225.jp',                                                                       kind: 'index', note: '日圓升貶直接影響日經；日股強勢時外資往往連帶增持台股' },
    { id: 'hsi',     section: '亞太股市', name: '恒生指數',         symbol: '^HSI',       stooq: 'hsi.hk',                                                                       kind: 'index', note: '中港資金動向風向球；港股重挫通常伴隨外資流出亞洲新興市場' },
    { id: 'kospi',   section: '亞太股市', name: 'KOSPI',            symbol: '^KS11',      stooq: 'ks11.kr',                                                                      kind: 'index', note: '韓股與台股半導體同業競爭，韓圜匯率走弱時三星出口競爭力上升' },
    { id: 'sse',     section: '亞太股市', name: '上海綜合',         symbol: '000001.SS',  stooq: '000001.cn',                                                                       kind: 'index', note: '中國景氣與政策力道指標；對台灣零組件出口中國的供應鏈影響大' },

    //  利率與殖利率曲線 
    { id: 'tnx',     section: '利率曲線', name: '美債 10Y',         symbol: '^TNX',       fredSeries: 'DGS10',         stooq: '10usy.b', kind: 'rate',   note: '最重要的折現率基準，10Y 每上升 25 bp，成長股本益比通常收縮 5–8%' },
    { id: 'thirtyY', section: '利率曲線', name: '美債 30Y',         symbol: '^TYX',       fredSeries: 'DGS30',         stooq: '30usy.b', kind: 'rate',   note: '長期通膨預期的體現；30Y 持續走高代表市場不相信通膨已受控' },




    //  外匯市場 
    { id: 'usdjpy',  section: '外匯',     name: 'USD/JPY',          symbol: 'USDJPY=X',  fredSeries: 'DEXJPUS',  frankBase: 'USD', frankSymbol: 'JPY',                   stooq: 'usdjpy',  kind: 'fx',     colorInverse: true, note: '日圓貶值代表日本貨幣寬鬆、資金充沛；但過度貶值會引發亞幣競貶壓力' },
    { id: 'eurusd',  section: '外匯',     name: 'EUR/USD',          symbol: 'EURUSD=X',  fredSeries: 'DEXUSEU',  frankBase: 'EUR', frankSymbol: 'USD',                   stooq: 'eurusd',  kind: 'fx',     colorInverse: false, note: '歐元升值代表美元整體偏弱，有利新興市場資金流入' },
    { id: 'usdcnh',  section: '外匯',     name: 'USD/CNH',          symbol: 'USDCNH=X',  fredSeries: 'DEXCHUS',  frankBase: 'USD', frankSymbol: 'CNY',                   stooq: 'usdcny',  kind: 'fx',     colorInverse: true, note: '人民幣貶值通常壓抑港股與對中出口比重高的台灣產業' },
    { id: 'usdkrw',  section: '外匯',     name: 'USD/KRW',          symbol: 'USDKRW=X',  fredSeries: 'DEXKOUS',  frankBase: 'USD', frankSymbol: 'KRW',                   stooq: 'usdkrw',  kind: 'fx',     colorInverse: true, note: '韓圜貶值提升三星、SK 出口競爭力，對台灣記憶體與顯示器業形成壓力' },

    //  大宗商品 
    { id: 'wti',     section: '大宗商品', name: 'WTI 原油',         symbol: 'CL=F',      fredSeries: 'DCOILWTICO',                       stooq: 'cl.f',    kind: 'commodity', colorInverse: true, note: '台灣能源 98% 仰賴進口；WTI 與 Brent 相關性 > 0.98，以 WTI 代表全球油價走勢' },

    { id: 'gold',    section: '大宗商品', name: '黃金',             symbol: 'GC=F',      fredSeries: 'GOLDAMGBD228NLBM',                 stooq: 'xauusd',  kind: 'commodity', colorInverse: false, note: '避險情緒指標；金價飆升代表市場不確定性升高，通常與股市呈反向' },
    { id: 'copper',  section: '大宗商品', name: '銅 (Dr. Copper)',  symbol: 'HG=F',                                    stooq: 'hg.f',    kind: 'commodity', colorInverse: false, note: '「銅博士」是景氣最準確的實物指標，銅價上漲代表製造業需求健康' },


    //  風險情緒 
    { id: 'vix',     section: '風險情緒', name: 'VIX 恐慌指數',    symbol: '^VIX',       stooq: '^vix',   historyUrl: 'https://historyofmarket.com/api/sp500/vix.json',        kind: 'vol',   colorInverse: true, note: '< 15 市場自滿、> 25 恐慌升溫、> 40 極度恐慌（歷史買點）' },

];

const TREND_MACRO_SERIES = [
    // 通膨
    { id: 'cpi',       section: '通膨與貨幣政策', name: '美國 CPI YoY',        series: 'CPIAUCSL', mode: 'yoy',   note: '整體通膨；CPI 持續高於 3% 使 Fed 降息空間受限' },
    { id: 'coreCpi',   section: '通膨與貨幣政策', name: '美國 Core CPI YoY',   series: 'CPILFESL', mode: 'yoy',   note: '排除食物能源；是 Fed 貨幣政策最主要觀察項目之一' },
    { id: 'corePce',   section: '通膨與貨幣政策', name: '美國 Core PCE YoY',   series: 'PCEPILFE', mode: 'yoy',   note: 'Fed 官方最青睞的通膨指標，目標值為 2%；是升降息決策的核心依據' },
    { id: 'fedRate',   section: '通膨與貨幣政策', name: '聯邦基金利率',        series: 'FEDFUNDS', mode: 'level', note: '全球無風險利率基準；Fed 升息通常壓抑股票估值，降息則帶動風險偏好上升' },
    // 就業
    { id: 'unemp',     section: '就業市場',         name: '美國失業率',          series: 'UNRATE',   mode: 'level', note: '薩姆法則：失業率 3 個月均值較前 12 個月低點上升 0.5% 即為衰退訊號' },
    { id: 'nfp',       section: '就業市場',         name: '非農就業人口 MoM',    series: 'PAYEMS',   mode: 'mom_diff', note: '月增 > 150K 為健康勞市；持續低於 100K 代表景氣降溫，市場開始定價降息' },
    { id: 'joltJob',   section: '就業市場',         name: 'JOLTS 職缺數',        series: 'JTSJOL',   mode: 'level', note: '職缺數大於失業人數代表勞市過熱；職缺縮減是薪資通膨降溫的早期訊號' },
    // 景氣循環
    { id: 'ismMfg',    section: '景氣循環',          name: 'ISM 製造業 PMI',      series: 'NAPM',     mode: 'level', fallbackSeries: 'IPMAN', fallbackName: '美國製造業產出', fallbackNote: 'ISM PMI 暫取不到，改用 FRED 製造業產出替代。', note: '50 以上擴張；對台灣製造業出口訂單有 1–2 個月的領先效果' },
    { id: 'ismSvc',    section: '景氣循環',          name: 'ISM 服務業 PMI',      series: 'NMFSL',    mode: 'level', fallbackSeries: 'DPCERA3M086SBEA', fallbackName: '美國實質個人消費', fallbackNote: 'ISM 服務 PMI 暫取不到，改用 FRED 實質個人消費替代。', note: '美國消費服務佔 GDP 70%；服務業 PMI > 50 代表內需動能健全' },
    { id: 'retail',    section: '景氣循環',          name: '零售銷售 MoM',        series: 'RSXFS',    mode: 'mom_pct', note: '扣除食品的月增率；連續兩個月負成長為消費降溫警訊' },
    { id: 'indProd',   section: '景氣循環',          name: '工業生產 YoY',        series: 'INDPRO',   mode: 'yoy',   note: '製造業實物產出；轉負代表工廠訂單萎縮，對台灣 B2B 出口影響直接' },
    { id: 'lei',       section: '景氣循環',          name: '領先指標指數 MoM',    series: 'USALOLITONOSTSAM', mode: 'mom_pct', note: '由 10 個分項組成的 OECD 領先指標；連續 6 個月下滑通常預示衰退' },
    // 消費與信心
    { id: 'sentiment', section: '消費與信心',        name: '密大消費者信心',      series: 'UMCSENT',  mode: 'level', note: '美國消費者信心；趨勢向下通常領先零售銷售滑落 2–3 個月' },
    { id: 'confBoard', section: '消費與信心',        name: '諮商會消費信心',      series: 'CSCICP03USM665S', mode: 'level', note: '另一個消費信心指標，側重就業預期；兩者同步下滑代表消費降溫趨勢確立' },
    // 房市
    { id: 'houst',     section: '房市與信用',        name: '美國新屋開工',        series: 'HOUST',    mode: 'level', note: '新屋開工是高乘數景氣指標；持續低迷代表建築材料與家電需求下滑' },
    { id: 'mortRate',  section: '房市與信用',        name: '30Y 房貸利率',        series: 'MORTGAGE30US', mode: 'level', note: '高房貸利率壓抑換屋需求，房市降溫會拉低整體消費財富效應' },
];

//  section 定義（每日 + 月更）

const DAILY_SECTIONS = [
    { key: '美股指數',   title: ' 美股主要指數',        note: '台股電子股與那斯達克、費半相關性最高；費半領漲通常帶動台積電次日走強' },
    { key: '亞太股市',   title: ' 亞太股市',              note: '外資在亞洲市場往往同步進出；日韓港股同步下跌為台股短線壓力的警訊' },
    { key: '利率曲線',   title: ' 利率與殖利率曲線',      note: '10Y–2Y 殖利率倒掛是歷史最可靠衰退領先指標；高收益利差走闊代表信用壓力升溫' },
    { key: '外匯',       title: ' 外匯市場',              note: '美元指數、日圓、韓圜、人民幣走勢直接影響台股外資動向與出口競爭格局' },
    { key: '大宗商品',   title: ' 大宗商品',             note: '銅價是景氣實物溫度計；油價影響台灣製造成本；黃金飆升代表避險情緒升溫' },
    { key: '風險情緒',   title: ' 風險情緒指標',          note: 'VIX 與 MOVE 同時飆升代表股債市雙重不安全，通常是最危險的市場環境' },
];

const TREND_SECTIONS = [
    { key: '通膨與貨幣政策', title: ' 通膨與貨幣政策', note: 'CPI、Core PCE 是 Fed 升降息的核心依據；PCE 高於 2.5% 時降息預期降溫' },
    { key: '就業市場',       title: ' 就業市場',       note: '非農與 JOLTS 是 Fed 雙重使命的另一半；就業過熱時 Fed 不敢快速降息' },
    { key: '景氣循環',       title: ' 景氣循環指標',   note: 'ISM 製造業 PMI 是台灣出口訂單的最佳領先指標，提前 1–2 個月反映需求變化' },
    { key: '消費與信心',     title: ' 消費者信心',    note: '消費信心連續下滑超過 3 個月，往往預示企業收入成長放緩' },
    { key: '房市與信用',     title: ' 房市與信用',     note: '房市冷熱反映利率政策效果；高房貸利率持續越久，消費財富效應侵蝕越深' },
];

//  格式化工具 

function macroFmt(value, digits = 2) {
    if (value === null || value === undefined || !isFinite(value)) return '--';
    return Number(value).toLocaleString('zh-TW', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}

function macroSigned(value, digits = 2, suffix = '') {
    if (value === null || value === undefined || !isFinite(value)) return '--';
    const sign = value > 0 ? '+' : '';
    return `${sign}${macroFmt(value, digits)}${suffix}`;
}

// colorInverse: true -> 上漲為壞事（油、VIX、利差等）
function macroColor(value, isInverse = false) {
    if (value === null || value === undefined || !isFinite(value)) return '#cbd5e1';
    const positive = value > 0;
    const up   = isInverse ? !positive : positive;
    if (up)   return '#f87171';   // 紅 = 上漲（或好）
    if (!up && value !== 0) return '#34d399'; // 綠 = 下跌（或壞）
    return '#cbd5e1';
}

function macroSparkline(points, color = '#60a5fa') {
    const clean = (points || []).filter(p => p && isFinite(p.value)).slice(-48);
    if (clean.length < 2) return '';
    const width = 180, height = 42, pad = 4;
    const vals  = clean.map(p => p.value);
    const min   = Math.min(...vals);
    const max   = Math.max(...vals);
    const range = (max - min) || 1;
    const d = clean.map((p, i) => {
        const x = pad + (i / (clean.length - 1)) * (width - pad * 2);
        const y = height - pad - ((p.value - min) / range) * (height - pad * 2);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const last  = clean[clean.length - 1];
    const prev  = clean[clean.length - 2];
    const dotColor = last.value >= prev.value ? '#f87171' : '#34d399';
    const lx = (width - pad).toFixed(1);
    const ly = (height - pad - ((last.value - min) / range) * (height - pad * 2)).toFixed(1);
    return `
        <svg class="macro-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
            <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle cx="${lx}" cy="${ly}" r="3" fill="${dotColor}"></circle>
        </svg>`;
}

function parseMacroCsv(text) {
    return String(text || '').trim().split(/\r?\n/).slice(1).map(line => {
        const parts = line.split(',');
        const date  = parts[0];
        const value = parseFloat(parts[1]);
        if (!date || isNaN(value)) return null;
        return { date, value };
    }).filter(Boolean);
}

//  Fetch 通用工具 

async function fetchMacroUrl(targetUrl, isJson = false, timeout = 5000) {
    async function tryOne(proxyUrl, allorigins = false) {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), timeout);
        try {
            const res  = await fetch(proxyUrl, { signal: ctrl.signal, cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            let text = await res.text();
            if (allorigins) { const w = JSON.parse(text); text = w?.contents || ''; }
            if (!text || text.length < 5 || text.startsWith('Edge:')) throw new Error('Empty');
            return isJson ? JSON.parse(text) : text;
        } finally { clearTimeout(tid); }
    }

    // Stage 1: 3 個 proxy 並聯 (最快者優先)
    try {
        return await Promise.any([
            tryOne(targetUrl),
            tryOne(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`),
            tryOne(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`)
        ]);
    } catch {}

    // Stage 2: 備援 proxy
    try {
        return await Promise.any([
            tryOne(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`),
            tryOne(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, true),
            tryOne(`https://thingproxy.freeboard.io/fetch/${targetUrl}`)
        ]);
    } catch {}

    throw new Error('macro source unavailable');
}

function extractMacroJsonSeries(payload) {
    const arrays = []; const seen = new Set();
    function walk(node, depth = 0) {
        if (!node || depth > 6 || seen.has(node)) return;
        if (typeof node === 'object') seen.add(node);
        if (Array.isArray(node)) { arrays.push(node); node.slice(0, 8).forEach(c => walk(c, depth + 1)); return; }
        if (typeof node === 'object') Object.values(node).forEach(c => walk(c, depth + 1));
    }
    walk(payload);
    const dateKeys  = ['date','Date','time','timestamp','month','day','x'];
    const valueKeys = ['close','Close','value','Value','price','Price','level','index','rate','yield','y','c','adj_close','adjClose'];
    function parseDate(raw) {
        if (raw === null || raw === undefined) return null;
        if (typeof raw === 'number') return new Date(raw > 1e10 ? raw : raw * 1000).toISOString().slice(0, 10);
        const t = String(raw).trim(); if (!t) return null;
        const d = new Date(t); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    }
    function parseNum(raw) {
        if (raw === null || raw === undefined || raw === '') return null;
        const v = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
        return isFinite(v) ? v : null;
    }
    function normalize(arr) {
        return arr.map(row => {
            if (Array.isArray(row)) {
                const d = parseDate(row[0]); const v = parseNum(row[1] ?? row[row.length - 1]);
                return d && v !== null ? { date: d, value: v } : null;
            }
            if (!row || typeof row !== 'object') return null;
            const dk = dateKeys.find(k => row[k] !== undefined); if (!dk) return null;
            const vk = valueKeys.find(k => parseNum(row[k]) !== null); if (!vk) return null;
            const d = parseDate(row[dk]); const v = parseNum(row[vk]);
            return d && v !== null ? { date: d, value: v } : null;
        }).filter(Boolean);
    }
    return arrays.map(normalize).filter(s => s.length >= 2).sort((a, b) => b.length - a.length)[0] || [];
}

function makeDailyMacroFromSeries(def, rawSeries, source) {
    const series = (rawSeries || [])
        .filter(p => p && p.date && isFinite(p.value))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map(p => {
            const v = (def.kind === 'rate' && !def.bpsUnit && p.value > 20) ? p.value / 10 : p.value;
            return { date: p.date, raw: p.value, value: v };
        });
    if (series.length < 2) throw new Error(`${source} has not enough data`);
    const latest = series[series.length - 1];
    const prev   = series[series.length - 2];
    const week   = series[Math.max(0, series.length - 6)];
    const month  = series[Math.max(0, series.length - 21)];
    const pctFrom = (base) => base && isFinite(base.raw) && base.raw !== 0
        ? ((latest.raw - base.raw) / base.raw) * 100 : null;
    // changeBps: for rates (%), multiply by 100 to get bps; for bpsUnit data, just subtract directly
    const bpsDiff = (a, b) => def.bpsUnit ? (a.value - b.value) : (a.value - b.value) * 100;
    return {
        ...def,
        date: latest.date, value: latest.value, rawValue: latest.raw,
        changePct: pctFrom(prev),   weekPct:  pctFrom(week),  monthPct: pctFrom(month),
        changeBps: (def.kind === 'rate' || def.kind === 'spread') ? bpsDiff(latest, prev) : null,
        weekBps:   (def.kind === 'rate' || def.kind === 'spread') ? bpsDiff(latest, week)  : null,
        monthBps:  (def.kind === 'rate' || def.kind === 'spread') ? bpsDiff(latest, month) : null,
        source, series
    };
}

//  各資料來源 fetch 

async function fetchYahooMacro(def) {
    if (!def.symbol) throw new Error('no symbol');
    const url    = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(def.symbol)}?range=6mo&interval=1d`;
    const json   = await fetchMacroUrl(url, true);
    const result = json?.chart?.result?.[0];
    if (!result || json?.chart?.error) throw new Error(json?.chart?.error?.description || 'empty');
    const ts = result.timestamp || [];
    const cl = result.indicators?.quote?.[0]?.close || [];
    const series = ts.map((t, i) => {
        const r = cl[i]; if (!isFinite(r)) return null;
        return { date: new Date(t * 1000).toISOString().slice(0, 10), value: r };
    }).filter(Boolean);
    return makeDailyMacroFromSeries(def, series, 'Yahoo Finance');
}

async function fetchHistoryMacro(def) {
    if (!def.historyUrl) throw new Error('no history endpoint');
    const json   = await fetchMacroUrl(def.historyUrl, true, 9000);
    const series = extractMacroJsonSeries(json);
    return makeDailyMacroFromSeries(def, series, 'History of Market');
}

async function fetchFredDailyMacro(def) {
    if (!def.fredSeries) throw new Error('no fred series');
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(def.fredSeries)}`;
    const csv = await fetchMacroUrl(url, false, 10000);
    // Validate: FRED CSV must start with "date," — reject HTML challenge pages
    const firstLine = String(csv || '').trim().split(/\r?\n/)[0] || '';
    if (!firstLine.toLowerCase().startsWith('date')) throw new Error('FRED: invalid response (not CSV)');
    const series = parseMacroCsv(csv);
    return makeDailyMacroFromSeries(def, series, 'FRED');
}

async function fetchStooqMacro(def) {
    if (!def.stooq) throw new Error('no stooq');
    const url    = `https://stooq.com/q/d/l/?s=${encodeURIComponent(def.stooq)}&i=d`;
    const csv    = await fetchMacroUrl(url, false, 9000);
    const series = String(csv || '').trim().split(/\r?\n/).slice(1).map(line => {
        const p = line.split(','); const c = Number(p[4]);
        return p[0] && isFinite(c) ? { date: p[0], value: c } : null;
    }).filter(Boolean);
    return makeDailyMacroFromSeries(def, series, 'Stooq');
}

// Frankfurter.app (ECB official rates) — 直連有 ACAO:*，不需 proxy
async function fetchFrankfurterFX(def) {
    if (!def.frankBase || !def.frankSymbol) throw new Error('no frankfurter config');
    const from = new Date();
    from.setMonth(from.getMonth() - 6);
    const fromStr = from.toISOString().split('T')[0];
    const url = `https://api.frankfurter.app/${fromStr}..?base=${def.frankBase}&symbols=${def.frankSymbol}`;
    const json = await fetchMacroUrl(url, true, 6000);
    if (!json || !json.rates) throw new Error('frankfurter: no rates');
    const series = Object.entries(json.rates)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, rates]) => {
            let value = rates[def.frankSymbol];
            if (!isFinite(value)) return null;
            if (def.frankInvert) value = 1 / value;
            return { date, value };
        }).filter(Boolean);
    return makeDailyMacroFromSeries(def, series, 'Frankfurter/ECB');
}

async function fetchDailyMacro(def) {
    const sources = [];
    if (def.frankBase)  sources.push(() => fetchFrankfurterFX(def));
    if (def.fredSeries) sources.push(() => fetchFredDailyMacro(def));
    if (def.historyUrl) sources.push(() => fetchHistoryMacro(def));
    if (def.symbol)     sources.push(() => fetchYahooMacro(def));
    if (def.stooq)      sources.push(() => fetchStooqMacro(def));
    if (!sources.length) throw new Error(`no source for ${def.id}`);
    let lastErr;
    for (const fn of sources) {
        try   { return await fn(); }
        catch (e) { lastErr = e; }
    }
    throw lastErr || new Error(`all sources failed for ${def.id}`);
}

async function fetchFredMacro(def) {
    const url  = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(def.series)}`;
    const csv  = await fetchMacroUrl(url, false, 10000);
    const rows = parseMacroCsv(csv).filter(r => isFinite(r.value));
    if (rows.length < 14) throw new Error(`FRED ${def.series}: not enough data`);

    if (def.mode === 'yoy') {
        const yoy = [];
        for (let i = 12; i < rows.length; i++) {
            if (rows[i - 12].value !== 0)
                yoy.push({ date: rows[i].date, value: ((rows[i].value / rows[i - 12].value) - 1) * 100 });
        }
        const latest = yoy[yoy.length - 1]; const prev = yoy[yoy.length - 2];
        const raw = rows[rows.length - 1];   const rawP = rows[rows.length - 2];
        return { ...def, date: latest.date, value: latest.value,
            change: latest.value - prev.value,
            mom:    ((raw.value / rawP.value) - 1) * 100, series: yoy };
    }
    if (def.mode === 'mom_diff') {
        const latest = rows[rows.length - 1]; const prev = rows[rows.length - 2];
        const diffs  = rows.slice(1).map((r, i) => ({ date: r.date, value: r.value - rows[i].value }));
        return { ...def, date: latest.date, value: latest.value,
            change: latest.value - prev.value, mom: latest.value - prev.value, series: diffs };
    }
    if (def.mode === 'mom_pct') {
        const latest = rows[rows.length - 1]; const prev = rows[rows.length - 2];
        const pcts   = rows.slice(1).map((r, i) => ({
            date: r.date, value: rows[i].value !== 0 ? ((r.value / rows[i].value) - 1) * 100 : 0
        }));
        return { ...def, date: latest.date, value: latest.value,
            change: latest.value - prev.value,
            mom: prev.value !== 0 ? ((latest.value / prev.value) - 1) * 100 : 0, series: pcts };
    }
    const latest = rows[rows.length - 1]; const prev = rows[rows.length - 2];
    return { ...def, date: latest.date, value: latest.value,
        change: latest.value - prev.value, series: rows };
}

async function fetchTrendMacro(def) {
    try {
        return await fetchFredMacro(def);
    } catch (err) {
        if (!def.fallbackSeries) throw err;
        return fetchFredMacro({
            ...def, series: def.fallbackSeries,
            name: def.fallbackName || def.name,
            note: def.fallbackNote || def.note,
            isFallback: true
        });
    }
}

async function tryNdcWebsite() {
    const urls = ['https://index.ndc.gov.tw/n/zh_tw', 'https://index.ndc.gov.tw/'];
    for (const url of urls) {
        try {
            const html = await fetchMacroUrl(url, false, 5000);
            if (!html || html.length < 200) continue;
            const scoreM  = html.match(/[\u7d9c\u5408\u5224\u65b7].*?(\d{1,2})\s*[\u5206]/);
            const score   = scoreM ? parseInt(scoreM[1]) : NaN;
            const signalM = html.match(/([\u7d05\u71c8|\u9ec3\u7d05\u71c8|\u7da0\u71c8|\u9ec3\u85cd\u71c8|\u85cd\u71c8])/);
            if (signalM || isFinite(score)) {
                const sig = isFinite(score) ? ndcScoreToSignal(score) : ndcLabelToSignal(signalM?.[1] || '');
                if (sig) return {
                    signal: sig, score: isFinite(score) ? score : null,
                    date: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit' }),
                    source: 'index.ndc.gov.tw', isProxy: false,
                    note: '直接解析國發會景氣指標網頁'
                };
            }
        } catch {}
    }
    throw new Error('NDC website parse failed');
}

async function fetchNdcMacroInfo() {
    // 嘗試解析 NDC 官方網頁（SPA 架構不一定能取得，但試試）
    try {
        const r = await tryNdcWebsite();
        return { id: 'ndc', status: 'ok', ...r };
    } catch {}

    // 官網解析失敗 → 不用推算，直接告知使用者去查
    return {
        id: 'ndc', status: 'failed',
        signal: null, score: null,
        date: '--',
        source: '',
        note: '因國發會網頁為 SPA 架構，無法由前端直接解析燈號。請點下方連結至官網查詢最新燈號。',
        isProxy: false
    };
}

//  風險溫度評分 

function evaluateMacroTone(daily, trends) {
    const byId  = Object.fromEntries((daily || []).filter(x => !x.error).map(x => [x.id, x]));
    const tById = Object.fromEntries((trends || []).filter(x => !x.error).map(x => [x.id, x]));
    let score   = 50;
    const notes = [];

    // 美股動能
    const addPct = (id, up, dn, w, label) => {
        const item = byId[id]; if (!item) return;
        if (item.changePct >= up) { score += w; notes.push(`${label}走強`); }
        else if (item.changePct <= dn) { score -= w; notes.push(`${label}轉弱`); }
    };
    addPct('sox',    1,    -1,    10, '費半');
    addPct('nasdaq', 0.8,  -0.8,   8, '科技股');
    addPct('sp500',  0.5,  -0.5,   6, '美股');
    addPct('smh',    1,    -1,     5, '半導體 ETF');
    addPct('rut',    0.8,  -0.8,   4, '小型股');

    // 亞太
    addPct('nikkei', 0.8, -0.8,  4, '日股');
    addPct('kospi',  0.8, -0.8,  3, '韓股');
    addPct('hsi',    0.8, -0.8,  3, '港股');

    // VIX
    if (byId.vix) {
        const v = byId.vix;
        if (v.value >= 30)      { score -= 12; notes.push('VIX 極度恐慌'); }
        else if (v.value >= 25) { score -= 8;  notes.push('VIX 偏高'); }
        else if (v.value <= 15) { score += 4;  notes.push('VIX 低檔自滿'); }
        if (v.changePct >= 8)   score -= 5;
        if (v.changePct <= -8)  score += 3;
    }

    // MOVE 債券波動率
    if (byId.move) {
        if (byId.move.value >= 120) { score -= 6; notes.push('MOVE 債券波動率極高'); }
        else if (byId.move.value >= 90) score -= 3;
    }

    // 殖利率曲線指標已移除（FRED CORS 限制）
    // 10Y 利率方向
    if (byId.tnx) {
        if (byId.tnx.changeBps >= 8)  { score -= 5; notes.push('10Y 殖利率上行'); }
        if (byId.tnx.value >= 5.0)    { score -= 4; notes.push('10Y 殖利率破 5%'); }
    }


    // 美元
    if (byId.dxy) {
        if (byId.dxy.changePct >= 0.5)  { score -= 4; notes.push('美元走強'); }
        else if (byId.dxy.changePct <= -0.5) { score += 3; notes.push('美元轉弱'); }
    }

    // 商品（景氣信號）
    if (byId.copper) {
        if (byId.copper.changePct >= 1.5)  { score += 4; notes.push('銅價走強（景氣正面）'); }
        if (byId.copper.changePct <= -2)   { score -= 5; notes.push('銅價走弱（景氣疑慮）'); }
    }
    if (byId.wti) {
        if (byId.wti.value >= 95)         { score -= 5; notes.push('油價偏高壓製成本'); }
        if (byId.wti.changePct >= 3)      { score -= 3; notes.push('油價單日急漲'); }
    }

    // FRED 月頻訊號
    if (tById.unemp && tById.unemp.value >= 4.5) { score -= 5; notes.push('失業率攀升'); }
    if (tById.ismMfg) {
        const pmi = tById.ismMfg.value;
        if (pmi >= 55)      score += 5;
        else if (pmi < 50)  score -= 4;
        else if (pmi < 45)  { score -= 8; notes.push('ISM PMI 大幅萎縮'); }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    if (score >= 68) return { score, label: '偏多風險開啟',   color: '#f87171', notes };
    if (score >= 52) return { score, label: '中性偏多',       color: '#fbbf24', notes };
    if (score >= 38) return { score, label: '中性偏保守',     color: '#93c5fd', notes };
    return              { score, label: '避險升溫',           color: '#34d399', notes };
}

//  Render：單一卡片 

function renderMacroErrorCard(name, message) {
    return `
        <div class="macro-card">
            <span class="macro-label">${name}</span>
            <span class="macro-value" style="font-size:18px;color:#fca5a5;">抓取失敗</span>
            <span class="macro-note">${message || '稍後可按更新重試'}</span>
        </div>`;
}

function renderDailyMacroCard(item) {
    if (item.error) return renderMacroErrorCard(item.name, item.error);

    const isInverse  = item.colorInverse === true || item.kind === 'vol';
    const isRate     = item.kind === 'rate';
    const isSpread   = item.kind === 'spread';
    const isFx       = item.kind === 'fx';
    const isCom      = item.kind === 'commodity';

    // 主數值顯示
    let valueText;
    if (isRate)   valueText = `${macroFmt(item.value, 2)}%`;
    else if (isSpread && item.bpsUnit) valueText = `${macroFmt(item.value, 0)} bps`;
    else if (isSpread) valueText = `${macroSigned(item.value, 2)} ppt`;
    else if (isFx) valueText = macroFmt(item.value, item.value < 10 ? 4 : item.value < 100 ? 3 : 2);
    else valueText = macroFmt(item.value, item.value >= 1000 ? 0 : 2);

    // 日變動 badge
    let changeText, changeColor;
    if (isRate || isSpread) {
        const bps = item.changeBps;
        changeText  = bps != null ? macroSigned(bps, 1, ' bp') : '--';
        changeColor = macroColor(bps, isInverse);
    } else {
        changeText  = item.changePct != null ? macroSigned(item.changePct, 2, '%') : '--';
        changeColor = macroColor(item.changePct, isInverse);
    }

    // 週/月資訊列
    let periodText;
    if (isRate || isSpread) {
        periodText = `週 ${item.weekBps != null ? macroSigned(item.weekBps, 1, ' bp') : '--'} / 月 ${item.monthBps != null ? macroSigned(item.monthBps, 1, ' bp') : '--'}`;
    } else {
        periodText = `週 ${item.weekPct != null ? macroSigned(item.weekPct, 1, '%') : '--'} / 月 ${item.monthPct != null ? macroSigned(item.monthPct, 1, '%') : '--'}`;
    }

    const sparkColor = isRate ? '#a78bfa' : isSpread ? '#f59e0b' : isCom ? '#fb923c' : isFx ? '#34d399' : item.kind === 'vol' ? '#fb7185' : '#60a5fa';

    return `
        <div class="macro-card">
            <span class="macro-label">${item.name}</span>
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
                <span class="macro-value">${valueText}</span>
                <span class="macro-pill" style="color:${changeColor};background:rgba(255,255,255,0.04);">${changeText}</span>
            </div>
            ${macroSparkline(item.series, sparkColor)}
            <span class="macro-meta">${item.source || 'FRED'} · ${item.date} · ${periodText}</span>
            <span class="macro-note">${item.note}</span>
        </div>`;
}

function renderTrendMacroCard(item) {
    if (item.error) return renderMacroErrorCard(item.name, item.error);

    const isPMI   = (item.id === 'ismMfg' || item.id === 'ismSvc') && !item.isFallback;
    const isLevel = item.mode === 'level';
    const isMomDiff = item.mode === 'mom_diff';

    let valueText, changeText, valueColor;

    if (isPMI) {
        valueText  = macroFmt(item.value, 1);
        changeText = macroSigned(item.change, 1, ' 點');
        valueColor = item.value >= 50 ? '#f87171' : '#34d399';
    } else if (isMomDiff) {
        // NFP: show latest level and MoM diff
        const diff = item.mom;
        valueText  = `${macroFmt(item.value / 1000, 0)}M`;  // total employment in millions
        changeText = diff != null ? macroSigned(diff, 0, ' K') : '--';
        valueColor = diff > 100 ? '#f87171' : diff > 0 ? '#fbbf24' : '#34d399';
    } else if (item.mode === 'yoy') {
        valueText  = `${macroFmt(item.value, 2)}%`;
        changeText = `${macroSigned(item.change, 2, ' ppt')} / MoM ${macroSigned(item.mom, 2, '%')}`;
        valueColor = macroColor(item.change, true); // falling inflation is good
    } else if (item.mode === 'mom_pct') {
        valueText  = macroFmt(item.value, item.value >= 1000 ? 0 : 2);
        changeText = item.mom != null ? macroSigned(item.mom, 2, '%') : '--';
        valueColor = macroColor(item.mom, false);
    } else {
        valueText  = `${macroFmt(item.value, item.value >= 10 ? 1 : 2)}${item.id === 'unemp' || item.id === 'fedRate' || item.id === 'mortRate' ? '%' : ''}`;
        changeText = macroSigned(item.change, 2);
        valueColor = '#e2e8f0';
    }

    // Override colors for specific indicators
    if (item.id === 'unemp')     valueColor = item.value >= 4.5 ? '#f87171' : item.value <= 3.5 ? '#fbbf24' : '#e2e8f0';
    if (item.id === 'fedRate')   valueColor = item.value >= 5 ? '#f87171' : item.value <= 2 ? '#34d399' : '#fbbf24';
    if (item.id === 'sentiment' || item.id === 'confBoard') valueColor = macroColor(item.change, false);

    const sparkColor = isPMI ? '#f59e0b' : item.mode === 'yoy' ? '#a78bfa' : '#60a5fa';

    return `
        <div class="macro-card">
            <span class="macro-label">${item.name}${item.isFallback ? ' <span style="font-size:9px;color:#94a3b8;">(備援)</span>' : ''}</span>
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
                <span class="macro-value" style="color:${valueColor};">${valueText}</span>
                <span class="macro-pill" style="color:#94a3b8;background:rgba(255,255,255,0.04);">${changeText}</span>
            </div>
            ${macroSparkline(item.series, sparkColor)}
            <span class="macro-meta">最新月份 ${item.date}</span>
            <span class="macro-note">${item.note}</span>
        </div>`;
}

function renderNdcCard(item) {
    const sig = item.signal;

    const signalHtml = sig ? `
        <div style="display:flex;align-items:center;gap:12px;margin:6px 0 4px;">
            <span style="font-size:36px;line-height:1;">${sig.emoji}</span>
            <div>
                <div style="font-size:22px;font-weight:800;color:${sig.color};">${sig.label}</div>
                <div style="font-size:12px;color:#94a3b8;">${sig.desc}</div>
            </div>
            ${item.score != null ? `<div style="margin-left:auto;text-align:right;">
                <div style="font-size:28px;font-weight:800;color:${sig.color};">${item.score}</div>
                <div style="font-size:10px;color:#94a3b8;">/ 45 分</div>
            </div>` : ''}
        </div>` : `<div style="font-size:13px;color:#94a3b8;padding:6px 0;">燈號資料暫時無法取得</div>`;

    const lampSegments = [
        ['#ef4444','[RED] 紅燈','38–45'],
        ['#f97316','[YR] 黃紅','32–37'],
        ['#22c55e','[GRN] 綠燈','23–31'],
        ['#eab308','[YB] 黃藍','17–22'],
        ['#3b82f6','[BLU] 藍燈','9–16']
    ].map(([c, l, r]) => {
        const active = sig && sig.color === c;
        return `<div style="flex:1;padding:3px 1px;background:${active ? c : c + '22'};color:${active ? '#fff' : c};font-weight:${active ? 700 : 400};border:1px solid ${c}44;text-align:center;font-size:9px;">
            <div>${l}</div><div style="font-size:8px;opacity:0.8;">${r}</div>
        </div>`;
    }).join('');

    const proxyWarning = ''; // CLI proxy removed

    return `
        <div class="macro-card" style="min-width:240px;">
            <span class="macro-label"> 台灣景氣對策信號</span>
            ${signalHtml}
            <div style="display:flex;gap:2px;margin:8px 0 4px;border-radius:4px;overflow:hidden;">${lampSegments}</div>
            ${proxyWarning}
            <span class="macro-meta" style="margin-top:4px;">${item.source || ''} · ${item.date || ''}</span>
            <span class="macro-note">${item.note || ''}</span>
            <div style="display:flex;gap:8px;margin-top:6px;">
                <a href="https://index.ndc.gov.tw/n/zh_tw" target="_blank" rel="noopener"
                   style="color:#93c5fd;font-size:11px;text-decoration:none;">國發會景氣指標 -></a>
                <a href="https://data.gov.tw/dataset/6099" target="_blank" rel="noopener"
                   style="color:#93c5fd;font-size:11px;text-decoration:none;">開放資料 -></a>
            </div>
        </div>`;
}

//  Render：主體 

function renderSectionGrid(title, note, cards) {
    return `
        <div class="macro-section-title">
            <h3>${title}</h3>
            <span>${note}</span>
        </div>
        <div class="macro-grid">${cards}</div>`;
}

function renderMacroDashboard(data, fromCache = false) {
    const macroBodyEl   = document.getElementById('macroBody');
    const macroStatusEl = document.getElementById('macroStatus');
    if (!macroBodyEl) return;


    if (macroStatusEl) {
        const src = fromCache ? '快取' : '即時';
        macroStatusEl.textContent =
            `${src} · ${new Date(data.fetchedAt).toLocaleString('zh-TW')} · 每日指標 ${(data.daily||[]).filter(x=>!x.error).length}/${DAILY_MACRO_SYMBOLS.length} 項成功`;
    }

    //  頂部摘要卡 

    const spreadVal = null;   // spread indicator removed (FRED CORS)
    const spreadColor = '#cbd5e1';
    const spreadText  = '--';

    macroBodyEl.innerHTML = `
        ${DAILY_SECTIONS.map(sec => {
            const items = (data.daily || []).filter(x => x.section === sec.key);
            if (!items.length) return '';
            return renderSectionGrid(sec.title, sec.note, items.map(renderDailyMacroCard).join(''));
        }).join('')}

        ${TREND_SECTIONS.map(sec => {
            const items = (data.trends || []).filter(x => x.section === sec.key);
            if (!items.length) return '';
            return renderSectionGrid(sec.title, sec.note, items.map(renderTrendMacroCard).join(''));
        }).join('')}

        <div class="macro-section-title">
            <h3> 台灣景氣指標</h3>
            <span>國發會每月發布，含燈號、領先/同步指標、製造業 PMI</span>
        </div>
        <div class="macro-grid">${renderNdcCard(data.ndc)}</div>

        <div class="macro-source-list">
            <a href="https://query1.finance.yahoo.com/" target="_blank" rel="noopener">Yahoo Finance</a>
            <a href="https://historyofmarket.com/" target="_blank" rel="noopener">History of Market</a>
            <a href="https://stooq.com/" target="_blank" rel="noopener">Stooq</a>
            <a href="https://fred.stlouisfed.org/" target="_blank" rel="noopener">FRED (St. Louis Fed)</a>
            <a href="https://data.gov.tw/dataset/6099" target="_blank" rel="noopener">國發會開放資料</a>
        </div>`;
}

function renderMacroLoading() {
    const el = document.getElementById('macroBody');
    if (!el) return;
    const total = DAILY_MACRO_SYMBOLS.length + TREND_MACRO_SERIES.length;
    el.innerHTML = `
        <div style="text-align:center;padding:48px;color:#94a3b8;">
            <div class="spinner" style="width:32px;height:32px;border:3px solid rgba(255,255,255,0.1);border-top-color:#22c55e;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px;"></div>
            <div>正在整理總經資料…</div>
            <div id="macroProg" style="font-size:12px;margin-top:8px;color:#64748b;">0 / ${total} 完成</div>
        </div>`;
}

//  資料並聯抓取 

// 限制並發：分批執行，每批最多 batchSize 個，避免瀏覽器 connection pool 爆炸
// guardedFetch: 用 done-flag + new Promise 構造，100% 保證在 ms 毫秒內 resolve
// 比 Promise.race 更可靠：即使內部 promise 永遠 pending，timer 也必定 resolve
function guardedFetch(fn, ms, fallback) {
    return new Promise(resolve => {
        let done = false;
        const finish = val => { if (!done) { done = true; resolve(val); } };

        // 硬性 deadline — setTimeout 一定會觸發
        setTimeout(() => finish(fallback), ms);

        // 啟動實際 fetch
        try {
            fn()
                .then(r  => finish(r))
                .catch(e => finish({ ...fallback, error: e?.message || String(e) }));
        } catch (e) {
            finish({ ...fallback, error: e?.message || String(e) });
        }
    });
}

async function fetchMacroDashboardData() {
    let cnt = 0;
    const total = DAILY_MACRO_SYMBOLS.length + TREND_MACRO_SERIES.length;
    const tick = () => {
        cnt++;
        const prog = document.getElementById('macroProg');
        if (prog) prog.textContent = `${cnt} / ${total} 完成`;
        console.log(`[Macro] ${cnt}/${total}`);
    };

    const wrapDaily = def => guardedFetch(
        () => fetchDailyMacro(def), 15000,
        { ...def, error: 'timeout' }
    ).then(r => { tick(); return r; });

    const wrapTrend = def => guardedFetch(
        () => fetchTrendMacro(def), 15000,
        { ...def, error: 'timeout' }
    ).then(r => { tick(); return r; });

    const ndcFallback = { id:'ndc', status:'failed', signal:null, score:null,
        date:'逾時', source:'', note:'連線逾時，請稍後重試。', isProxy:false };

    console.log('[Macro] 開始，共', total, '個指標');
    const [dailyResults, trendResults, ndc] = await Promise.all([
        Promise.all(DAILY_MACRO_SYMBOLS.map(wrapDaily)),
        Promise.all(TREND_MACRO_SERIES.map(wrapTrend)),
        guardedFetch(() => fetchNdcMacroInfo(), 18000, ndcFallback)
    ]);
    console.log('[Macro] 全部完成');
    return { fetchedAt: new Date().toISOString(), daily: dailyResults, trends: trendResults, ndc };
}

//  公開介面 

window.loadMacroDashboard = async function loadMacroDashboard(force = false) {
    const macroBodyEl     = document.getElementById('macroBody');
    const macroRefreshBtn = document.getElementById('macroRefreshBtn');
    const macroStatusEl   = document.getElementById('macroStatus');
    if (!macroBodyEl) return;

    // 試讀快取
    if (!force) {
        try {
            const cached = JSON.parse(localStorage.getItem(MACRO_CACHE_KEY) || 'null');
            if (cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < MACRO_CACHE_TTL_MS) {
                renderMacroDashboard(cached, true);
                return;
            }
        } catch {}
    }

    renderMacroLoading();
    if (macroRefreshBtn) { macroRefreshBtn.disabled = true; macroRefreshBtn.textContent = '更新中...'; }

    console.log('[Macro] loadMacroDashboard 開始，', new Date().toLocaleTimeString());

    //  逃生門：18 秒後強制結束 loading，無論 async 是否完成 
    const escapeTimer = setTimeout(() => {
        console.warn('[Macro] [T] 逃生門觸發（18s）');
        const el = document.getElementById('macroBody');
        if (el && el.id && (el.querySelector('#macroProg') || el.querySelector('.spinner'))) {
            el.innerHTML = `<div style="padding:24px;color:#fca5a5;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;line-height:1.7;">
                [T] 載入逾時（18 秒）<br>
                <span style="font-size:12px;color:#94a3b8;">
                    請開啟瀏覽器 DevTools -> Console，尋找 <code>[Macro]</code> 開頭的訊息，
                    確認卡在哪個步驟。網路若正常，按「 更新」重試。
                </span>
            </div>`;
        }
        if (macroRefreshBtn) { macroRefreshBtn.disabled = false; macroRefreshBtn.textContent = ' 更新'; }
    }, 18000);

    try {
        const data = await fetchMacroDashboardData();
        clearTimeout(escapeTimer);
        console.log('[Macro] fetch 完成，日頻成功 ', (data.daily||[]).filter(x=>!x.error).length,
                    '/', (data.daily||[]).length);
        // 先 render，再存快取；避免 QuotaExceededError 導致畫面空白
        try {
            renderMacroDashboard(data, false);
        } catch (renderErr) {
            console.error('Macro render failed:', renderErr);
            const el = document.getElementById('macroBody');
            if (el) el.innerHTML = `<div style="padding:28px;color:#fca5a5;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;">
                總經資料已取得但顯示失敗，請開啟 DevTools Console 查看錯誤。<br>
                <small style="color:#94a3b8;">${renderErr.message}</small>
            </div>`;
        }
        // 儲存快取：只保留每個 series 最後 60 筆，避免 localStorage quota 超標
        try {
            const slim = {
                ...data,
                daily:  (data.daily  || []).map(x => ({ ...x, series: (x.series  || []).slice(-60) })),
                trends: (data.trends || []).map(x => ({ ...x, series: (x.series  || []).slice(-60) })),
            };
            localStorage.setItem(MACRO_CACHE_KEY, JSON.stringify(slim));
        } catch (cacheErr) {
            console.warn('Macro cache write failed (quota?):', cacheErr.message);
        }
    } catch (err) {
        clearTimeout(escapeTimer);
        console.error('[Macro] 整體失敗:', err);
        try {
            const cached = JSON.parse(localStorage.getItem(MACRO_CACHE_KEY) || 'null');
            if (cached) {
                renderMacroDashboard(cached, true);
                if (macroStatusEl) macroStatusEl.textContent += ' · 即時更新失敗，顯示快取';
                return;
            }
        } catch {}
        const el = document.getElementById('macroBody');
        if (el) el.innerHTML = `<div style="padding:28px;color:#fca5a5;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px;">總經資料暫時抓取失敗，請稍後再試。</div>`;
    } finally {
        if (macroRefreshBtn) { macroRefreshBtn.disabled = false; macroRefreshBtn.textContent = ' 更新'; }
    }
};
