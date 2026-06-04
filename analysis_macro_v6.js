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

    // ── 補回：無 FRED 依賴，靠 Yahoo / Stooq ──────────────────────────────────
    { id: 'dxy',     section: '外匯',     name: '美元指數 (DXY)',    symbol: 'DX-Y.NYB', stooq: 'dxy', kind: 'index', colorInverse: true, note: '美元走強通常壓抑新興市場；外資賣台股匯出時加速台幣貶值' },
    { id: 'usdtwd',  section: '外匯',     name: 'USD/TWD',          symbol: 'TWD=X',  stooq: 'usdtwd',  kind: 'fx', colorInverse: true, note: '台幣升值不利出口但吸引外資；台幣走強往往是外資淨流入的領先訊號' },
    { id: 'natgas',  section: '大宗商品', name: '天然氣',            symbol: 'NG=F',   stooq: 'ng.f',    kind: 'commodity', colorInverse: true, note: '台灣電廠與工業用氣主要來源，天然氣走高直接推升電費與生產成本' },
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
    { id: 'ismMfg',    section: '景氣循環',          name: 'ISM 製造業 PMI',      series: 'MANEMP',   mode: 'level', fallbackSeries: 'IPMAN', fallbackName: '美國製造業產出', fallbackNote: 'ISM PMI 暫取不到，改用 FRED 製造業產出替代。', note: '50 以上擴張；對台灣製造業出口訂單有 1–2 個月的領先效果' },
    { id: 'ismSvc',    section: '景氣循環',          name: 'ISM 服務業 PMI',      series: 'RSAFS',    mode: 'level', fallbackSeries: 'DPCERA3M086SBEA', fallbackName: '美國實質個人消費', fallbackNote: 'ISM 服務 PMI 暫取不到，改用 FRED 實質個人消費替代。', note: '美國消費服務佔 GDP 70%；服務業 PMI > 50 代表內需動能健全' },
    { id: 'retail',    section: '景氣循環',          name: '零售銷售 MoM',        series: 'RSXFS',    mode: 'mom_pct', note: '扣除食品的月增率；連續兩個月負成長為消費降溫警訊' },
    { id: 'indProd',   section: '景氣循環',          name: '工業生產 YoY',        series: 'INDPRO',   mode: 'yoy',   note: '製造業實物產出；轉負代表工廠訂單萎縮，對台灣 B2B 出口影響直接' },
    // 消費與信心
    { id: 'sentiment', section: '消費與信心',        name: '密大消費者信心',      series: 'UMCSENT',  mode: 'level', note: '美國消費者信心；趨勢向下通常領先零售銷售滑落 2–3 個月' },
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

    // 把 series 序列化成 data 屬性，供 mousemove tooltip 使用
    const seriesJson = JSON.stringify(clean.map(p => ({ d: p.date, v: p.value })));

    return `
        <div class="macro-spark-wrap" style="position:relative;">
            <svg class="macro-sparkline macro-spark-svg" viewBox="0 0 ${width} ${height}"
                preserveAspectRatio="none" aria-hidden="true"
                data-min="${min}" data-max="${max}" data-range="${range}"
                data-pad="${pad}" data-w="${width}" data-h="${height}"
                data-color="${color}"
                data-series='${seriesJson.replace(/'/g, '&apos;')}'>
                <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
                <line class="spark-cursor" x1="-100" y1="${pad}" x2="-100" y2="${height - pad}"
                    stroke="rgba(255,255,255,0.4)" stroke-width="1" stroke-dasharray="3,2"/>
                <circle class="spark-dot-hover" cx="-100" cy="-100" r="3.5" fill="${color}" stroke="#1e293b" stroke-width="1.5"/>
                <circle cx="${lx}" cy="${ly}" r="3" fill="${dotColor}"></circle>
            </svg>
            <div class="spark-tooltip" style="
                display:none;position:absolute;top:-28px;
                background:rgba(15,23,42,0.92);border:1px solid rgba(255,255,255,0.12);
                border-radius:6px;padding:3px 8px;font-size:11px;color:#e2e8f0;
                white-space:nowrap;pointer-events:none;z-index:10;transform:translateX(-50%);">
            </div>
        </div>`;
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

// ── 自架 Cloudflare Worker Proxy URL ─────────────────────────────────────────
// 部署 cloudflare-worker.js 後填入你的 Worker URL（結尾不加斜線）
// 例如：'https://ramanstock-proxy.yourname.workers.dev'
const WORKER_PROXY_URL = 'https://young-unit-cf65.anonymous596314.workers.dev';

async function fetchWithTimeout(url, opts = {}, ms = 8000) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { ...opts, signal: ctrl.signal, cache: 'no-store' });
    } finally { clearTimeout(tid); }
}

async function fetchMacroUrl(targetUrl, isJson = false, timeout = 8000) {
    async function tryOne(url, unwrapAllorigins = false) {
        const res = await fetchWithTimeout(url, {}, timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let text = await res.text();
        if (unwrapAllorigins) { const w = JSON.parse(text); text = w?.contents || ''; }
        if (!text || text.length < 5 || text.startsWith('Edge:')) throw new Error('empty');
        return isJson ? JSON.parse(text) : text;
    }

    const enc = encodeURIComponent(targetUrl);

    // Stage 0: 自架 Worker（最優先，穩定無 rate limit）
    if (WORKER_PROXY_URL) {
        try { return await tryOne(`${WORKER_PROXY_URL}/?url=${enc}`); } catch {}
    }

    // Stage 1: 直連 + corsproxy.io 並聯
    try {
        return await Promise.any([
            tryOne(targetUrl),
            tryOne(`https://corsproxy.io/?${enc}`),
        ]);
    } catch {}

    // Stage 2: codetabs 備援
    try {
        return await tryOne(`https://api.codetabs.com/v1/proxy?quest=${enc}`);
    } catch {}

    throw new Error('macro source unavailable');
}

// Yahoo Finance 專用 fetch（query1 / query2 雙域名互備）
async function fetchYahooJson(symbol) {
    const urls = [
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`,
        `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`,
    ];
    for (const base of urls) {
        try { return await fetchMacroUrl(base, true, 9000); } catch {}
    }
    throw new Error(`Yahoo: all endpoints failed for ${symbol}`);
}

// Stooq 專用 fetch
async function fetchStooqCsv(stooqSymbol) {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;
    return fetchMacroUrl(url, false, 9000);
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
        .filter(p => p && p.date && p.value !== null && p.value !== undefined && isFinite(p.value))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .map(p => ({ date: p.date, raw: p.value, value: p.value }));
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
    const json   = await fetchYahooJson(def.symbol);
    const result = json?.chart?.result?.[0];
    if (!result || json?.chart?.error) throw new Error(json?.chart?.error?.description || 'empty');
    const ts = result.timestamp || [];
    const cl = result.indicators?.quote?.[0]?.close || [];
    const series = ts.map((t, i) => {
        const r = cl[i];
        // 明確排除 null / undefined / NaN（isFinite(null) === true，需要額外檢查）
        if (r === null || r === undefined || !isFinite(r)) return null;
        return { date: new Date(t * 1000).toISOString().slice(0, 10), value: r };
    }).filter(Boolean);
    return makeDailyMacroFromSeries(def, series, 'Yahoo Finance');
}

async function fetchStooqMacro(def) {
    if (!def.stooq) throw new Error('no stooq');
    const csv    = await fetchStooqCsv(def.stooq);
    const lines  = String(csv || '').trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error('Stooq: empty');
    // 用 header 找 Close 欄位，避免欄數不一致
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const closeIdx = headers.indexOf('close');
    const dateIdx  = headers.indexOf('date');
    if (closeIdx < 0 || dateIdx < 0) throw new Error('Stooq: unexpected format');
    const series = lines.slice(1).map(line => {
        const p = line.split(',');
        const date = p[dateIdx]?.trim();
        const c    = Number(p[closeIdx]);
        return date && isFinite(c) && c > 0 ? { date, value: c } : null;
    }).filter(Boolean);
    if (series.length < 2) throw new Error('Stooq: not enough data');
    return makeDailyMacroFromSeries(def, series, 'Stooq');
}

async function fetchHistoryMacro(def) {
    if (!def.historyUrl) throw new Error('no history endpoint');
    const json   = await fetchMacroUrl(def.historyUrl, true, 9000);
    const series = extractMacroJsonSeries(json);
    const result = makeDailyMacroFromSeries(def, series, 'History of Market');
    // 若資料落後超過 1 個交易日（含週末：週一允許到週五，否則只允許昨天）
    // 簡單判斷：若資料日期不是「最近一個交易日」就 fallback
    const dataDate = new Date(result.date + 'T00:00:00Z');
    const now = new Date();
    const nowUtcDay = now.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
    // 計算最近交易日（美東時間收盤後約 UTC 21:00 才算「今天有資料」）
    // 保守起見：週一~週五，若 UTC 超過 22:00 則今天資料應存在；否則昨天
    const hourUTC = now.getUTCHours();
    let expectedDate = new Date(now);
    expectedDate.setUTCHours(0,0,0,0);
    // 若現在 UTC < 22:00（美股未收盤），期望資料是前一交易日
    if (hourUTC < 22) expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);
    // 往前跳過週末
    while ([0, 6].includes(expectedDate.getUTCDay()))
        expectedDate.setUTCDate(expectedDate.getUTCDate() - 1);

    if (dataDate < expectedDate)
        throw new Error(`historyofmarket stale: got ${result.date}, expected ${expectedDate.toISOString().slice(0,10)}`);
    return result;
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
    // 順序改為：快速直連優先 → Frankfurter (CORS OK) → historyofmarket → Yahoo/Stooq 並聯 → FRED 最後備援
    // 原本把 FRED 排第二，但 FRED CSV 需要過 CORS proxy，proxy 封鎖率極高，
    // 每個指標都卡 10s 後才 timeout，導致 guardedFetch(10000) 砍掉整個 fetch。
    const fastSources = [];
    if (def.frankBase)  fastSources.push(() => fetchFrankfurterFX(def));
    if (def.historyUrl) fastSources.push(() => fetchHistoryMacro(def));

    // Yahoo + Stooq 並聯搶快
    const parallelSources = [];
    if (def.symbol) parallelSources.push(() => fetchYahooMacro(def));
    if (def.stooq)  parallelSources.push(() => fetchStooqMacro(def));

    // FRED 最後備援（慢、proxy 易失敗，但有時能過）
    const slowSources = [];
    if (def.fredSeries) slowSources.push(() => fetchFredDailyMacro(def));

    if (!fastSources.length && !parallelSources.length && !slowSources.length)
        throw new Error(`no source for ${def.id}`);

    let lastErr;

    // 1. 先跑快速直連
    for (const fn of fastSources) {
        try { return await fn(); } catch (e) { lastErr = e; }
    }

    // 2. Yahoo / Stooq 並聯（取最快成功者）
    if (parallelSources.length) {
        try {
            return await Promise.any(parallelSources.map(fn => fn()));
        } catch (e) { lastErr = e?.errors?.[0] || e; }
    }

    // 3. FRED 備援
    for (const fn of slowSources) {
        try { return await fn(); } catch (e) { lastErr = e; }
    }

    throw lastErr || new Error(`all sources failed for ${def.id}`);
}

// ── FRED API Key（使用者可選填，免費申請：https://fred.stlouisfed.org/docs/api/api_key.html）
// 填入後走官方 JSON API，有正確 CORS header，完全不需要 proxy。
// 留空則走多重 proxy fallback。
const FRED_API_KEY = '8c585d6fcf7fa72274c20411ef079c63';

// ── 方法 A：FRED 官方 JSON API（需要 API key，直接 CORS，最穩）────────────────
async function fetchFredJsonApi(def) {
    if (!FRED_API_KEY) throw new Error('no FRED API key');
    const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(def.series)}&api_key=${FRED_API_KEY}&file_type=json&sort_order=asc&observation_start=1990-01-01`;

    // api.stlouisfed.org 封鎖 GitHub Pages 的 cross-origin fetch，
    // 必須透過 CORS proxy 轉發。用多個 proxy 並聯，取最快成功者。
    async function tryFredProxy(proxyUrl) {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 10000);
        try {
            const res = await fetch(proxyUrl, { signal: ctrl.signal, cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json?.error_code) throw new Error(`FRED error ${json.error_code}: ${json.error_message}`);
            const obs = json?.observations || json?.contents?.observations || [];
            if (!obs.length) {
                // allorigins wraps in { contents: "..." }
                const inner = typeof json?.contents === 'string' ? JSON.parse(json.contents) : null;
                if (inner?.error_code) throw new Error(`FRED error ${inner.error_code}: ${inner.error_message}`);
                const obs2 = inner?.observations || [];
                if (!obs2.length) throw new Error('no observations');
                return obs2;
            }
            return obs;
        } finally { clearTimeout(tid); }
    }

    async function tryAllorigins() {
        const wrapped = `https://api.allorigins.win/get?url=${encodeURIComponent(fredUrl)}`;
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 10000);
        try {
            const res = await fetch(wrapped, { signal: ctrl.signal, cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const w = await res.json();
            const inner = JSON.parse(w?.contents || '{}');
            if (inner?.error_code) throw new Error(`FRED error ${inner.error_code}: ${inner.error_message}`);
            const obs = inner?.observations || [];
            if (!obs.length) throw new Error('no observations');
            return obs;
        } finally { clearTimeout(tid); }
    }

    let obs;
    // 批次 1：corsproxy.io 直接轉發 JSON
    try {
        obs = await Promise.any([
            tryFredProxy(`https://corsproxy.io/?${encodeURIComponent(fredUrl)}`),
            tryFredProxy(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(fredUrl)}`),
            tryAllorigins(),
        ]);
    } catch {}

    // 批次 2：備援
    if (!obs) {
        try {
            obs = await Promise.any([
                tryFredProxy(`https://corsproxy.io/?${encodeURIComponent(fredUrl)}`),
                tryFredProxy(`https://proxy.cors.sh/${fredUrl}`),
            ]);
        } catch {}
    }

    if (!obs || !obs.length) throw new Error(`FRED API proxy unavailable for ${def.series}`);

    const rows = obs.map(o => {
        const v = parseFloat(o.value);
        if (!o.date || !isFinite(v)) return null;
        return { date: o.date, value: v };
    }).filter(Boolean);

    if (rows.length < 14) throw new Error(`FRED API: not enough data (${rows.length}) for ${def.series}`);
    return processFredRows(def, rows, 'FRED API');
}

// ── 方法 B：FRED CSV via proxy（不需 key，但 proxy 可能不穩）───────────────────
// 使用多個 proxy 並聯，增加成功率
async function fetchFredCsvProxy(def) {
    const fredUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(def.series)}`;

    // 同時嘗試多個 proxy，取最快成功者
    async function tryProxy(proxyUrl, allorigins = false) {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 9000);
        try {
            const res = await fetch(proxyUrl, { signal: ctrl.signal, cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            let text = await res.text();
            if (allorigins) { const w = JSON.parse(text); text = w?.contents || ''; }
            const firstLine = (text || '').split('\n')[0].replace('\r', '');
            if (!firstLine.toLowerCase().startsWith('date')) throw new Error('not CSV');
            if (text.length < 100) throw new Error('too short');
            return text;
        } finally { clearTimeout(tid); }
    }

    let csv;
    // 批次 1：3 個並聯
    try {
        csv = await Promise.any([
            tryProxy(`https://corsproxy.io/?${encodeURIComponent(fredUrl)}`),
            tryProxy(`https://api.allorigins.win/raw?url=${encodeURIComponent(fredUrl)}`),
            tryProxy(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(fredUrl)}`),
        ]);
    } catch {}

    // 批次 2：備援
    if (!csv) {
        try {
            csv = await Promise.any([
                tryProxy(`https://api.allorigins.win/get?url=${encodeURIComponent(fredUrl)}`, true),
                tryProxy(`https://thingproxy.freeboard.io/fetch/${fredUrl}`),
                tryProxy(`https://yacdn.org/proxy/${fredUrl}`),
            ]);
        } catch {}
    }

    if (!csv) throw new Error(`FRED ${def.series}: proxy unavailable`);
    const rows = parseMacroCsv(csv).filter(r => isFinite(r.value));
    if (rows.length < 14) throw new Error(`FRED ${def.series}: not enough data`);
    return processFredRows(def, rows, 'FRED CSV');
}

// ── 共用：把原始 rows 依 mode 計算成 trend 物件 ─────────────────────────────
function processFredRows(def, rows, source) {
    if (def.mode === 'yoy') {
        const yoy = [];
        for (let i = 12; i < rows.length; i++) {
            if (rows[i - 12].value !== 0)
                yoy.push({ date: rows[i].date, value: ((rows[i].value / rows[i - 12].value) - 1) * 100 });
        }
        if (!yoy.length) throw new Error(`${source}: yoy calc failed`);
        const latest = yoy[yoy.length - 1]; const prev = yoy[yoy.length - 2];
        const raw = rows[rows.length - 1];   const rawP = rows[rows.length - 2];
        return { ...def, date: latest.date, value: latest.value, source,
            change: latest.value - prev.value,
            mom:    ((raw.value / rawP.value) - 1) * 100, series: yoy };
    }
    if (def.mode === 'mom_diff') {
        const latest = rows[rows.length - 1]; const prev = rows[rows.length - 2];
        const diffs  = rows.slice(1).map((r, i) => ({ date: r.date, value: r.value - rows[i].value }));
        return { ...def, date: latest.date, value: latest.value, source,
            change: latest.value - prev.value, mom: latest.value - prev.value, series: diffs };
    }
    if (def.mode === 'mom_pct') {
        const latest = rows[rows.length - 1]; const prev = rows[rows.length - 2];
        const pcts   = rows.slice(1).map((r, i) => ({
            date: r.date, value: rows[i].value !== 0 ? ((r.value / rows[i].value) - 1) * 100 : 0
        }));
        return { ...def, date: latest.date, value: latest.value, source,
            change: latest.value - prev.value,
            mom: prev.value !== 0 ? ((latest.value / prev.value) - 1) * 100 : 0, series: pcts };
    }
    const latest = rows[rows.length - 1]; const prev = rows[rows.length - 2];
    return { ...def, date: latest.date, value: latest.value, source,
        change: latest.value - prev.value, series: rows };
}

async function fetchFredMacro(def) {
    // 先試 JSON API（有 key 時直接成功），否則走 proxy CSV
    try { return await fetchFredJsonApi(def); } catch {}
    return fetchFredCsvProxy(def);
}

async function fetchTrendMacro(def) {
    const trySeries = async (d) => {
        let apiErr;
        try { return await fetchFredJsonApi(d); }
        catch (e) { apiErr = e; console.warn(`[FRED API] ${d.series}:`, e.message); }
        return fetchFredCsvProxy(d);
    };
    try {
        return await trySeries(def);
    } catch (err) {
        if (!def.fallbackSeries) throw err;
        return trySeries({
            ...def, series: def.fallbackSeries,
            name: def.fallbackName || def.name,
            note: def.fallbackNote || def.note,
            isFallback: true
        });
    }
}

// ── 台灣景氣對策信號：NDC 內部 API + 政府開放資料 ───────────────────────────
async function fetchNdcLightscore() {
    if (!WORKER_PROXY_URL) throw new Error('需要 Cloudflare Worker');
    const url = 'https://index.ndc.gov.tw/n/json/lightscore';
    const enc = encodeURIComponent(url);
    const res = await fetchWithTimeout(`${WORKER_PROXY_URL}/?url=${enc}`, {}, 8000);
    if (!res.ok) throw new Error(`Worker HTTP ${res.status}`);
    const json = await res.json();
    console.log('[NDC lightscore] raw:', JSON.stringify(json).slice(0, 300));

    // 回傳格式待確認，嘗試多種結構
    const data = Array.isArray(json) ? json[0] : (json?.data?.[0] || json?.result?.[0] || json);
    if (!data) throw new Error('lightscore: empty response');

    const scoreRaw  = data['score']  || data['Score']  || data['綜合判斷分數'] || data['composite'] || '';
    const signalRaw = data['signal'] || data['Signal'] || data['燈號']        || data['light']     || data['color'] || '';
    const period    = data['period'] || data['Period'] || data['yearMonth']   || data['date']       || data['ym']    || '';
    const score     = parseInt(scoreRaw);

    const sig = isFinite(score) && score > 0 ? ndcScoreToSignal(score)
              : signalRaw ? ndcLabelToSignal(String(signalRaw)) : null;
    if (!sig) throw new Error(`lightscore: cannot parse — keys: ${Object.keys(data).join(',')}, data: ${JSON.stringify(data).slice(0,150)}`);

    return {
        signal: sig,
        score:  isFinite(score) && score > 0 ? score : null,
        date:   String(period).replace(/(\d{4})(\d{2})/, '$1/$2'),
        source: 'index.ndc.gov.tw',
        note:   '資料來源：國發會景氣指標'
    };
}

async function fetchNdcFromDataGov() {
    if (!WORKER_PROXY_URL) throw new Error('需要 Cloudflare Worker');
    const url = 'https://data.gov.tw/api/v2/rest/datastore/301000000A-000080-001?limit=3&sort=period+desc';
    const enc = encodeURIComponent(url);
    const res = await fetchWithTimeout(`${WORKER_PROXY_URL}/?url=${enc}`, {}, 8000);
    if (!res.ok) throw new Error(`Worker HTTP ${res.status} for data.gov.tw`);
    const json = await res.json();
    const records = json?.result?.records || json?.records || [];
    if (!records.length) {
        console.warn('[NDC] data.gov.tw response:', JSON.stringify(json).slice(0, 300));
        throw new Error('data.gov.tw: no records');
    }
    const rec = records[0];
    console.log('[NDC] record keys:', Object.keys(rec), JSON.stringify(rec).slice(0, 200));
    const period    = rec['period']  || rec['年月']       || rec['date']  || rec['ym']    || '';
    const scoreRaw  = rec['score']   || rec['綜合判斷分數'] || rec['composite_score']      || '';
    const signalRaw = rec['signal']  || rec['燈號']       || rec['light'] || rec['color'] || '';
    const score     = parseInt(scoreRaw);
    const sig = isFinite(score) && score > 0 ? ndcScoreToSignal(score)
              : signalRaw ? ndcLabelToSignal(String(signalRaw)) : null;
    if (!sig) throw new Error(`data.gov.tw: cannot parse — keys: ${Object.keys(rec).join(',')}`);
    return {
        signal: sig, score: isFinite(score) && score > 0 ? score : null,
        date: String(period).replace(/(\d{4})(\d{2})/, '$1/$2'),
        source: 'data.gov.tw', note: '資料來源：政府開放資料平台 景氣對策信號'
    };
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
    // 1. NDC 內部 lightscore API（最直接）
    if (WORKER_PROXY_URL) {
        try {
            const r = await fetchNdcLightscore();
            return { id: 'ndc', status: 'ok', ...r };
        } catch (e) { console.warn('[NDC] lightscore failed:', e.message); }
    }

    // 2. 政府開放資料 API
    try {
        const r = await fetchNdcFromDataGov();
        return { id: 'ndc', status: 'ok', ...r };
    } catch (e) { console.warn('[NDC] data.gov.tw failed:', e.message); }

    // 3. NDC 官網 HTML（SPA，成功率低）
    try {
        const r = await tryNdcWebsite();
        return { id: 'ndc', status: 'ok', ...r };
    } catch {}

    return {
        id: 'ndc', status: 'failed',
        signal: null, score: null, date: '--', source: '',
        note: '燈號資料暫時無法取得，請點下方連結至官網查詢。',
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
    if (message === '載入中...') {
        return `<div class="macro-card" style="opacity:0.35;">
            <span class="macro-label">${name}</span>
            <span class="macro-value" style="font-size:20px;color:#475569;">…</span>
        </div>`;
    }
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
    if (item.id === 'sentiment') valueColor = macroColor(item.change, false);

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

    bindSparklineTooltips(macroBodyEl);
}

// ── Sparkline 互動 tooltip ────────────────────────────────────────────────────
function bindSparklineTooltips(container) {
    container.querySelectorAll('.macro-spark-svg').forEach(svg => {
        const wrap    = svg.closest('.macro-spark-wrap');
        const tooltip = wrap?.querySelector('.spark-tooltip');
        const cursor  = svg.querySelector('.spark-cursor');
        const dotH    = svg.querySelector('.spark-dot-hover');
        if (!tooltip || !cursor || !dotH) return;

        let series;
        try { series = JSON.parse(svg.dataset.series); } catch { return; }
        if (!series || series.length < 2) return;

        const pad   = +svg.dataset.pad;
        const w     = +svg.dataset.w;
        const h     = +svg.dataset.h;
        const min   = +svg.dataset.min;
        const range = +svg.dataset.range;
        const n     = series.length;

        function getIndex(clientX) {
            const rect = svg.getBoundingClientRect();
            const ratio = (clientX - rect.left) / rect.width;
            return Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
        }

        function update(clientX) {
            const i   = getIndex(clientX);
            const pt  = series[i];
            const x   = pad + (i / (n - 1)) * (w - pad * 2);
            const y   = h - pad - ((pt.v - min) / range) * (h - pad * 2);

            cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
            dotH.setAttribute('cx', x);   dotH.setAttribute('cy', y);

            // 格式化數值
            const val = Math.abs(pt.v) >= 1000
                ? pt.v.toLocaleString('zh-TW', { maximumFractionDigits: 0 })
                : pt.v.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            tooltip.textContent = `${pt.d}  ${val}`;
            tooltip.style.display = 'block';

            // tooltip 水平定位：跟著游標但不超出 wrap
            const wrapW = wrap.offsetWidth;
            const tipW  = tooltip.offsetWidth || 120;
            const xPct  = x / w * 100;
            const leftPx = (x / w) * wrapW;
            let finalLeft = leftPx;
            if (finalLeft - tipW / 2 < 0) finalLeft = tipW / 2;
            if (finalLeft + tipW / 2 > wrapW) finalLeft = wrapW - tipW / 2;
            tooltip.style.left = `${finalLeft}px`;
        }

        function hide() {
            cursor.setAttribute('x1', -100); cursor.setAttribute('x2', -100);
            dotH.setAttribute('cx', -100);   dotH.setAttribute('cy', -100);
            tooltip.style.display = 'none';
        }

        svg.addEventListener('mousemove', e => update(e.clientX));
        svg.addEventListener('mouseleave', hide);
        svg.addEventListener('touchmove', e => {
            e.preventDefault();
            update(e.touches[0].clientX);
        }, { passive: false });
        svg.addEventListener('touchend', hide);
    });
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
    };

    const wrapDaily = def => guardedFetch(
        () => fetchDailyMacro(def), 12000,
        { ...def, error: 'timeout' }
    ).then(r => { tick(); return r; });

    const wrapTrend = def => guardedFetch(
        () => fetchTrendMacro(def), 18000,   // econdb 最多 8s + FRED fallback 最多 8s
        { ...def, error: 'timeout' }
    ).then(r => { tick(); return r; });

    const ndcFallback = { id:'ndc', status:'failed', signal:null, score:null,
        date:'--', source:'', note:'連線逾時，請稍後重試。', isProxy:false };

    // Promise.all：全部同時起跑，每個最多等 10/12s，總時間 = max(個別時間) ≤ 12s
    const [dailyResults, trendResults, ndc] = await Promise.all([
        Promise.all(DAILY_MACRO_SYMBOLS.map(wrapDaily)),
        Promise.all(TREND_MACRO_SERIES.map(wrapTrend)),
        guardedFetch(() => fetchNdcMacroInfo(), 12000, ndcFallback)
    ]);
    return { fetchedAt: new Date().toISOString(), daily: dailyResults, trends: trendResults, ndc };
}

//  公開介面 

window.loadMacroDashboard = async function loadMacroDashboard(force = false) {
    const macroBodyEl     = document.getElementById('macroBody');
    const macroRefreshBtn = document.getElementById('macroRefreshBtn');
    const macroStatusEl   = document.getElementById('macroStatus');
    if (!macroBodyEl) return;

    // 讀快取
    if (!force) {
        try {
            const cached = JSON.parse(localStorage.getItem(MACRO_CACHE_KEY) || 'null');
            if (cached?.fetchedAt && Date.now() - new Date(cached.fetchedAt).getTime() < MACRO_CACHE_TTL_MS) {
                renderMacroDashboard(cached, true);
                return;
            }
        } catch {}
    }

    if (macroRefreshBtn) { macroRefreshBtn.disabled = true; macroRefreshBtn.textContent = '更新中...'; }

    // ── 立即顯示空框架（不等任何 API）────────────────────────────────────────
    const state = {
        fetchedAt: new Date().toISOString(),
        daily:  DAILY_MACRO_SYMBOLS.map(d => ({ ...d, error: '載入中...' })),
        trends: TREND_MACRO_SERIES.map(d => ({ ...d, error: '載入中...' })),
        ndc:    { id:'ndc', status:'failed', signal:null, score:null,
                  date:'--', source:'', note:'載入中...', isProxy:false }
    };
    renderMacroDashboard(state, false);  // t=0 立即可見

    const ndcFallback = { id:'ndc', status:'failed', signal:null, score:null,
        date:'--', source:'', note:'連線逾時，請稍後重試。', isProxy:false };

    // ── 所有 fetch 並行，各自完成後更新 state ─────────────────────────────────
    const allPromises = [
        ...DAILY_MACRO_SYMBOLS.map((def, i) =>
            guardedFetch(() => fetchDailyMacro(def), 12000, { ...def, error: 'timeout' })
            .then(r => { state.daily[i] = r; })
        ),
        ...TREND_MACRO_SERIES.map((def, i) =>
            guardedFetch(() => fetchTrendMacro(def), 18000, { ...def, error: 'timeout' })
            .then(r => { state.trends[i] = r; })
        ),
        guardedFetch(() => fetchNdcMacroInfo(), 12000, ndcFallback)
            .then(r => { state.ndc = r; })
    ];

    // ── 每 2 秒重新渲染（讓使用者看到陸續完成的資料）────────────────────────
    const refreshInterval = setInterval(() => {
        renderMacroDashboard(state, false);
    }, 2000);

    // ── 全部完成後最終渲染 + 存快取 ─────────────────────────────────────────
    Promise.all(allPromises).then(() => {
        clearInterval(refreshInterval);
        state.fetchedAt = new Date().toISOString();
        renderMacroDashboard(state, false);
        try {
            const slim = {
                ...state,
                daily:  state.daily.map(x => ({ ...x, series: (x.series||[]).slice(-60) })),
                trends: state.trends.map(x => ({ ...x, series: (x.series||[]).slice(-60) })),
            };
            localStorage.setItem(MACRO_CACHE_KEY, JSON.stringify(slim));
        } catch {}
        if (macroStatusEl) {
            const ok = state.daily.filter(x => !x.error || x.error === 'timeout').length;
            macroStatusEl.textContent = `即時 · ${new Date(state.fetchedAt).toLocaleString('zh-TW')} · 每日指標 ${state.daily.filter(x=>!x.error).length}/${DAILY_MACRO_SYMBOLS.length} 項成功`;
        }
    }).finally(() => {
        if (macroRefreshBtn) { macroRefreshBtn.disabled = false; macroRefreshBtn.textContent = '↻ 更新'; }
    });
};
