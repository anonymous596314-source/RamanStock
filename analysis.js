// analysis.js
window._fetchLogs = [`--- 腳本載入時間: ${new Date().toLocaleTimeString()} ---` || []];
window.onerror = function(msg, url, line) {
    window._fetchLogs.push(`[ERROR] ${msg} (Line: ${line})`);
    return false;
};

// === UI & Initialization ===
const analysisModal = document.getElementById('analysisModal');
const closeAnalysisBtn = document.getElementById('closeAnalysisBtn');
const analysisTitle = document.getElementById('analysisTitle');
const analysisBody = document.getElementById('analysisBody');

// === 全域分析設定 (可透過 Console 調整：ANALYSIS_CONFIG.riskFreeRate = 4.5) ===
const ANALYSIS_CONFIG = {
    riskFreeRate: 4.2  // 預設 10 年期美債殖利率 (無風險利率)
};

// Close modal handlers
closeAnalysisBtn.addEventListener('click', () => {
    analysisModal.classList.remove('active');
    if (window.toggleMagnifierMode) window.toggleMagnifierMode(false);
});

analysisModal.addEventListener('click', (e) => {
    if (e.target === analysisModal) {
        analysisModal.classList.remove('active');
        if (window.toggleMagnifierMode) window.toggleMagnifierMode(false);
    }
});

// Use event delegation for dynamically created buttons
document.body.addEventListener('click', async (e) => {
    if (e.target.closest('.btn-analyze')) {
        const btn = e.target.closest('.btn-analyze');
        const symbol = btn.getAttribute('data-code');
        const name = btn.getAttribute('data-name');
        const avgCost = btn.getAttribute('data-avg-cost');
        
        openAnalysisModal(symbol, name, avgCost);
    }
});

// Listen for global price updates to sync the modal if it's open
window.addEventListener('stockPricesUpdated', (e) => {
    if (analysisModal.classList.contains('active')) {
        // Here we could trigger a partial re-render or a full refresh
        // For simplicity and to avoid excessive API calls, we just update the price-related DOM elements if we can find them
        // But the user's requirement is to "update together", so we might want to at least notify or refresh the view.
        console.log('[Analysis Sync] Global prices updated, modal is active.');
    }
});

// Caches for APIs to avoid repeated large fetches
let twseBasicCache = null;

// === 智能並行限制器 (取代舊的 finmindQueue 單一串行鎖) ===
function createRateLimiter(maxConcurrent, minIntervalMs) {
    let running = 0;
    const queue = [];

    const tryRun = () => {
        while (running < maxConcurrent && queue.length > 0) {
            const { fn, resolve, reject } = queue.shift();
            running++;
            fn().then(
                (result) => { 
                    running--; 
                    setTimeout(tryRun, minIntervalMs); 
                    resolve(result); 
                },
                (err) => { 
                    running--; 
                    setTimeout(tryRun, minIntervalMs); 
                    reject(err); 
                }
            );
        }
    };

    return (fn) => new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        tryRun();
    });
}

// 各 domain 獨立限制，互不影響
// finmind: 同時最多 3 個請求，每完成一個後間隔 150ms → 較舊版快 ~40%，仍安全
const finmindLimiter  = createRateLimiter(3, 150);
// scraping (moneydj/fbs): 同時最多 2 個，間隔 350ms
const scrapingLimiter = createRateLimiter(2, 350);

// === Global Connection Engine ===
async function analysisFetchProxy(url, isJson = false) {
    window._fetchLogs = window._fetchLogs || [];
    const log = (msg) => {
        try {
            console.log(msg);
            window._fetchLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
            if (window._fetchLogs.length > 30) window._fetchLogs.shift();
        } catch(e) {}
    };

    const proxies = [
        (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
        (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
        (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
        (u) => `https://yacdn.org/proxy/${encodeURIComponent(u)}`,
        (u) => `https://cors-proxy.org/?url=${encodeURIComponent(u)}`
    ];

    // 代理成功記憶：記住每個來源 domain 上次成功的代理索引
    window._vpHint = window._vpHint || {};
    const domain = (url.match(/\/\/([\w.-]+)/) || [])[1] || 'other';
    const hintIdx = (window._vpHint[domain] !== undefined) ? window._vpHint[domain] : -1; // -1=直連

    // 單次 fetch（含逾時中斷）
    async function tryFetch(targetUrl, timeout = 7000) {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), timeout);
        try {
            const opts = { signal: controller.signal };
            if (targetUrl === url) opts.headers = { 'Cache-Control': 'no-cache' };
            const res = await fetch(targetUrl, opts);
            clearTimeout(tid);
            if (res.status === 429) throw new Error('HTTP 429');
            const buffer = await res.arrayBuffer();
            const enc = (url.includes('moneydj.com') || url.includes('fbs.com.tw')) ? 'big5' : 'utf-8';
            let text = new TextDecoder(enc).decode(buffer).trim();
            if (targetUrl.includes('allorigins.win/get')) {
                try { text = JSON.parse(text).contents; } catch(e) {}
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return text;
        } catch (e) {
            clearTimeout(tid);
            throw e;
        }
    }

    // 帶速率限制的直連（僅對直連請求套用，代理請求不套用以避免阻塞）
    async function tryFetchDirect(timeout = 5000) {
        const isFinMind = url.includes('finmindtrade.com');
        const isScraping = url.includes('moneydj.com') || url.includes('fbs.com.tw') || url.includes('norway.twsthr.info');
        if (isFinMind)  return finmindLimiter(() => tryFetch(url, timeout));
        if (isScraping) return scrapingLimiter(() => tryFetch(url, timeout));
        return tryFetch(url, timeout);
    }

    // 競速函數：同時啟動多個 task，最快成功者獲勝；全敗才 reject
    function raceSuccess(taskFns) {
        return new Promise((resolve, reject) => {
            let fails = 0;
            let done = false;
            const n = taskFns.length;
            taskFns.forEach(fn => {
                fn().then(r  => { if (!done) { done = true; resolve(r); } })
                    .catch(() => { if (++fails === n && !done) { done = true; reject(new Error('all failed')); } });
            });
        });
    }

    const parseResponse = (text) => {
        if (!isJson) return text;
        try {
            const parsed = JSON.parse(text);
            if (parsed?.status && parsed.status !== 200 && parsed.msg) throw new Error(`API ${parsed.status}: ${parsed.msg}`);
            if (Array.isArray(parsed)) return { status: 200, data: parsed };
            if (parsed && !parsed.data && !parsed.chart) {
                if (parsed.msg || parsed.error) throw new Error(parsed.msg || parsed.error);
                return { status: 200, data: [parsed] };
            }
            return parsed;
        } catch(e) {
            if (text.length < 5) throw new Error('回傳數據格式不正確 (Empty)');
            throw new Error(`JSON 解析失敗: ${e.message.substring(0, 20)}`);
        }
    };

    log(`🌐 ${url.substring(0, 50)}...`);

    // ── 第一階段：直連 + 上次成功的代理 同時競速（最快路徑）──
    const phase1 = [() => tryFetchDirect(5000)];
    if (hintIdx >= 0 && hintIdx < proxies.length) {
        phase1.push(() => tryFetch(proxies[hintIdx](url), 7000).then(r => {
            window._vpHint[domain] = hintIdx; return r;
        }));
    }
    try {
        const text = await raceSuccess(phase1);
        log('✅ 快速通道成功');
        return parseResponse(text);
    } catch(e) {
        log('⚡ 快速通道全敗，競速前三代理...');
    }

    // ── 第二階段：同時競速前三個 proxy（排除已在第一階段試過的 hint）──
    const phase2 = [];
    for (let i = 0; i < 3; i++) {
        if (i === hintIdx) continue;
        const pi = i;
        phase2.push(() => tryFetch(proxies[pi](url), 7000).then(r => {
            window._vpHint[domain] = pi; return r;
        }));
    }
    if (phase2.length > 0) {
        try {
            const text = await raceSuccess(phase2);
            log('✅ 代理競速成功');
            return parseResponse(text);
        } catch(e) {
            log('❌ 前三代理均失敗，嘗試備援代理...');
        }
    }

    // ── 第三階段：備援代理循序嘗試 ──
    for (let i = 3; i < proxies.length; i++) {
        if (i === hintIdx) continue;
        try {
            log(`🔄 備援代理 ${i + 1}...`);
            const text = await tryFetch(proxies[i](url), 7000);
            window._vpHint[domain] = i;
            log(`✅ 備援代理 ${i + 1} 成功`);
            return parseResponse(text);
        } catch(e) {
            log(`❌ 備援代理 ${i + 1} 失敗`);
        }
    }

    throw new Error('所有連線管道皆失敗，請檢查網路或稍後重試。');
}

async function fetchStockChart(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const log = (msg) => { 
        window._fetchLogs = window._fetchLogs || [];
        window._fetchLogs.push(`[${new Date().toLocaleTimeString()}] [Chart] ${msg}`);
    };
    log(`Fetch start for ${rawSymbol}`);
    
    const d = new Date();
    d.setDate(d.getDate() - 2100); 
    let startDate = d.toISOString().split('T')[0];
    let url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${rawSymbol}&start_date=${startDate}&cb=${Date.now()}`;
    
    // ── 股價資料抓取（重構為 flat 結構，例外與空資料均可 fallback）────────────────
    // 舊版深度巢狀 try/catch 只在 exception 時 fallback；
    // 若 FinMind 靜默降級回傳 {data:[]} 則永遠到不了 Yahoo。
    // 新版：helper 同時處理「拋例外」與「回傳空陣列」兩種失敗情境。
    const _tryFM = async (fmUrl) => {
        try {
            const _r = await analysisFetchProxy(fmUrl, true);
            return (_r?.data?.length > 0) ? _r : null;
        } catch (_e) { return null; }
    };

    const _tryYahoo = async () => {
        // 4 碼：上市 .TW 優先，上櫃 .TWO 備援（如 2831）；5 碼以上反之
        const _syms = rawSymbol.length === 4
            ? [`${rawSymbol}.TW`, `${rawSymbol}.TWO`]
            : [`${rawSymbol}.TWO`, `${rawSymbol}.TW`];
        for (const _sym of _syms) {
            try {
                const _yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${_sym}?range=5y&interval=1d&cb=${Date.now()}`;
                const _yRes = await analysisFetchProxy(_yUrl, true);
                const _r    = _yRes?.chart?.result?.[0];
                if (_r?.timestamp?.length > 0) {
                    log(`Yahoo OK: ${_sym} (${_r.timestamp.length} pts)`);
                    const _q = _r.indicators?.quote?.[0] || {};
                    const _adjArr = _r.indicators?.adjclose?.[0]?.adjclose; // B方案：還原股價
                    return {
                        _yahooSym: _sym,
                        data: _r.timestamp.map((t, i) => ({
                            date           : new Date(t * 1000).toISOString().split('T')[0],
                            close          : _q.close?.[i]  ?? null,
                            adj_close      : _adjArr?.[i]   ?? null,  // B方案：有值才填入
                            max            : _q.high?.[i]   ?? null,
                            min            : _q.low?.[i]    ?? null,
                            trading_volume : _q.volume?.[i] ?? 0
                        })).filter(x => x.close != null && x.close > 0)
                    };
                }
            } catch (_ey) { log(`Yahoo fail ${_sym}: ${_ey.message}`); }
        }
        return null;
    };

    // FinMind: 5Y → 1Y → 90D；任一成功即停止
    const _d1y = new Date(); _d1y.setDate(_d1y.getDate() - 365);
    const _d90 = new Date(); _d90.setDate(_d90.getDate() - 90);
    let json =
        await _tryFM(url) ||
        (log('FM 5Y null → 1Y'), await _tryFM(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${rawSymbol}&start_date=${_d1y.toISOString().split('T')[0]}&cb=${Date.now()}`)) ||
        (log('FM 1Y null → 90D'), await _tryFM(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${rawSymbol}&start_date=${_d90.toISOString().split('T')[0]}&cb=${Date.now()}`)) ||
        (log('FM 90D null → Yahoo'), await _tryYahoo());

    if (!json) {
        throw new Error(`無法取得股價資料 (${rawSymbol})：FinMind 各時間窗口與 Yahoo Finance (.TW/.TWO) 均失敗。請確認代號正確或稍後重試。`);
    }

    try {
        if (!json || !json.data || json.data.length === 0) {
            log(`Final data check failed. Json: ${!!json}, DataLen: ${json?.data?.length}`);
            throw new Error(`無歷史股價資料 (代號: ${rawSymbol})。可能尚未產生有效交易價格或數據源連線受阻。`);
        }
        
        // 增加欄位容錯性
        const getP = (item) => (item.close || item.Close || item.price || item.Price || 0);
        const getV = (item) => (item.Trading_Volume || item.trading_volume || item.volume || item.Volume || item.Trading_Turnover || 0);
        const getH = (item) => (item.max || item.High || item.Max || item.high || getP(item));
        const getL = (item) => (item.min || item.Low || item.Min || item.low || getP(item));

        const data = json.data
            .filter(item => getP(item) > 0)
            .sort((a, b) => (a.date || a.Date || '').localeCompare(b.date || b.Date || ''));
        if (data.length === 0) {
            const keys = Object.keys(json.data[0] || {}).join(', ');
            log(`Filtered data is empty. Original: ${json.data.length}. Keys: ${keys}`);
            throw new Error(`股價解析失敗 (代號: ${rawSymbol})。<br>API 回傳欄位: [${keys}]<br>原因：找不到有效收盤價。請嘗試點擊「全數重抓」。`);
        }
        log(`Processing ${data.length} records...`);
        
        const closes = data.map(item => getP(item));
        const highs  = data.map(item => getH(item));
        const lows   = data.map(item => getL(item));
        const vols   = data.map(item => getV(item));
        const currentPrice = closes[closes.length - 1];
        
        const ma5   = calcMA(closes, 5);
        const ma10  = calcMA(closes, 10);
        const ma20  = calcMA(closes, 20);
        const ma60  = calcMA(closes, 60);
        const ma120 = calcMA(closes, 120);
        const ma240 = calcMA(closes, 240);
        const recentHighs = highs.slice(-252);
        const recentLows  = lows.slice(-252);
        const high52w = Math.max(...recentHighs);
        const low52w  = Math.min(...recentLows);
        // 修正：posIn52w 應為數值型別，避免字串比較的隱式轉型問題
        const posIn52w = (high52w - low52w) > 0 ? parseFloat(safeFix(((currentPrice - low52w) / (high52w - low52w) * 100), 1)) : 0;
        const rsi14 = calcRSI(closes, 14);
        const bb = calcBollinger(closes, 20, 2);
        const avgVol5 = vols.length >= 5 ? Math.round(vols.slice(-5).reduce((a,b)=>a+b,0) / 5) : null;
        const kd = calcKD(highs, lows, closes, 9);
        const macd = calcMACD(closes, 12, 26, 9);
        const calcReturn = (days) => {
            const idx = closes.length - 1 - days;
            if (idx < 0 || !closes[idx]) return null;
            return ((currentPrice - closes[idx]) / closes[idx] * 100);
        };
        const price10d = calcReturn(10);
        const price1m = calcReturn(20);
        const price3m = calcReturn(60);
        const mom6m = calcReturn(126);
        const mom1y = calcReturn(252);
        const mom2y = calcReturn(504);
        const mom3y = calcReturn(756);
        const mom4y = calcReturn(1008);
        const mom5y = calcReturn(1260);
        const lastYearEndData = data.filter(x => new Date(x.date).getFullYear() < new Date().getFullYear()).pop();
        const momYTD = lastYearEndData ? ((currentPrice - lastYearEndData.close) / lastYearEndData.close * 100) : null;

        return {
            prices: data, currentPrice, ma: { ma5, ma10, ma20, ma60, ma120, ma240 },
            high52w, low52w, posIn52w, rsi14, bb, latestVol: vols[vols.length - 1], avgVol5, kd, macd,
            price10d, price1m, price3m, mom6m, mom1y, mom2y, mom3y, mom4y, mom5y, momYTD,
            goldenCross: (ma5 > ma20 && ma20 > ma60), deathCross: (ma5 < ma20 && ma20 < ma60)
        };
    } catch (e) {
        window._lastFetchError = e.message;
        throw e;
    }
}

async function openAnalysisModal(symbol, name, avgCost = null, forceRefresh = false, partialResults = null) {
    // 生成唯一 Session ID 並存入全域，用於防止舊有異步回調干擾 UI
    const sessionId = Date.now() + Math.random();
    window._currentAnalysisSessionId = sessionId;

    // 清除舊有的計時器以防顯示錯亂
    if (window._analysisTimerInterval) {
        clearInterval(window._analysisTimerInterval);
        window._analysisTimerInterval = null;
    }

    analysisModal.classList.add('active');

    // Show Loading
    analysisBody.innerHTML = `
        <div class="analysis-loading">
            <div class="analysis-spinner"></div>
            <span id="analysisLoadingStatus">${partialResults ? '正在修補缺失數據...' : '正在初始化數據引擎...'}</span>
            <div id="analysisTimer" style="font-size:14px; color:#60a5fa; margin-top:8px; font-family:monospace; font-weight:bold;">已耗時: 0.0s</div>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">(初次載入約 15-30 秒，快取命中 &lt; 1 秒)</div>
            <div style="margin-top:15px;">
                <div id="analysisProgressBar" style="width:200px; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin:0 auto 10px; overflow:hidden;">
                    <div id="analysisProgressInner" style="width:${partialResults ? '50' : '10'}%; height:100%; background:#3b82f6; transition:width 0.3s;"></div>
                </div>
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}', true)" 
                        style="background:transparent; color:#94a3b8; border:1px solid #475569; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:11px;">
                    ⌛ 載入過久？強制重試 (跳過快取)
                </button>
            </div>
        </div>
    `;

    const startTime = Date.now();
    window._analysisTimerInterval = setInterval(() => {
        // 同樣檢查 Session ID
        if (window._currentAnalysisSessionId !== sessionId) {
            clearInterval(window._analysisTimerInterval);
            return;
        }
        const el = document.getElementById('analysisTimer');
        if (el) {
            el.textContent = `已耗時: ${((Date.now() - startTime) / 1000).toFixed(1)}s`;
        } else {
            clearInterval(window._analysisTimerInterval);
            window._analysisTimerInterval = null;
        }
    }, 100);

    const updateStatus = (msg, progress) => {
        // 僅允許當前活躍的 Session 更新 UI
        if (window._currentAnalysisSessionId !== sessionId) return;
        const el = document.getElementById('analysisLoadingStatus');
        const bar = document.getElementById('analysisProgressInner');
        if (el) el.textContent = msg;
        if (bar) bar.style.width = `${progress}%`;
    };

    let finalSymbol = symbol.trim().toUpperCase();
    let displayName = name;
    
    // 全域緩存與名稱解析邏輯
    try {
        // 嘗試從 localStorage 恢復台股清單 (快取 7 天)
        if (!window.allStockInfoCache) {
            const stored = localStorage.getItem('all_stock_info_cache_v1');
            if (stored) {
                const { data, timestamp } = JSON.parse(stored);
                if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
                    window.allStockInfoCache = data;
                }
            }
        }

        const isNumeric = /^\d{4,6}$/.test(finalSymbol);
        
        // 1. 如果有快取，優先從快取找
        if (window.allStockInfoCache) {
            const found = window.allStockInfoCache.find(x => x.stock_id === finalSymbol || x.stock_name === symbol);
            if (found) {
                finalSymbol = found.stock_id;
                displayName = found.stock_name;
            } else if (!isNumeric) {
                const fuzzy = window.allStockInfoCache.find(x => x.stock_name.includes(symbol));
                if (fuzzy) {
                    finalSymbol = fuzzy.stock_id;
                    displayName = fuzzy.stock_name;
                }
            }
        }
        
        // 2. 如果還是沒名稱 (例如輸入 2330 且無快取)，發起單一 ID 的快速查詢
        if (displayName === finalSymbol || !displayName) {
            analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${finalSymbol}`, true)
                .then(json => {
                    if (json && json.data && json.data[0]) {
                        displayName = json.data[0].stock_name;
                        const dName = (displayName && displayName !== finalSymbol) ? displayName : "股票";
                        analysisTitle.textContent = `📊 ${dName} (${finalSymbol}) 分析報告`;
                    }
                }).catch(() => {});
        }

        if (!isNumeric && !window.allStockInfoCache) {
            updateStatus("正在建立安全連線與下載股票清單 (大型數據預計 5-10 秒)...", 5);
            const json = await analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo`, true);
            if (json && json.data) {
                window.allStockInfoCache = json.data;
                localStorage.setItem('all_stock_info_cache_v1', JSON.stringify({
                    data: json.data,
                    timestamp: Date.now()
                }));
            }
            if (window.allStockInfoCache) {
                const found = window.allStockInfoCache.find(x => x.stock_id === finalSymbol || x.stock_name === symbol);
                if (found) {
                    finalSymbol = found.stock_id;
                    displayName = found.stock_name;
                }
            }
        }
    } catch(e) {
        console.warn("Stock info resolution failed", e);
    }

    const displayTitleName = (displayName && displayName !== finalSymbol && !/^\d+$/.test(displayName)) ? displayName : "股票";
    analysisTitle.textContent = `📊 ${displayTitleName} (${finalSymbol}) 分析報告`;
    const headerPrice = document.getElementById('analysisHeaderPrice');
    if (headerPrice) headerPrice.textContent = ''; // 清空等待載入
    window._fetchLogs = window._fetchLogs || [];
    window._fetchLogs.push(`--- 開始分析 ${finalSymbol} (${new Date().toLocaleTimeString()}) ${partialResults ? '[PARTIAL RETRY]' : ''} ---`);

    try {
        if (forceRefresh) {
            const allKeys = Object.keys(localStorage);
            allKeys.forEach(k => { if (k.startsWith(ANALYSIS_CACHE_PREFIX)) localStorage.removeItem(k); });
        }
        
        const cacheKey = `${finalSymbol}_v21`; 
        let cachedResults = (forceRefresh || partialResults) ? null : getCachedAnalysis(cacheKey);
        
        if (cachedResults && !cachedResults[0]) cachedResults = null;

        // ── 快取過期檢查：若快取中的財報最新日期超過 100 天前，強制重抓 ─────────
        // 原因：8 小時 TTL 不夠用來強制取得新一季財報（季報更新週期遠超 8 小時）
        if (cachedResults) {
            try {
                const _cachedFin = cachedResults[6]; // index 6 = finDataRaw
                const _cachedFinDate = _cachedFin?.quarter || _cachedFin?.latestDate || '';
                if (_cachedFinDate) {
                    const _daysOld = (Date.now() - new Date(_cachedFinDate).getTime()) / 86400000;
                    if (_daysOld > 100) {
                        console.log(`[Cache] finData latestDate=${_cachedFinDate} is ${_daysOld.toFixed(0)}d old → force refresh`);
                        cachedResults = null; // 強制重抓
                    }
                }
            } catch (_ce) {}
        }
        // ─────────────────────────────────────────────────────────────────────────

        let results;
        let peerPromise = null; // 宣告在 if/else 外層，快取路徑與一般路徑均可存取
        if (cachedResults) {
            results = cachedResults;
        } else {
            const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            let completedCount = 0;
            const totalTasks = 10;
            
            // 如果有 partialResults，先初始化 results
            results = partialResults || new Array(10).fill(null);
            
            const taskDone = (msg) => {
                completedCount++;
                updateStatus(msg, Math.min(95, Math.round((completedCount / totalTasks) * 100)));
            };

            let pChart = null;
            let pChips = null;
            // peerPromise 已在外層宣告，此處直接使用

            const fetchers = [
                () => { pChart = (async () => { if (results[0]) { taskDone("跳過已載入股價"); return results[0]; } const r = await fetchStockChart(finalSymbol); taskDone("股價數據 OK"); return r; })(); return pChart; },
                async () => { if (results[1]) { taskDone("跳過基本資料"); return results[1]; } const r = await fetchTWSEBasic(finalSymbol); taskDone("基本資料 OK"); return r; },
                () => { pChips = (async () => {
                    if (results[2]) {
                        // 即使命中快取，仍可提前啟動 peer 查詢
                        if (!peerPromise && results[2]?.industry) {
                            peerPromise = fetchIndustryPeersMetrics(results[2].industry, finalSymbol).catch(() => []);
                        }
                        taskDone("跳過籌碼數據"); return results[2];
                    }
                    const r = await fetchStockChips(finalSymbol);
                    taskDone("籌碼數據 OK");
                    // 🚀 chips 一完成立即啟動同業對比，與後續任務並行
                    if (!peerPromise && r?.industry) {
                        peerPromise = fetchIndustryPeersMetrics(r.industry, finalSymbol).catch(() => []);
                    }
                    return r;
                })(); return pChips; },
                async () => { if (results[3]) { taskDone("跳過營收數據"); return results[3]; } const r = await fetchFinMindRevenue(finalSymbol); taskDone("營收數據 OK"); return r; },
                async () => { if (results[4]) { taskDone("跳過融資融券"); return results[4]; } const r = await fetchFinMindMargin(finalSymbol); taskDone("融資融券 OK"); return r; },
                async () => { if (results[5]) { taskDone("跳過法人動態"); return results[5]; } const r = await fetchFinMindInstitutional(finalSymbol, 0); taskDone("法人動態 OK"); return r; },
                async () => { 
                    if (results[6]) { taskDone("跳過財務指標"); return results[6]; } 
                    const chart = await pChart;
                    const chips = await pChips;
                    const cp = chart?.currentPrice || 0;
                    const sh = chips?.sharesIssued || chips?.shares || 0;
                    const r = await fetchFinMindFinancial(finalSymbol, cp, sh); 
                    taskDone("財務指標 OK"); 
                    return r; 
                },
                async () => { 
                    if (results[7]) { taskDone("跳過市場數據"); return results[7]; }
                    const d = new Date(); d.setDate(d.getDate() - 500);
                    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=TAIEX&start_date=${d.toISOString().split('T')[0]}&cb=${Date.now()}`;
                    const res = await analysisFetchProxy(url, true).catch(() => null);
                    taskDone("市場數據 OK");
                    return res?.data || null;
                },
                async () => {
                    if (results[8]) { taskDone("跳過內部人"); return results[8]; }
                    const res = { moneydj: null, director: null };
                    try { const url = `https://concords.moneydj.com/z/zc/zck/zck_${finalSymbol}.djhtm`; res.moneydj = await analysisFetchProxy(url, false); } catch(e) {}
                    taskDone("內部人數據 OK");
                    return res;
                },
                async () => { if (results[9]) { taskDone("跳過分點籌碼"); return results[9]; } const r = await fetchBrokerConcentration(finalSymbol); taskDone("分點籌碼 OK"); return r; }
            ];
            
            results = await Promise.all(fetchers.map(f => f()));
            setCachedAnalysis(cacheKey, results);
        }

        // 保存最後一次結果供局部重試使用
        window._lastAnalysisResults = results;
        
        const [chartData, twseBasic, chipsData, revData, marginData, instDataFinMind, finDataRaw, marketDataRaw, insiderDataRaw, brokerData] = results;
        window._lastChipsData = chipsData;
        window._lastInstitutionalData = instDataFinMind;
        window._lastRevData = revData; // 保存營收數據供趨勢圖使用

        // 🚀 DJ 備援：非阻塞式提前啟動，不等 peer 結束才發請求
        let djDataPromise = null;
        if (!instDataFinMind || instDataFinMind.isFallback) {
            djDataPromise = fetchInstitutionalMoneyDJ(finalSymbol).catch(() => null);
        }

        // 獲取同業專業對比數據 — 已在 chips 完成時提前啟動，通常此時已接近完成
        const peerCCCData = await (peerPromise || fetchIndustryPeersMetrics(chipsData?.industry, finalSymbol).catch(() => []));

        // 計算風險指標
        let riskMetrics = null;
        if (chartData?.prices && marketDataRaw) {
            riskMetrics = calculateRiskMetrics(chartData.prices, marketDataRaw);
        }

        // --- 籌碼深度計算 ---
        let chipCosts = null;
        if (instDataFinMind?.daily && chartData?.prices) {
            chipCosts = calculateInstitutionalCosts(instDataFinMind.daily, chartData.prices);
        }

        let winnerBrokers = [];
        let topSellers60 = [];
        if (brokerData && chartData?.prices && chartData.prices.length > 0) {
            const lastPriceObj = chartData.prices[chartData.prices.length - 1];
            const currentPrice = lastPriceObj ? (lastPriceObj.close || lastPriceObj.Close) : 0;
            const res = identifyWinnerBrokers(brokerData, currentPrice);
            winnerBrokers = res.winners;
            topSellers60 = res.sellers;
        }

        // 計算內部人與大戶動向 (含備援邏輯)
        const insiderActivity = processInsiderData(insiderDataRaw, chipsData);

        const debugInfo = {
            dj: !!insiderDataRaw?.moneydj,
            dir: !!insiderDataRaw?.director,
            holders: chipsData?.holders?.length || 0
        };

        // 等待 DJ 備援結果（此時應已完成，幾乎無等待）
        let institutionalData = instDataFinMind;
        if (djDataPromise) {
            const djData = await djDataPromise;
            if (djData) institutionalData = djData;
        }
        
        const finData = finDataRaw;

        // --- 新增：估計融資維持率計算 (當 API 未提供時) ---
        if (marginData && !marginData.marginMaintenance && chartData?.ma?.ma60 && chartData?.currentPrice) {
            // 估計成本基準使用 60 日均線，融資成數以台股標準 6 成 (0.6) 計算
            // 公式：(目前股價 / (成本基準 * 0.6)) * 100
            const estimatedCost = chartData.ma.ma60;
            marginData.estimatedMMR = (chartData.currentPrice / (estimatedCost * 0.6)) * 100;
        }

        if (!cachedResults) {
            setCachedAnalysis(cacheKey, results);
        }

        window._lastFinData = finData;
        if (window._analysisTimerInterval) {
            clearInterval(window._analysisTimerInterval);
            window._analysisTimerInterval = null;
        }
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        renderAnalysis(finalSymbol, displayName, chartData, twseBasic, chipsData, revData, finData, marginData, institutionalData, avgCost, riskMetrics, insiderActivity, debugInfo, brokerData, peerCCCData, chipCosts, winnerBrokers, topSellers60, totalTime);
    } catch (err) {
        // 發生錯誤時也確保計時器與放大鏡關閉
        if (window._analysisTimerInterval) {
            clearInterval(window._analysisTimerInterval);
            window._analysisTimerInterval = null;
        }
        if (window.toggleMagnifierMode) window.toggleMagnifierMode(false);
        console.error("Analysis fetch error:", err);
        analysisBody.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <div style="font-size:32px; margin-bottom:16px;">📡</div>
                <div style="color:#f87171; font-weight:700; font-size:16px; margin-bottom:8px;">載入分析失敗</div>
                <div style="color:#cbd5e1; font-size:12px; margin-bottom:12px;">原因：${err.message}</div>
                <div style="background:rgba(239, 68, 68, 0.1); padding:12px; border-radius:8px; border:1px solid rgba(239, 68, 68, 0.2); margin-bottom:24px; text-align:left;">
                    <div style="color:#ef4444; font-size:11px; font-weight:bold; margin-bottom:4px;">💡 故障排除建議：</div>
                    <ul style="color:#fca5a5; font-size:10px; margin:0; padding-left:15px; line-height:1.6;">
                        <li>建議切換到手機熱點 (電信網路通常較無限制)</li>
                        <li>請關閉瀏覽器的「廣告攔截器 (Ad-block)」</li>
                        <li>如果您在公司環境，可能所有代理站點都被封鎖了</li>
                        <li>嘗試清除瀏覽器快取後重新開啟</li>
                    </ul>
                </div>
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}')" 
                        style="background:#3b82f6; color:white; border:none; padding:12px 24px; border-radius:10px; cursor:pointer; font-weight:700;">
                    🔄 立即重試
                </button>
            </div>
        `;
    }
}

// === Caching Helper ===
const ANALYSIS_CACHE_PREFIX = 'stock_analysis_cache_v5_'; // 升級版本以引入 PS 歷史位階數據
function getCachedAnalysis(key, ttlHours = 8) {
    try {
        const cached = localStorage.getItem(ANALYSIS_CACHE_PREFIX + key);
        if (!cached) return null;
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < ttlHours * 3600000) return data;
        localStorage.removeItem(ANALYSIS_CACHE_PREFIX + key);
    } catch (e) {}
    return null;
}
function setCachedAnalysis(key, data) {
    try {
        const cacheObj = { timestamp: Date.now(), data };
        localStorage.setItem(ANALYSIS_CACHE_PREFIX + key, JSON.stringify(cacheObj));
    } catch (e) {}
}

// === Technical Indicator Calculations ===

function calcMA(closes, period) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
    if (closes.length <= period) return null;
    
    // 使用最近 150 筆資料進行計算以確保 Wilder's 平滑值穩定
    const lookback = Math.min(closes.length, 150);
    const data = closes.slice(-lookback);
    
    const gains = [];
    const losses = [];
    for (let i = 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? Math.abs(diff) : 0);
    }
    
    // 1. 計算初始種子 (前 period 期的 SMA)
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    // 2. 使用 Wilder's 平滑公式迭代其餘數據
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    const rsiVal = 100 - (100 / (1 + rs));
    return parseFloat(safeFix(rsiVal, 1));
}

function calcEMA(data, period) {
    if (data.length < period) return data.map(v => v); 
    const k = 2 / (period + 1);
    const ema = new Array(data.length).fill(0);
    
    // 業界標準：先算前 N 期的 SMA 作為 EMA 的種子起始值
    const smaSeed = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema[period - 1] = smaSeed;
    
    // 為了保持陣列長度一致，種子之前的數值用原始數據填充
    for (let i = 0; i < period - 1; i++) {
        ema[i] = data[i];
    }
    
    // 從種子後第一筆開始套用 EMA 公式
    for (let i = period; i < data.length; i++) {
        ema[i] = data[i] * k + ema[i-1] * (1 - k);
    }
    return ema;
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
    if (closes.length < slow + signal) return null;
    const emaFast = calcEMA(closes, fast);
    const emaSlow = calcEMA(closes, slow);
    const dif = emaFast.map((v, i) => v - emaSlow[i]);
    const macdLine = calcEMA(dif, signal);
    const osc = dif.map((v, i) => v - macdLine[i]);
    return {
        dif: dif[dif.length - 1],
        macd: macdLine[macdLine.length - 1],
        osc: osc[osc.length - 1]
    };
}

function calcBollinger(prices, period, stdDev) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const mid = slice.reduce((a, b) => a + b, 0) / period; // 直接計算均值，避免雙重 slice
    const sumSq = slice.reduce((a, b) => a + Math.pow(b - mid, 2), 0);
    // 布林通道使用母體標準差 (除以 n)，而非樣本標準差 (除以 n-1)
    const sigma = Math.sqrt(sumSq / period);
    return {
        upper: parseFloat(safeFix(mid + sigma * stdDev, 2)),
        mid: parseFloat(safeFix(mid, 2)),
        lower: parseFloat(safeFix(mid - sigma * stdDev, 2))
    };
}

function calcKD(highs, lows, closes, period = 9) {
    if (closes.length < period) return null;
    let k = 50, d = 50;
    // Iterate to stabilize KD values
    // 增加穩定化天數至 120 天，讓 K/D 初始種子值 (50) 的衝擊充分平滑消散
    const startIdx = Math.max(0, closes.length - 120); 
    for (let i = startIdx; i < closes.length; i++) {
        const start = Math.max(0, i - period + 1);
        const highPeriod = Math.max(...highs.slice(start, i + 1));
        const lowPeriod  = Math.min(...lows.slice(start, i + 1));
        const rsv = (highPeriod === lowPeriod) ? 0 : (closes[i] - lowPeriod) / (highPeriod - lowPeriod) * 100;
        k = (2/3) * k + (1/3) * rsv;
        d = (2/3) * d + (1/3) * k;
    }
    return { k: Math.round(k), d: Math.round(d) };
}

/**
 * 計算風險指標 (Beta & Volatility)
 * @param {Array} stockData 個股歷史價格
 * @param {Array} marketData 大盤歷史價格
 * @param {number} lookback 追蹤天數 (預設 252 交易日，約一年)
 */
function calculateRiskMetrics(stockData, marketData, lookback = 252) {
    if (!stockData || !marketData) {
        console.warn("[RiskMetrics] Missing data", { stock: !!stockData, market: !!marketData });
        return null;
    }
    
    if (stockData.length < 20 || marketData.length < 20) {
        console.warn("[RiskMetrics] Insufficient data length", { stock: stockData.length, market: marketData.length });
        return null;
    }

    // 確保日期對齊，並移除錯誤的 Trading_Volume 備援以免污染 Beta 計算
    const marketMap = new Map(marketData.map(d => [d.date, d.close || d.Close || 0]));
    const alignedReturns = [];
    
    // 取得重合的日期並計算回報率
    for (let i = 1; i < stockData.length; i++) {
        const date = stockData[i].date;
        const prevDate = stockData[i-1].date;
        const stockClose = stockData[i].close || stockData[i].Close || 0;
        const stockPrev = stockData[i-1].close || stockData[i-1].Close || 0;
        
        if (stockClose === 0 || stockPrev === 0) continue;

        if (marketMap.has(date) && marketMap.has(prevDate)) {
            const mClose = marketMap.get(date);
            const mPrev = marketMap.get(prevDate);
            
            if (mClose === 0 || mPrev === 0) continue;

            const stockReturn = (stockClose - stockPrev) / stockPrev;
            const marketReturn = (mClose - mPrev) / mPrev;
            
            alignedReturns.push({ s: stockReturn, m: marketReturn });
        }
    }

    const recentReturns = alignedReturns.slice(-lookback);
    if (recentReturns.length < 20) {
        console.warn("[RiskMetrics] Aligned returns insufficient", { total: alignedReturns.length, recent: recentReturns.length });
        return null;
    }

    // 1. 計算 Volatility (個股年化波動率)
    const sReturns = recentReturns.map(r => r.s);
    const sMean = sReturns.reduce((a, b) => a + b, 0) / sReturns.length;
    const sVar = sReturns.reduce((a, b) => a + Math.pow(b - sMean, 2), 0) / (sReturns.length - 1);
    const volatility = Math.sqrt(sVar * 252) * 100; // 年化

    // 2. 計算 Beta (β)
    const mReturns = recentReturns.map(r => r.m);
    const mMean = mReturns.reduce((a, b) => a + b, 0) / mReturns.length;
    const mVar = mReturns.reduce((a, b) => a + Math.pow(b - mMean, 2), 0) / (mReturns.length - 1);
    
    let covariance = 0;
    for (let i = 0; i < recentReturns.length; i++) {
        covariance += (recentReturns[i].s - sMean) * (recentReturns[i].m - mMean);
    }
    covariance /= (recentReturns.length > 1 ? recentReturns.length - 1 : 1);
    
    const beta = mVar !== 0 ? (covariance / mVar) : null;
    
    // 3. 計算簡化夏普值 (Sharpe Ratio)
    // 算法：(年化報酬率 - 無風險利率) / 年化波動率
    const latestSharpePrice = stockData[stockData.length - 1].close || stockData[stockData.length - 1].Close || 0;
    const baseSharpePoint = stockData[Math.max(0, stockData.length - 1 - 252)];
    const baseSharpePrice = baseSharpePoint.close || baseSharpePoint.Close || 0;
    const mom1y = (latestSharpePrice > 0 && baseSharpePrice > 0) ? (latestSharpePrice / baseSharpePrice - 1) * 100 : 0;
    const sharpeRatio = volatility > 0 ? (mom1y - ANALYSIS_CONFIG.riskFreeRate) / volatility : null;

    // 4. 計算 RSR (Relative Strength Ratio)

    const calculateRSR = (days) => {
        if (stockData.length <= days) return null;
        
        const latestStock = stockData[stockData.length - 1];
        const prevStock = stockData[stockData.length - 1 - days];
        
        const sPriceNow = latestStock.close || latestStock.Close || 0;
        const sPricePrev = prevStock.close || prevStock.Close || 0;
        if (sPricePrev === 0) return null;
        const sRet = (sPriceNow - sPricePrev) / sPricePrev; // 漲跌幅

        // 尋找 contemporaneous (同期) 的大盤資料
        const latestM = [...marketData].reverse().find(d => d.date <= latestStock.date);
        const prevM = [...marketData].reverse().find(d => d.date <= prevStock.date);
        
        if (!latestM || !prevM) return null;

        const mPriceNow = latestM.close || latestM.Close || 0;
        const mPricePrev = prevM.close || prevM.Close || 0;
        if (mPricePrev === 0) return null;
        const mRet = (mPriceNow - mPricePrev) / mPricePrev; // 報酬率

        if (1 + mRet === 0) return null;

        const rsr = (1 + sRet) / (1 + mRet);
        // 使用相對報酬比，避免「個股與大盤同跌」時除以負報酬造成強弱方向反轉。
        return parseFloat(rsr.toFixed(2));
    };

    const rsr20 = calculateRSR(20);
    const rsr60 = calculateRSR(60);

    // 5. 計算 最大回撤 (MDD) 與 修復期 (Recovery)
    let mdd = 0;
    let peak = -Infinity;
    let mddPeak = 0;
    let mddTroughIdx = 0;
    const pData = stockData.slice(-lookback);
    
    // 找出最大回撤發生的高點與坑底位置
    pData.forEach((d, i) => {
        const price = d.close || d.Close || 0;
        if (price > peak) peak = price;
        const dd = (price - peak) / peak;
        if (dd < mdd) {
            mdd = dd;
            mddPeak = peak;
            mddTroughIdx = i;
        }
    });

    // ── 除權息 / 股票分割 保護機制 ────────────────────────────────────────────────
    // B方案（優先）：若資料含 Yahoo adj_close（還原股價），直接使用，跳過 A方案
    // A方案（備援）：無還原股價時，偵測單日跌幅 > 10%（超出台股漲跌停上限）的除權息事件，
    //               將計算起始點截斷到最近一次除權息日之後，避免舊高點永遠回不去的失真
    const hasAdjClose = pData.some(d => d.adj_close != null && d.adj_close > 0);
    const getTrapPrice = (d) => {
        if (hasAdjClose) return (d.adj_close > 0 ? d.adj_close : (d.close || d.Close || 0));
        return d.close || d.Close || 0;
    };

    let trapDataStart = 0; // 套牢計算起始 index（A方案才會 > 0）
    if (!hasAdjClose) {
        for (let i = 1; i < pData.length; i++) {
            const prev = getTrapPrice(pData[i - 1]) || 1;
            const curr = getTrapPrice(pData[i]);
            if (curr > 0 && (curr - prev) / prev < -0.10) {
                trapDataStart = i; // 更新為最近一次除權息日（取最後一次）
            }
        }
    }

    // 套牢修復天數 (MAX)：以除權息截斷後的最高收盤價為基準
    // 找最後一次觸及高點的日期，從當日（含）起算到重新觸及（含），若未修復標示 pending
    let maxRecoveryDays = 0;
    let maxRecoveryRange = '';
    let maxRecoveryPending = false;
    {
        // 在 trapDataStart 之後重新找最高收盤價
        let trapPeak = 0;
        for (let i = trapDataStart; i < pData.length; i++) {
            const p = getTrapPrice(pData[i]);
            if (p > trapPeak) trapPeak = p;
        }
        // 找最後一次觸及 trapPeak 的 index
        let high52LastIdx = trapDataStart;
        for (let i = trapDataStart; i < pData.length; i++) {
            if (getTrapPrice(pData[i]) >= trapPeak) high52LastIdx = i;
        }
        if (high52LastIdx < pData.length - 1) {
            const trapStartIdx = high52LastIdx;         // 高點當日 = 第 1 天
            let recoveryIdx = -1;
            let days = 0;
            for (let i = trapStartIdx; i < pData.length; i++) {
                days++;                                  // 當日先計入（含高點日與修復日）
                const price = getTrapPrice(pData[i]);
                if (i > trapStartIdx && price >= trapPeak) { recoveryIdx = i; break; }
            }
            maxRecoveryDays = days;
            maxRecoveryPending = (recoveryIdx === -1);
            const s = (pData[trapStartIdx].date || '').replace(/-/g, '');
            const endI = recoveryIdx !== -1 ? recoveryIdx : pData.length - 1;
            const e = (pData[endI].date || '').replace(/-/g, '');
            if (s && e) maxRecoveryRange = s + '-' + e;
        }
        // else: 最後一日就是高點，無套牢，保留 maxRecoveryDays = 0
    }

    // 區間峰值套牢天數 (MAX)：掃描除權息截斷後的所有局部收盤高點
    // 計數規則：從高點當日（含，視為第 1 天）到突破日（含）取最大值
    let localPeakMaxTrapDays = 0;
    let localPeakMaxTrapRange = '';
    let localPeakMaxTrapPending = false;
    const peakWin = 5; // 局部高點判斷窗格：前後各 5 日均不得高於該日
    const localPeakStart = Math.max(peakWin, trapDataStart); // 不跨越除權息截斷點
    for (let i = localPeakStart; i < pData.length - peakWin; i++) {
        const H = getTrapPrice(pData[i]);
        if (H <= 0) continue;
        let isPeak = true;
        for (let k = 1; k <= peakWin; k++) {
            const lp = getTrapPrice(pData[i - k]);
            const rp = getTrapPrice(pData[i + k]);
            if (lp >= H || rp >= H) { isPeak = false; break; }
        }
        if (!isPeak) continue;
        // 從高點當日（i）起算：當日計 1 天，突破日也計入
        const trapStartIdx = i;
        let trapEndIdx = pData.length - 1;
        let trapDays = 0;
        let recovered = false;
        for (let j = trapStartIdx; j < pData.length; j++) {
            trapDays++;                                  // 先計入當日
            const p = getTrapPrice(pData[j]);
            if (j > trapStartIdx && p >= H) { trapEndIdx = j; recovered = true; break; } // 突破日含入後跳出
        }
        if (trapDays > localPeakMaxTrapDays) {
            localPeakMaxTrapDays = trapDays;
            localPeakMaxTrapPending = !recovered;
            const s = (pData[trapStartIdx].date || '').replace(/-/g, '');
            const e = (pData[trapEndIdx].date || '').replace(/-/g, '');
            localPeakMaxTrapRange = (s && e) ? s + '-' + e : '';
        }
    }

    const currentPrice = stockData[stockData.length - 1].close || 0;
    const currentDrawdown = peak > 0 ? (currentPrice - peak) / peak : 0;

    // 6. 計算 相關係數 (Correlation)
    const calculateCorrelation = (days) => {
        const sub = alignedReturns.slice(-days);
        if (sub.length < 10) return null;
        const sSub = sub.map(r => r.s), mSub = sub.map(r => r.m);
        const sM = sSub.reduce((a,b)=>a+b,0)/sSub.length, mM = mSub.reduce((a,b)=>a+b,0)/mSub.length;
        let cov = 0, sVar = 0, mVar = 0;
        for (let i=0; i<sub.length; i++) {
            const sd = sub[i].s-sM, md = sub[i].m-mM;
            cov += sd*md; sVar += sd*sd; mVar += md*md;
        }
        const denom = Math.sqrt(sVar * mVar);
        return denom !== 0 ? (cov / denom) : 0;
    };
    const corr20 = calculateCorrelation(20);
    const corr60 = calculateCorrelation(60);

    return {
        beta: beta !== null ? parseFloat(beta.toFixed(2)) : null,
        volatility: parseFloat(volatility.toFixed(2)),
        sharpeRatio: sharpeRatio !== null ? parseFloat(sharpeRatio.toFixed(2)) : null,
        rsr20: rsr20 !== null ? parseFloat(rsr20.toFixed(2)) : null,
        rsr60: rsr60 !== null ? parseFloat(rsr60.toFixed(2)) : null,
        mdd: Math.abs(parseFloat((mdd * 100).toFixed(2))),
        currentDrawdown: Math.abs(parseFloat((currentDrawdown * 100).toFixed(2))),
        maxRecoveryDays,
        maxRecoveryRange,
        maxRecoveryPending,
        localPeakMaxTrapDays,
        localPeakMaxTrapRange,
        localPeakMaxTrapPending,
        corr20: corr20 !== null ? parseFloat(corr20.toFixed(2)) : null,
        corr60: corr60 !== null ? parseFloat(corr60.toFixed(2)) : null,
        sampleSize: recentReturns.length
    };
}

/**
 * 計算內部人 (董監事) 持股變動
 * @param {Array} rawData TaiwanStockDirectorShareholding 原始數據
 */
/**
 * 處理內部人與大戶籌碼數據 (含三層備援)
 */
function processInsiderData(raw, chipsData) {
    let result = null;
    
    // 1. 優先嘗試 MoneyDJ 申報轉讓
    if (raw?.moneydj) {
        result = parseMoneyDJInsider(raw.moneydj);
    }

    // 2. 備援 A：解析 FinMind 董監持股明細
    if ((!result || result.type === 'none') && raw?.director && raw.director.length > 0) {
        const dirRes = calculateDirectorChanges(raw.director);
        if (dirRes) result = dirRes;
    }

    // 3. 備援 B：分析大股東分級趨勢
    const holderData = chipsData?.holders || chipsData?.shareholding || [];
    if ((!result || result.type === 'none') && holderData && holderData.length >= 2) {
        const chipRes = calculateLargeHolderTrend(holderData);
        if (chipRes) result = chipRes;
    }

    return result;
}

function parseMoneyDJInsider(html) {
    if (!html || typeof html !== 'string' || html.length < 500) return null;
    
    const history = [];
    let latestSample = "N/A";

    try {
        // 更加寬鬆的正則表達式：匹配日期、姓名、職稱、張數、方式
        // 允許 td 標籤之間有任何字元，並忽略特定的 class 依賴
        const regex = /<td[^>]*>(\d{2,3}\/\d{2}\/\d{2})<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([\d,]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
        
        let match;
        while ((match = regex.exec(html)) !== null) {
            const dateRaw = match[1];
            const name = match[2].replace(/&nbsp;/g, '').trim();
            const position = match[3].replace(/&nbsp;/g, '').trim();
            const shares = parseInt(match[4].replace(/,/g, '')) || 0;
            const method = match[5].replace(/&nbsp;/g, '').trim();
            
            if (name && name !== '姓名') {
                const parts = dateRaw.split('/');
                const year = parseInt(parts[0]) + 1911;
                history.push({
                    date: `${year}/${parts[1]}/${parts[2]}`,
                    name, position, totalChange: -shares, method
                });
            }
        }
    } catch (e) {
        console.warn("Regex parse failed", e);
    }

    if (history.length > 0) {
        return { 
            type: 'moneydj', 
            history: history.slice(0, 8), 
            trend: -1, 
            sample: `Found ${history.length} records. Latest: ${history[0].name}` 
        };
    }
    
    // 如果失敗，嘗試抓取 <title> 來診斷是否被攔截
    let title = "No Title";
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1];

    const snippet = html.substring(0, 150).replace(/[\r\n\t]/g, ' ').replace(/</g, '&lt;');
    return { 
        type: 'none', 
        history: [], 
        trend: 0, 
        sample: `Parse Failed. [${title}] Snippet: ${snippet}` 
    };
}

function calculateDirectorChanges(data) {
    if (!data || data.length < 2) return null;
    // 按日期排序並比對最後兩期
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const dates = [...new Set(sorted.map(d => d.date))].sort();
    if (dates.length < 2) return null;

    const currDate = dates[dates.length - 1];
    const prevDate = dates[dates.length - 2];
    const currItems = sorted.filter(d => d.date === currDate);
    const prevItems = sorted.filter(d => d.date === prevDate);
    
    let totalChange = 0;
    currItems.forEach(curr => {
        const prev = prevItems.find(p => p.name === curr.name);
        if (prev) totalChange += (curr.holding_shares - prev.holding_shares);
    });

    return {
        type: 'director',
        history: [{ date: currDate, totalChange: totalChange / 1000, method: '董監持股餘額變動' }],
        trend: totalChange,
        sample: 'FinMind Director Data Processed'
    };
}

function calculateLargeHolderTrend(data) {
    if (!data || data.length < 2) return null;
    // 找出 Level 15 (400張) 或 Level 17 (1000張)
    const targetLevel = data.some(d => d.HoldingSharesLevel === '17' || d.HoldingSharesLevel === 17) ? 17 : 15;
    const levels = data.filter(d => d.HoldingSharesLevel == targetLevel).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if (levels.length < 2) return null;

    const latest = levels[levels.length - 1];
    const prev = levels[levels.length - 2];
    const diff = (latest.percent || 0) - (prev.percent || 0);

    return {
        type: 'fallback_chips',
        history: [{ 
            date: latest.date, 
            totalChange: diff, 
            isPercent: true, 
            method: `${targetLevel === 17 ? '1000' : '400'}張大戶持股比變動` 
        }],
        trend: diff,
        isPercent: true,
        sample: `Fallback: Level ${targetLevel} Trend OK`
    };
}

async function fetchTWSEBasic(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    
    // 設定起始日期 (抓過去 5 年數據以計算分位數)
    const d = new Date();
    d.setDate(d.getDate() - 1825);
    const startDate = d.toISOString().split('T')[0];
    
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPER&data_id=${rawSymbol}&start_date=${startDate}`;
    
    try {
        let json = await analysisFetchProxy(url, true).catch(() => null);
        
        // 備援 1：如果 5 年數據失敗，嘗試 1 年數據
        if (!json || !json.data || json.data.length === 0) {
            const d1 = new Date(); d1.setDate(d1.getDate() - 365);
            const url1 = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPER&data_id=${rawSymbol}&start_date=${d1.toISOString().split('T')[0]}`;
            json = await analysisFetchProxy(url1, true).catch(() => null);
        }

        // 備援 2：如果 1 年數據仍失敗，抓最近 30 天 (保底抓取當前值)
        if (!json || !json.data || json.data.length === 0) {
            const d2 = new Date(); d2.setDate(d2.getDate() - 30);
            const url2 = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPER&data_id=${rawSymbol}&start_date=${d2.toISOString().split('T')[0]}`;
            json = await analysisFetchProxy(url2, true).catch(() => null);
        }

        if (json && json.data && json.data.length > 0) {
            const data = [...json.data].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            const latest = data[data.length - 1];
            
            // 提取有效的 PE/PB 列表用於統計
            const peList = data.map(d => d.PER || d.per || d.P_E_Ratio || d.PERatio || 0).filter(v => v > 0).sort((a, b) => a - b);
            const pbList = data.map(d => d.PBR || d.pbr || d.P_B_Ratio || d.PBRatio || 0).filter(v => v > 0).sort((a, b) => a - b);
            
            const currentPE = latest.PER || latest.per || latest.P_E_Ratio || latest.PERatio || null;
            const currentPB = latest.PBR || latest.pbr || latest.P_B_Ratio || latest.PBRatio || null;
            
            const getPercentile = (list, val) => {
                if (val === null || list.length === 0) return null;
                const count = list.filter(v => v <= val).length;
                return (count / list.length) * 100;
            };

            const getBands = (list) => {
                if (list.length === 0) return null;
                return {
                    min: list[0],
                    p25: list[Math.floor(list.length * 0.25)],
                    p50: list[Math.floor(list.length * 0.50)],
                    p75: list[Math.floor(list.length * 0.75)],
                    max: list[list.length - 1]
                };
            };

            return {
                pe: currentPE,
                yield: latest.dividend_yield || latest.yield || latest.Dividend_Yield || null,
                pb: currentPB,
                pePercentile: getPercentile(peList, currentPE),
                pbPercentile: getPercentile(pbList, currentPB),
                peBands: getBands(peList),
                pbBands: getBands(pbList),
                historyCount: data.length
            };
        }
    } catch (err) {
        console.warn("FinMind PER API failed", err);
    }
    return null;
}

// Fetch FinMind Dividends & Shareholding + Scrape Official sources for others
async function fetchStockChips(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    
    // --- 並行執行所有子請求 ---
    const [jsonDiv, jsonInfo, jsonShare, mdjHtmls, jsonMargin, jsonHolders, jsonPledgeData] = await Promise.all([
        (async () => {
            try {
                const dDiv = new Date(); dDiv.setDate(dDiv.getDate() - 7000); 
                const urlDiv = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDividend&data_id=${rawSymbol}&start_date=${dDiv.toISOString().split('T')[0]}&cb=${Date.now()}`;
                return await analysisFetchProxy(urlDiv, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            try {
                const urlInfo = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${rawSymbol}&cb=${Date.now()}`;
                return await analysisFetchProxy(urlInfo, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            try {
                const dShare = new Date(); dShare.setDate(dShare.getDate() - 365);
                const urlShare = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockShareholding&data_id=${rawSymbol}&start_date=${dShare.toISOString().split('T')[0]}&cb=${Date.now()}`;
                return await analysisFetchProxy(urlShare, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            // MoneyDJ / Fubon 探針
            const urls = [
                `https://www.moneydj.com/z/zc/zcl/zcl_${rawSymbol}.djhtm`,
                `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl_${rawSymbol}.djhtm`
            ];
            return Promise.all(urls.map(url => analysisFetchProxy(url, false).catch(() => null)));
        })(),
        (async () => {
            try {
                const dMargin = new Date(); dMargin.setDate(dMargin.getDate() - 30);
                const urlMargin = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMarginPurchaseShortSale&data_id=${rawSymbol}&start_date=${dMargin.toISOString().split('T')[0]}&cb=${Date.now()}`;
                return await analysisFetchProxy(urlMargin, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            try {
                const dHolders = new Date(); dHolders.setDate(dHolders.getDate() - 100); 
                const urlHolders = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockHoldingSharesPer&data_id=${rawSymbol}&start_date=${dHolders.toISOString().split('T')[0]}&cb=${Date.now()}`;
                return await analysisFetchProxy(urlHolders, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            // 董監質押與持股明細 (含 FinMind API 與 MoneyDJ 備援)
            const dPledge = new Date(); dPledge.setDate(dPledge.getDate() - 60);
            const urlFinMind = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDirectorShareholding&data_id=${rawSymbol}&start_date=${dPledge.toISOString().split('T')[0]}&cb=${Date.now()}`;
            // 切換至免登入的券商代理版本以確保能抓取原始數據
            const urlMoneyDJ = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zck/zck_${rawSymbol}.djhtm`;
            
            const [fm, mdj] = await Promise.all([
                analysisFetchProxy(urlFinMind, true).catch(() => null),
                analysisFetchProxy(urlMoneyDJ, false).catch(() => null)
            ]);
            return { fm, mdj };
        })()
    ]);

    // --- 1. 處理股利資料 ---
    let exDivDate = '無資料';
    let exDivAmt = null;
    let divGrowth3y = null;
    let divConsecutiveYears = 0;
    let divHistory = [];
    let currentTtmDiv = 0;
    if (jsonDiv && jsonDiv.data && jsonDiv.data.length > 0) {
        const processed = jsonDiv.data.map(d => {
            const cash = (d.CashDividend || d.StockDividendCash || d.CashEarningsDistribution || 0) + 
                         (d.CashStatutorySurplus || 0) + (d.CashCapitalSurplus || 0);
            const stock = (d.StockDividend || d.StockDividendShares || d.StockEarningsDistribution || 0) + 
                          (d.StockStatutorySurplus || 0) + (d.StockCapitalSurplus || 0);
            const date = d.CashExDividendTradingDate || d.StockExDividendTradingDate || d.ExDividendTradingDate || d.date;
            return { date, cash, stock };
        }).filter(x => x.cash > 0 || x.stock > 0);

        const historyMap = new Map();
        processed.forEach(p => {
            if (!historyMap.has(p.date)) historyMap.set(p.date, { ...p });
            else { const item = historyMap.get(p.date); item.cash += p.cash; item.stock += p.stock; }
        });
        const sortedHistory = Array.from(historyMap.values()).sort((a,b) => new Date(b.date) - new Date(a.date));
        if (sortedHistory.length > 0) {
            exDivDate = sortedHistory[0].date;
            // 優先尋找最近一次有發放現金股利的紀錄，避免因「股票股利較晚單獨發放」導致最近現金股利顯示為 0 (如富邦金案例)
            const latestCashObj = sortedHistory.find(h => h.cash > 0);
            exDivAmt = latestCashObj ? latestCashObj.cash : sortedHistory[0].cash;
            divHistory = sortedHistory.slice(0, 8);
            // --- 強化版 CAGR 計算：偵測配息頻率並以「週期」為單位計算 ---
            const getTtmSum = (startIndex, count) => {
                if (sortedHistory.length < startIndex + count) return 0;
                return sortedHistory.slice(startIndex, startIndex + count).reduce((s, x) => s + x.cash, 0);
            };

            // 1. 偵測頻率 (透過前 4 筆紀錄的平均間隔天數)
            let payoutsPerYear = 1;
            if (sortedHistory.length >= 4) {
                const totalDays = (new Date(sortedHistory[0].date) - new Date(sortedHistory[3].date)) / (1000 * 60 * 60 * 24);
                const avgGap = totalDays / 3;
                if (avgGap < 120) payoutsPerYear = 4;      // 季配 (約 90 天)
                else if (avgGap < 240) payoutsPerYear = 2; // 半年配 (約 180 天)
                else payoutsPerYear = 1;                   // 年配 (約 360 天)
            }
            
            // 2. 計算 TTM (目前週期的總和與三年前週期的總和)
            const ttmNow = getTtmSum(0, payoutsPerYear);
            const ttmPrev = getTtmSum(payoutsPerYear * 3, payoutsPerYear);
            
            currentTtmDiv = ttmNow;

            if (ttmPrev > 0 && ttmNow > 0 && sortedHistory.length >= payoutsPerYear * 4) {
                divGrowth3y = (Math.pow(ttmNow / ttmPrev, 1 / 3) - 1) * 100;
            } else if (sortedHistory.length >= 2) {
                // 備援：若資料長度不足計算 3 年 CAGR，則計算最近兩次有意義紀錄的變動率
                const latest = sortedHistory[0].cash > 0 ? sortedHistory[0].cash : (sortedHistory[1]?.cash || 0);
                const prev = sortedHistory.find((h, i) => i > 0 && h.cash > 0)?.cash || 0;
                if (prev > 0) divGrowth3y = ((latest - prev) / prev) * 100;
            }
            const divYears = [...new Set(sortedHistory.map(d => new Date(d.date).getFullYear()))].sort((a,b) => b-a);
            let streak = 0;
            if (divYears.length > 0) {
                streak = 1;
                for (let i = 0; i < divYears.length - 1; i++) {
                    if (divYears[i] - divYears[i+1] === 1) streak++; else break;
                }
            }
            divConsecutiveYears = streak;
        }
    }

    // --- 2. 處理產業資訊 ---
    let industry = null, stockNameFromAPI = null, sharesFromInfo = null;
    if (jsonInfo && jsonInfo.data && jsonInfo.data.length > 0) {
        industry = jsonInfo.data[0].industry_category;
        stockNameFromAPI = jsonInfo.data[0].stock_name;
        sharesFromInfo = jsonInfo.data[0].shares_issued || jsonInfo.data[0].number_of_shares_issued || null;
    }

    // --- 3. 處理法人持股 ---
    let foreign = null, trust = null, dealer = null, sharesIssued = null, institutionalTotal = null;
    if (jsonShare && jsonShare.data && jsonShare.data.length > 0) {
    const latest = jsonShare.data[jsonShare.data.length - 1];
        foreign = latest.ForeignInvestmentSharesRatio || latest.foreign_investment_shares_ratio || latest.ForeignInvestmentRatio || null;
        trust = latest.InvestmentTrustSharesRatio || latest.investment_trust_shares_ratio || latest.InvestmentTrustRatio || null;
        dealer = latest.DealerSharesRatio || latest.dealer_shares_ratio || latest.DealerRatio || null;
        sharesIssued = latest.NumberOfSharesIssued || latest.number_of_shares_issued || latest.SharesIssued || sharesFromInfo || null;
    } else {
        sharesIssued = sharesFromInfo;
    }

    // --- 4. 處理 MoneyDJ / Fubon 備援 ---
    for (let mdjHtml of (mdjHtmls || [])) {
        if (!mdjHtml) continue;
        const rows = mdjHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        for (let row of rows) {
            if (/\d{2,3}\/\d{2}\/\d{2}/.test(row) && row.includes('%')) {
                const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
                if (cells.length >= 11) {
                    const clean = (c) => c.replace(/<[^>]*>/g, '').trim().replace(/,/g, '').replace(/%/g, '');
                    const fShares = parseFloat(clean(cells[5]));
                    const fPct = parseFloat(clean(cells[9]));
                    if (!isNaN(fPct) && fPct > 0) {
                        foreign = fPct;
                        const issued = fShares / (fPct / 100);
                        const tShares = parseFloat(clean(cells[6]));
                        const dShares = parseFloat(clean(cells[7]));
                        const totalPct = parseFloat(clean(cells[10]));
                        if (!isNaN(tShares)) trust = (tShares / issued) * 100;
                        if (!isNaN(dShares)) dealer = (dShares / issued) * 100;
                        if (!isNaN(totalPct)) institutionalTotal = totalPct;
                        break;
                    }
                }
            }
        }
    }
    // --- 5. 處理集保與信用交易 ---
    let marginShortRatio = null, large = null, retail = null;
    let holderTrend = [];
    if (jsonMargin && jsonMargin.data && jsonMargin.data.length > 0) {
        const latestM = jsonMargin.data[jsonMargin.data.length - 1];
        const margin = latestM.MarginPurchaseTodayBalance || latestM.margin_purchase_today_balance || 0;
        const short = latestM.ShortSaleTodayBalance || latestM.short_sale_today_balance || 0;
        if (margin > 0) marginShortRatio = (short / margin) * 100;
    }

    if (jsonHolders && jsonHolders.data && jsonHolders.data.length > 0) {
        const dates = [...new Set(jsonHolders.data.map(x => x.date || x.Date))].sort().filter(d => d);
        holderTrend = dates.map(d => {
            const dayData = jsonHolders.data.filter(x => (x.date || x.Date) === d);
            const getLvl = (x) => parseInt(x.HoldingSharesLevel || x.Level || 0);
            const getPct = (x) => {
                const val = x.Percent || x.Ratio || 0;
                return typeof val === 'string' ? parseFloat(val.replace(/%/g, '')) : val;
            };
            const l = dayData.filter(x => {
                const lvl = getLvl(x);
                return (lvl >= 12 && lvl <= 17) || (lvl >= 400); // Level 12-17 涵蓋 400張以上，或直接以張數 > 400
            }).reduce((s, x) => s + getPct(x), 0);
            
            const r = dayData.filter(x => {
                const lvl = getLvl(x);
                return (lvl >= 1 && lvl <= 8) || (lvl > 17 && lvl <= 50); // Level 1-8 涵蓋 50張以下，或張數 50 以下
            }).reduce((s, x) => s + getPct(x), 0);
            return { date: d, large: l, retail: r };
        // 百分比合理性校驗：大戶與散戶均不得超過100%，且總和不得超過100%
        // 舊版資料格式的 HoldingSharesLevel 可能儲存實際股數而非等級，造成天文數字
        }).filter(x => x && x.large > 0 && x.large <= 100 && x.retail >= 0 && x.retail <= 100 && (x.large + x.retail) <= 100);
    }

    // --- 備援：神秘金字塔 (Norway) ---
    let norwayStatus = "N/A";
    if (holderTrend.length === 0) {
        try {
            const norwayUrl = `https://norway.twsthr.info/StockHolders.aspx?stock=${rawSymbol}&STEP=2`;
            const html = await analysisFetchProxy(norwayUrl, false).catch(() => null);
            if (html && html.length > 1000) {
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

                    const n = (idx) => (vals[b + idx] || 0);
                    const r = n(1) + n(2) + n(3) + n(4) + n(5) + n(6) + n(7) + n(8); // Level 1~8 (<= 50張)
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


    // --- 6. 處理董監質押 (含 MoneyDJ 深度解析) ---
    let pledgeRatio = null;
    const { fm: jsonPledge, mdj: htmlPledge } = jsonPledgeData || {};
    
    // 優先嘗試解析 MoneyDJ (通常資料較完整且無權限限制)
    if (htmlPledge && typeof htmlPledge === 'string') {
        const rows = htmlPledge.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        let totalHold = 0;
        let totalPledged = 0;
        for (let row of rows) {
            // 篩選董監事行
            if (row.includes('董事') || row.includes('監察人') || row.includes('代表')) {
                const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
                // 根據最新探測，券商版表格索引為：持股(2), 質押(4), 總數為 6 欄
                if (cells.length >= 6) {
                    const clean = (c) => c.replace(/<[^>]*>/g, '').trim().replace(/,/g, '');
                    const hold = parseFloat(clean(cells[2])) || 0;
                    const pledged = parseFloat(clean(cells[4])) || 0;
                    totalHold += hold;
                    totalPledged += pledged;
                }
            }
        }
        if (totalHold > 0) pledgeRatio = (totalPledged / totalHold) * 100;
    }

    // 備援：嘗試 FinMind API (若有權限)
    if (pledgeRatio === null && jsonPledge && jsonPledge.data && jsonPledge.data.length > 0) {
        const latestPledgeDate = jsonPledge.data[jsonPledge.data.length - 1].date;
        const latestPledgeData = jsonPledge.data.filter(x => x.date === latestPledgeDate);
        const totalHolding = latestPledgeData.reduce((s, x) => s + (x.holding_shares || 0), 0);
        const totalPledged = latestPledgeData.reduce((s, x) => s + (x.pledge_shares || 0), 0);
        if (totalHolding > 0) pledgeRatio = (totalPledged / totalHolding) * 100;
    }

    const apiRawCount = (jsonHolders && jsonHolders.data) ? jsonHolders.data.length : 0;
    if (institutionalTotal === null && foreign !== null) institutionalTotal = foreign + (trust || 0) + (dealer || 0);
    
    // 獲取最新的持股日期
    let holdingDate = null;
    if (jsonShare && jsonShare.data && jsonShare.data.length > 0) {
        holdingDate = jsonShare.data[jsonShare.data.length - 1].date || jsonShare.data[jsonShare.data.length - 1].Date;
    }

    return { 
        foreign, trust, dealer, institutionalTotal, large, retail, exDivDate, exDivAmt, sharesIssued, 
        divGrowth3y, divConsecutiveYears, divHistory, holderTrend, marginShortRatio, industry, 
        stockName: stockNameFromAPI, apiRawCount, norwayStatus, pledgeRatio, currentTtmDiv, 
        holdingHistory: jsonShare?.data || [],
        holdingDate: holdingDate 
    };
}

// --- 4. FinMind 月營收 ---
async function fetchFinMindRevenue(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date();
    d.setDate(d.getDate() - 2000); 
    const startDate = d.toISOString().split('T')[0];
    const log = (msg) => {
        window._fetchLogs = window._fetchLogs || [];
        window._fetchLogs.push(`[${new Date().toLocaleTimeString()}] [Revenue] ${msg}`);
    };
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMonthRevenue&data_id=${rawSymbol}&start_date=${startDate}&cb=${Date.now()}`;
    
    let json = null;
    try {
        json = await analysisFetchProxy(url, true);
    } catch (e) {
        log(`FM Revenue 5Y failed, trying 2Y...`);
        const d2 = new Date(); d2.setDate(d2.getDate() - 730);
        const url2 = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMonthRevenue&data_id=${rawSymbol}&start_date=${d2.toISOString().split('T')[0]}&cb=${Date.now()}`;
        json = await analysisFetchProxy(url2, true).catch(() => null);
    }
    
    // 如果數據仍為空，嘗試 1 年窗口
    if (!json || !json.data || json.data.length < 2) {
        log(`FM Revenue still empty, trying 1Y...`);
        const d1y = new Date(); d1y.setDate(d1y.getDate() - 365);
        const url1y = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMonthRevenue&data_id=${rawSymbol}&start_date=${d1y.toISOString().split('T')[0]}&cb=${Date.now()}`;
        json = await analysisFetchProxy(url1y, true).catch(() => null);
    }

    // ── 最終備援：月營收資料不存在（常見於金融控股/銀行/保險股）──────────────
    // 原因：金融控股公司依法不向 TWSE/MOPS 申報月營收，TaiwanStockMonthRevenue 對其為空。
    //        解法：改從季報損益表（TaiwanStockFinancialStatements）抓季度營收替代。
    if (!json || !json.data || json.data.length < 2) {
        log('Monthly revenue empty → trying quarterly financial statements as fallback...');
        try {
            const _dFin = new Date(); _dFin.setFullYear(_dFin.getFullYear() - 3);
            const _urlFin = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockFinancialStatements&data_id=${rawSymbol}&start_date=${_dFin.toISOString().split('T')[0]}&supp=1&cb=${Date.now()}`;
            const _finJson = await analysisFetchProxy(_urlFin, true).catch(() => null);

            if (_finJson?.data?.length > 0) {
                // ── 優先列表：精確名稱比對 ───────────────────────────────────────
                const _revTypes = [
                    // 一般產業
                    'Revenue', 'OperatingRevenue', 'Operating_Revenue', 'Total_Operating_Revenue',
                    'Total_revenue', 'Net_revenue', 'TotalRevenue', 'NetRevenue',
                    // 銀行/金控常用
                    'InterestIncome', 'NetInterestIncome', 'TotalInterestIncome',
                    'TotalNonInterestIncome', 'TotalOperatingIncome', 'TotalOperatingRevenue',
                    'OperatingIncome', 'TotalIncome', 'GrossProfit',
                    // 保險常用
                    'PremiumsEarned', 'PremiumIncome', 'NetPremiumIncome', 'TotalPremiumIncome',
                    // 廣義兜底
                    'TotalRevenues', 'NetRevenues', 'SalesRevenue', 'ServiceRevenue',
                    'Revenues', 'Income', 'GrossRevenue'
                ];
                const _qDates = [...new Set(_finJson.data.map(x => x.date))].sort();
                const _qData  = [];

                _qDates.forEach(_date => {
                    const _items = _finJson.data.filter(x => x.date === _date);

                    // 第一輪：精確名稱比對
                    let _found = null;
                    for (const _type of _revTypes) {
                        const _item = _items.find(x => x.type === _type);
                        const _val  = Number(_item?.value || 0);
                        if (_val > 0) { _found = _item; break; }
                    }

                    // 第二輪：正則模糊比對（兜底金融股等奇特命名）
                    // 取所有 type 名含 Revenue/Income 且值最大者
                    if (!_found) {
                        _found = _items
                            .filter(x => /revenue|income/i.test(x.type) && Number(x.value || 0) > 0)
                            .sort((a, b) => Number(b.value) - Number(a.value))[0] || null;
                    }

                    if (_found) {
                        _qData.push({
                            date          : _date,
                            revenue_year  : parseInt(_date.slice(0, 4)),
                            revenue_month : parseInt(_date.slice(5, 7)),
                            revenue       : Number(_found.value),
                            _srcType      : _found.type,
                            _isQuarterly  : true
                        });
                    }
                });

                if (_qData.length >= 2) {
                    json = { data: _qData, _isQuarterly: true };
                    log(`Quarterly fallback OK: ${_qData.length} quarters, srcType=${_qData[0]._srcType}`);
                } else {
                    // 偵錯：印出所有可用 type，幫助未來擴充
                    const _allTypes = [...new Set(_finJson.data.map(x => x.type))].sort();
                    log(`Quarterly fallback: no revenue type found. Available types: ${_allTypes.slice(0, 20).join(', ')}`);
                }
            }
        } catch (_eFin) {
            log(`Quarterly revenue fallback error: ${_eFin.message}`);
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (json && json.data && json.data.length >= 2) {
        const data = [...json.data].sort((a, b) => {
            const da = a.date || `${a.revenue_year}-${String(a.revenue_month).padStart(2, '0')}`;
            const db = b.date || `${b.revenue_year}-${String(b.revenue_month).padStart(2, '0')}`;
            return da.localeCompare(db);
        });
        const current = data[data.length - 1];
        const prev    = data[data.length - 2];
        const toNumber = (value) => {
            const num = Number(value);
            return Number.isFinite(num) ? num : 0;
        };
        const getRevenue = (item) => toNumber(item?.revenue ?? item?.Revenue ?? 0);
        const getRevenueYear = (item) => toNumber(item?.revenue_year ?? (item?.date || '').slice(0, 4));
        const getRevenueMonth = (item) => toNumber(item?.revenue_month ?? (item?.date || '').slice(5, 7));
        const currentYear = getRevenueYear(current);
        const currentMonth = getRevenueMonth(current);
        const lastYear = data.find(x => getRevenueYear(x) === currentYear - 1 && getRevenueMonth(x) === currentMonth);
        
        const curRev = getRevenue(current);
        const preRev = getRevenue(prev);
        const lyRev  = lastYear ? getRevenue(lastYear) : 0;

        const mom = preRev > 0 ? ((curRev - preRev) / preRev) * 100 : null;
        const yoy = lyRev > 0 ? ((curRev - lyRev) / lyRev) * 100 : null;
        
        const last12 = data.slice(-12);
        const cum12m = last12.reduce((s, x) => s + getRevenue(x), 0);
        
        const ytdMonths = data.filter(x => getRevenueYear(x) === currentYear);
        const ytd = ytdMonths.reduce((s, x) => s + getRevenue(x), 0);
        
        // 新增：去年同期累計 (Last Year YTD)
        const lyYtdMonths = data.filter(x => getRevenueYear(x) === currentYear - 1 && getRevenueMonth(x) <= currentMonth);
        const lyYtd = lyYtdMonths.reduce((s, x) => s + getRevenue(x), 0);
        const cumYoy = lyYtd > 0 ? ((ytd - lyYtd) / lyYtd * 100) : null;
        
        let yoyUpMonths = 0;
        let yoySum6m = 0;
        let yoyCount6m = 0;
        
        // 計算近 12 個月的逐月 YoY，並統計近 6 個月的平均值
        for (let i = 0; i < last12.length; i++) {
            const m = last12[i];
            const mYear = getRevenueYear(m);
            const mMonth = getRevenueMonth(m);
            const ly = data.find(x => getRevenueYear(x) === mYear - 1 && getRevenueMonth(x) === mMonth);
            const mRev = getRevenue(m);
            const lyR = ly ? getRevenue(ly) : 0;
            if (lyR > 0) {
                const currentYoY = ((mRev - lyR) / lyR) * 100;
                if (mRev > lyR) yoyUpMonths++;
                
                // 取最後 6 筆有效 YoY 計算平均
                if (i >= last12.length - 6) {
                    yoySum6m += currentYoY;
                    yoyCount6m++;
                }
            }
        }

        const _isQtrFallback = !!(json?._isQuarterly);
        const _monthLabel = _isQtrFallback
            ? `${currentYear}年 Q${Math.ceil(currentMonth / 3)}（季報估算）`
            : `${currentYear}年${currentMonth}月`;

        return {
            month        : _monthLabel,
            revenue      : curRev,
            mom,
            yoy,
            avgYoY6m     : yoyCount6m > 0 ? (yoySum6m / yoyCount6m) : yoy,
            cum12m,
            ytd,
            ytdMonthCount: ytdMonths.length,
            cumYoy,
            yoyUpMonths,
            totalMonths  : last12.length || 12,
            history      : data,
            _isQuarterly : _isQtrFallback
        };
    }
    return null;
}

// --- 5. FinMind 財報、比率、現金流 ---
async function fetchFinMindFinancial(symbol, currentPrice = 0, sharesFromChips = 0) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    d.setMonth(0);
    d.setDate(1); // 調整至 5 年前的 1 月 1 日，確保涵蓋完整年度數據
    const startDate = d.toISOString().split('T')[0];
    
    const datasets = [
        'TaiwanStockFinancialStatements',
        'TaiwanStockBalanceSheet',
        'TaiwanStockCashFlowsStatement'
    ];

    try {
        const fetchDataset = async (ds) => {
            try {
                // 加入快取破壞器 &cb= 以避免代理伺服器回傳過期的空數據
                const url = `https://api.finmindtrade.com/api/v4/data?dataset=${ds}&data_id=${rawSymbol}&start_date=${startDate}&cb=${Date.now()}`;
                let res = await analysisFetchProxy(url, true).catch(() => null);
                
                // 只有在「連線成功但數據為空」時才嘗試縮短日期，這代表數據可能太大被 API 限制
                if (res && (!res.data || res.data.length === 0)) {
                    const dShort = new Date(); dShort.setDate(dShort.getDate() - 1200);
                    const urlShort = `https://api.finmindtrade.com/api/v4/data?dataset=${ds}&data_id=${rawSymbol}&start_date=${dShort.toISOString().split('T')[0]}&retry=1&cb=${Date.now()}`;
                    res = await analysisFetchProxy(urlShort, true).catch(() => null);
                }
                
                if (res && res.data && res.data.length > 0) return res;
                return { data: [] };
            } catch (e) {
                return { data: [] };
            }
        };

        // ✅ 改為平行獲取以大幅提速
        const [jsonS, jsonB, jsonC, jsonInfo] = await Promise.all([
            fetchDataset('TaiwanStockFinancialStatements'),
            fetchDataset('TaiwanStockBalanceSheet'),
            fetchDataset('TaiwanStockCashFlowsStatement'),
            analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${rawSymbol}`, true).catch(() => null)
        ]);
        
        const results = [jsonS, jsonB, jsonC, jsonInfo];

        // ── 補充最新一季 ──────────────────────────────────────────────────────────
        // 原因：FinMind 免費 API 有筆數上限。金融股每季欄位多（50+ type），
        //        5 年資料一次 fetch 容易被截斷，導致最新一季（如 2026-03-31）缺失。
        //        解法：主 fetch 完後，若最新日期 > 100 天前，再補抓近 6 個月並 merge。
        try {
            const _chkDates = jsonS?.data?.length
                ? [...new Set(jsonS.data.map(x => x.date))].sort() : [];
            const _latestDate = _chkDates[_chkDates.length - 1] || '';
            const _daysSince  = _latestDate
                ? (Date.now() - new Date(_latestDate).getTime()) / 86400000 : 999;

            if (_daysSince > 100) {
                console.log(`[FinData] Latest date ${_latestDate} is ${_daysSince.toFixed(0)}d ago → supplemental recent fetch`);
                const _dSupp = new Date(); _dSupp.setDate(_dSupp.getDate() - 200);
                const _suppStart = _dSupp.toISOString().split('T')[0];

                const _fetchRecent = async (ds) => {
                    try {
                        const _url = `https://api.finmindtrade.com/api/v4/data?dataset=${ds}&data_id=${rawSymbol}&start_date=${_suppStart}&supp=1&cb=${Date.now()}`;
                        const _res = await analysisFetchProxy(_url, true).catch(() => null);
                        return (_res?.data?.length > 0) ? _res : null;
                    } catch (_e) { return null; }
                };

                const [_rS, _rB, _rC] = await Promise.all([
                    _fetchRecent('TaiwanStockFinancialStatements'),
                    _fetchRecent('TaiwanStockBalanceSheet'),
                    _fetchRecent('TaiwanStockCashFlowsStatement')
                ]);

                const _mergeInto = (base, supp) => {
                    if (!supp?.data?.length || !base?.data) return;
                    const keys = new Set(base.data.map(x => `${x.date}||${x.type}`));
                    let added = 0;
                    supp.data.forEach(x => {
                        if (!keys.has(`${x.date}||${x.type}`)) { base.data.push(x); added++; }
                    });
                    if (added > 0) console.log(`[FinData] Merged ${added} new records from ${supp.data[0]?.date || '?'}`);
                };

                _mergeInto(jsonS, _rS);
                _mergeInto(jsonB, _rB);
                _mergeInto(jsonC, _rC);
            }
        } catch (_suppErr) {
            console.warn('[FinData] Supplemental fetch failed:', _suppErr.message);
        }
        // ─────────────────────────────────────────────────────────────────────────

        // 取得產業資訊與發行股數 (關鍵：確保 PB 計算正確)

        let industry = '';
        let sharesFromInfo = 0;
        if (jsonInfo && jsonInfo.data && jsonInfo.data[0]) {
            industry = jsonInfo.data[0].industry_category;
            sharesFromInfo = jsonInfo.data[0].shares_issued || jsonInfo.data[0].number_of_shares_issued || jsonInfo.data[0].SharesIssued || 0;
        }
        // 備援：若仍缺失，從資產負債表「股本」反算 (股本 / 10)
        if (!sharesFromInfo && jsonB?.data) {
            const capitalTypes = ['CapitalStock', 'Capital_Stock', 'OrdinaryShareCapital', 'Ordinary_share_capital'];
            const capital = jsonB.data
                .filter(x => capitalTypes.includes(x.type) && !/_per$/i.test(x.type))
                .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                .pop()?.value || 0;
            if (capital > 0) sharesFromInfo = capital / 10;
        }

        if (!sharesFromInfo && sharesFromChips) sharesFromInfo = sharesFromChips;

        
        // 核心檢查：只要有損益表數據就嘗試呈現
        if (jsonS?.data?.length > 0) {
            const allDates = [...new Set(jsonS.data.map(x => x.date))].sort();
            const latestDate = allDates[allDates.length - 1];
            
            const getQData = (dataset, date) => dataset ? dataset.filter(x => x.date === date) : [];
            const getVal = (qData, types) => {
                if (!qData || qData.length === 0) return 0;
                if (typeof types === 'string') types = [types];
                const toNumber = (value) => {
                    const num = Number(value);
                    return Number.isFinite(num) ? num : 0;
                };
                
                // 1. 精確比對
                for (let t of types) {
                    const item = qData.find(x => x.type === t);
                    if (item && item.value !== undefined) return toNumber(item.value);
                }
                
                // 2. 寬鬆比對 (忽略大小寫、底線、空格)
                const cleanStr = (s) => (s || "").toLowerCase().replace(/_/g, '').replace(/\s/g, '').replace(/-/g, '');
                const cleanTypes = types.map(t => cleanStr(t));
                const allowPercentField = types.some(t => /(^|_)per$/i.test(t) || /percent|percentage|ratio/i.test(t));

                for (let ct of cleanTypes) {
                    const item = qData.find(x => {
                        if (!allowPercentField && /(^|_)per$/i.test(x.type || '')) return false;
                        const cx = cleanStr(x.type);
                        return cx === ct || cx.includes(ct);
                    });
                    if (item && item.value !== undefined) return toNumber(item.value);
                }
                return 0;
            };

            // 新增：取得單季離散值的輔助函數 (不改動原始數據)
            const getDiscreteVal = (dataset, date, types) => {
                if (!dataset || dataset.length === 0) return 0;
                const currentVal = getVal(getQData(dataset, date), types);
                const year = date.substring(0, 4);
                
                // 從該數據集中找出同一年份的前一個日期
                const dsDates = [...new Set(dataset.map(x => x.date))].sort();
                const idx = dsDates.indexOf(date);
                
                if (idx > 0 && dsDates[idx - 1].startsWith(year)) {
                    const prevVal = getVal(getQData(dataset, dsDates[idx - 1]), types);
                    return currentVal - prevVal;
                }
                return currentVal;
            };

            const latestS = getQData(jsonS.data, latestDate);
            
            const getLatestDataFromDataset = (dataset, date) => {
                if (!dataset || dataset.length === 0) return [];
                const dts = [...new Set(dataset.map(x => x.date))].sort();
                const d = dts.includes(date) ? date : dts.filter(x => x <= date).pop() || dts[dts.length - 1];
                return dataset.filter(x => x.date === d);
            };

            const latestB = getLatestDataFromDataset(jsonB?.data, latestDate);
            const latestC = getLatestDataFromDataset(jsonC?.data, latestDate);

            // 擴展關鍵欄位的匹配名稱，優先選用「歸屬於母公司」之數值 (整合版)
            const niSyns = ['Consolidated_net_income_attributable_to_owners_of_parent', 'Net_income_loss_attributable_to_owners_of_parent', 'NetIncomeAttributableToParent', 'NetIncome', 'Net_Income', 'IncomeAfterTaxes'];
            const eqSyns = ['Total_equity_attributable_to_owners_of_parent', 'Equity_attributable_to_owners_of_parent', 'TotalEquityAttributableToOwnersOfParent', 'EquityAttributableToOwnersOfParent', 'TotalEquity', 'Total_Equity', 'Equity'];
            const assetSyns = ['TotalAssets', 'Assets', 'Total_Assets', 'Total_assets'];

            const revenueSyns = ['Revenue', 'revenue', 'OperatingRevenue', 'Total_Operating_Revenue', 'Operating_Revenue'];
            const grossProfitSyns = ['GrossProfit', 'Gross_Profit', 'gross_profit', 'Gross_Profit_Loss', 'Gross_profit_loss_from_operations'];
            const opIncomeSyns = ['OperatingIncome', 'Operating_Income', 'operating_income', 'Operating_Income_Loss', 'Operating_income_loss'];
            const preTaxIncomeSyns = ['PreTaxIncome', 'IncomeBeforeTax', 'ProfitBeforeTax', 'Profit_Loss_Before_Tax', 'income_before_tax', 'Profit_loss_before_tax'];
            const interestExpSyns = ['FinancialCost', 'InterestExpense', 'FinanceCosts', 'Finance_Costs', 'interest_expense', 'Interest_expense', 'Financial_costs'];
            const ocfSyns = ['CashFlowsFromOperatingActivities', 'NetCashInflowFromOperatingActivities', 'Cash_flows_from_used_in_operating_activities', 'Net_cash_flows_from_used_in_operating_activities', 'Net_cash_generated_from_used_in_operating_activities', 'OperatingCashFlow', 'Operating_cash_flow', 'Net_cash_inflow_from_operating_activities'];
            const investingCFSyns = ['CashProvidedByInvestingActivities', 'CashFlowsFromInvestingActivities', 'NetCashInflowFromInvestingActivities', 'InvestingCashFlow', 'Investing_cash_flow', 'Net_cash_used_in_investing_activities'];
            const capexSyns = ['Acquisition_of_property_plant_and_equipment', 'PropertyAndPlantAndEquipment', 'AcquisitionOfPropertyPlantAndEquipment', 'Acquisition_of_property_plant_and_equipment_and_other_assets', 'purchase_of_property_plant_and_equipment'];

            const rev = getVal(latestS, revenueSyns);
            const netIncome = getVal(latestS, niSyns);
            const opIncome = getVal(latestS, opIncomeSyns);
            const grossProfit = getVal(latestS, grossProfitSyns);
            const preTaxIncome = getVal(latestS, preTaxIncomeSyns);
            
            const equity = getVal(latestB, eqSyns) || 1;
            const assets = getVal(latestB, assetSyns) || 1;
            const liabilities = getVal(latestB, ['TotalLiabilities', 'Liabilities', 'Total_Liabilities', 'liabilities', 'Total_liabilities']);
            const curAssets = getVal(latestB, ['CurrentAssets', 'TotalCurrentAssets', 'Current_Assets', 'current_assets', 'Total_current_assets']);
            const curLiab = getVal(latestB, ['CurrentLiabilities', 'TotalCurrentLiabilities', 'Current_Liabilities', 'current_liabilities', 'Total_current_liabilities']);
            const inv = getVal(latestB, ['Inventories', 'Inventory', 'TotalInventories', 'inventories', 'Inventories_net']);
            const retainedEarnings = getVal(latestB, ['RetainedEarnings', 'TotalRetainedEarnings', 'UnappropriatedRetainedEarnings', 'retained_earnings', 'Total_retained_earnings', 'Unappropriated_retained_earnings_undistributed_earnings']);
            
            const receivables = getVal(latestB, ['Accounts_Receivable', 'AccountsReceivable', 'AccountsReceivableNet', 'NotesAndAccountsReceivableNet', 'accounts_receivable', 'Notes_and_accounts_receivable_net', 'Accounts_receivable_net']);
            const payables = getVal(latestB, ['Accounts_Payable', 'AccountsPayable', 'Notes_Payable', 'NotesPayable', 'accounts_payable', 'Notes_and_accounts_payable', 'Accounts_payable']);
            
            const ppe = getVal(latestB, ['Property_plant_and_equipment', 'PropertyPlantAndEquipment', 'PropertyPlantAndEquipmentNet', 'property_plant_and_equipment']);
            const depr = getVal(latestC, ['Depreciation', 'Depreciation_and_amortization_expense', 'depreciation']);
            const sga = getVal(latestS, ['Selling_general_and_administrative_expenses', 'OperatingExpenses', 'Total_operating_expenses', 'operating_expenses']);
            const cfo = getVal(latestC, ocfSyns);

            const interestExp = Math.abs(getVal(latestS, interestExpSyns));
            const nonOpIncome = getVal(latestS, ['TotalNonoperatingIncomeAndExpense', 'NonOperatingIncome', 'TotalNonOperatingIncomeAndExpenses', 'Total_non_operating_income_and_expenses', 'Non-operating_income_and_expenses', 'Net_non_operating_income_and_expenses']);
            const cash = getVal(latestB, ['CashAndCashEquivalents', 'Cash_And_Cash_Equivalents', 'cash_and_cash_equivalents', 'Cash_and_cash_equivalents']);
            const nonOpRate = (netIncome !== 0) ? (nonOpIncome / Math.abs(netIncome) * 100) : 0;

            // 取得上季資產負債表數據用於計算「平均值」
            const prevDate = allDates.length >= 2 ? allDates[allDates.length - 2] : null;
            const prevB = prevDate ? getLatestDataFromDataset(jsonB?.data, prevDate) : [];

            // 計算平均權益與平均資產 (分母平均化可提升 ROE/ROA 精確度)
            const prevEquity = prevB.length > 0 ? getVal(prevB, eqSyns) : equity;
            const prevAssets = prevB.length > 0 ? getVal(prevB, assetSyns) : assets;
            const avgEquity = (equity + prevEquity) / 2;
            const avgAssets = (assets + prevAssets) / 2;

            const ttmDates = allDates.slice(-4);
            const sumStatementTTM = (types) => ttmDates.reduce((sum, date) => {
                return sum + (getVal(getQData(jsonS.data, date), types) || 0);
            }, 0);
            const normalizeCapexOutflow = (value) => {
                if (!value) return 0;
                return value > 0 ? -value : value;
            };
            const sumCashFlowTTM = (types, normalizeCapex = false) => ttmDates.reduce((sum, date) => {
                const value = getDiscreteVal(jsonC?.data, date, types) || 0;
                return sum + (normalizeCapex ? normalizeCapexOutflow(value) : value);
            }, 0);
            const getAverageBalanceEnding = (endDate, types) => {
                const endIdx = allDates.indexOf(endDate);
                const startDate = endIdx >= 4 ? allDates[endIdx - 4] : (endIdx > 0 ? allDates[endIdx - 1] : endDate);
                const endB = getLatestDataFromDataset(jsonB?.data, endDate);
                const startB = getLatestDataFromDataset(jsonB?.data, startDate);
                const endValue = endB.length > 0 ? getVal(endB, types) : getVal(latestB, types);
                const startValue = startB.length > 0 ? getVal(startB, types) : endValue;
                return (startValue > 0 && endValue > 0) ? ((startValue + endValue) / 2) : (endValue || startValue || 0);
            };
            const getAverageBalanceTTM = (types) => getAverageBalanceEnding(latestDate, types);

            const ttmRevenue = sumStatementTTM(revenueSyns);
            const ttmNetIncome = sumStatementTTM(niSyns);
            const ttmOpIncome = sumStatementTTM(opIncomeSyns);
            const ttmPreTaxIncome = sumStatementTTM(preTaxIncomeSyns);
            const ttmInterestExp = Math.abs(sumStatementTTM(interestExpSyns));
            const ttmOCF = sumCashFlowTTM(ocfSyns);
            const ttmInvestingCF = sumCashFlowTTM(investingCFSyns);
            const ttmCapEx = sumCashFlowTTM(capexSyns, true);
            const ttmFCF = ttmOCF + ttmCapEx;

            // 淨負債/EBITDA：以有息負債（finDebt 在後方計算，此處用同義方式先算 D&A TTM）
            // D&A TTM = 過去四季折舊攤銷加總（現金流量表中的非現金費用加回項）
            const daSyns = ['Depreciation', 'Depreciation_and_amortization_expense', 'depreciation', 'Depreciation_And_Amortization'];
            const ttmDA = sumCashFlowTTM(daSyns);
            const avgEquityTTM = getAverageBalanceTTM(eqSyns) || avgEquity;
            const avgAssetsTTM = getAverageBalanceTTM(assetSyns) || avgAssets;
            const cfoForAnnualMetrics = ttmOCF || cfo || 0;

            // Calculate Market Cap if possible
            const shares = sharesFromChips || sharesFromInfo || getVal(latestB, ['Shares_issued', 'NumberOfSharesIssued', 'Total_shares_issued', 'Ordinary_shares_issued', 'Ordinary_shares_outstanding', 'Total_shares_outstanding']) || 0;
            const marketCap = (currentPrice > 0 && shares > 0) ? (currentPrice * shares / 100000000) : 0; // 億元

            // 計算 8 季 EPS 趨勢
            const epsSynonyms = ['EPS', 'EarningsPerShare', 'BasicEarningsPerShare', 'Basic_earnings_loss_per_share', 'Basic_earnings_per_share'];
            const epsTrend8 = allDates.slice(-8).map(date => {
                const qd = getQData(jsonS.data, date);
                return { date: date, eps: getVal(qd, epsSynonyms) };
            });

            // 計算 EPS 年增率與毛利改善 (YoY)
            let epsYoY = null;
            let grossMarginYoYImprove = null;
            if (allDates.length >= 5) {
                const currentEps = getVal(latestS, epsSynonyms);
                const lastYearDate = allDates[allDates.length - 5];
                const lastYearS = getQData(jsonS.data, lastYearDate);
                const lastYearEps = getVal(lastYearS, epsSynonyms);
                if (lastYearEps !== 0) epsYoY = ((currentEps - lastYearEps) / Math.abs(lastYearEps)) * 100;
                
                const lastYearRev = getVal(lastYearS, revenueSyns);
                const lastYearGross = getVal(lastYearS, grossProfitSyns);
                if (rev > 0 && lastYearRev > 0) {
                    const currentGM = (grossProfit / rev) * 100;
                    const lastYearGM = (lastYearGross / lastYearRev) * 100;
                    grossMarginYoYImprove = currentGM - lastYearGM;
                }
            }

            const marginTrend4 = allDates.slice(-4).map(date => {
                const qd = getQData(jsonS.data, date);
                const qb = getLatestDataFromDataset(jsonB?.data, date);
                const qRev = getVal(qd, revenueSyns);
                const qNet = getVal(qd, niSyns);
                const currentEquity = getVal(qb, eqSyns) || 1;
                const currentAssets = getVal(qb, assetSyns) || 1;
                
                // 獲取上季數據以計算趨勢中的平均值
                const idx = allDates.indexOf(date);
                const prevDate = idx > 0 ? allDates[idx-1] : null;
                const prevQB = prevDate ? getLatestDataFromDataset(jsonB?.data, prevDate) : [];
                
                const prevEquity = prevQB.length > 0 ? getVal(prevQB, eqSyns) : currentEquity;
                const prevAssets = prevQB.length > 0 ? getVal(prevQB, assetSyns) : currentAssets;
                
                const avgEq = (currentEquity + prevEquity) / 2;
                const avgAssets = (currentAssets + prevAssets) / 2;

                return {
                    date: date,
                    grossMargin: qRev > 0 ? (getVal(qd, grossProfitSyns) / qRev * 100) : 0,
                    operatingMargin: qRev > 0 ? (getVal(qd, opIncomeSyns) / qRev * 100) : 0,
                    netMargin: qRev > 0 ? (qNet / qRev * 100) : 0,
                    roe: avgEq > 0 ? (qNet / avgEq * 100) : 0,
                    assetTurnover: avgAssets > 0 ? (qRev / avgAssets) : 0,
                    equityMultiplier: avgEq > 0 ? (avgAssets / avgEq) : 0
                };
            });

            // 新增：毛利率連續改善季數 (Margin Momentum Count)
            let marginMomentumCount = 0;
            if (marginTrend4.length >= 2) {
                // 從最新一季開始往前比對 (marginTrend4 已按日期排序)
                for (let i = marginTrend4.length - 1; i > 0; i--) {
                    if (marginTrend4[i].grossMargin > marginTrend4[i - 1].grossMargin) {
                        marginMomentumCount++;
                    } else {
                        break;
                    }
                }
            }

            // 獲利品質 (OCF / NI)
            const ocf = ttmOCF;
            const investingCF = ttmInvestingCF;
            const capex = ttmCapEx;
            const earningsQuality = (cfoForAnnualMetrics && ttmNetIncome > 0) ? (cfoForAnnualMetrics / ttmNetIncome * 100) : null;

            // 斯隆比例 (Sloan Ratio) = (淨利 - 營運現金流) / 平均總資產
            // 偵測「帳面盈餘 vs 實際現金」的落差，> 10% 代表盈餘品質存疑
            const sloanRatio = (avgAssetsTTM > 0 && ttmNetIncome !== null && cfoForAnnualMetrics !== null)
                ? ((ttmNetIncome - cfoForAnnualMetrics) / avgAssetsTTM) * 100
                : null;

            // Altman Z-Score Calculation (approximate)
            const zA = assets > 0 ? (curAssets - curLiab) / assets : 0;
            const zB = assets > 0 ? retainedEarnings / assets : 0;
            const zC = assets > 0 ? ttmOpIncome / assets : 0;
            const zE = assets > 0 ? ttmRevenue / assets : 0;

            const dio = (inv > 0 && rev > grossProfit) ? (inv / ((rev - grossProfit) / 90)) : 0;
            const dso = (receivables > 0 && rev > 0) ? (receivables / (rev / 90)) : 0;
            const dpo = (payables > 0 && rev > grossProfit) ? (payables / ((rev - grossProfit) / 90)) : 0;

            // Piotroski F-Score Calculation
            let fScore = 0;
            const fDetails = [];
            if (allDates.length >= 5) {
                const prevYearDate = allDates[allDates.length - 5];
                const prevS = getQData(jsonS.data, prevYearDate);
                const prevB = getLatestDataFromDataset(jsonB?.data, prevYearDate);
                
                const prevYearIdx = allDates.indexOf(prevYearDate);
                const prevTtmDates = prevYearIdx >= 3 ? allDates.slice(prevYearIdx - 3, prevYearIdx + 1) : [prevYearDate];
                const sumPrevStatement = (types) => prevTtmDates.reduce((sum, date) => {
                    return sum + (getVal(getQData(jsonS.data, date), types) || 0);
                }, 0);

                const ni = ttmNetIncome;
                const pni = sumPrevStatement(niSyns);
                const roa = avgAssetsTTM > 0 ? ni / avgAssetsTTM : 0;
                const pAssets = getVal(prevB, ['TotalAssets', 'Assets', 'Total_Assets']);
                const prevAvgAssets = getAverageBalanceEnding(prevYearDate, assetSyns) || pAssets;
                const proa = prevAvgAssets > 0 ? pni / prevAvgAssets : 0;
                const curOCF = cfoForAnnualMetrics || 0;
                
                const curLTD = getVal(latestB, ['LongTermLiabilities', 'NonCurrentLiabilities', 'TotalNonCurrentLiabilities']) || 0;
                const pLTD = getVal(prevB, ['LongTermLiabilities', 'NonCurrentLiabilities', 'TotalNonCurrentLiabilities']) || 0;
                const curCR = curLiab > 0 ? curAssets / curLiab : 0;
                const prevCL = getVal(prevB, ['CurrentLiabilities', 'TotalCurrentLiabilities']);
                const prevCA = getVal(prevB, ['CurrentAssets', 'TotalCurrentAssets']);
                const pCR = prevCL > 0 ? prevCA / prevCL : 0;
                
                const curGM = rev > 0 ? grossProfit / rev : 0;
                const prevRev = sumPrevStatement(revenueSyns);
                const prevGP = sumPrevStatement(grossProfitSyns);
                const pGM = prevRev > 0 ? prevGP / prevRev : 0;
                
                const curAT = avgAssetsTTM > 0 ? ttmRevenue / avgAssetsTTM : 0;
                const pAT = prevAvgAssets > 0 ? prevRev / prevAvgAssets : 0;

                const check = (cond, msg) => { 
                    if(cond) { fScore++; fDetails.push({msg, ok:true}); } 
                    else { fDetails.push({msg, ok:false}); } 
                };
                
                check(ni > 0, "ROA (近四季淨利) 為正值");
                check(curOCF > 0, "營運現金流 (OCF) 為正值");
                check(roa > proa, "ROA 較去年同期進步");
                check(curOCF > ni, "獲利品質優良 (OCF > 淨利)");
                // F5：財務槓桿 (長債/總資產) 未增加 —— 使用比率而非絕對值，避免資產規模膨脹時誤判
                const curLev = avgAssetsTTM > 0 ? curLTD / avgAssetsTTM : 0;
                const pLev   = prevAvgAssets > 0 ? pLTD / prevAvgAssets : 0;
                check(curLev <= pLev, "財務槓桿 (長債/資產比) 未增加");
                check(curCR > pCR, "流動比率較去年同期進步");
                // 股份稀釋檢核：比對本期與去年同期的發行股數
                const shareSyns = ['Shares_issued', 'NumberOfSharesIssued', 'Total_shares_issued', 'Ordinary_shares_issued', 'Ordinary_shares_outstanding', 'Total_shares_outstanding'];
                const curShares = shares || getVal(latestB, shareSyns);
                const pShares   = getVal(prevB, shareSyns);
                // 只有在資料齊全，且今年股數不超過去年時才給分 (允許減資，不允許增資稀釋)
                if (curShares > 0 && pShares > 0) {
                    check(curShares <= pShares, "股份稀釋檢核 (無增資行為)");
                } else {
                    check(true, "股份稀釋檢核 (數據不足，暫予通過)");
                }
                check(curGM > pGM, "毛利率較去年同期進步");
                check(curAT > pAT, "資產週轉率較去年同期進步");
            }

            // --- 新增：Beneish M-Score 舞弊診斷 (優化版) ---
            let mScore = null;
            if (allDates.length >= 2) {
                const curD = new Date(latestDate);
                const targetY = curD.getFullYear() - 1;
                const targetM = curD.getMonth();
                
                let prevYearDate = allDates.find(d => {
                    const dd = new Date(d);
                    return dd.getFullYear() === targetY && dd.getMonth() === targetM;
                });
                
                if (!prevYearDate && allDates.length >= 5) {
                    prevYearDate = allDates[allDates.length - 5];
                }

                if (prevYearDate) {
                    const prevS = getQData(jsonS.data, prevYearDate);
                    const prevB = getLatestDataFromDataset(jsonB?.data, prevYearDate);
                    const prevC = getLatestDataFromDataset(jsonC?.data, prevYearDate);

                    const r_t = rev, r_t1 = getVal(prevS, ['Revenue', 'revenue', 'OperatingRevenue']) || 1;
                    const ar_t = receivables, ar_t1 = getVal(prevB, ['Accounts_Receivable', 'AccountsReceivable', 'Accounts_receivable_net']) || 1;
                    const gp_t = grossProfit, gp_t1 = getVal(prevS, ['GrossProfit', 'Gross_Profit']) || 1;
                    const as_t = assets, as_t1 = getVal(prevB, assetSyns) || 1;
                    const ca_t = curAssets, ca_t1 = getVal(prevB, ['CurrentAssets', 'TotalCurrentAssets']) || 1;
                    const ppe_t = ppe, ppe_t1 = getVal(prevB, ['Property_plant_and_equipment', 'PropertyPlantAndEquipment', 'property_plant_and_equipment']) || 1;
                    const depr_t = depr, depr_t1 = getVal(prevC, ['Depreciation', 'Depreciation_and_amortization_expense']) || 0;
                    const sga_t = sga, sga_t1 = getVal(prevS, ['Selling_general_and_administrative_expenses', 'OperatingExpenses', 'operating_expenses']) || 1;
                    const lb_t = liabilities, lb_t1 = getVal(prevB, ['TotalLiabilities', 'Liabilities']) || 1;
                    const ni_t = ttmNetIncome || netIncome;
                    const cfo_t = cfoForAnnualMetrics;

                    const safeDiv = (a, b) => (b && b !== 0) ? a / b : 1;

                    const dsri = safeDiv(ar_t / r_t, ar_t1 / r_t1);
                    const gmi = safeDiv(gp_t1 / r_t1, gp_t / r_t);
                    const aqi = safeDiv(1 - (ca_t + ppe_t) / as_t, 1 - (ca_t1 + ppe_t1) / as_t1);
                    const sgi = safeDiv(r_t, r_t1);
                    const depi = safeDiv(depr_t1 / (ppe_t1 + depr_t1), depr_t / (ppe_t + depr_t));
                    const sgai = safeDiv(sga_t / r_t, sga_t1 / r_t1);
                    const lvgi = safeDiv(lb_t / as_t, lb_t1 / as_t1);
                    const tata = (ni_t - cfo_t) / as_t;

                    mScore = -4.84 + 0.92*dsri + 0.528*gmi + 0.404*aqi + 0.892*sgi + 0.115*depi - 0.172*sgai + 4.679*tata - 0.327*lvgi;
                }
            }

            // 計算歷史 TTM EPS 與 TTM 營收 (用於估值位階)
            const historicalTTM = [];
            const historicalPSData = [];
            for (let i = 3; i < allDates.length; i++) {
                const date = allDates[i];
                const qDataArray = [
                    getQData(jsonS.data, allDates[i]),
                    getQData(jsonS.data, allDates[i-1]),
                    getQData(jsonS.data, allDates[i-2]),
                    getQData(jsonS.data, allDates[i-3])
                ];
                
                // TTM EPS
                const ttmEps = qDataArray.reduce((sum, qd) => sum + (getVal(qd, epsSynonyms) || 0), 0);
                if (ttmEps > 0) historicalTTM.push({ date, ttm: ttmEps });
                
                // TTM Revenue & Shares (for PS Ratio)
                const ttmRev = qDataArray.reduce((sum, qd) => sum + (getVal(qd, revenueSyns) || 0), 0);
                const qb = getLatestDataFromDataset(jsonB?.data, date);
                const histShares = getVal(qb, ['Shares_issued', 'NumberOfSharesIssued', 'Total_shares_issued', 'Ordinary_shares_issued', 'Ordinary_shares_outstanding', 'Total_shares_outstanding']) || 
                                   (getVal(qb, ['Ordinary_share_capital', 'CapitalStock', 'Capital_Stock']) / 10) || 0;
                
                if (ttmRev > 0 && histShares > 0) {
                    historicalPSData.push({ date, ttmRev, shares: histShares });
                }
            }
            // 進階機構指標計算：ROIC 與 EV/EBIT 使用近四季 EBIT，避免單季數字年化失真
            const rawMarketCap = (currentPrice > 0 && shares > 0) ? (currentPrice * shares) : 0;
            // 優先加總明確有息負債科目，避免 getVal 只抓到第一個科目而低估 EV。
            const debtExactTypes = [
                'ShortTermBorrowings', 'Short-term_borrowings', 'ShortTermLoan', 'Short_term_loans',
                'LongTermBorrowings', 'Long-term_borrowings', 'LongTermLoan', 'Long_term_loans',
                'Current_portion_of_long_term_borrowings', 'CurrentPortionOfLongTermBorrowings',
                'BondsPayable', 'Bonds_payable'
            ];
            const finDebtExact = debtExactTypes.reduce((sum, type) => {
                const item = latestB.find(x => x.type === type);
                return sum + (item && item.value !== undefined ? Math.abs(item.value) : 0);
            }, 0);
            const finDebt = finDebtExact || getVal(latestB, ['Borrowings', 'LoansAndBorrowings']) || (liabilities * 0.4); // 近似值：若 API 無法拆分，以總負債 40% 替代有息負債
            const ev = rawMarketCap > 0 ? (rawMarketCap + finDebt - cash) : 0;
            const evEbit = (ev > 0 && ttmOpIncome > 0) ? (ev / ttmOpIncome) : null;
            const investedCapital = equity + finDebt - cash;
            const roic = (investedCapital > 0) ? (ttmOpIncome * 0.8 / investedCapital * 100) : null;

            return {
                quarter: latestDate,
                sharesIssued: shares,
                grossMargin: rev > 0 ? (grossProfit / rev) * 100 : 0,
                opMargin:    rev > 0 ? (opIncome / rev) * 100 : 0,
                netMargin:   rev > 0 ? (netIncome / rev) * 100 : 0,
                opExRatio:   rev > 0 ? ((grossProfit - opIncome) / rev) * 100 : 0,
                roic:        roic,
                evEbit:      evEbit,
                nonOpRate:   nonOpRate,
                dol:         (opIncome > 0 && grossProfit > 0) ? (grossProfit / opIncome) : null,
                grossImproveYoY: grossMarginYoYImprove,
                marginMomentumCount: marginMomentumCount,
                eps:         getVal(latestS, 'EPS'),
                epsLTM:      allDates.slice(-4).reduce((sum, date) => {
                    const qd = getQData(jsonS.data, date);
                    return sum + (getVal(qd, 'EPS') || 0);
                }, 0),
                epsYoY:      epsYoY,
                roe:         avgEquityTTM > 0 ? (ttmNetIncome / avgEquityTTM) * 100 : null,
                roa:         avgAssetsTTM > 0 ? (ttmNetIncome / avgAssetsTTM) * 100 : null,
                equity:      equity,
                assets:      assets,
                liabilities: liabilities,
                assetTurnover: avgAssetsTTM > 0 ? ttmRevenue / avgAssetsTTM : null,
                equityMultiplier: equity > 0 ? assets / equity : null,
                debtRatio:   getVal(latestB, 'Liabilities_per') || (liabilities / assets * 100),
                currentRatio: curLiab > 0 ? (curAssets / curLiab) * 100 : null,
                quickRatio:   curLiab > 0 ? ((curAssets - inv) / curLiab) * 100 : null,
                inventoryTurnover: (inv > 0 && rev >= grossProfit) ? ((rev - grossProfit) / inv) : null,
                inventoryDays: dio || null, 
                receivableDays: dso || null,
                payableDays: dpo || null,
                // 修正：使用明確條件判斷，避免 CCC=0 時被 || 誤判為 null
                ccc: (dio > 0 || dso > 0 || dpo > 0) ? (dio + dso - dpo) : null,
                interestCoverage: ttmInterestExp > 0 ? (ttmPreTaxIncome + ttmInterestExp) / ttmInterestExp : (ttmPreTaxIncome > 0 ? 999 : null),
                earningsQuality: earningsQuality,
                sloanRatio: sloanRatio,
                fcfTrend:    allDates.slice(-8).map(date => {
                    const ocfVal = getDiscreteVal(jsonC?.data, date, ocfSyns);
                    const capexVal = normalizeCapexOutflow(getDiscreteVal(jsonC?.data, date, capexSyns));
                    return { date, ocf: ocfVal, capex: capexVal, fcf: ocfVal + capexVal };
                }),
                latestOCF: ocf,
                latestCapEx: capex,
                epsTrend8: epsTrend8,
                epsTrendFull: allDates.map(date => {
                    const qd = getQData(jsonS.data, date);
                    return { date: date, eps: getVal(qd, epsSynonyms) };
                }),
                annualEpsTrend: (() => {
                    const yearly = {};
                    allDates.forEach(date => {
                        const year = date.substring(0, 4);
                        const qd = getQData(jsonS.data, date);
                        const val = getVal(qd, epsSynonyms) || 0;
                        yearly[year] = (yearly[year] || 0) + val;
                    });
                    return Object.keys(yearly).sort().map(y => ({ year: y, eps: yearly[y] }));
                })(),
                marginTrend: marginTrend4,
                zComponents: { zA, zB, zC, zE, liabilities },
                fScore,
                fDetails,
                mScore,
                ttmEps: (() => {
                    if (allDates.length < 4) return null;
                    const latest4 = allDates.slice(-4);
                    return latest4.reduce((sum, date) => sum + (getVal(getQData(jsonS.data, date), 'EPS') || 0), 0);
                })(),
                historicalTTM: historicalTTM,
                historicalPSData: historicalPSData,
                ttmEpsYoY: (() => {
                    if (allDates.length < 8) return null;
                    const curTTM = (getVal(getQData(jsonS.data, allDates[allDates.length - 1]), 'EPS') || 0) +
                                   (getVal(getQData(jsonS.data, allDates[allDates.length - 2]), 'EPS') || 0) +
                                   (getVal(getQData(jsonS.data, allDates[allDates.length - 3]), 'EPS') || 0) +
                                   (getVal(getQData(jsonS.data, allDates[allDates.length - 4]), 'EPS') || 0);
                    const prevTTM = (getVal(getQData(jsonS.data, allDates[allDates.length - 5]), 'EPS') || 0) +
                                    (getVal(getQData(jsonS.data, allDates[allDates.length - 6]), 'EPS') || 0) +
                                    (getVal(getQData(jsonS.data, allDates[allDates.length - 7]), 'EPS') || 0) +
                                    (getVal(getQData(jsonS.data, allDates[allDates.length - 8]), 'EPS') || 0);
                    return prevTTM !== 0 ? ((curTTM - prevTTM) / Math.abs(prevTTM)) * 100 : null;
                })(),
                netIncomeTrend: allDates.slice(-8).map(date => {
                    const sData = getQData(jsonS.data, date);
                    return { date, ni: getVal(sData, ['IncomeAfterTaxes', 'NetIncome', 'Net_Income', 'income_after_taxes', 'NetIncomeAttributableToParent', 'Net_Income_Loss', 'Consolidated_net_income_attributable_to_owners_of_parent']) };
                }),
                cashFlowFidelity: (() => {
                    const last8 = allDates.slice(-8);
                    let totalOCF = 0;
                    let totalNI = 0;
                    let ocfAboveNiCount = 0;
                    
                    last8.forEach(date => {
                        const sData = getQData(jsonS.data, date);
                        const ni = getVal(sData, ['IncomeAfterTaxes', 'NetIncome', 'Net_Income', 'income_after_taxes', 'NetIncomeAttributableToParent', 'Net_Income_Loss', 'Consolidated_net_income_attributable_to_owners_of_parent']);
                        const ocf = getDiscreteVal(jsonC?.data, date, ocfSyns);
                        
                        totalOCF += ocf;
                        totalNI += ni;
                        if (ocf > ni) ocfAboveNiCount++;
                    });
                    
                    return {
                        totalRatio: totalNI > 0 ? (totalOCF / totalNI * 100) : null,
                        stableCount: ocfAboveNiCount,
                        score: (totalNI > 0 && totalOCF > totalNI) ? '卓越' : (ocfAboveNiCount >= 4 ? '穩健' : '警戒')
                    };
                })(),
                epsTrend: allDates.slice(-8).map(date => {
                    const sData = getQData(jsonS.data, date);
                    return { date: date, eps: getVal(sData, 'EPS') || 0 };
                }),
                netDebt: liabilities - cash,
                netDebtRatio: equity > 0 ? ((liabilities - cash) / equity * 100) : null,
                netDebtEBITDA: (() => {
                    // 有息淨負債 / TTM EBITDA
                    // finDebt 已在下方 EV 計算段算出，此處採同邏輯內聯計算
                    const fd = debtExactTypes.reduce((s, t) => {
                        const item = latestB.find(x => x.type === t);
                        return s + (item && item.value !== undefined ? Math.abs(item.value) : 0);
                    }, 0) || getVal(latestB, ['Borrowings', 'LoansAndBorrowings']) || (liabilities * 0.4);
                    const nd = fd - (cash || 0);                // 有息淨負債
                    const ebitda = ttmOpIncome + (ttmDA || 0);  // TTM EBITDA = EBIT + D&A
                    if (ebitda <= 0) return null;               // EBITDA 為負無意義
                    return nd / ebitda;                          // 單位：倍
                })(),
                revCAGR: (() => {
                    const revSyns = ['Revenue', 'revenue', 'OperatingRevenue', 'Total_Operating_Revenue', 'Operating_Revenue'];
                    if (!allDates || allDates.length < 5) return null;
                    
                    // 為了穩定性，CAGR 改用 TTM (近四季總和) 來對比三年前的 TTM
                    const getTTMRev = (endIdx) => {
                        if (endIdx < 3) return 0;
                        let sum = 0;
                        for (let i = 0; i < 4; i++) {
                            sum += getVal(getQData(jsonS.data, allDates[endIdx - i]), revSyns);
                        }
                        return sum;
                    };

                    const latestTTM = getTTMRev(allDates.length - 1);
                    const oldIdx = Math.max(3, allDates.length - 13); // 3年前
                    const oldTTM = getTTMRev(oldIdx);
                    
                    const latestDate = allDates[allDates.length - 1];
                    const oldDate = allDates[oldIdx];
                    
                    const years = (allDates.length - 1 - oldIdx) / 4;
                    return {
                        value: (oldTTM > 0 && years > 0) ? (Math.pow(latestTTM / oldTTM, 1 / years) - 1) * 100 : null,
                        period: `${oldDate} 至 ${latestDate} (TTM 對比)`
                    };
                })(),
                sharesIssued: shares,
                rdRatio: (() => {
                    const rdSyns = ['Research_And_Development_Expenses', 'ResearchAndDevelopmentExpenses', 'Research_And_Development_Expense', 'research_and_development_expenses', '研究發展費用', 'RD_Expense', 'RDExpense', '研究發展費'];
                    const revSyns = ['Revenue', 'revenue', 'OperatingRevenue', 'Total_Operating_Revenue', 'Operating_Revenue'];
                    const opExSyns = ['OperatingExpenses', 'Operating_Expenses', 'operating_expenses', '營業費用'];
                    
                    // 從 jsonB (資產負債表) 或 jsonS 的 meta 中嘗試找產業資訊 (若無則預設為電子)
                    // 這裡簡單化處理：直接判斷是否有營業費用
                    if (allDates.length < 4) return 0;
                    
                    const calcRD = (qd) => {
                        return getVal(qd, rdSyns);
                    };

                    // 嘗試從最新單季抓取
                    const latestRD = calcRD(latestS);
                    const latestRev = getVal(latestS, revSyns);
                    
                    if (latestRD > 0 && latestRev > 0) return (latestRD / latestRev * 100);

                    // 否則回退到 TTM 計算
                    let totalRD = 0;
                    let totalRev = 0;
                    allDates.slice(-4).forEach(date => {
                        const qd = getQData(jsonS.data, date);
                        totalRD += calcRD(qd);
                        totalRev += getVal(qd, revSyns);
                    });
                    
                    return totalRev > 0 ? (totalRD / totalRev * 100) : 0;
                })(),
                revInvGrowthTrend: (() => {
                    const trend = [];
                    const displayDates = allDates.slice(-8); 
                    displayDates.forEach(date => {
                        const idx = allDates.indexOf(date);
                        if (idx < 4) return; 

                        const currS = getQData(jsonS.data, date);
                        const currB = getLatestDataFromDataset(jsonB?.data, date);
                        const prevDate = allDates[idx - 4];
                        const prevS = getQData(jsonS.data, prevDate);
                        const prevB = getLatestDataFromDataset(jsonB?.data, prevDate);

                        const cRev = getVal(currS, ['Revenue', 'revenue', 'OperatingRevenue', 'Total_Operating_Revenue', 'Operating_Revenue']);
                        const pRev = getVal(prevS, ['Revenue', 'revenue', 'OperatingRevenue', 'Total_Operating_Revenue', 'Operating_Revenue']);
                        const cInv = getVal(currB, ['Inventories', 'Inventory', 'Total_Inventories', 'TotalInventories']);
                        const pInv = getVal(prevB, ['Inventories', 'Inventory', 'Total_Inventories', 'TotalInventories']);

                        trend.push({
                            date,
                            revYoY: pRev > 0 ? ((cRev - pRev) / pRev * 100) : null,
                            invYoY: pInv > 0 ? ((cInv - pInv) / pInv * 100) : null
                        });
                    });
                    return trend;
                })(),
                dioDsoTrend: allDates.slice(-8).map(date => {
                    const qd = getQData(jsonS.data, date);
                    const qb = getLatestDataFromDataset(jsonB?.data, date);
                    const qRev = getVal(qd, ['Revenue', 'OperatingRevenue', 'Total_Operating_Revenue']);
                    const qGP = getVal(qd, ['GrossProfit', 'gross_profit']);
                    const qInv = getVal(qb, ['Inventories', 'Inventory', 'Total_Inventories']);
                    const qRec = getVal(qb, ['Accounts_Receivable', 'AccountsReceivable', 'Accounts_Receivable_net']);
                    
                    const dioVal = (qInv > 0 && qRev > qGP) ? (qInv / ((qRev - qGP) / 90)) : 0;
                    const dsoVal = (qRec > 0 && qRev > 0) ? (qRec / (qRev / 90)) : 0;
                    return { date, dio: dioVal, dso: dsoVal };
                }),
                // CCC 完整多季趨勢（含 DSO/DIO/DPO/CCC，供折線圖使用）
                cccTrend: allDates.map(date => {
                    const qd = getQData(jsonS.data, date);
                    const qb = getLatestDataFromDataset(jsonB?.data, date);
                    const qRev = getVal(qd, ['Revenue', 'OperatingRevenue', 'Total_Operating_Revenue']) || 0;
                    const qGP  = getVal(qd, ['GrossProfit', 'gross_profit']) || 0;
                    const qInv = getVal(qb, ['Inventories', 'Inventory', 'Total_Inventories']) || 0;
                    const qRec = getVal(qb, ['Accounts_Receivable', 'AccountsReceivable', 'Accounts_Receivable_net']) || 0;
                    const qPay = getVal(qb, ['Accounts_Payable', 'AccountsPayable', 'Notes_Payable', 'NotesPayable', 'Notes_and_accounts_payable', 'Accounts_payable']) || 0;
                    const cogs = (qRev > 0 && qGP < qRev) ? (qRev - qGP) : 0;
                    const dio = (qInv > 0 && cogs > 0) ? (qInv / (cogs / 90)) : 0;
                    const dso = (qRec > 0 && qRev > 0) ? (qRec / (qRev / 90)) : 0;
                    const dpo = (qPay > 0 && cogs > 0) ? (qPay / (cogs / 90)) : 0;
                    const ccc = (dio > 0 || dso > 0) ? (dio + dso - dpo) : null;
                    return { date, dio, dso, dpo, ccc };
                }).filter(x => x.dio > 0 || x.dso > 0),
                totalFCF5Y: (() => {
                    // 精確計算近 20 季 (5 年) 的離散值總和
                    const last20 = allDates.slice(-20);
                    let total = 0;
                    last20.forEach(date => {
                        const ocfVal = getDiscreteVal(jsonC?.data, date, ocfSyns) || 0;
                        const capexVal = normalizeCapexOutflow(getDiscreteVal(jsonC?.data, date, capexSyns) || 0);
                        total += (ocfVal + capexVal);
                    });
                    return total;
                })(),
                fcfContinuity: (() => {
                    // 按年份分組計算 FCF (使用離散值加總)
                    const yearlyFCF = {};
                    allDates.forEach(date => {
                        const year = date.split('-')[0];
                        const ocfVal = getDiscreteVal(jsonC?.data, date, ocfSyns) || 0;
                        const capexVal = normalizeCapexOutflow(getDiscreteVal(jsonC?.data, date, capexSyns) || 0);
                        const fcf = ocfVal + capexVal;
                        yearlyFCF[year] = (yearlyFCF[year] || 0) + fcf;
                    });
                    
                    const years = Object.keys(yearlyFCF).sort().reverse();
                    const last10Years = years.slice(0, 10);
                    const positiveCount = last10Years.filter(y => yearlyFCF[y] > 0).length;
                    
                    // 計算連續正向年份 (由近往遠)
                    let continuousPositiveYears = 0;
                    for (let y of last10Years) {
                        if (yearlyFCF[y] > 0) continuousPositiveYears++;
                        else break;
                    }
                    
                    return {
                        positiveCount,
                        totalYears: last10Years.length,
                        continuousPositiveYears,
                        isExcellent: continuousPositiveYears >= 5 || (positiveCount >= 8 && last10Years.length >= 8)
                    };
                })(),
                fcfYield: (marketCap > 0) ? ((ttmFCF / 100000000) / marketCap * 100) : 0,
                marketCap: marketCap,
                opCashFlow: ocf,
                investingCashFlow: investingCF,
                freeCashFlow: ttmFCF,
                allTypes: latestC ? latestC.map(x => x.type).join(', ') : 'EMPTY'
            };
        }
    } catch(e) { console.warn("FinMind Multi-Financial failed", e); }
    return null;
}


/**
 * 獲取產業同業 (龍頭) 的專業對比數據 (18 項指標)
 * @param {string} industry 產業名稱
 * @param {string} currentSymbol 當前股票代號
 */
async function fetchIndustryPeersMetrics(industry, currentSymbol) {
    if (!window.allStockInfoCache || !industry) return [];
    
    // 1. 找出同產業所有股票
    const industryPeers = window.allStockInfoCache.filter(x => x.industry_category === industry);
    const sortedPeers = industryPeers.sort((a, b) => parseInt(a.stock_id) - parseInt(b.stock_id));
    
    // 2. 判斷自身是否在龍頭 (前三)
    const top3 = sortedPeers.slice(0, 3);
    const isSelfInTop3 = top3.some(p => p.stock_id === currentSymbol);
    
    let targetPeers = isSelfInTop3 
        ? sortedPeers.filter(p => p.stock_id !== currentSymbol).slice(0, 3) 
        : top3;

    // 3. 並行獲取數據
    const peerDataPromises = targetPeers.map(async (peer) => {
        try {
            const d = new Date(); d.setDate(d.getDate() - 450);
            const startDate = d.toISOString().split('T')[0];
            
            const [jsonS, jsonB, jsonP, jsonR] = await Promise.all([
                analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockFinancialStatements&data_id=${peer.stock_id}&start_date=${startDate}`, true),
                analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockBalanceSheet&data_id=${peer.stock_id}&start_date=${startDate}`, true),
                analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPER&data_id=${peer.stock_id}&start_date=${startDate}`, true),
                analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMonthRevenue&data_id=${peer.stock_id}&start_date=${startDate}`, true)
            ]);

            if (jsonS?.data?.length > 0) {


                const allDates = [...new Set(jsonS.data.map(x => x.date))].sort();
                const latestDate = allDates[allDates.length - 1];
                const prevYearDate = allDates[allDates.length - 5];

                const getVal = (qData, types) => {
                    const toNumber = (value) => {
                        const num = Number(value);
                        return Number.isFinite(num) ? num : 0;
                    };
                    for (let t of (Array.isArray(types) ? types : [types])) {
                        const item = qData.find(x => x.type === t);
                        if (item) return toNumber(item.value);
                    }
                    return 0;
                };

                const s = jsonS.data.filter(x => x.date === latestDate);
                const balanceDates = jsonB?.data ? [...new Set(jsonB.data.map(x => x.date))].sort() : [];
                const balanceDate = balanceDates.filter(d => d <= latestDate).pop() || balanceDates[balanceDates.length - 1];
                const b = balanceDate ? jsonB.data.filter(x => x.date === balanceDate) : [];
                const p = jsonP?.data ? jsonP.data[jsonP.data.length - 1] : null;
                const r = jsonR?.data ? jsonR.data.slice(-13) : [];

                const rev = getVal(s, ['Revenue', 'OperatingRevenue']);
                const gp = getVal(s, ['GrossProfit', 'gross_profit']);
                const op = getVal(s, ['OperatingIncome', 'operating_income']);
                const ni = getVal(s, ['IncomeAfterTaxes', 'NetIncome']);
                const rd = getVal(s, ['Research_And_Development_Expenses', 'ResearchAndDevelopmentExpenses', 'research_and_development_expenses', 'Research_And_Development_Expense', '研究發展費用', 'RD_Expense']);
                
                const assets = getVal(b, ['TotalAssets', 'Assets']) || 1;
                const equity = getVal(b, ['TotalEquity', 'Equity']) || 1;
                const liab = getVal(b, ['TotalLiabilities', 'Liabilities']);
                const cAssets = getVal(b, ['CurrentAssets', 'TotalCurrentAssets']);
                const cLiab = getVal(b, ['CurrentLiabilities', 'TotalCurrentLiabilities']);
                const inv = getVal(b, ['Inventories', 'Inventory']);
                const rec = getVal(b, ['Accounts_Receivable', 'AccountsReceivable']);
                const pay = getVal(b, ['Accounts_Payable', 'AccountsPayable']);

                // 營收成長 (YoY)
                let revYoY = 0;
                if (r.length >= 13) {
                    const curR = r[r.length-1].revenue || 0;
                    const preR = r[r.length-13].revenue || 0;
                    if (preR > 0) revYoY = ((curR - preR) / preR) * 100;
                }

                const dio = (inv > 0 && rev > gp) ? (inv / ((rev - gp) / 90)) : 0;
                const dso = (rec > 0 && rev > 0) ? (rec / (rev / 90)) : 0;
                const dpo = (pay > 0 && rev > gp) ? (pay / ((rev - gp) / 90)) : 0;

                // 龍頭對比同樣使用 TTM 研發費用 (若數據足夠)
                const rdSyns = ['Research_And_Development_Expenses', 'ResearchAndDevelopmentExpenses', 'Research_And_Development_Expense', 'research_and_development_expenses', '研究發展費用', 'RD_Expense'];
                let totalRD = getVal(s, rdSyns);
                let totalRev = rev;
                
                // 嘗試獲取更多季度來計算 TTM (簡化處理)
                const rdRatio = totalRev > 0 ? (totalRD / totalRev * 100) : 0;
                
                return {
                    name: peer.stock_name,
                    symbol: peer.stock_id,
                    rev: revYoY,
                    yield: p?.dividend_yield || 0,
                    gm: rev > 0 ? (gp / rev * 100) : 0,
                    om: rev > 0 ? (op / rev * 100) : 0,
                    nm: rev > 0 ? (ni / rev * 100) : 0,
                    roe: equity > 0 ? (ni / equity * 100) : 0,
                    roa: assets > 0 ? (ni / assets * 100) : 0,
                    rd: rdRatio,
                    dio: dio, dso: dso, dpo: dpo, ccc: (dio > 0 || dso > 0 || dpo > 0) ? (dio + dso - dpo) : null,
                    at: assets > 0 ? (rev / assets) : 0,
                    dr: assets > 0 ? (liab / assets * 100) : 0,
                    cr: cLiab > 0 ? (cAssets / cLiab * 100) : 0,
                    qr: cLiab > 0 ? ((cAssets - inv) / cLiab * 100) : 0,
                    pe: p?.PER || 0,
                    pb: p?.PBR || 0
                };
            }
        } catch (e) { console.warn(`Peer ${peer.stock_name} fetch failed`, e); }
        return null;
    });

    const results = await Promise.all(peerDataPromises);
    return results.filter(r => r !== null);
}

// --- 6. MoneyDJ 分點集中度 (Broker Concentration) ---
async function fetchBrokerConcentration(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    
    const fetchForPeriod = async (days) => {
        // 富邦的 URL 邏輯：
        // 1日: zco.djhtm?a=SYMBOL
        // 5日: zco_SYMBOL_2.djhtm
        // 20日: zco_SYMBOL_4.djhtm
        let url;
        if (days === 1) {
            url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco.djhtm?a=${rawSymbol}`;
        } else {
            const map = { 5: 2, 10: 3, 20: 4, 40: 5, 60: 6 };
            const suffix = map[days] || 2;
            url = `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zco/zco_${rawSymbol}_${suffix}.djhtm`;
        }
        
        try {
            const html = await analysisFetchProxy(url, false);
            if (!html) return null;

            // 1. 提取合計買超/賣超張數與均價 (位於表格底部)
            const buySumMatch = html.match(/合計買超張數[\s\S]*?<td[^>]*>([\d,]+)[\s\S]*?平均買超成本[\s\S]*?<td[^>]*>([\d,.]+)/i);
            const sellSumMatch = html.match(/合計賣超張數[\s\S]*?<td[^>]*>([\d,]+)[\s\S]*?平均賣超成本[\s\S]*?<td[^>]*>([\d,.]+)/i);
            
            let topBuySum = 0, avgBuyCost = 0, topSellSum = 0, avgSellCost = 0;
            if (buySumMatch) {
                topBuySum = parseInt(buySumMatch[1].replace(/,/g, ''));
                avgBuyCost = parseFloat(buySumMatch[2].replace(/,/g, ''));
            }
            if (sellSumMatch) {
                topSellSum = parseInt(sellSumMatch[1].replace(/,/g, ''));
                avgSellCost = parseFloat(sellSumMatch[2].replace(/,/g, ''));
            }

            // 2. 提取買賣超前 5 大分點明細
            const topBrokers = [];
            const topSellers = [];
            const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
            for (let row of rows) {
                // 擴展過濾條件以包含 zco0.djhtm 格式與賣超連結
                if (row.includes('zco0.djhtm') || row.includes('Link2Buy') || row.includes('Link2Sell') || row.includes('genLinkBroker')) {
                    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
                    const clean = (c) => c.replace(/<[^>]*>/g, '').trim().replace(/,/g, '');
                    
                    // 根據網頁結構 (共 10 欄):
                    // [買超券商, 買進, 賣出, 買超淨額, 比重, 賣超券商, 買進, 賣出, 賣超淨額, 比重]
                    
                    // 提取買超分點 (索引 0 與 3)
                    if (cells.length >= 4) {
                        const name = clean(cells[0]);
                        const buyNet = parseInt(clean(cells[3]));
                        if (!isNaN(buyNet) && buyNet > 0 && topBrokers.length < 5 && name && !name.includes('買超') && !name.includes('券商')) {
                            topBrokers.push({ name, buyNet });
                        }
                    }
                    
                    // 提取賣超分點 (索引 5 與 8)
                    if (cells.length >= 9) {
                        const sName = clean(cells[5]);
                        const sellNet = parseInt(clean(cells[8]));
                        if (!isNaN(sellNet) && sellNet > 0 && topSellers.length < 5 && sName && !sName.includes('賣超') && !sName.includes('券商')) {
                            topSellers.push({ name: sName, sellNet });
                        }
                    }
                }
            }

            return { days, topBuySum, topSellSum, mainNetBuy: topBuySum - topSellSum, avgBuyCost, avgSellCost, topBrokers, topSellers };
        } catch (e) { return null; }
    };

    const periods = [1, 5, 20, 60];
    const results = await Promise.all(periods.map(p => fetchForPeriod(p)));
    return {
        d1: results[0],
        d5: results[1],
        d20: results[2],
        d60: results[3]
    };
}

// --- 6. FinMind 融資融券 ---
async function fetchFinMindMargin(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date();
    d.setDate(d.getDate() - 30); // 擴大到 30 天，確保能抓到資料
    const startDate = d.toISOString().split('T')[0];
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMarginPurchaseShortSale&data_id=${rawSymbol}&start_date=${startDate}&cb=${Date.now()}`;
    try {
        const json = await analysisFetchProxy(url, true);
        if (json && json.data && json.data.length > 0) {
            const data = [...json.data].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            const latest = data[data.length - 1];
            
            // 強化欄位提取邏輯
            const toNumber = (value) => {
                const num = Number(value);
                return Number.isFinite(num) ? num : 0;
            };
            const getMarginBal = (item) => toNumber(item?.MarginPurchaseTodayBalance ?? item?.margin_purchase_today_balance ?? item?.MarginPurchaseBalance ?? item?.margin_purchase_balance ?? 0);
            
            const marginBal = getMarginBal(latest);
            const shortBal  = toNumber(latest.ShortSaleTodayBalance ?? latest.short_sale_today_balance ?? latest.ShortSaleBalance ?? latest.short_sale_balance ?? 0);
            const marginLim = toNumber(latest.MarginPurchaseLimit ?? latest.margin_purchase_limit ?? 0);
            
            // 計算近 10 日趨勢 (斜率與變動百分比)
            let marginTrend = null;
            const lastN = data.slice(-10); // 嘗試抓取最後 10 筆，若不足 10 筆也會抓到剩餘的所有筆數
            if (lastN.length >= 3) { // 提高到 3 筆以上計算較有意義
                const values = lastN.map(getMarginBal);
                const n = values.length;
                let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
                for (let i = 0; i < n; i++) {
                    sumX += i;
                    sumY += values[i];
                    sumXY += i * values[i];
                    sumX2 += i * i;
                }
                
                const denominator = (n * sumX2 - sumX * sumX);
                const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
                
                // 變動百分比 (相較於序列起點)
                const firstVal = values[0];
                const lastVal = values[values.length - 1];
                let changePct = 0;
                if (firstVal > 0) {
                    changePct = ((lastVal - firstVal) / firstVal * 100);
                } else if (lastVal > 0) {
                    changePct = 100; // 從 0 到有
                }
                
                marginTrend = {
                    slope: slope,
                    percent: Math.abs(changePct).toFixed(1),
                    arrow: slope > 0.001 ? '↗' : (slope < -0.001 ? '↘' : '→'),
                    color: slope > 0.001 ? '#f87171' : (slope < -0.001 ? '#4ade80' : '#fff')
                };
            }
            
            return {
                marginPurchase: marginBal,
                shortSale: shortBal,
                marginLimit: marginLim,
                marginUseRate: marginLim > 0 ? (marginBal / marginLim * 100).toFixed(1) : '0.0',
                marginMaintenance: latest.MarginPurchaseMaintenanceRatio || latest.margin_purchase_maintenance_ratio || null,
                marginTrend: marginTrend
            };
        } else {
            console.warn(`[Margin] No data returned for ${rawSymbol} since ${startDate}`);
        }
    } catch(e) { console.warn("FinMind Margin failed", e); }
    return null;
}

// --- 7. FinMind 三大法人近一個月買賣超 ---
async function fetchFinMindInstitutional(symbol, latestVol = 0) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date();
    d.setDate(d.getDate() - 500); // 擴大至 500 自然日 ≈ 360 交易日，確保 slice(-240) 有足夠緩衝
    const startDate = d.toISOString().split('T')[0];
    const log = (msg) => {
        window._fetchLogs = window._fetchLogs || [];
        window._fetchLogs.push(`[${new Date().toLocaleTimeString()}] [Inst] ${msg}`);
    };
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${rawSymbol}&start_date=${startDate}&cb=${Date.now()}`;
    let json = null;
    try {
        json = await analysisFetchProxy(url, true);
    } catch (e) {
        const d2 = new Date(); d2.setDate(d2.getDate() - 120);
        const url2 = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${rawSymbol}&start_date=${d2.toISOString().split('T')[0]}&cb=${Date.now()}`;
        json = await analysisFetchProxy(url2, true).catch(() => null);
    }
    const parseData = (data) => {
        if (!data || data.length === 0) return null;
        const allDates = [...new Set(data.map(x => x.date))].sort();
        if (allDates.length === 0) return null;
        
        const latestDate = allDates[allDates.length - 1];
        
        const calcNet = (dataset) => {
            if (!dataset || dataset.length === 0) return { foreign: 0, trust: 0, dealer: 0 };
            const getNet = (item) => {
                const b = parseFloat(item.buy || item.Buy || item.buy_shares || 0);
                const s = parseFloat(item.sell || item.Sell || item.sell_shares || 0);
                return (b - s) / 1000; // 轉為張
            };
            const f = dataset.filter(x => {
                const n = (x.name||x.Name||"").toLowerCase();
                return n.includes('foreign') || n.includes('外資') || n.includes('陸資');
            }).reduce((a,b)=>a+getNet(b), 0);
            const t = dataset.filter(x => {
                const n = (x.name||x.Name||"").toLowerCase();
                return n.includes('trust') || n.includes('投信');
            }).reduce((a,b)=>a+getNet(b), 0);
            const d = dataset.filter(x => {
                const n = (x.name||x.Name||x.name_zh_tw||"").toLowerCase();
                return n.includes('dealer') || n.includes('自營') || n.includes('自營商');
            }).reduce((a,b)=>a+getNet(b), 0);
            return { foreign: f, trust: t, dealer: d };
        };

        const latestDay = calcNet(data.filter(x => x.date === latestDate));
        latestDay.date = latestDate;
        const fiveDayTotal = calcNet(data.filter(x => allDates.slice(-5).includes(x.date)));
        
        const getStreak = (type) => {
            let streak = 0;
            for (let i = 0; i < allDates.length; i++) {
                const date = allDates[allDates.length - 1 - i];
                const dayData = data.filter(x => x.date === date);
                const net = dayData.filter(x => {
                    const n = (x.name || x.Name || x.name_zh_tw || "").toLowerCase();
                    if (type === 'foreign') return n.includes('foreign') || n.includes('外資') || n.includes('陸資');
                    if (type === 'trust') return n.includes('trust') || n.includes('投信');
                    if (type === 'dealer') return n.includes('dealer') || n.includes('自營');
                    return false;
                }).reduce((a,b)=>a+( (b.buy||b.Buy||b.buy_shares||0) - (b.sell||b.Sell||b.sell_shares||0) ), 0);
                
                if (i === 0) { 
                    if (net === 0) continue; 
                    streak = net > 0 ? 1 : -1; 
                } else {
                    if (net > 0 && streak > 0) streak++;
                    else if (net < 0 && streak < 0) streak--;
                    else break;
                }
            }
            return streak;
        };

        // 整理每日買賣超數據用於成本計算
        const daily = allDates.map(date => {
            const dayData = data.filter(x => x.date === date);
            const net = calcNet(dayData);
            return { date, foreign: net.foreign, trust: net.trust, dealer: net.dealer };
        });

        return {
            date: latestDate,
            latestDay,
            fiveDayTotal,
            daily,
            streaks: { foreign: getStreak('foreign'), trust: getStreak('trust') },
            latestDayNetPct: (latestVol && latestVol > 0) ? ( (latestDay.foreign + latestDay.trust + latestDay.dealer) * 1000 / latestVol * 100 ) : 0,
            sample: `Data OK (${data.length} records)`
        };
    };

    if (json && json.data && json.data.length > 0) return parseData(json.data);
    return null;
}

async function fetchInstitutionalMoneyDJ(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const url = `https://www.moneydj.com/Z/ZC/ZCL/ZCL.djhtm?a=${rawSymbol}`;
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const text = await res.text();
        const foreignMatch = text.match(/外資<\/td><td[^>]*>([^<]+)<\/td>/);
        const parseNum = (s) => s ? parseFloat(s.replace(/,/g, '')) : 0;
        if (foreignMatch) {
            return {
                latestDay: { foreign: parseNum(foreignMatch[1]), trust: 0, dealer: 0 },
                fiveDayTotal: { foreign: 0, trust: 0, dealer: 0 },
                streaks: { foreign: 0, trust: 0 },
                latestDayNetPct: 0,
                sample: "MoneyDJ Scraped"
            };
        }
    } catch (e) {}
    return null;
}

// === Rendering Logic ===

function renderAnalysis(symbol, name, chartData, twseBasic, chipsData, revData, finData, marginData, institutionalData, avgCost = null, riskMetrics = null, insiderActivity = null, debugInfo = null, brokerData = null, peerCCCData = [], chipCosts = null, winnerBrokers = [], topSellers60 = [], totalTime = null) {
    if (!chartData) {
        analysisBody.innerHTML = `
            <div style="text-align:center; padding:60px 20px; background:rgba(255,255,255,0.02); border-radius:15px; border:1px dashed rgba(255,255,255,0.1);">
                <div style="font-size:50px; margin-bottom:20px;">📡</div>
                <div style="color:#f87171; font-size:20px; font-weight:700; margin-bottom:12px;">核心數據載入失敗 (v18)</div>
                <div style="color:#cbd5e1; font-size:14px; line-height:1.6; margin-bottom:25px;">
                    連線偵測結果：<br>
                    <div id="fetchDiagnostic" style="font-size:11px; color:#cbd5e1; font-family:monospace; margin-top:10px; text-align:left; background:rgba(0,0,0,0.6); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); max-height:150px; overflow-y:auto; line-height:1.5;">
                        ${(window._fetchLogs && window._fetchLogs.length > 0) ? window._fetchLogs.slice(-8).join('<br>') : '⚠️ 無日誌記錄，請確認網路連線或重試'}
                    </div>
                </div>
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}', true)" 
                        style="background:#3b82f6; color:white; border:none; padding:12px 30px; border-radius:12px; cursor:pointer; font-weight:700; font-size:15px; box-shadow:0 4px 15px rgba(59, 130, 246, 0.4);">
                    🚀 嘗試終極重新連線
                </button>
            </div>
        `;
        return;
    }
    const { currentPrice, ma, high52w, low52w, posIn52w, rsi14, bb, latestVol, avgVol5, kd, macd, price1m, price3m, mom6m, mom1y, mom2y, mom3y, mom4y, mom5y, momYTD } = chartData;
    
    // 計算均線排列與技術狀態 (修正 undefined 問題)
    let maStatus = "數據不足";
    let goldenCross = false;
    let deathCross = false;
    if (ma && ma.ma5 && ma.ma10 && ma.ma20 && ma.ma60 && ma.ma120 && ma.ma240) {
        if (ma.ma5 > ma.ma10 && ma.ma10 > ma.ma20 && ma.ma20 > ma.ma60 && ma.ma60 > ma.ma120 && ma.ma120 > ma.ma240) {
            maStatus = "多頭排列 (強勢)";
            goldenCross = true;
        } else if (ma.ma5 < ma.ma10 && ma.ma10 < ma.ma20 && ma.ma20 < ma.ma60 && ma.ma60 < ma.ma120 && ma.ma120 < ma.ma240) {
            maStatus = "空頭排列 (弱勢)";
            deathCross = true;
        } else if (ma.ma5 > ma.ma20) {
            maStatus = "短線轉強";
        } else {
            maStatus = "區間震盪";
        }
    }
    chartData.maStatus = maStatus;
    chartData.goldenCross = goldenCross;
    chartData.deathCross = deathCross;
    
    if (bb) {
        const bandwidth = (bb.upper - bb.lower) / bb.mid;
        chartData.bbSqueeze = bandwidth < 0.1;
    }
    
    // 更新表頭名稱與價格
    const displayTitleName = (chipsData?.stockName || name || "股票");

    // ══════════════════════════════════════════════════════════
    // ── 股票類型判斷 & N/A Context 建構 ──────────────────────
    // ══════════════════════════════════════════════════════════
    const _industry = chipsData?.industry || '';
    const isETF          = !finData;   // ETF / 基金：finData 為 null
    const isFinancialSec = /銀行|金融控股|保險|證券|票券|投信/.test(_industry);
    const isNoInventory  = /旅館|飯店|餐飲|航空|觀光|軟體|電信|媒體/.test(_industry);

    const _naRows = new Set();

    if (isETF) {
        // ETF：無財務報表，所有財務指標欄位均 N/A
        ['單季 EPS 📈','毛利率','營業利益率','業外損益佔比','應收帳款狀態',
         'ROIC (投入資本回報)','存貨週轉天數 (DIO)','應收帳款天數 (DSO)','應付帳款天數 (DPO)',
         '現金週期 (CCC) 📈','存貨週轉率','5年累計自由現金流','FCF 連貫性 (5年)',
         '近四季自由現金流 (FCF)','近四季營業現金流 (OCF)','近四季投資現金流 (ICF)',
         '淨負債 (總負債-現金)','流動比率','速動比率','負債比率','淨負債比率',
         '利息保障倍數','獲利品質 (OCF/NI)','每股淨值 (BPS)',
         // ETF 估值相關欄位（無法計算個股本益比等）
         '市值營收比 (PS)','自由現金流殖利率','葛拉漢內在價值',
         '市淨率 (P/B)','企業價值倍數 (EV/EBIT)',
         '盈餘殖利率 (EY)','股權風險溢酬 (ERP)',
         'EPS 成長率 (TTM)','PEG 比例','營運槓桿度 (DOL)',
         // ETF 河圖估值位階（以PE/PB為基礎，ETF不適用）
         'PE 位階','PS 位階','PB 位階',
         // ETF 股利分析欄位
         '盈餘分配率 (Payout Ratio)','自由現金流配息率','近四季 EPS (LTM)'
        ].forEach(f => _naRows.add(f));
    }

    if (isFinancialSec && !isETF) {
        // 金融業：存貨/應收帳款/CCC 等製造業指標在此不適用；以資料是否確實缺失作雙重確認
        const _chk = (lbl, val) => { if (val === null || val === undefined) _naRows.add(lbl); };
        _chk('存貨週轉天數 (DIO)',   finData?.inventoryDays);
        _chk('應收帳款天數 (DSO)',   finData?.receivableDays);
        _chk('應付帳款天數 (DPO)',   finData?.payableDays);
        _chk('現金週期 (CCC) 📈', finData?.ccc);
        _chk('存貨週轉率',         finData?.inventoryTurnover);
        _chk('ROIC (投入資本回報)', finData?.roic);
        _chk('毛利率',             finData?.grossMargin);
        _chk('近四季自由現金流 (FCF)', finData?.freeCashFlow);
        _chk('5年累計自由現金流',   finData?.totalFCF5Y);
        _chk('FCF 連貫性 (5年)',    finData?.fcfContinuity);
        _naRows.add('應收帳款狀態');  // 銀行無傳統應收帳款
        // 金融業額外不適用欄位
        _naRows.add('存貨管理狀態'); // 銀行無存貨
        _naRows.add('流動比率');     // 金融業流動比率定義不同，不適用一般標準
        _naRows.add('速動比率');     // 同上
    }

    if (isNoInventory && !isETF && !isFinancialSec) {
        // 服務業：存貨相關欄位若資料缺失即標示 N/A
        const _chk = (lbl, val) => { if (val === null || val === undefined) _naRows.add(lbl); };
        _chk('存貨週轉天數 (DIO)', finData?.inventoryDays);
        _chk('存貨週轉率',       finData?.inventoryTurnover);
    }

    // 同業對比格子中需劃除的 metric key 集合
    const _naPeerKeys = new Set();
    if (isETF) {
        ['pe', 'pb'].forEach(k => _naPeerKeys.add(k));
    }
    if (isFinancialSec && !isETF) {
        // 金融業：研發費用、存貨/應收/應付/CCC/流動/速動 均不適用
        ['rd', 'dio', 'dso', 'dpo', 'ccc', 'cr', 'qr'].forEach(k => _naPeerKeys.add(k));
    }
    window._naCtx = { naRows: _naRows, naPeerKeys: _naPeerKeys, isFinancialSec, isETF };

    // 大區塊斜線劃除：在整個 card 上覆蓋紅色 X（僅用於整張卡片均不適用的情況）
    const _naCardStyle   = (on) => on ? 'position:relative; overflow:hidden;' : '';
    const _naCardOverlay = (on) => !on ? '' :
        `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.28);pointer-events:none;z-index:9;border-radius:inherit;"></div>
         <svg style="position:absolute;inset:0;width:100%;height:100%;z-index:10;pointer-events:none;overflow:visible;" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
           <line x1="1%" y1="1%" x2="99%" y2="99%" stroke="#ef4444" stroke-width="2.5" opacity="0.72" stroke-linecap="round"/>
           <line x1="99%" y1="1%" x2="1%" y2="99%" stroke="#ef4444" stroke-width="2.5" opacity="0.72" stroke-linecap="round"/>
         </svg>`;
    const finalDisplayName = (displayTitleName !== symbol && !/^\d+$/.test(displayTitleName)) ? displayTitleName : "股票";
    
    if (analysisTitle) {
        analysisTitle.textContent = `📊 ${finalDisplayName} (${symbol}) 分析報告`;
    }
    const headerPrice = document.getElementById('analysisHeaderPrice');
    if (headerPrice && currentPrice) {
        headerPrice.textContent = `目前股價 ${currentPrice} 元`;
    }
    
    // 暫存當前價格供百科分析使用
    window._lastCurrentPrice = currentPrice;

    // --- 數據同步修正：若總持股日期落後於法人動態日期，則進行估算補齊 ---
    if (chipsData && chipsData.holdingDate && institutionalData && institutionalData.daily && institutionalData.daily.length > 0) {
        const daily = institutionalData.daily;
        // 找出比總持股日期更晚的買賣超數據 (通常是今天或昨天的最新變動)
        const patches = daily.filter(d => d.date > chipsData.holdingDate).sort((a,b) => a.date.localeCompare(b.date));
        if (patches.length > 0) {
            const shares = chipsData.sharesIssued || 1;
            
            // 補齊歷史數據紀錄，確保圖表能顯示最新點
            if (chipsData.holdingHistory && chipsData.holdingHistory.length > 0) {
                let lastKnownForeign = parseFloat(chipsData.foreign || 0);
                patches.forEach(p => {
                    const netF = p.foreign || 0;
                    lastKnownForeign += (netF * 1000 / shares) * 100;
                    chipsData.holdingHistory.push({
                        date: p.date,
                        foreign_investment_shares_ratio: lastKnownForeign,
                        is_estimated: true
                    });
                });
            }

            let netF = 0, netT = 0, netD = 0;
            patches.forEach(p => {
                netF += p.foreign || 0;
                netT += p.trust || 0;
                netD += p.dealer || 0;
            });
            
            // 將「張數」轉換為「持股百分比」並累加 (1張 = 1000股)
            chipsData.foreign = (chipsData.foreign || 0) + (netF * 1000 / shares) * 100;
            chipsData.trust = (chipsData.trust || 0) + (netT * 1000 / shares) * 100;
            chipsData.dealer = (chipsData.dealer || 0) + (netD * 1000 / shares) * 100;
            chipsData.institutionalTotal = (chipsData.foreign || 0) + (chipsData.trust || 0) + (chipsData.dealer || 0);
            
            const latestPatchDate = patches[patches.length - 1].date;
            chipsData.holdingDate = latestPatchDate;
            chipsData.isEstimated = true; // 標記為估算數據
        }
    }

    // --- ETF / 無持股基準日：trust、dealer 從法人日資料全期累積估算 ---
    // TaiwanStockShareholding 只含外資欄位，ETF 通常也無此資料，
    // 投信與自營商持股比須從法人買賣日資料累積轉換
    if (chipsData && !chipsData.holdingDate && institutionalData && institutionalData.daily && institutionalData.daily.length > 0
        && chipsData.trust === null && chipsData.dealer === null) {
        const shares = chipsData.sharesIssued || 1;
        let netT = 0, netD = 0, netF = 0, hasActivity = false;
        for (const d of institutionalData.daily) {
            netT += d.trust   || 0;
            netD += d.dealer  || 0;
            netF += d.foreign || 0;
            if (d.trust || d.dealer) hasActivity = true;
        }
        if (hasActivity) {
            // trust/dealer：累積淨買張數轉換為佔發行股比（以 0 為基準，代表法人近期淨倉位）
            chipsData.trust  = parseFloat(((netT * 1000 / shares) * 100).toFixed(3));
            chipsData.dealer = parseFloat(((netD * 1000 / shares) * 100).toFixed(3));
            // 外資：若 MoneyDJ 已給絕對值則保留，否則也以累積估算補上
            if (chipsData.foreign === null) {
                chipsData.foreign = parseFloat(((netF * 1000 / shares) * 100).toFixed(3));
            }
            chipsData.institutionalTotal = (chipsData.foreign || 0) + chipsData.trust + chipsData.dealer;
            // 以法人資料最新日期補上 holdingDate
            chipsData.holdingDate = institutionalData.daily[institutionalData.daily.length - 1]?.date || null;
            chipsData.isEstimated = true;
            chipsData.isETFEstimated = true; // ETF 專用旗標，用於區分一般股補丁估算
        }
    }

    // 每股淨值 (BPS)
    const shares = chipsData?.sharesIssued || finData?.sharesIssued;
    const bps = (finData?.equity && shares) ? (finData.equity / shares) : null;
    
    // 市值
    const marketCap = shares ? (currentPrice * shares / 100000000) : null; // 億元
    
    const totalDiv12m = chipsData?.currentTtmDiv || 0;

    // 市銷率 (P/S)
    const psRatio = (marketCap && revData?.cum12m) ? (marketCap * 100000000 / revData.cum12m) : null;
    
    // 股利趨勢分析 (優化：使用 TTM 12個月累計數據進行比較，避免單次除權息(如僅發放股票)導致誤判)
    let divTrendAnalysis = "數據不足以進行趨勢分析";
    if (chipsData?.divHistory && chipsData.divHistory.length >= 2) {
        // 使用計算好的 totalDiv12m (目前年度) 與 過去 8 次紀錄的平均值(年化) 進行比較
        const historicalAvg = chipsData.divHistory.reduce((s, x) => s + x.cash, 0) / (chipsData.divHistory.length / (chipsData.divConsecutiveYears || 1) || 1);
        const currentSum = totalDiv12m || 0;
        
        if (currentSum > historicalAvg * 1.1) divTrendAnalysis = "🚀 近期股利發放顯著優於平均，顯示獲利能力進入成長期。";
        else if (currentSum > 0 && currentSum < historicalAvg * 0.8) divTrendAnalysis = "⚠️ 近期股利發放低於長期平均，需觀察營運是否進入衰退期或保留資金擴張。";
        else if (currentSum > 0) divTrendAnalysis = "📊 股利政策維持極高穩定性，具備定存股核心特質。";
        else divTrendAnalysis = "目前處於無息狀態或數據尚未更新。";
    }
    
    // 計算歷史 PE 分佈與分位數 (優化：使用 filter().pop() 取得最接近日期的價格)
    const epsLTM = finData?.ttmEps || 0;
    const currentPE = epsLTM > 0 ? currentPrice / epsLTM : (twseBasic?.pe || null);
    let pePercentile = twseBasic?.pePercentile ?? null;
    let valuationBands = null;
    if (finData?.historicalTTM && chartData?.prices && currentPE > 0) {
        const peSamples = finData.historicalTTM.map(h => {
            const p = chartData.prices.filter(p => p.date <= h.date).pop(); 
            return (p && p.close > 0) ? p.close / h.ttm : null;
        }).filter(v => v !== null && v > 0).sort((a,b) => a-b);

        if (peSamples.length > 5) {
            const getP = (p) => peSamples[Math.floor((peSamples.length - 1) * p)];
            valuationBands = { 
                p10: getP(0.1), p20: getP(0.2), p50: getP(0.5), p80: getP(0.8), p90: getP(0.9),
                min: peSamples[0], max: peSamples[peSamples.length - 1] 
            };
            const rank = peSamples.filter(v => v <= currentPE).length;
            pePercentile = Math.round((rank / peSamples.length) * 100 * 10) / 10;
        }
    }

    // 計算 PS Ratio 歷史位階 (PS Percentile)
    const currentPS = psRatio;
    let psPercentile = null;
    let psBands = null;
    if (finData?.historicalPSData && chartData?.prices && currentPS > 0) {
        const psSamples = finData.historicalPSData.map(h => {
            const p = chartData.prices.filter(p => p.date <= h.date).pop();
            // PS Ratio = (Price * Shares) / TTM Revenue
            return (p && p.close > 0 && h.ttmRev > 0) ? (p.close * h.shares / h.ttmRev) : null;
        }).filter(v => v !== null && v > 0).sort((a, b) => a - b);

        if (psSamples.length > 5) {
            const rank = psSamples.filter(v => v < currentPS).length;
            psPercentile = (rank / psSamples.length) * 100;
            // 為 PS 位階也建立簡單的 bands 結構供圖表顯示 min/max
            psBands = { min: psSamples[0], max: psSamples[psSamples.length - 1] };
        }
    }

    // Z-Score 計算
    let zScore = null;
    let zRiskLevel = 'N/A';
    let zColor = '#cbd5e1';
    if (finData?.zComponents && marketCap) {
        const marketCapValue = marketCap * 100000000;
        const { zA, zB, zC, zE, liabilities: zLiab } = finData.zComponents;
        // zD = 市值 / 總負債。若無負債，則該項給予極大值 (99) 代表財務極其穩健
        const zD = (zLiab && zLiab > 0) ? (marketCapValue / zLiab) : (marketCapValue > 0 ? 99 : 0);
        zScore = 1.2 * zA + 1.4 * zB + 3.3 * zC + 0.6 * zD + 1.0 * zE;
        
        if (zScore > 2.99) { zRiskLevel = '安全區'; zColor = '#10b981'; }
        else if (zScore > 1.8) { zRiskLevel = '警戒區'; zColor = '#fbbf24'; }
        else { zRiskLevel = '風險區'; zColor = '#ef4444'; }
    }

    // --- 新增：Beneish M-Score 舞弊診斷 ---
    let mStatus = '正常', mColor = '#4ade80';
    if (finData?.mScore !== undefined && finData?.mScore !== null) {
        if (finData.mScore > -1.78) { mStatus = '舞弊機率高'; mColor = '#ef4444'; }
        else if (finData.mScore > -2.22) { mStatus = '需注意'; mColor = '#fbbf24'; }
    }

    // --- 新增：營收質量診斷 (Accrual Quality) ---
    let accrualDiagnosis = { flags: [], arStatus: '正常', invStatus: '正常' };
    if (finData?.receivableDays !== undefined && finData?.inventoryDays !== undefined) {
        const trend = finData.dioDsoTrend || [];
        if (trend.length >= 5) {
            const current = trend[trend.length - 1];
            const prevYear = trend[trend.length - 5]; // 精確取 4 季前 (去年同期)
            
            if (prevYear && prevYear.dso > 0 && prevYear.dio > 0) {
                // 應收帳款天數大幅增加 (>20%)
                if (current.dso > prevYear.dso * 1.2) {
                    accrualDiagnosis.arStatus = '惡化';
                    accrualDiagnosis.flags.push('⚠️ 應收帳款回收變慢，需留意營收含金量。');
                }
                // 存貨天數大幅增加 (>20%)
                if (current.dio > prevYear.dio * 1.2) {
                    accrualDiagnosis.invStatus = '惡化';
                    accrualDiagnosis.flags.push('⚠️ 存貨週轉天數拉長，需防範產品滯銷或跌價風險。');
                }
            }
        }
        // OCF vs NI 診斷
        if (finData.earningsQuality !== null && finData.earningsQuality < 80) {
            accrualDiagnosis.flags.push('⚠️ 獲利含金量不足 (OCF < 淨利 80%)，獲利多存在於帳面上。');
        }
    }

    
    // 如果 API 沒給殖利率，則根據近一年股利自行計算
    const calcYield = (totalDiv12m > 0 && currentPrice > 0) ? (totalDiv12m / currentPrice * 100) : null;
    const finalYield = twseBasic?.yield || calcYield;
    const currentDiv = totalDiv12m > 0 ? totalDiv12m : ((finalYield && currentPrice) ? (currentPrice * (finalYield / 100)) : null);
    
    // 成本殖利率
    const costYield = (avgCost && avgCost > 0 && totalDiv12m > 0) ? (totalDiv12m / avgCost * 100) : null;
    
    // 便宜/合理/昂貴價推算 (統一使用近四季加總 EPS LTM 以確保專業精度)
    // 修正：EPS fallback 優先使用 TTM (epsLTM)，次用本益比反推，最後才用單季 × 4 (粗估)
    const eps = epsLTM > 0 ? epsLTM : (twseBasic?.pe && currentPrice ? currentPrice / twseBasic.pe : (finData?.eps ? finData.eps * 4 : null));
    const divCheap = currentDiv ? currentDiv / 0.05 : null;
    const divReasonable = currentDiv ? currentDiv / 0.04 : null;
    const divExpensive = currentDiv ? currentDiv / 0.03 : null;
    const peCheap = eps ? eps * 12 : null;
    const peReasonable = eps ? eps * 15 : null;
    const peExpensive = eps ? eps * 20 : null;

    // 葛拉漢公式內在價值 (Graham Value)
    const grahamValue = (eps && bps && eps > 0 && bps > 0) ? Math.sqrt(22.5 * eps * bps) : null;

    // --- 新增：籌碼擁擠度與壓力診斷 ---
    let crowdMetrics = { marginRatio: 0, marginStress: '安全', distToCall: null };
    if (marginData && shares > 0) {
        // 融資佔比 = (融資餘額(張) * 1000 / 發行股數) * 100%
        crowdMetrics.marginRatio = (marginData.marginPurchase * 1000 / shares) * 100;
        if (marginData.marginMaintenance) {
            crowdMetrics.distToCall = marginData.marginMaintenance - 130;
            if (marginData.marginMaintenance < 140) crowdMetrics.marginStress = '極高';
            else if (marginData.marginMaintenance < 160) crowdMetrics.marginStress = '警戒';
        }
    }

    // AI Summary logic
    let summaryText = `【${finalDisplayName}】目前股價 ${safeFix(currentPrice, 2)} 元。`;
    
    // --- 0. 投資屬性歸類 ---
    let profile = "穩健型";
    if (revData?.yoy > 20 && finData?.epsYoY > 20) profile = "強勢成長型";
    else if (twseBasic?.yield > 6 && chipsData.divConsecutiveYears > 10) profile = "高息定存型";
    else if (currentPE && currentPE < 10 && finData?.roe > 10) profile = "低估價值型";
    else if (price3m > 30) profile = "飆悍動能型";
    
    summaryText += `<br><span style="background:#3b82f6; color:#ffffff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:8px;">${profile}標的</span>`;

    // --- 1. 技術面與動能 ---
    if (currentPrice > ma.ma60) {
        summaryText += `技術面位於季線 (${safeFix(ma.ma60, 2)}) 之上，均線架構偏多。`;
    } else {
        summaryText += `目前股價在季線 (${safeFix(ma.ma60, 2)}) 之下，屬弱勢格局。`;
    }
    
    if (latestVol && avgVol5 && latestVol > avgVol5 * 1.5) {
        summaryText += "今日成交量顯著放大（量比 > 1.5），顯示市場熱度升溫。";
    }

    if (posIn52w !== null) {
        if (posIn52w > 90) summaryText += "股價目前接近 52 週高點，展現強勢突破態勢。";
        else if (posIn52w < 10) summaryText += "股價目前接近 52 週低點，需觀察是否出現止跌訊號。";
    }

    if (macd) {
        if (macd.osc > 0) summaryText += "MACD 柱狀體位於正值區，多方控盤中。";
        else if (macd.osc < 0) summaryText += "MACD 柱狀體位於負值區，動能偏弱。";
    }

    if (rsi14 !== null) {
        if (rsi14 > 70) summaryText += `RSI (${rsi14}) 進入超買區，短線不宜過度追高。`;
        else if (rsi14 < 30) summaryText += `RSI (${rsi14}) 進入超賣區，可留意止跌反彈機會。`;
    }

    // --- 1.1 歷史估值位階分析 ---
    if (twseBasic && twseBasic.pePercentile !== null && twseBasic.pePercentile !== undefined) {
        const peP = twseBasic.pePercentile;
        if (peP < 20) summaryText += `目前本益比處於 5 年歷史極低位階 (${safeFix(peP, 1)}%)，具備極高投資價值。`;
        else if (peP > 80) summaryText += `目前本益比處於 5 年歷史高位階 (${safeFix(peP, 1)}%)，需留意估值過高風險。`;
        else summaryText += `目前本益比處於歷史中位區間 (${safeFix(peP, 1)}%)。`;
    }
    if (twseBasic && twseBasic.pbPercentile !== null && twseBasic.pbPercentile !== undefined) {
        const pbP = twseBasic.pbPercentile;
        if (pbP < 20) summaryText += `且股價淨值比亦處於歷史低位 (${safeFix(pbP, 1)}%)。`;
    }

    // --- 2. 籌碼面深度分析 (含主力動向與賣超壓力) ---
    const fStreak = institutionalData?.streaks?.foreign || 0;
    const tStreak = institutionalData?.streaks?.trust || 0;

    // === 土洋共識度計算 (從 instData.daily 派生，零額外 API) ===
    let consensusScore = null;   // 共識度 0-100%
    let consensusDays = 0;        // 同向天數
    let consensusBull = 0;        // 同向做多天數
    let consensusBear = 0;        // 同向做空天數
    const consensusWindow = 20;
    if (institutionalData?.daily && institutionalData.daily.length >= 5) {
        const last20 = institutionalData.daily.slice(-consensusWindow);
        last20.forEach(d => {
            const fDir = d.foreign > 0 ? 1 : (d.foreign < 0 ? -1 : 0);
            const tDir = d.trust   > 0 ? 1 : (d.trust   < 0 ? -1 : 0);
            if (fDir !== 0 && tDir !== 0 && fDir === tDir) {
                consensusDays++;
                if (fDir > 0) consensusBull++;
                else consensusBear++;
            }
        });
        consensusScore = Math.round((consensusDays / last20.length) * 100);
    }

    if (fStreak > 2 && tStreak > 2) {
        summaryText += "外資與投信近期同步連買，籌碼面出現「土洋大戰」偏多態勢。";
    } else if (fStreak > 3) {
        summaryText += `外資近期連買 ${fStreak} 日，外資資金持續湧入。`;
    } else if (tStreak > 3) {
        summaryText += `投信近期連買 ${tStreak} 日，內資護盤意圖明顯。`;
    }
    if (consensusScore !== null) {
        if (consensusScore >= 60 && consensusBull > consensusBear) summaryText += `土洋共識度高達 ${consensusScore}%（近20日同向 ${consensusDays} 天），外資投信攜手做多，籌碼結構強健。`;
        else if (consensusScore >= 60 && consensusBear > consensusBull) summaryText += `⚠️ 土洋共識度 ${consensusScore}%，但雙方共同做空天數較多，需謹慎評估。`;
        else if (consensusScore < 30) summaryText += `土洋背離明顯（20日共識度僅 ${consensusScore}%），外資與投信方向相左，籌碼面較為複雜。`;
    }

    // === 多期累計計算 (從 instData.daily 派生) ===
    const calcPeriodTotal = (days) => {
        if (!institutionalData?.daily || institutionalData.daily.length === 0) return null;
        const slice = institutionalData.daily.slice(-days);
        // 如果偵測到舊版快取資料（沒有 dealer 屬性），嘗試從其他屬性或預設 0 處理，不要直接回傳 null
        const hasDealer = slice.some(d => d.dealer !== undefined);
        
        return {
            foreign: slice.reduce((s, d) => s + (parseFloat(d.foreign) || 0), 0),
            trust:   slice.reduce((s, d) => s + (parseFloat(d.trust)   || 0), 0),
            dealer:  slice.reduce((s, d) => s + (parseFloat(d.dealer)  || 0), 0)
        };
    };
    const instPeriod = {
        d2:   calcPeriodTotal(2),
        d3:   calcPeriodTotal(3),
        d5:   calcPeriodTotal(5) || institutionalData?.fiveDayTotal || null,
        d10:  calcPeriodTotal(10),
        m1:   calcPeriodTotal(20),
        m3:   calcPeriodTotal(60),
        m6:   calcPeriodTotal(120),
        y1:   calcPeriodTotal(240)
    };

    // === 籌碼動能加速偵測 (D1 vs D20) ===
    let momentumRatio = null;
    let momentumStatus = null; // 1: 買盤加速, -1: 賣壓加速, 2: 轉買, -2: 轉賣
    if (brokerData?.d1?.mainNetBuy !== undefined && brokerData?.d20?.mainNetBuy !== undefined) {
        const d1 = brokerData.d1.mainNetBuy;
        const d20Avg = brokerData.d20.mainNetBuy / 20;
        
        if (d20Avg !== 0) {
            momentumRatio = d1 / d20Avg;
            if (d1 > 0) {
                if (d20Avg > 0 && momentumRatio > 2) momentumStatus = 1; // 買盤加速
                else if (d20Avg < 0) momentumStatus = 2; // 轉買
            } else if (d1 < 0) {
                if (d20Avg < 0 && momentumRatio > 2) momentumStatus = -1; // 賣壓加速
                else if (d20Avg > 0) momentumStatus = -2; // 轉賣
            }
        }
    }

    if (momentumStatus === 1) {
        summaryText += `🔥 偵測到<b>買盤動能加速</b>！今日主力買超為 20 日均值的 ${safeFix(momentumRatio, 1)} 倍，大戶正積極吸籌。`;
    } else if (momentumStatus === -1) {
        summaryText += `❄️ 偵測到<b>賣壓動能加速</b>！今日主力賣超為 20 日均值的 ${safeFix(momentumRatio, 1)} 倍，需留意主力撤出。`;
    } else if (momentumStatus === 2) {
        summaryText += `✨ 籌碼現<b>轉買訊號</b>！今日主力由賣轉買，且買盤力道顯著。`;
    } else if (momentumStatus === -2) {
        summaryText += `⚠️ 籌碼現<b>轉賣警訊</b>！今日主力由買轉賣，需防範短線走弱。`;
    }

    if (topSellers60.length > 0) {
        const topS = topSellers60[0];
        summaryText += `注意：近 60 日賣超最重分點為「${topS.name}」，賣超達 ${topS.sellNet.toLocaleString()} 張，需留意賣壓。`;
    }

    // --- 3. 獲利與評價 ---
    if (currentPE && currentPE < 12) {
        summaryText += `當前本益比 ${safeFix(currentPE, 1)} 倍，處於歷史低估區間。`;
    } else if (currentPE && currentPE > 25) {
        summaryText += `本益比 ${safeFix(currentPE, 1)} 倍偏高，需有更高成長性支撐。`;
    }

    if (psPercentile !== null) {
        if (psPercentile < 20) summaryText += `🔥 <b>PS 位階極低 (${Math.round(psPercentile)}%)</b>，目前股價相對於營收處於歷史極便宜區域，成長股安全邊際顯著。`;
        else if (psPercentile > 80) summaryText += `⚠️ <b>PS 位階偏高 (${Math.round(psPercentile)}%)</b>，目前市場給予的營收估值較高，需留意獲利成長是否能跟上預期。`;
    }

    if (divCheap && currentPrice < divCheap) {
        summaryText += "目前股價低於系統推算之「便宜價」，具備長期投資安全邊際。";
    } else if (divExpensive && currentPrice > divExpensive) {
        summaryText += "目前股價已超越「昂貴價」，操作宜轉趨審慎。";
    }

    if (finalYield && finalYield > 5) {
        summaryText += `目前殖利率 ${safeFix(finalYield, 2)}% 具備高息誘因。`;
        
        // 盈餘分配率診斷 (統一使用 eps 基準)
        const payout = (totalDiv12m && eps > 0) ? (totalDiv12m / eps * 100) : null;
        if (payout > 100) {
            summaryText += `⚠️ 注意：盈餘分配率高達 ${safeFix(payout, 1)}%，股利發放已超過獲利，需警惕配息的永續性。`;
        } else if (payout > 80) {
            summaryText += `目前配息率約 ${safeFix(payout, 1)}% 偏高，顯示獲利多用於配息，公積轉增資空間較小。`;
        } else if (payout > 0) {
            summaryText += `配息率 ${safeFix(payout, 1)}% 處於健康水準。`;
        }

        if (chipsData.divConsecutiveYears >= 10) {
            summaryText += `且公司已連續配息 ${chipsData.divConsecutiveYears} 年，屬於極高可靠度的收息標的。`;
        }
    }
    if (costYield && costYield > 7) {
        summaryText += `您的成本殖利率達 ${safeFix(costYield, 2)}%，為長期持有的優秀標的。`;
    }

    // --- 4. 財報與經營效率 ---
    if (revData?.yoy && revData.yoy > 15) {
        summaryText += `營收年增率 ${safeFix(revData.yoy, 1)}% 成長動能強勁。`;
    }
    
    if (finData) {
        if (finData.grossMargin > 40) summaryText += "毛利率表現極佳，顯示產品具備高度護城河。";
        if (finData.earningsQuality && finData.earningsQuality > 100) summaryText += "獲利品質優異（OCF/NI > 100%），盈餘含金量高。";
        else if (finData.earningsQuality && finData.earningsQuality < 50) summaryText += "獲利品質偏低，需留意是否有應收帳款過高或虛報盈餘風險。";
        
        if (finData.roe > 15) summaryText += `ROE (${safeFix(finData.roe, 1)}%) 展現卓越獲利效率。`;
        
        if (zScore && zScore < 1.8) {
            summaryText += "⚠️ 注意：Z-Score 處於風險區，需特別留意公司財務體質。";
        }
        const currentFcfYield = (finData?.latestOCF !== undefined && marketCap > 0) ? (finData.latestOCF + (finData.latestCapEx || 0)) / (marketCap * 100000000) * 100 : null;
        if (currentFcfYield > 8) {
            summaryText += `自由現金流殖利率達 ${safeFix(currentFcfYield, 1)}%，顯示公司具備極強的現金產生能力。`;
        }
    }

    if (grahamValue && currentPrice < grahamValue * 0.7) {
        summaryText += "當前股價顯著低於葛拉漢內在價值，具備安全邊際潛力。";
    }

    // --- 5. 風險與波動分析 ---
    if (riskMetrics) {
        if (riskMetrics.beta > 1.3) summaryText += `⚠️ 注意：Beta 係數 (${riskMetrics.beta}) 較高，股價波動強於大盤，屬於積極攻擊型標的。`;
        else if (riskMetrics.beta < 0.7) summaryText += `Beta 係數 (${riskMetrics.beta}) 較低，表現相對大盤穩定，具備防禦屬性。`;
        
        if (riskMetrics.volatility > 40) summaryText += `年化波動率達 ${riskMetrics.volatility}%，股價震盪劇烈，操作需嚴格執行停損。`;
        else if (riskMetrics.volatility < 20) summaryText += `年化波動率 ${riskMetrics.volatility}% 處於低檔，股價走勢相對平穩。`;

        // 相對強弱 RSR 診斷
        if (riskMetrics.rsr20 !== null) {
            if (riskMetrics.rsr20 > 1.2 && riskMetrics.rsr60 > 1.1) {
                summaryText += ` 相對強弱 (RSR) 顯示該股短中線皆顯著超越大盤，屬於領頭羊標的。`;
            } else if (riskMetrics.rsr20 > 1.05) {
                summaryText += ` 近期走勢明顯領先大盤 (RSR: ${riskMetrics.rsr20}x)。`;
            } else if (riskMetrics.rsr20 < 0.85) {
                summaryText += ` 目前 RSR 僅 ${riskMetrics.rsr20}x，表現落後大盤，動能稍嫌不足。`;
            }
        }
    }

    // --- 6. 內部人持股分析 ---
    if (insiderActivity) {
        const trend = insiderActivity.trend;
        if (trend > 100) summaryText += `近期董監事合計增持約 ${Math.round(trend)} 張，顯示內部人對公司前景具備強大信心。`;
        else if (trend < -500) summaryText += `⚠️ 警訊：近期董監事合計減持約 ${Math.round(Math.abs(trend))} 張，需留意是否為高位套現 or 營運轉折訊號。`;
    }

    // --- 6.1 專業排雷警訊彙整 ---
    if (accrualDiagnosis.flags.length > 0) {
        summaryText += `<br>🚩 <b>專業排雷預警：</b>${accrualDiagnosis.flags.join(' ')}`;
    }

    // --- 7. 產業競爭力對比 ---
    const bench = sectorBenchmarks[chipsData?.industry];
    if (bench && finData) {
        const gmDiff = (finData.grossMargin || 0) - bench.gm;
        if (gmDiff > 15) summaryText += `<br>🔥 <b>競爭優勢：</b>毛利率大幅領先產業平均 (${bench.gm}%) 達 ${gmDiff.toFixed(1)}%，展現極強的產業定價權與技術護城河。`;
        else if (gmDiff > 0) summaryText += ` 毛利率優於產業平均 (${bench.gm}%)，獲利能力屬同業中上水準。`;
        else if (gmDiff < -5) summaryText += ` ⚠️ <b>注意：</b>毛利率低於同業平均 (${bench.gm}%)，需留意成本端壓力或產品競爭力是否轉弱。`;
        
        if (finData.roe > bench.roe + 5) summaryText += ` ROE 顯著優於同業標竿，資本運用效率極佳。`;
    }

    summaryText += "（註：以上建議由系統自動運算，僅供參考，不構成投資邀約。）";

    // --- 籌碼套牢與支撐診斷 (新增) ---
    let chipDiagnosticMsg = "";
    if (chartData?.prices && chartData.prices.length > 20) {
        const p = currentPrice;
        const p52w = chartData.prices.slice(-250);
        
        // 獲取價格與成交量的輔助函數 (與下方 52週價量換手分析保持一致)
        const getP = (item) => (item.close || item.Close || item.price || item.Price || 0);
        const getV = (item) => (item.Trading_Volume || item.trading_volume || item.volume || item.Volume || item.Trading_Turnover || 0);

        let step;
        if (p < 10) step = 0.1;
        else if (p < 50) step = 0.5;
        else if (p < 100) step = 1;
        else if (p < 500) step = 5;
        else if (p < 1000) step = 10;
        else step = 50;

        const tempBins = {};
        p52w.forEach(d => {
            const vol = getV(d);
            const close = getP(d);
            if (vol > 0 && close > 0) {
                const binEnd = Math.ceil(close / step) * step;
                tempBins[binEnd] = (tempBins[binEnd] || 0) + vol;
            }
        });

        let maxVolAbove = 0;
        let resPrice = null;
        let maxVolBelow = 0;
        let supPrice = null;

        Object.keys(tempBins).forEach(bpStr => {
            const bp = parseFloat(bpStr);
            const vol = tempBins[bpStr];
            if (bp > p) {
                if (vol > maxVolAbove) {
                    maxVolAbove = vol;
                    resPrice = bp;
                }
            } else if (bp < p) {
                if (vol > maxVolBelow) {
                    maxVolBelow = vol;
                    supPrice = bp;
                }
            }
        });

        if (resPrice) {
            const dist = Math.round((resPrice - p) / p * 100);
            chipDiagnosticMsg += `目前股價距上方最大套牢區僅 ${dist}%，預期面臨解套壓力；`;
        }
        if (supPrice) {
            const dist = Math.round((p - supPrice) / p * 100);
            chipDiagnosticMsg += `下方 ${dist}% 處有強力支撐區。`;
        }
    }

    analysisBody.innerHTML = `
        <div class="analysis-grid">
            <!-- 1. 市值與規模 -->
            <div class="analysis-card">
                <div class="analysis-card-title">🏢 市值與股本規模</div>
                ${renderStatRow('產業分類', chipsData?.industry || 'N/A')}
                ${renderStatRow('市值', marketCap ? formatCurrency(marketCap * 100000000) : 'N/A')}
                ${renderStatRow('實收股本', chipsData?.sharesIssued ? formatCurrency(chipsData.sharesIssued * 10) : 'N/A')}
                ${renderStatRow('發行股數', chipsData?.sharesIssued ? chipsData.sharesIssued.toLocaleString() + ' 股' : 'N/A')}
                ${renderStatRow('市值營收比 (PS)', psRatio ? safeFix(psRatio, 2) + ' 倍' : 'N/A')}
                ${renderStatRow('每股淨值 (BPS)', bps !== undefined ? safeFix(bps, 2) + ' 元' : 'N/A')}
                ${renderStatRow('5日均量', avgVol5 ? avgVol5.toLocaleString() + ' 股' : 'N/A')}
                ${renderStatRow('估計量比', (latestVol && avgVol5) ? safeFix(latestVol / avgVol5, 2) + ' 倍' : 'N/A')}
                ${renderStatRow('52週最高', high52w !== undefined ? safeFix(high52w, 2) + ' 元' : 'N/A')}
                ${renderStatRow('52週最低', low52w !== undefined ? safeFix(low52w, 2) + ' 元' : 'N/A')}
                ${renderStatRow('52週位置', posIn52w !== null ? posIn52w + '%' : 'N/A')}
                <div style="font-size:11px; color:#cbd5e1; margin-top:8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">⚖️ 風險調整後表現</div>
                ${renderStatRow('簡化夏普值', riskMetrics?.sharpeRatio !== undefined ? safeFix(riskMetrics.sharpeRatio, 2) : 'N/A')}
                ${renderStatRow('籌碼擁擠度 (融資佔比)', crowdMetrics.marginRatio ? safeFix(crowdMetrics.marginRatio, 2) + '%' : 'N/A')}
                ${renderStatRow('52週最大回撤 (MDD)', riskMetrics?.mdd !== undefined ? safeFix(riskMetrics.mdd, 2) + '%' : 'N/A')}
                ${renderStatRow('目前回撤幅度', riskMetrics?.currentDrawdown !== undefined ? safeFix(riskMetrics.currentDrawdown, 2) + '%' : 'N/A')}
                ${(() => {
                    if (!riskMetrics || riskMetrics.maxRecoveryDays === undefined) return renderStatRow('套牢修復天數 (MAX)', 'N/A');
                    const days = riskMetrics.maxRecoveryDays;
                    const pending = riskMetrics.maxRecoveryPending;
                    const range = riskMetrics.maxRecoveryRange || '';
                    // pending 用負數編碼傳入 showTermExplainer，analyze 以 v < 0 判斷
                    const encVal = (pending ? -days : days) + (range ? ' (' + range + ')' : '');
                    const qualLabel = days === 0 ? '高點續創' : pending ? '尚未修復' : days <= 15 ? '強勢' : days <= 40 ? '正常' : '偏弱';
                    const cardVal = days === 0 ? '高點續創' : days + ' 天(' + qualLabel + ')';
                    const safeVal = String(encVal).replace(/'/g, "\\'");
                    return renderStatRow('套牢修復天數 (MAX)', cardVal, null, "showTermExplainer('套牢修復天數 (MAX)', '" + safeVal + "')");
                })()}
                ${(() => {
                    if (!riskMetrics || riskMetrics.localPeakMaxTrapDays === undefined) return renderStatRow('區間峰值套牢天數 (MAX)', 'N/A');
                    const days = riskMetrics.localPeakMaxTrapDays;
                    const pending = riskMetrics.localPeakMaxTrapPending;
                    const range = riskMetrics.localPeakMaxTrapRange || '';
                    const encVal = (pending ? -days : days) + (range ? ' (' + range + ')' : '');
                    const qualLabel = days === 0 ? 'N/A' : pending ? '尚未修復' : days <= 15 ? '強勢' : days <= 40 ? '正常' : days <= 80 ? '偏弱' : '⚠️ 警示';
                    const cardVal = days === 0 ? 'N/A' : days + ' 天(' + qualLabel + ')';
                    const safeVal = String(encVal).replace(/'/g, "\\'");
                    return renderStatRow('區間峰值套牢天數 (MAX)', cardVal, null, "showTermExplainer('區間峰值套牢天數 (MAX)', '" + safeVal + "')");
                })()}
                ${renderStatRow('與大盤相關性 (20日)', riskMetrics?.corr20 !== undefined ? safeFix(riskMetrics.corr20, 2) : 'N/A')}
                ${renderStatRow('與大盤相關性 (60日)', riskMetrics?.corr60 !== undefined ? safeFix(riskMetrics.corr60, 2) : 'N/A')}
                ${renderDiagnostic(
                    (marketCap > 1000 ? "大型權值股，流動性與防禦力強。" : (marketCap < 100 ? "小型標的，波動大且需防範流動性。" : "中型規模，兼具成長動能與基礎穩定性。")) +
                    (latestVol > avgVol5 * 2 ? " 今日爆量，市場熱度極高。" : "")
                )}
            </div>

            <!-- 1.5 產業橫向對比 (Sector Comparison) -->
            ${(() => {
                // 統一使用即時價格計算 P/E, P/B 以確保全頁面一致
                const epsLTMForCompare = eps || 0;
                const netWorth = (finData?.equity && finData?.sharesIssued > 0) ? (finData.equity / finData.sharesIssued) : 0;
                
                let realTimePE = (epsLTMForCompare > 0) ? (currentPrice / epsLTMForCompare) : (twseBasic?.pe || 0);
                let realTimePB = (netWorth > 0) ? (currentPrice / netWorth) : (twseBasic?.pb || 0);
                
                // 安全回退：如果計算出的 PB/PE 異常(例如 0.00 或 NaN)，則使用官方數據
                if (isNaN(realTimePB) || realTimePB < 0.01 || realTimePB > 200) realTimePB = twseBasic?.pb || 0;
                if (isNaN(realTimePE) || realTimePE < 0.1 || realTimePE > 500) realTimePE = twseBasic?.pe || 0;
                
                return renderSectorComparison(chipsData?.industry, {
                    rev: revData?.yoy,
                    yield: finalYield,
                    gm: finData?.grossMargin,
                    om: finData?.opMargin,
                    nm: finData?.netMargin,
                    roe: finData?.roe,
                    roa: finData?.roa,
                    rd: finData?.rdRatio,
                    dio: finData?.inventoryDays,
                    dso: finData?.receivableDays,
                    dpo: finData?.payableDays,
                    ccc: finData?.ccc,
                    at: finData?.assetTurnover,
                    dr: finData?.debtRatio,
                    cr: finData?.currentRatio,
                    qr: finData?.quickRatio,
                    pe: realTimePE,
                    pb: realTimePB
                });
            })()}

            <!-- 2. 合理價格評估 -->
            <div class="analysis-card">
                <div class="analysis-card-title">💰 合理價格評估</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; background:rgba(37, 99, 235, 0.1); padding:8px 12px; border-radius:8px; border:1px solid rgba(37, 99, 235, 0.2);">
                    <div style="text-align:center; flex:1; position:relative; ${isETF ? 'opacity:0.52;' : ''}">
                        <div style="font-size:10px; color:#cbd5e1; ${isETF ? 'text-decoration:line-through; color:#6b7280;' : ''}">當前本益比 (PE)</div>
                        <div style="font-size:15px; font-weight:700; color:${isETF ? '#6b7280' : '#ffffff'}; ${isETF ? 'text-decoration:line-through;' : ''}">${currentPE ? safeFix(currentPE, 2) + ' 倍' : 'N/A'}</div>
                        ${isETF ? `<div style="position:absolute; left:0; right:0; top:50%; height:2px; background:#ef4444; opacity:0.85; pointer-events:none; border-radius:1px;"></div>` : ''}
                    </div>
                    <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:10px; color:#cbd5e1;">當前殖利率 (Yield)</div>
                        <div style="font-size:15px; font-weight:700; color:#ef4444;">${finalYield !== undefined ? safeFix(finalYield, 2) + '%' : 'N/A'}</div>
                    </div>
                    ${avgCost ? `
                    <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:10px; color:#cbd5e1;">成本殖利率</div>
                        <div style="font-size:15px; font-weight:700; color:#fbbf24;">${costYield !== undefined ? safeFix(costYield, 2) + '%' : 'N/A'}</div>
                    </div>` : ''}
                </div>
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:10px; cursor:pointer; text-decoration:underline dashed;" class="has-info" onclick="showTermExplainer('綜合估值評估', '雙模型評估')">📊 綜合估值評估 (殖利率 / PE)</div>
                ${renderValuationRow('便宜價', `${safeFix(divCheap, 1)} / ${safeFix(peCheap, 1)} 元`)}
                ${renderValuationRow('合理價', `${safeFix(divReasonable, 1)} / ${safeFix(peReasonable, 1)} 元`)}
                ${renderValuationRow('昂貴價', `${safeFix(divExpensive, 1)} / ${safeFix(peExpensive, 1)} 元`)}

                <div style="font-size:11px; color:${isETF ? '#6b7280' : '#cbd5e1'}; margin:12px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px; ${isETF ? 'text-decoration:line-through; opacity:0.6;' : ''}">📊 歷史估值區間 (5Y River Map)</div>
                ${renderValuationRiverMap('PE 位階', currentPE, pePercentile, valuationBands)}
                ${psPercentile !== null ? renderValuationRiverMap('PS 位階', currentPS, psPercentile, psBands) : ''}
                ${renderValuationRiverMap('PB 位階', twseBasic?.pb, twseBasic?.pbPercentile, twseBasic?.pbBands)}

                <div style="font-size:11px; color:${isETF ? '#6b7280' : '#cbd5e1'}; margin:12px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px; ${isETF ? 'text-decoration:line-through; opacity:0.6;' : ''}">🏆 價值投資核心指標</div>
                ${renderValuationRow('葛拉漢內在價值', grahamValue)}
                ${(() => {
                    // 重新計算 FCF Yield
                    let ttmFcf = 0;
                    if (finData?.fcfTrend && finData.fcfTrend.length >= 4) {
                        ttmFcf = finData.fcfTrend.slice(-4).reduce((sum, item) => sum + (item.fcf || 0), 0);
                    } else {
                        ttmFcf = finData?.freeCashFlow || 0;
                    }
                    const calculatedFcfYield = (marketCap && marketCap > 0) ? ((ttmFcf / 100000000) / marketCap * 100) : 0;
                    // 修正：FCF 殖利率為 0 時不應顯示 N/A，應明確判斷 null/undefined
                    return renderStatRow('自由現金流殖利率', (calculatedFcfYield !== null && calculatedFcfYield !== undefined) ? safeFix(calculatedFcfYield, 2) + '%' : 'N/A');
                })()}

                <div style="font-size:11px; color:${isETF ? '#6b7280' : '#cbd5e1'}; margin:12px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px; ${isETF ? 'text-decoration:line-through; opacity:0.6;' : ''}">📊 估值倍數與成長</div>
                ${renderStatRow('市值營收比 (PS)', psRatio !== undefined ? safeFix(psRatio, 2) + ' 倍' : 'N/A')}
                ${renderStatRow('市淨率 (P/B)', (currentPrice && bps) ? safeFix(currentPrice / bps, 2) + ' 倍' : 'N/A')}
                ${renderStatRow('企業價值倍數 (EV/EBIT)', finData?.evEbit !== undefined && finData?.evEbit !== null ? safeFix(finData.evEbit, 2) + ' 倍' : 'N/A')}
                ${(() => {
                    const earningsYield = currentPE > 0 ? (100 / currentPE) : 0;
                    const us10y = ANALYSIS_CONFIG.riskFreeRate; // 使用全域預設值
                    const erp = earningsYield > 0 ? (earningsYield - us10y) : null;
                    
                    return `
                        ${renderStatRow('盈餘殖利率 (EY)', earningsYield ? safeFix(earningsYield, 2) + '%' : 'N/A')}
                        ${erp !== null ? renderStatRow('股權風險溢酬 (ERP)', safeFix(erp, 2) + '%') : ''}
                    `;
                })()}
                ${renderStatRow('EPS 成長率 (TTM)', finData?.ttmEpsYoY != null ? safeFix(finData?.ttmEpsYoY, 2) + '%' : 'N/A')}
                ${renderStatRow('PEG 比例', (twseBasic?.pe && finData?.ttmEpsYoY && finData?.ttmEpsYoY > 0) ? safeFix(twseBasic.pe / finData?.ttmEpsYoY, 2) : (finData?.ttmEpsYoY <= 0 ? 'N/A (獲利衰退)' : 'N/A'))}
                ${renderStatRow('營運槓桿度 (DOL)', finData?.dol !== undefined && finData?.dol !== null ? safeFix(finData.dol, 2) + ' 倍' : 'N/A')}
                ${renderDiagnostic(
                    (() => {
                        const earningsYield = twseBasic?.pe > 0 ? (100 / twseBasic.pe) : 0;
                        // 修正：PE 為負 (虧損) 或 earningsYield ≤ 0 時不計算 ERP，避免顯示誤導性高溢酬
                        const erp = earningsYield > 0 ? (earningsYield - ANALYSIS_CONFIG.riskFreeRate) : null;
                        let erpDiag = "";
                        if (erp === null) erpDiag = "⚠️ 注意：公司目前 PE 為負或無效，無法計算股權風險溢酬 (ERP)。";
                        else if (erp < 2) erpDiag = "⚠️ 警訊：股權風險溢酬 (ERP) 過低，股市相對債券不具吸引力。";
                        else if (erp > 5) erpDiag = "🚀 股市風險溢酬極高，具備極佳長線佈局價值。";

                        return (erpDiag ? erpDiag + " " : "") + 
                        (finalYield > 5 ? "殖利率高於 5%，具備防禦屬性與收息誘因。" : (psPercentile !== null && psPercentile < 20 ? "PS 位階極低，具備成長股安全邊際。" : (twseBasic?.pe > 25 ? "本益比偏高，估值面已有過熱跡象。" : "當前估值尚屬合理，未見明顯泡沫。"))) +
                        (currentPrice < bps ? " 股價低於每股淨值 (P/B < 1)，具極高安全邊際。" : "");
                    })()
                )}
            </div>

            <!-- 5. 估值河流與位階 (PE River) -->
            <div class="analysis-card" style="${_naCardStyle(isETF)}">
                ${_naCardOverlay(isETF)}
                <div class="analysis-card-title">💎 估值動態與成長預測 (TTM vs Forward)</div>
                <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:10px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
                        <div>
                            <div style="font-size:10px; color:#cbd5e1; margin-bottom:2px;">當前 TTM 本益比 (近 4 季累計)</div>
                            <div style="font-size:22px; font-weight:800; color:#ffffff;">${safeFix(currentPE || twseBasic?.pe, 1)} <span style="font-size:12px; font-weight:400; color:#cbd5e1;">倍</span></div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:10px; color:#cbd5e1; margin-bottom:2px;">歷史百分位數 (5年)</div>
                            <div style="font-size:16px; font-weight:700; color:${(pePercentile ?? twseBasic?.pePercentile) > 80 ? '#f87171' : ((pePercentile ?? twseBasic?.pePercentile) < 30 ? '#4ade80' : '#fbbf24')};">${safeFix(pePercentile ?? twseBasic?.pePercentile, 1)}%</div>
                            <div style="font-size:9px; color:#64748b; margin-top:2px; line-height:1.3;">${(() => { const p = pePercentile ?? twseBasic?.pePercentile; if (p === null || p === undefined) return ''; if (p <= 10) return '📉 5年歷史估值低點'; if (p <= 30) return '💚 估值偏低'; if (p <= 70) return '🟡 估值合理'; if (p <= 90) return '🟠 估值偏高'; return '🔴 5年歷史估值高點'; })()} （0%=歷史最便宜）</div>
                        </div>
                    </div>
                    
                    <div style="position:relative; height:12px; width:100%; background:linear-gradient(to right, #10b981 0%, #4ade80 20%, #facc15 50%, #fb923c 80%, #ef4444 100%); border-radius:6px; margin:20px 0 10px;">
                        <div style="position:absolute; left:${pePercentile ?? twseBasic?.pePercentile}%; top:-10px; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid #fff;"></div>
                        <div style="position:absolute; left:${pePercentile ?? twseBasic?.pePercentile}%; bottom:-18px; transform:translateX(-50%); font-size:10px; font-weight:800; color:#ffffff; white-space:nowrap;">目前位置</div>
                    </div>
                    
                    <div class="legend-horizontal chart-internal" style="display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; margin-top:14px;">
                        <span>便宜 (10%)</span>
                        <span>合理 (50%)</span>
                        <span>昂貴 (90%)</span>
                    </div>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px;">
                    <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:6px;">
                        <div style="font-size:9px; color:#cbd5e1;">歷史便宜價 (PE ${valuationBands ? safeFix(valuationBands.p20, 1) : 'N/A'})</div>
                        <div style="font-size:13px; font-weight:700; color:#4ade80;">${valuationBands ? safeFix(valuationBands.p20 * epsLTM, 1) : 'N/A'}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:6px;">
                        <div style="font-size:9px; color:#cbd5e1;">歷史昂貴價 (PE ${valuationBands ? safeFix(valuationBands.p80, 1) : 'N/A'})</div>
                        <div style="font-size:13px; font-weight:700; color:#f87171;">${valuationBands ? safeFix(valuationBands.p80 * epsLTM, 1) : 'N/A'}</div>
                    </div>
                </div>

                <!-- 新增：Forward PE 成長預測區塊 -->
                ${(() => {
                    const revGrowth = revData?.avgYoY6m || revData?.yoy || 0;
                    const forwardEPS = epsLTM * (1 + (revGrowth / 100));
                    const forwardPE = forwardEPS > 0 ? (currentPrice / forwardEPS) : 0;
                    const growthColor = revGrowth >= 0 ? '#f87171' : '#4ade80';
                    const peComparison = forwardPE < (currentPE || twseBasic?.pe);
                    
                    return `
                    <div style="background:linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%); padding:12px; border-radius:10px; margin-bottom:12px; border:1px solid rgba(59, 130, 246, 0.2); position:relative; overflow:hidden;">
                        <div style="position:absolute; top:-10px; right:-10px; font-size:40px; opacity:0.05; transform:rotate(-15deg);">🚀</div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px;">
                            <span style="font-size:11px; color:#60a5fa; font-weight:bold;">🔭 未來 12 個月成長預測</span>
                            <span style="font-size:9px; color:#94a3b8; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;">依近半年營收動能</span>
                        </div>
                        <div class="no-mobile-collapse" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                            <div>
                                <div style="font-size:9px; color:#cbd5e1; margin-bottom:2px;">預估 Forward EPS</div>
                                <div style="font-size:16px; font-weight:800; color:#ffffff;">${safeFix(forwardEPS, 2)} <span style="font-size:10px; font-weight:400; color:${growthColor};">(${revGrowth >= 0 ? '+' : ''}${safeFix(revGrowth, 1)}%)</span></div>
                            </div>
                            <div style="text-align:right;">
                                <div style="font-size:9px; color:#cbd5e1; margin-bottom:2px;">預估 Forward PE</div>
                                <div style="font-size:16px; font-weight:800; color:${peComparison ? '#4ade80' : '#ffffff'};">${safeFix(forwardPE, 1)} <span style="font-size:10px; font-weight:400;">倍</span></div>
                            </div>
                        </div>
                        <div style="margin-top:8px; font-size:10px; color:${peComparison ? '#4ade80' : '#94a3b8'};">
                            ${peComparison ? '✅ 獲利成長中，預估本益比將進一步下降，目前具備長期潛力。' : '⚠️ 營收動能放緩，預期本益比可能墊高，需注意評價修正。'}
                        </div>
                    </div>
                    `;
                })()}
                
                <div style="font-size:11px;">
                    ${renderDiagnostic(
                        (pePercentile < 20 ? "⚠️ 估值進入歷史極低區，具備高度長線投資價值。" : (pePercentile > 80 ? "⚠️ 估值進入歷史極高區，需警惕過熱回檔風險。" : "目前估值處於歷史合理範圍內。"))
                    )}
                </div>
            </div>

            <div class="analysis-card">
                <div class="analysis-card-title">💎 籌碼深度分析</div>
                ${renderStatRow('券資比', (chipsData.marginShortRatio !== null && chipsData.marginShortRatio !== undefined) ? safeFix(chipsData.marginShortRatio, 1) + '%' : 'N/A')}
                ${renderStatRow('融資餘額', marginData?.marginPurchase ? marginData.marginPurchase.toLocaleString() + ' 張' : 'N/A')}
                ${renderStatRow('融券餘額', marginData?.shortSale ? marginData.shortSale.toLocaleString() + ' 張' : 'N/A')}
                ${renderStatRow('融資使用率', (marginData?.marginUseRate !== null && marginData?.marginUseRate !== undefined) ? marginData.marginUseRate + '%' : 'N/A')}
                ${renderStatRow('融資維持率', (() => {
                    if (marginData?.marginMaintenance) return safeFix(marginData.marginMaintenance, 1) + '%';
                    if (marginData?.estimatedMMR) return safeFix(marginData.estimatedMMR, 1) + '% (估)';
                    return 'N/A';
                })())}
                ${renderStatRow('融資趨勢 (10日)', (() => {
                    if (!marginData?.marginTrend) return 'N/A';
                    const { arrow, percent, color } = marginData.marginTrend;
                    return `<span style="color:${color}; font-weight:700;">融資近10日 ${arrow} ${percent}%</span>`;
                })())}
                
                <div style="font-size:11px; color:#cbd5e1; margin:10px 0 6px; border-bottom:1px dashed rgba(255,255,255,0.05); padding-bottom:6px;">
                    📈 法人動態 
                    <span style="font-size:9px; font-weight:normal; opacity:0.7; margin-left:4px;">(${institutionalData?.date || 'N/A'})</span>
                </div>
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <div style="flex:1; background:rgba(255,255,255,0.03); padding:8px; border-radius:6px; text-align:center;">
                        <div style="font-size:10px; color:#cbd5e1;">外資連買/賣</div>
                        <div style="font-size:14px; font-weight:600; color:${institutionalData?.streaks?.foreign > 0 ? '#ef4444' : (institutionalData?.streaks?.foreign < 0 ? '#10b981' : '#fff')}">
                            ${institutionalData?.streaks?.foreign > 0 ? `連買 ${institutionalData.streaks.foreign} 日` : (institutionalData?.streaks?.foreign < 0 ? `連賣 ${Math.abs(institutionalData.streaks.foreign)} 日` : '無')}
                        </div>
                    </div>
                    <div style="flex:1; background:rgba(255,255,255,0.03); padding:8px; border-radius:6px; text-align:center;">
                        <div style="font-size:10px; color:#cbd5e1;">投信連買/賣</div>
                        <div style="font-size:14px; font-weight:600; color:${institutionalData?.streaks?.trust > 0 ? '#ef4444' : (institutionalData?.streaks?.trust < 0 ? '#10b981' : '#fff')}">
                            ${institutionalData?.streaks?.trust > 0 ? `連買 ${institutionalData.streaks.trust} 日` : (institutionalData?.streaks?.trust < 0 ? `連賣 ${Math.abs(institutionalData.streaks.trust)} 日` : '無')}
                        </div>
                    </div>
                </div>
                
                <!-- 最新單日 + 看更多按鈕 -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="font-size:10px; color:#94a3b8;">📌 最新單日進出 (張)</span>
                    <button onclick="(function(btn){
                        var panel = document.getElementById('instPeriodPanel');
                        var expanded = panel.style.display !== 'none';
                        panel.style.display = expanded ? 'none' : 'block';
                        btn.textContent = expanded ? '看更多 ▼' : '收起 ▲';
                    })(this)" style="font-size:9px; color:#60a5fa; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.25); border-radius:4px; padding:2px 7px; cursor:pointer;">看更多 ▼</button>
                </div>
                ${renderNetBuyRow('外資單日', institutionalData?.latestDay?.foreign)}
                ${renderNetBuyRow('投信單日', institutionalData?.latestDay?.trust)}
                ${renderNetBuyRow('自營商單日', institutionalData?.latestDay?.dealer)}

                <!-- 可展開的多期累計抽屜 -->
                <div id="instPeriodPanel" style="display:none; margin-top:8px; border-top:1px dashed rgba(255,255,255,0.07); padding-top:8px;">
                    ${[{k:'d2',label:'近2日'},{k:'d3',label:'近3日'},{k:'d5',label:'近5日'},{k:'d10',label:'近10日'},{k:'m1',label:'近1個月'},{k:'m3',label:'近3個月'},{k:'m6',label:'近半年'},{k:'y1',label:'近1年'}].map(p => {
                        const v = instPeriod[p.k];
                        if (!v) return '';
                        const fmt = (n) => n === null || n === undefined ? 'N/A'
                            : `<span style="font-weight:700;color:${n>0?'#f87171':(n<0?'#4ade80':'#fff')};">${n>0?'+':''}${Math.round(n).toLocaleString()}</span>`;
                        return `
                        <div style="margin-bottom:6px;">
                            <div style="font-size:9px; color:#64748b; margin-bottom:2px; font-weight:600;">📅 累計 ${p.label}</div>
                            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; font-size:10px;">
                                <div style="background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:5px;">
                                    <div style="color:#94a3b8; font-size:9px;">外資</div>${fmt(v.foreign)}
                                </div>
                                <div style="background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:5px;">
                                    <div style="color:#94a3b8; font-size:9px;">投信</div>${fmt(v.trust)}
                                </div>
                                <div style="background:rgba(255,255,255,0.03); padding:4px 6px; border-radius:5px;">
                                    <div style="color:#94a3b8; font-size:9px;">自營商</div>${fmt(v.dealer)}
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>

                ${/* 土洋共識度指標列 */ consensusScore !== null ? (() => {
                    const barColor = consensusBull >= consensusBear ? '#ef4444' : '#10b981';
                    const label = consensusScore >= 60
                        ? (consensusBull >= consensusBear ? '共同做多 🔥' : '共同做空 ⚠️')
                        : (consensusScore >= 40 ? '方向分歧' : '明顯背離');
                    const textColor = consensusScore >= 60
                        ? (consensusBull >= consensusBear ? '#ef4444' : '#10b981')
                        : '#94a3b8';
                    return `
                    <div style="margin-top:10px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span class="analysis-label has-info" style="font-size:11px; color:#cbd5e1; cursor:pointer;"
                                  onclick="showTermExplainer('土洋共識度', '${consensusScore}%')">🤝 土洋共識度</span>
                            <span style="font-size:13px; font-weight:700; color:${textColor};">${consensusScore}%
                                <span style="font-size:9px; color:#64748b; margin-left:4px;">${label}</span>
                            </span>
                        </div>
                        <div style="height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden; margin-bottom:3px;">
                            <div style="height:100%; width:${consensusScore}%; background:${barColor}; border-radius:3px; transition:width 0.5s;"></div>
                        </div>
                    <div style="font-size:9px; color:#64748b; text-align:right;">近20日同向 ${consensusDays} 天（多${consensusBull} 空${consensusBear}）</div>
                    
                    <!-- 新增：法人預期修正動能 (Simulated) -->
                    <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
                        <span class="analysis-label has-info" style="font-size:11px; color:#94a3b8; cursor:pointer;" 
                              onclick="showTermExplainer('法人預期修正動能 (Simulated)', '模擬指標')">🎯 預期修正動能</span>
                        ${(() => {
                            let revScore = 0;
                            // 1. 投信行為 (核心權重)
                            if (instPeriod?.m1?.trust > 1000) revScore += 40;
                            else if (instPeriod?.m1?.trust < -1000) revScore -= 40;
                            else if (instPeriod?.m1?.trust > 0) revScore += 20;
                            else if (instPeriod?.m1?.trust < 0) revScore -= 20;

                            // 2. 營收動能 (基本面濾鏡)
                            if (revData?.yoy > 15) revScore += 30;
                            else if (revData?.yoy < -5) revScore -= 30;

                            // 3. 相對強弱 (市場定價預期)
                            if (riskMetrics?.rsr20 > 1.05) revScore += 30;
                            else if (riskMetrics?.rsr20 < 0.95) revScore -= 30;

                            let status = "中性持平";
                            let color = "#cbd5e1";
                            if (revScore >= 50) { status = "🚀 預期上修"; color = "#f87171"; }
                            else if (revScore <= -50) { status = "📉 預期下修"; color = "#4ade80"; }
                            
                            return `<span style="font-size:12px; font-weight:700; color:${color};">${status}</span>`;
                        })()}
                    </div>
                </div>`;
                })() : ''}
                ${(() => {
                    const latestDay = institutionalData?.latestDay;
                    const vol = chartData?.latestVol || 0;
                    const volLots = vol / 1000;
                    const netPct = (latestDay && vol > 0) ? ((latestDay.foreign + latestDay.trust + latestDay.dealer) * 1000 / vol * 100) : (institutionalData?.latestDayNetPct || 0);
                    
                    let concentration = 'N/A';
                    const d1 = brokerData?.d1 || brokerData;
                    if (d1 && volLots > 0 && d1.topBuySum !== undefined) {
                        const concVal = ((d1.topBuySum + d1.topSellSum) / volLots) * 100;
                        concentration = safeFix(concVal, 1) + '%';
                        d1.concentration = concVal;
                    }
                    
                    return `
                        ${renderStatRow('三大法人佔比/成交量', netPct ? safeFix(netPct, 1) + '%' : 'N/A')}
                        ${renderStatRow('分點集中度', concentration)}
                    `;
                })()}
                ${renderStatRow('主力買超 (Top15)', (brokerData?.d1?.mainNetBuy !== undefined) ? brokerData.d1.mainNetBuy.toLocaleString() + ' 張' : (brokerData?.mainNetBuy ? brokerData.mainNetBuy.toLocaleString() + ' 張' : 'N/A'))}
                ${(() => {
                    const d1 = brokerData?.d1 || brokerData;
                    const volLots = (chartData?.latestVol || 0) / 1000;
                    if (d1 && d1.mainNetBuy !== undefined && volLots > 0) {
                        const pct = (d1.mainNetBuy / volLots) * 100;
                        return renderPercentRow('主力買超佔比', pct);
                    }
                    return '';
                })()}
                ${(() => {
                    if (momentumRatio === null) return '';
                    let label = '';
                    let color = '#ffffff';
                    if (momentumStatus === 1) { label = '🔥 買盤加速'; color = '#ef4444'; }
                    else if (momentumStatus === -1) { label = '❄️ 賣壓加速'; color = '#10b981'; }
                    else if (momentumStatus === 2) { label = '✨ 轉買發力'; color = '#ef4444'; }
                    else if (momentumStatus === -2) { label = '⚠️ 轉賣警訊'; color = '#fbbf24'; }
                    
                    const ratioText = (momentumRatio !== null) ? `${safeFix(Math.abs(momentumRatio), 1)} 倍 ` : '';
                    return renderStatRow('籌碼動能加速', `<span style="color:${color}; font-weight:800;">${ratioText}${label}</span>`);
                })()}
                ${renderDiagnostic(
                    (institutionalData?.streaks?.foreign > 3 ? "外資持續吸籌，大戶心態偏多。" : (institutionalData?.streaks?.foreign < -3 ? "外資持續提款，短線需防範賣壓。" : "法人進出互有勝負，籌碼面處於觀望狀態。")) +
                    ((brokerData?.d1?.concentration || brokerData?.concentration) > 20 ? " 分點集中度高，主力收貨力道強勁。" : "") +
                    (marginData?.marginUseRate > 40 ? " 融資比例偏高，浮額較多需慎防多殺多。" : "") +
                    (chipDiagnosticMsg ? " <br>" + chipDiagnosticMsg : "")
                )}
            </div>


            
            <!-- 2.5 52週價量換手分析 (籌碼位階) -->
            <div class="analysis-card">
                <div class="analysis-card-title">🎯 52週價量換手分析</div>
                ${(() => {
                    const prices = chartData?.prices || [];
                    if (prices.length < 20) return '<div style="color:#94a3b8; font-size:12px; text-align:center; padding:20px;">歷史數據不足，無法進行換手分析</div>';
                    
                    // 直接使用 fetchStockChart 已經算好且具備容錯處理的高低點
                    const high52w = chartData?.high52w || 0;
                    const low52w = chartData?.low52w || 0;
                    
                    // 為了計算 VWAP，我們需要使用相同的欄位容錯邏輯
                    const getP = (item) => (item.close || item.Close || item.price || item.Price || 0);
                    const getV = (item) => (item.Trading_Volume || item.trading_volume || item.volume || item.Volume || item.Trading_Turnover || 0);
                    const getH = (item) => (item.max || item.High || item.Max || item.high || getP(item));
                    const getL = (item) => (item.min || item.Low || item.Min || item.low || getP(item));

                    let totalVol = 0;
                    let totalValue = 0;
                    const p52w = prices.slice(-250);
                    
                    p52w.forEach(d => {
                        const vol = getV(d);
                        const close = getP(d);
                        const high = getH(d);
                        const low = getL(d);
                        const typicalPrice = (high + low + close) / 3;
                        
                        if (vol > 0 && typicalPrice > 0) {
                            totalVol += vol;
                            totalValue += (typicalPrice * vol);
                        }
                    });
                    
                    const vwap52w = totalVol > 0 ? (totalValue / totalVol) : (p52w.reduce((s, x) => s + getP(x), 0) / p52w.length);
                    
                    const p = currentPrice || (p52w.length > 0 ? getP(p52w[p52w.length-1]) : 0);
                    const distHigh = high52w > 0 ? ((p - high52w) / high52w * 100).toFixed(1) : "0.0";
                    const vwapDiff = vwap52w > 0 ? ((p - vwap52w) / vwap52w * 100).toFixed(1) : "0.0";
                    const posPercent = (high52w !== low52w) ? ((p - low52w) / (high52w - low52w) * 100).toFixed(1) : 50;
                    const vwapPos = (high52w !== low52w) ? ((vwap52w - low52w) / (high52w - low52w) * 100).toFixed(1) : 50;

                    // --- 成交量能特徵 (Volume Profile / POC) 計算 ---
                    // 每筆資料依【其自身價格】決定級距，確保跨區間52週資料各自正確分組
                    const getVPStep = (px) => { px = Math.max(0, px - 0.001);
                        if (px < 10)   return 0.1;
                        if (px < 50)   return 0.5;
                        if (px < 100)  return 2.5;
                        if (px < 500)  return 5;
                        if (px < 1000) return 10;
                        return 50;
                    };
                    // 浮點安全的 floor-based 分桶 (防止 9.9/0.1 = 98.9999... 造成錯誤)
                    const getVPFloor = (px) => {
                        const st = getVPStep(px);
                        if (st >= 1) return Math.floor(Math.max(0, px - 0.001) / st) * st;
                        const factor = Math.round(1 / st); // 0.1→10, 0.5→2
                        const p = Math.max(0, px - 0.001); return Math.floor(Math.round(p * factor * 10000) / 10000) / factor;
                    };
                    // 標籤生成：整數步距含頭含尾 (100-104)；小數步距顯示兩端 (9.9-10.0)；步距=1只顯示底值
                    const getVPLabel = (fl, st) => {
                        if (st === 0.1) {
                            return `${parseFloat((fl + 0.01).toFixed(2))}-${parseFloat((fl + 0.1).toFixed(2))}`;
                        } else if (st === 0.5) {
                            return `${parseFloat((fl + 0.01).toFixed(2))}-${parseFloat((fl + 0.5).toFixed(2))}`;
                        } else if (st === 2.5) {
                            return `${parseFloat((fl + 0.01).toFixed(2))}-${parseFloat((fl + 2.5).toFixed(2))}`;
                        } else if (st === 5) {
                            return `${parseFloat((fl + 0.01).toFixed(2))}-${fl + 5}`;
                        } else if (st === 10) {
                            return `${parseFloat((fl + 0.01).toFixed(2))}-${fl + 10}`;
                        } else if (st === 50) {
                            return `${fl + 1}-${fl + 50}`;
                        }
                        return `${fl}-${fl + st}`;




                    };

                    // bins: key = string(依精度格式化的floor)，value = { vol, floor, step }
                    const bins = {};
                    let maxBinVol = 0;
                    let pocBinKey = '';

                    p52w.forEach(d => {
                        const vol      = getV(d);
                        const rawClose = getP(d);
                        if (vol > 0 && rawClose > 0) {
                            const close = Math.round(rawClose * 100) / 100; // 四捨五入至分
                            const st    = getVPStep(close);
                            const fl    = getVPFloor(close);
                            const prec  = st < 1 ? 1 : 0;
                            const key   = fl.toFixed(prec);
                            if (!bins[key]) bins[key] = { vol: 0, floor: fl, step: st };
                            bins[key].vol += vol;
                            if (bins[key].vol > maxBinVol) {
                                maxBinVol = bins[key].vol;
                                pocBinKey = key;
                            }
                        }
                    });

                    const sortedBins = Object.keys(bins).sort((a, b) => parseFloat(b) - parseFloat(a));
                    const pocFloor = bins[pocBinKey]?.floor ?? 0;
                    const pocStep  = bins[pocBinKey]?.step  ?? getVPStep(p);
                    const pocPrice = pocFloor + pocStep / 2; // POC 定位在密集區間中點
                    const pocDiff  = pocPrice > 0 ? ((p - pocPrice) / pocPrice * 100).toFixed(1) : '0.0';

                    return `
                        <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:12px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <span style="font-size:12px; color:#cbd5e1;">52週價格位階 (盤中高低點)</span>
                                <span style="font-size:14px; font-weight:800; color:#ffffff;">${posPercent}%</span>
                            </div>
                            
                            <!-- 52週高低點進度條 (整合 VWAP 與 POC) -->
                            <div style="position:relative; height:24px; width:100%; background:rgba(255,255,255,0.05); border-radius:6px; margin:22px 0 25px; border:1px solid rgba(255,255,255,0.1);">
                                <!-- VWAP 標記線 (紅) -->
                                <div style="position:absolute; left:${Math.max(0, Math.min(100, vwapPos))}% ; top:0; bottom:0; width:2px; background:#ef4444; z-index:1; opacity:0.8;"></div>
                                <div style="position:absolute; left:${Math.max(0, Math.min(100, vwapPos))}% ; top:-18px; transform:translateX(-50%); font-size:9px; color:#ef4444; white-space:nowrap; font-weight:700;">均價: ${vwap52w.toFixed(0)}</div>
                                
                                <!-- POC 標記線 (黃) -->
                                <div style="position:absolute; left:${Math.max(0, Math.min(100, (pocPrice - low52w) / (high52w - low52w) * 100))}% ; top:0; bottom:0; width:2px; background:#fbbf24; z-index:1; opacity:0.8;"></div>
                                <div style="position:absolute; left:${Math.max(0, Math.min(100, (pocPrice - low52w) / (high52w - low52w) * 100))}% ; bottom:-18px; transform:translateX(-50%); font-size:9px; color:#fbbf24; white-space:nowrap; font-weight:700;">密集區: ${pocPrice.toFixed(0)}</div>
                                
                                <!-- 目前股價標記 -->
                                <div style="position:absolute; left:${Math.max(0, Math.min(100, posPercent))}% ; top:50%; transform:translate(-50%, -50%); width:10px; height:10px; background:#fff; border-radius:50%; box-shadow:0 0 10px #fff; z-index:2; border:2px solid #3b82f6;"></div>
                                <div style="position:absolute; left:${Math.max(0, Math.min(100, posPercent))}% ; bottom:-18px; transform:translateX(-50%); font-size:10px; font-weight:900; color:#3b82f6; white-space:nowrap;">目前價: ${p}</div>
                                
                                <!-- 區間填色 -->
                                <div style="position:absolute; left:0; top:0; bottom:0; width:${Math.max(0, Math.min(100, posPercent))}% ; background:linear-gradient(90deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.3) 100%); border-radius:6px 0 0 6px;"></div>
                            </div>
                            
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                                <div class="has-info" onclick="showTermExplainer('52週成交均價 (VWAP)', '${safeFix(vwap52w, 1)}', '${p}')" style="background:rgba(255,243,232,0.05); padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); cursor:pointer;">
                                    <div style="font-size:10px; color:#ef4444; margin-bottom:4px;">52週成交均價 (VWAP) 💡</div>
                                    <div style="font-size:13px; font-weight:700; color:#ffffff;">
                                        ${safeFix(vwap52w, 1)} <span style="font-size:10px; font-weight:400; color:${parseFloat(vwapDiff) >= 0 ? '#f87171' : '#4ade80'};">(${parseFloat(vwapDiff) > 0 ? '+' : ''}${vwapDiff}%)</span>
                                    </div>
                                </div>
                                <div class="has-info" onclick="showTermExplainer('籌碼密集區 (POC)', '${safeFix(pocPrice, 1)}', '${p}')" style="background:rgba(255,243,232,0.05); padding:8px; border-radius:8px; border:1px solid rgba(251,191,36,0.2); cursor:pointer;">
                                    <div style="font-size:10px; color:#fbbf24; margin-bottom:4px;">籌碼密集區 (POC) 💡</div>
                                    <div style="font-size:13px; font-weight:700; color:#ffffff;">
                                        ${safeFix(pocPrice, 1)} <span style="font-size:10px; font-weight:400; color:${parseFloat(pocDiff) >= 0 ? '#f87171' : '#4ade80'};">(${parseFloat(pocDiff) > 0 ? '+' : ''}${pocDiff}%)</span>
                                    </div>
                                </div>
                            </div>

                            ${(() => {
                                // --- 新增：籌碼分佈密度 (套牢壓力) 計算 ---
                                let totalVolSum = 0;
                                let trappedVolSum = 0;
                                const upperLimit = p * 1.10; // 上方 10% 區間

                                Object.keys(bins).forEach(bpStr => {
                                    const { vol: v, floor: bf } = bins[bpStr];
                                    totalVolSum += v;
                                    // 以 binFloor 判斷：該 bucket 起點嚴格在目前股價之上才計入套牢
                                    if (bf > p && bf <= upperLimit) {
                                        trappedVolSum += v;
                                    }
                                });

                                const tRatio = totalVolSum > 0 ? (trappedVolSum / totalVolSum * 100) : 0;
                                let pColor = '#10b981'; // Green
                                let pLabel = '輕微 (籌碼乾淨)';
                                if (tRatio > 35) {
                                    pColor = '#ef4444'; // Red
                                    pLabel = '極重 (強大解套賣壓)';
                                } else if (tRatio > 25) {
                                    pColor = '#f97316'; // Orange
                                    pLabel = '沉重 (明顯阻力)';
                                } else if (tRatio > 15) {
                                    pColor = '#facc15'; // Yellow
                                    pLabel = '中等 (正常換手)';
                                }

                                return `
                                <!-- 籌碼分佈密度 (套牢壓力) 分析 -->
                                <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:10px; margin-bottom:15px; border:1px solid rgba(255,255,255,0.05);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                        <span style="font-size:11px; color:#cbd5e1; font-weight:700;">🛡️ 籌碼分佈密度 (套牢壓力)</span>
                                        <span style="font-size:11px; font-weight:800; color:${pColor};">${pLabel}</span>
                                    </div>
                                    <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; position:relative; margin-bottom:6px;">
                                        <div style="height:100%; width:${Math.min(100, tRatio)}%; background:${pColor}; border-radius:4px; transition:width 0.5s;"></div>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; font-size:12px; color:#94a3b8;">
                                        <span>上方 10% 區間籌碼佔比</span>
                                        <span style="color:#ffffff; font-weight:700;">${tRatio.toFixed(1)}%</span>
                                    </div>
                                    <div style="margin-top:6px; font-size:11.5px; color:#cbd5e1; line-height:1.4;">
                                        ${tRatio > 20 ? `⚠️ 警訊：目前股價上方 10% 區間內聚集了 ${tRatio.toFixed(1)}% 的沉重籌碼，上攻將面臨強大的解套拋售壓力。` : `✅ 籌碼結構相對輕盈（${tRatio.toFixed(1)}%），上方無明顯大量套牢區，有利於股價後續推進。`}
                                    </div>
                                </div>
                                `;
                            })()}

                            <div style="margin-top:10px; margin-bottom:15px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                    <div style="font-size:11px; color:#cbd5e1;">📊 價格量能分佈 (Volume Profile)</div>
                                    <div style="font-size:9px; color:#fbbf24;">🟡 籌碼密集區 (POC)</div>
                                </div>
                                <div id="vp-container">
                                    ${(() => {
                                        return sortedBins.slice(0, 50).map((binKey, idx) => {
                                            const { vol: binVol, floor: binFloor, step: binStep } = bins[binKey];
                                            const weight    = (binVol / maxBinVol * 100);
                                            const isPOC     = binKey === pocBinKey;
                                            const isHidden  = idx >= 8;
                                            const binEnd    = binFloor + binStep;
                                            const isCurrent = (p > binFloor && p <= binEnd);
                                            const label     = getVPLabel(binFloor, binStep);
                                            
                                            return `
                                                <div class="vp-row${isHidden ? ' vp-hidden-row' : ''}" style="display:${isHidden ? 'none' : 'flex'}; align-items:center; gap:8px; margin-bottom:4px; position:relative;">
                                                    <div style="width:75px; font-size:10px; color:${isPOC ? '#fbbf24' : (isCurrent ? '#ffffff' : '#94a3b8')}; letter-spacing:-0.5px; font-weight:${isCurrent ? '800' : '400'}; line-height:1.3;">
                                                        ${label}<br><span style="font-size:9px; color:${isPOC ? '#fbbf24' : '#ffffff'}; font-weight:400;">${Math.round(binVol / 1000).toLocaleString()}張</span>
                                                    </div>
                                                    <div style="flex:1; height:6px; background:rgba(255,255,255,0.05); border-radius:3px; position:relative; overflow:visible;">
                                                        <div style="position:absolute; left:0; top:0; bottom:0; width:${weight}%; background:${isPOC ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'linear-gradient(90deg, #3b82f6, #2563eb)'}; opacity:${isPOC ? 1 : 0.6}; border-radius:3px;"></div>
                                                        ${isCurrent ? `
                                                            <div style="position:absolute; left:${Math.max(0, Math.min(100, (p - binFloor) / binStep * 100))}%; top:50%; transform:translate(-50%, -50%); width:6px; height:6px; background:#fff; border-radius:50%; box-shadow:0 0 5px #fff; z-index:10;"></div>
                                                            <div style="position:absolute; left:${Math.max(0, Math.min(100, (p - binFloor) / binStep * 100))}%; top:-12px; transform:translateX(-50%); font-size:10px; color:#fff; white-space:nowrap; font-weight:900; text-shadow:0 0 3px #000;">${p}</div>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                            `;
                                        }).join('');
                                    })()}
                                </div>
                                <button onclick="toggleVP(this)" style="display: ${sortedBins.length > 8 ? 'block' : 'none'}; width:100%; margin-top:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-size:10px; padding:4px; border-radius:4px; cursor:pointer;">展開 ↓</button>
                            </div>

                            <div class="analysis-stat-row">
                                <span class="analysis-label has-info" onclick="showTermExplainer('52週 加權平均成本', '${safeFix(vwap52w, 2)}', '${p}')">52週 加權平均成本</span>
                                <span class="analysis-val">${safeFix(vwap52w, 2)} 元</span>
                            </div>
                            ${renderStatRow('距 52週 高點距離', distHigh + '%')}
                            ${renderStatRow('距 加權成本 偏離', (parseFloat(vwapDiff) > 0 ? '+' : '') + vwapDiff + '%')}

                            ${renderDiagnostic(
                                (() => {
                                    let diag = (p > pocPrice * 1.03 ? "🚀 股價站穩籌碼密集區上方，具備強力支撐。" : (p < pocPrice * 0.97 ? "⚠️ 股價處於籌碼密集區下方，面臨大量解套壓力。" : "🟡 股價正與籌碼密集區拉鋸中，多空方向未明。"));
                                    diag += (p > vwap52w ? " 且高於年度均價，趨勢偏多。" : " 且低於年度均價，趨勢偏弱。");
                                    return diag;
                                })()
                            )}
                        </div>
                    `;
                })()}
            </div>

            <!-- 17. 籌碼集中度深度分析 (Advanced Chip Analysis) -->
            <div class="analysis-card">
                <div class="analysis-card-title">🎯 籌碼集中度深度分析</div>
                
                <div class="analysis-stat-row" style="display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px dashed rgba(255,255,255,0.05);">
                    <span class="analysis-label">
                        三大法人總持股 ${chipsData?.holdingDate ? `<span style="font-size:10px; opacity:0.6; font-weight:normal;">(${chipsData.holdingDate})</span>` : ''}
                    </span>
                    <span class="analysis-val">${chipsData?.institutionalTotal ? safeFix(chipsData.institutionalTotal, 2) + '%' : 'N/A'}</span>
                </div>
                
                <div class="analysis-stat-row" onclick="showHoldingTrendChart('${symbol}', '外資')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px dashed rgba(255,255,255,0.05);">
                    <span style="font-size:12.5px; color:#60a5fa; font-weight:700;">外資持股比 📈</span>
                    <span class="analysis-val">${chipsData?.foreign ? safeFix(chipsData.foreign, 2) + '%' : 'N/A'}</span>
                </div>
                <div class="analysis-stat-row" onclick="showHoldingTrendChart('${symbol}', '投信')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px dashed rgba(255,255,255,0.05);">
                    <span style="font-size:12.5px; color:#60a5fa; font-weight:700;">投信持股比 📈${chipsData?.isETFEstimated && chipsData?.trust !== null ? '<span style="font-size:9px; color:#94a3b8; font-weight:normal;"> (累積淨倉估算)</span>' : ''}</span>
                    <span class="analysis-val">${chipsData?.trust !== null && chipsData?.trust !== undefined ? safeFix(chipsData.trust, 3) + '%' : 'N/A'}</span>
                </div>
                <div class="analysis-stat-row" onclick="showHoldingTrendChart('${symbol}', '自營商')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px dashed rgba(255,255,255,0.05);">
                    <span style="font-size:12.5px; color:#60a5fa; font-weight:700;">自營商持股比 📈${chipsData?.isETFEstimated && chipsData?.dealer !== null ? '<span style="font-size:9px; color:#94a3b8; font-weight:normal;"> (累積淨倉估算)</span>' : ''}</span>
                    <span class="analysis-val">${chipsData?.dealer !== null && chipsData?.dealer !== undefined ? safeFix(chipsData.dealer, 3) + '%' : 'N/A'}</span>
                </div>
                
                <!-- 法人買進均價 -->
                <div style="background:rgba(59, 130, 246, 0.05); padding:12px; border-radius:12px; margin-bottom:15px; border:1px solid rgba(59, 130, 246, 0.1);">
                    <div style="font-size:12px; color:#60a5fa; font-weight:700; margin-bottom:4px;">🏦 法人買進均價 (5/10/20日)</div>
                    <div style="font-size:9px; color:#64748b; margin-bottom:2px;">以當日收盤價估算（非盤中 VWAP，誤差約 0.3–1%）；有淨買超時顯示買進均價，純賣超期間改示交易活動均價，僅供參考</div>
                    <div style="font-size:9px; color:#475569; margin-bottom:8px;">⚠ 資料來源為買賣流量（FinMind 免費方案），非實際持倉量，與真實持倉成本存在本質差距</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <!-- 外資部分 -->
                        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:8px;">
                            <div style="font-size:10px; color:#cbd5e1; margin-bottom:5px;">外資買進均價</div>
                            <div style="display:flex; justify-content:space-between; font-size:11px;">
                                <span style="color:#cbd5e1;">5日:</span>
                                <span style="font-weight:700; color:#fbbf24;">${chipCosts?.foreign?.cost5 > 0 ? safeFix(chipCosts.foreign.cost5, 1) : 'N/A'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:11px;">
                                <span style="color:#cbd5e1;">10日:</span>
                                <span style="font-weight:700; color:#fbbf24;">${chipCosts?.foreign?.cost10 > 0 ? safeFix(chipCosts.foreign.cost10, 1) : 'N/A'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:11px;">
                                <span style="color:#cbd5e1;">20日:</span>
                                <span style="font-weight:700; color:#fbbf24;">${chipCosts?.foreign?.cost20 > 0 ? safeFix(chipCosts.foreign.cost20, 1) : 'N/A'}</span>
                            </div>
                            <!-- 隱藏部分 -->
                            <div class="inst-costs-hidden" style="display:none;">
                                <div style="display:flex; justify-content:space-between; font-size:11px;">
                                    <span style="color:#cbd5e1;">60日:</span>
                                    <span style="font-weight:700; color:#fbbf24;">${chipCosts?.foreign?.cost60 > 0 ? safeFix(chipCosts.foreign.cost60, 1) : 'N/A'}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:11px;">
                                    <span style="color:#cbd5e1;">120日:</span>
                                    <span style="font-weight:700; color:#fbbf24;">${chipCosts?.foreign?.cost120 > 0 ? safeFix(chipCosts.foreign.cost120, 1) : 'N/A'}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:11px;">
                                    <span style="color:#cbd5e1;">240日:</span>
                                    <span style="font-weight:700; color:#fbbf24;">${chipCosts?.foreign?.cost240 > 0 ? safeFix(chipCosts.foreign.cost240, 1) : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                        <!-- 投信部分 -->
                        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:8px;">
                            <div style="font-size:10px; color:#cbd5e1; margin-bottom:5px;">投信買進均價</div>
                            <div style="display:flex; justify-content:space-between; font-size:11px;">
                                <span style="color:#cbd5e1;">5日:</span>
                                <span style="font-weight:700; color:#fbbf24;">${chipCosts?.trust?.cost5 > 0 ? safeFix(chipCosts.trust.cost5, 1) : 'N/A'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:11px;">
                                <span style="color:#cbd5e1;">10日:</span>
                                <span style="font-weight:700; color:#fbbf24;">${chipCosts?.trust?.cost10 > 0 ? safeFix(chipCosts.trust.cost10, 1) : 'N/A'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:11px;">
                                <span style="color:#cbd5e1;">20日:</span>
                                <span style="font-weight:700; color:#fbbf24;">${chipCosts?.trust?.cost20 > 0 ? safeFix(chipCosts.trust.cost20, 1) : 'N/A'}</span>
                            </div>
                            <!-- 隱藏部分 -->
                            <div class="inst-costs-hidden" style="display:none;">
                                <div style="display:flex; justify-content:space-between; font-size:11px;">
                                    <span style="color:#cbd5e1;">60日:</span>
                                    <span style="font-weight:700; color:#fbbf24;">${chipCosts?.trust?.cost60 > 0 ? safeFix(chipCosts.trust.cost60, 1) : 'N/A'}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:11px;">
                                    <span style="color:#cbd5e1;">120日:</span>
                                    <span style="font-weight:700; color:#fbbf24;">${chipCosts?.trust?.cost120 > 0 ? safeFix(chipCosts.trust.cost120, 1) : 'N/A'}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; font-size:11px;">
                                    <span style="color:#cbd5e1;">240日:</span>
                                    <span style="font-weight:700; color:#fbbf24;">${chipCosts?.trust?.cost240 > 0 ? safeFix(chipCosts.trust.cost240, 1) : 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button onclick="toggleInstCosts(this)" style="width:100%; margin-top:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-size:10px; padding:4px; border-radius:4px; cursor:pointer;">看更多 (60/120/240日) ↓</button>
                </div>

                <!-- 贏家與主力分點追蹤 -->
                <div style="margin-bottom:15px;">
                    <div style="font-size:11px; color:#cbd5e1; margin-bottom:10px; display:flex; align-items:center; gap:5px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px;">
                        <span>📊 近60日買賣超前五大券商</span>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <!-- 買超前五 (含贏家標籤) -->
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <div style="font-size:10px; color:#ef4444; font-weight:700; margin-bottom:2px;">📈 買超前五名</div>
                            ${(winnerBrokers.length > 0 ? winnerBrokers : (brokerData?.d60?.topBrokers || [])).slice(0, 5).map(b => `
                                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(239, 68, 68, 0.05); padding:6px 8px; border-radius:6px; border:1px solid rgba(239, 68, 68, 0.1);">
                                    <div style="display:flex; align-items:baseline; gap:4px; min-width:0; flex:1;">
                                        <span style="font-size:11px; color:#ffffff; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex-shrink:1;">${b.name}</span>
                                        ${b.label ? `<span style="font-size:9px; color:#fbbf24; white-space:nowrap; flex-shrink:0;">${b.label}</span>` : ''}
                                    </div>
                                    <span style="font-size:10px; font-weight:700; color:#ef4444; flex-shrink:0; margin-left:6px;">+${(b.buyNet || 0).toLocaleString()}</span>
                                </div>
                            `).join('') || '<div style="color:#94a3b8; font-size:10px; text-align:center;">無買超數據</div>'}
                        </div>

                        <!-- 賣超前五 -->
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <div style="font-size:10px; color:#10b981; font-weight:700; margin-bottom:2px;">📉 賣超前五名</div>
                            ${(topSellers60 || []).slice(0, 5).map(b => `
                                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(16, 185, 129, 0.05); padding:6px 8px; border-radius:6px; border:1px solid rgba(16, 185, 129, 0.1);">
                                    <div style="display:flex; align-items:baseline; gap:4px; min-width:0; flex:1;">
                                        <span style="font-size:11px; color:#ffffff; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex-shrink:1;">${b.name}</span>
                                        ${b.label ? `<span style="font-size:9px; color:#fb923c; white-space:nowrap; flex-shrink:0;">${b.label}</span>` : ''}
                                    </div>
                                    <span style="font-size:10px; font-weight:700; color:#10b981; flex-shrink:0; margin-left:6px;">-${(b.sellNet || 0).toLocaleString()}</span>
                                </div>
                            `).join('') || '<div style="color:#94a3b8; font-size:10px; text-align:center;">無賣超數據</div>'}
                        </div>

                    </div>
                </div>

                <!-- 大戶/散戶持股比例 -->
                <div style="margin-bottom:20px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span onclick="showHolderTrendChart()" style="font-size:12px; color:#60a5fa; cursor:pointer; display:flex; align-items:center; gap:4px;" title="點擊查看完整趨勢圖">
                            📊 集保大戶 vs 散戶持股比例
                        </span>
                        <div style="display:flex; align-items:center; gap:12px;">
                            ${(() => {
                                const trend = chipsData?.holderTrend || [];
                                if (trend.length < 3) return '';
                                const last3 = trend.slice(-3);
                                const slope = (last3[2].large - last3[0].large) / 2;
                                const color = slope > 0 ? '#f87171' : (slope < 0 ? '#4ade80' : '#cbd5e1');
                                return `
                                    <div class="has-info" onclick="showTermExplainer('大戶持股速度', '${slope.toFixed(3)}%/期')" style="font-size:10px; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:12px; border:1px solid ${color}40; display:flex; align-items:center; gap:4px; cursor:pointer;">
                                        <span style="color:#94a3b8;">持股速度:</span>
                                        <span style="color:${color}; font-weight:800;">${slope > 0 ? '+' : ''}${slope.toFixed(3)}%</span>
                                        <span style="color:${color};">${slope > 0 ? '📈' : (slope < 0 ? '📉' : '━')}</span>
                                    </div>
                                `;
                            })()}
                            <div style="display:flex; gap:8px; font-size:10px;">
                                <span style="color:#ef4444;">● >400</span>
                                <span style="color:#10b981;">● &lt;50</span>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${(chipsData?.holderTrend || []).slice(-8).reverse().map(t => {
                            return `
                            <div style="display:flex; align-items:center; gap:8px; padding:2px 0;">
                                <div style="width:38px; font-size:10px; color:#94a3b8; font-family:monospace;">${t.date.substring(5)}</div>
                                <div style="flex:1; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; display:flex;">
                                    <div style="width:${t.large}%; background:#ef4444; height:100%;"></div>
                                    <div style="width:${t.retail}%; background:#10b981; height:100%;"></div>
                                </div>
                                <div style="width:105px; font-size:10px; color:#ffffff; text-align:right; font-family:monospace;">
                                    <span style="color:#f87171;">${t.large.toFixed(2)}</span>
                                    <span style="color:#94a3b8;">/</span> 
                                    <span style="color:#4ade80;">${t.retail.toFixed(2)}</span>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- 籌碼集中程度指數 -->
                ${(() => {
                    const trend = chipsData?.holderTrend || [];
                    if (trend.length === 0) return '';
                    const latest = trend[trend.length - 1];
                    const ci = latest.large - latest.retail;
                    const prev = trend.length >= 5 ? trend[trend.length - 5] : trend[0];
                    const prevCi = prev.large - prev.retail;
                    const delta = ci - prevCi;
                    const nWeeks = trend.length >= 5 ? 4 : trend.length - 1;

                    let ciColor, ciLabel;
                    if (ci > 30)        { ciColor = '#ef4444'; ciLabel = '高度集中'; }
                    else if (ci > 10)   { ciColor = '#f97316'; ciLabel = '偏向集中'; }
                    else if (ci >= -10) { ciColor = '#fbbf24'; ciLabel = '籌碼平衡'; }
                    else                { ciColor = '#10b981'; ciLabel = '散戶主導'; }

                    const trendArrow = delta > 0.3 ? '▲ 集中中' : delta < -0.3 ? '▼ 鬆動中' : '─ 持平';
                    const trendColor = delta > 0.3 ? '#ef4444' : delta < -0.3 ? '#10b981' : '#94a3b8';
                    const ciStr = (ci >= 0 ? '' : '') + ci.toFixed(2);
                    const safeVal = ciStr.replace(/'/g, "\\'");

                    return `
                <div style="background:rgba(255,255,255,0.04); padding:10px 12px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="analysis-label has-info" style="font-size:12px; color:#cbd5e1; cursor:pointer;"
                              onclick="showTermExplainer('籌碼集中程度指數', '${safeVal}')">籌碼集中程度指數</span>
                        <span style="font-size:18px; font-weight:800; color:${ciColor};">${ciStr}%</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <span style="font-size:10px; color:${trendColor};">${trendArrow}（近${nWeeks}週 ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%）</span>
                        <span style="font-size:11px; font-weight:700; color:${ciColor};">${ciLabel}</span>
                    </div>
                </div>`;
                })()}

                ${renderDiagnostic(
                    (() => {
                        const d20 = brokerData?.d20;
                        const lastHolder = chipsData?.holderTrend?.[chipsData.holderTrend.length - 1];
                        
                        let diag = "";
                        // 成本診斷
                        const tCost = chipCosts?.trust?.cost20 || 0;
                        const fCost = chipCosts?.foreign?.cost20 || 0;
                        const tCost240 = chipCosts?.trust?.cost240 || 0;
                        const fCost240 = chipCosts?.foreign?.cost240 || 0;
                        
                        if (tCost240 > 0 && Math.abs(currentPrice - tCost240) / tCost240 < 0.02) {
                            diag += "🛡️ 警告/機會：股價正處於「投信年線成本 (240日)」附近，這是長線大底的關鍵防線，若跌破需警惕長線轉弱。";
                        } else if (fCost240 > 0 && Math.abs(currentPrice - fCost240) / fCost240 < 0.02) {
                            diag += "🛡️ 警告/機會：股價回測「外資年線成本 (240日)」，此處具備極強的長線支撐與指標意義。";
                        } else if (tCost > 0 && Math.abs(currentPrice - tCost) / tCost < 0.02) {
                            diag += "🚀 股價正回測「投信 20 日成本線」，若能撐住則具備強大支撐力道。";
                        } else if (fCost > 0 && currentPrice > fCost * 1.3) {
                            diag += "⚠️ 警告：股價已偏離外資成本超過 30%，需防範外資獲利了結賣壓。";
                        } else if (tCost > 0 && currentPrice < tCost * 0.93) {
                            diag += "⚠️ 警告：股價已跌破投信成本區，需留意法人認賠殺出的連鎖效應。";
                        } else {
                            diag += "目前股價處於法人成本區間上方，籌碼結構健康。";
                        }
                        
                        
                        return diag;
                    })()
                )}
            </div>

            <!-- 8. 股利與分配 -->
            <div class="analysis-card">
                <div class="analysis-card-title">🍎 股利政策與趨勢</div>
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:10px;">📅 近 8 次除權息紀錄:</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; margin-bottom:12px;">
                    ${(chipsData?.divHistory || []).map(d => `
                        <div style="background:rgba(255,255,255,0.03); padding:6px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:2px;">
                            <div style="font-size:10px; color:#94a3b8; font-family:monospace;">${d.date}</div>
                            <div style="display:flex; gap:6px; font-size:12px; font-weight:800;">
                                <span style="color:#4ade80;">現 ${d.cash}</span>
                                ${d.stock > 0 ? `<span style="color:#fbbf24;">股 ${d.stock}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${renderStatRow('最近現金股利', (chipsData?.exDivAmt !== null && chipsData?.exDivAmt !== undefined) ? chipsData.exDivAmt + ' 元' : 'N/A')}
                ${renderStatRow('連續配息年數', (chipsData?.divConsecutiveYears !== undefined) ? chipsData.divConsecutiveYears + ' 年' : 'N/A')}
                ${renderPercentRow('股利 3年 CAGR', chipsData?.divGrowth3y)}
                <div style="font-size:11px; color:${isETF ? '#6b7280' : '#cbd5e1'}; margin:10px 0 6px; border-bottom:1px dashed rgba(255,255,255,0.05); padding-bottom:6px; ${isETF ? 'text-decoration:line-through; opacity:0.6;' : ''}">📈 獲利分配與永續性</div>
                ${(() => {
                    const payout = (totalDiv12m && finData?.epsLTM) ? (totalDiv12m / finData.epsLTM * 100) : null;
                    
                    // 新增：自由現金流配息率 (FCF Payout Ratio)
                    let ttmFcf = 0;
                    if (finData?.fcfTrend && finData.fcfTrend.length >= 4) {
                        ttmFcf = finData.fcfTrend.slice(-4).reduce((sum, item) => sum + (item.fcf || 0), 0);
                    } else {
                        ttmFcf = finData?.freeCashFlow || 0;
                    }
                    
                    const fcfPerShare = (shares > 0) ? (ttmFcf / shares) : 0;
                    const fcfPayout = (totalDiv12m > 0 && fcfPerShare > 0) ? (totalDiv12m / fcfPerShare * 100) : null;
                    
                    return `
                        ${renderPercentRow('盈餘分配率 (Payout Ratio)', payout, false, false)}
                        ${renderPercentRow('自由現金流配息率', fcfPayout, false, false)}
                    `;
                })()}
                ${renderStatRow('近四季 EPS (LTM)', finData?.epsLTM ? safeFix(finData.epsLTM, 2) + ' 元' : 'N/A')}
                ${renderStatRow('近一年總配息', safeFix(totalDiv12m, 2) + ' 元')}
                ${renderDiagnostic(
                    (() => {
                        const payout = (totalDiv12m && finData?.epsLTM) ? (totalDiv12m / finData.epsLTM * 100) : null;
                        
                        // FCF Payout 診斷
                        let ttmFcf = 0;
                        if (finData?.fcfTrend && finData.fcfTrend.length >= 4) {
                            ttmFcf = finData.fcfTrend.slice(-4).reduce((sum, item) => sum + (item.fcf || 0), 0);
                        } else {
                            ttmFcf = finData?.freeCashFlow || 0;
                        }
                        const fcfPerShare = (shares > 0) ? (ttmFcf / shares) : 0;
                        const fcfPayout = (totalDiv12m > 0 && fcfPerShare > 0) ? (totalDiv12m / fcfPerShare * 100) : null;

                        let diag = divTrendAnalysis + " ";
                        if (fcfPayout > 100) diag += "‼️ <b>地雷警訊：</b>自由現金流配息率爆表 (${Math.round(fcfPayout)}%)，代表公司正借債發股利，配息極其危險。";
                        else if (payout > 100) diag += "⚠️ 警告：發放率超過 100%，公司正在「吃老本」發放股利，長期恐不具永續性。";
                        else if (payout > 80 || fcfPayout > 80) diag += "配息率偏高，雖然殖利率誘人，但需留意公司是否缺乏未來投資成長的資金。";
                        else if (payout < 30 && payout > 0) diag += "配息率較低，公司可能保留較多資金用於擴張，屬成長型特徵。";
                        else if (payout > 0) diag += "配息政策穩健，獲利與發放比例均衡。";
                        
                        if ((chipsData?.divConsecutiveYears || 0) >= 10) diag += " 長期連續配息紀錄佳，收息極其穩定。";
                        return diag;
                    })()
                )}
            </div>

            <!-- 7. 技術面分析 -->
            <div class="analysis-card">
                <div class="analysis-card-title">📉 技術面分析</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="text-align:center; flex:1; cursor:pointer;" onclick="showTermExplainer('RSI(14)', '${rsi14}')">
                        <div style="font-size:10px; color:#cbd5e1;" class="has-info">RSI(14)</div>
                        <div style="font-size:16px; font-weight:600; color:${rsi14 > 70 ? '#ef4444' : (rsi14 < 30 ? '#10b981' : '#fff')}">${rsi14 || 'N/A'}</div>
                    </div>
                    <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                    <div style="text-align:center; flex:1; cursor:pointer;" onclick="showTermExplainer('KD (K/D)', '${kd ? `${kd.k}/${kd.d}` : ''}')">
                        <div style="font-size:10px; color:#cbd5e1;" class="has-info">KD (K/D)</div>
                        <div style="font-size:16px; font-weight:600;">${kd ? `${kd.k}/${kd.d}` : 'N/A'}</div>
                    </div>
                    <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                    <div style="text-align:center; flex:1; cursor:pointer;" onclick="showTermExplainer('MACD OSC', '${macd ? safeFix(macd.osc, 2) : ''}')">
                        <div style="font-size:10px; color:#cbd5e1;" class="has-info">MACD OSC</div>
                        <div style="font-size:16px; font-weight:600; color:#ffffff;">${macd ? safeFix(macd.osc, 2) : 'N/A'}</div>
                    </div>
                </div>
                ${renderMARow('5日線 (週線)', ma.ma5, currentPrice)}
                ${renderMARow('10日線', ma.ma10, currentPrice)}
                ${renderMARow('20日線 (月線)', ma.ma20, currentPrice)}
                <div class="ma-hidden-rows" style="display:none;">
                    ${renderMARow('60日線 (季線)', ma.ma60, currentPrice)}
                    ${renderMARow('120日線 (半年線)', ma.ma120, currentPrice)}
                    ${renderMARow('240日線 (年線)', ma.ma240, currentPrice)}
                </div>
                <button onclick="toggleTechnicalMA(this)" style="width:100%; margin: 8px 0; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#94a3b8; font-size:10px; padding:4px; border-radius:4px; cursor:pointer;" data-expanded="false">展開更多均線 (60/120/240) ↓</button>
                ${renderStatRow('布林位置', (() => {
                    if(!bb) return 'N/A';
                    const bbPosVal = ((currentPrice - bb.lower) / (bb.upper - bb.lower) * 100);
                    const pos = safeFix(bbPosVal, 0);
                    return `${pos}% ${bbPosVal > 80 ? '⚠️' : bbPosVal < 20 ? '🟢' : ''}`;
                })())}
                <div style="font-size:11px; color:#cbd5e1; margin:12px 0 6px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">🚀 價格與中長期動能</div>
                <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px; margin-bottom:12px;">
                    ${(() => {
                        let p10d = chartData.price10d;
                        if (p10d === undefined && chartData.prices && chartData.prices.length >= 10) {
                            const curObj = chartData.prices[chartData.prices.length - 1];
                            const preObj = chartData.prices[chartData.prices.length - 10];
                            const curP = curObj ? (curObj.close || curObj.Close) : 0;
                            const preP = preObj ? (preObj.close || preObj.Close) : 0;
                            if (preP > 0) p10d = (curP - preP) / preP * 100;
                        }

                        const mItems = [
                            { label: '近10日', val: p10d },
                            { label: '近一月', val: chartData.price1m },
                            { label: '年初至今', val: chartData.momYTD },
                            { label: '近半年', val: chartData.mom6m },
                            { label: '近一年', val: chartData.mom1y },
                            { label: '近兩年', val: chartData.mom2y },
                            { label: '近三年', val: chartData.mom3y },
                            { label: '近四年', val: chartData.mom4y },
                            { label: '近五年', val: chartData.mom5y }
                        ];
                        return mItems.map(item => {
                            if (item.val === null || item.val === undefined) return '';
                            const color = item.val > 0 ? '#f87171' : (item.val < 0 ? '#4ade80' : '#fff');
                            return `
                                <div style="background:rgba(255,255,255,0.03); padding:6px 4px; border-radius:6px; border:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; gap:2px; text-align:center;">
                                    <div style="font-size:9px; color:#94a3b8; white-space:nowrap;">${item.label}</div>
                                    <div style="font-size:13px; font-weight:800; color:${color};">
                                        ${item.val > 0 ? '+' : ''}${safeFix(item.val, 1)}%
                                    </div>
                                </div>
                            `;
                        }).join('');
                    })()}
                </div>
                ${renderDiagnostic(
                    (chartData.goldenCross ? "🔥 均線呈現多頭強勢排列（黃金交叉區域）。" : 
                     (chartData.deathCross ? "❄️ 均線呈現空頭弱勢排列（死亡交叉區域）。" : 
                     `均線狀態: ${chartData.maStatus}。`)) +
                    (currentPrice > ma.ma60 ? "股價在季線之上，趨勢偏多。" : "股價在季線之下，處於空頭格局。") +
                    (rsi14 > 70 ? " RSI 進入超買，慎防回檔。" : (rsi14 < 30 ? " RSI 進入超賣，醞釀跌深反彈。" : "")) +
                    (chartData.bbSqueeze ? " ⚡ 注意：目前處於布林帶縮排（Squeeze），近期可能出現大波動突破。" : "")
                )}
            </div>

            <!-- 15. 風險與波動分析 -->
            <div class="analysis-card">
                <div class="analysis-card-title">⚖️ 風險與波動分析</div>
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:12px;">基準指數: 台股加權指數 (TAIEX)</div>
                
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <div style="flex:1; background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:10px; color:#cbd5e1; margin-bottom:4px;">Beta 係數 (β)</div>
                        <div style="font-size:22px; font-weight:800; color:#ffffff;">
                            ${riskMetrics ? riskMetrics.beta : 'N/A'}
                        </div>
                        <div style="font-size:10px; color:#94a3b8; margin-top:4px;">
                            ${riskMetrics?.beta > 1.2 ? '積極型' : (riskMetrics?.beta < 0.8 ? '防禦型' : '中型/與大盤同步')}
                        </div>
                    </div>
                    <div style="flex:1; background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:10px; color:#cbd5e1; margin-bottom:4px;">年化波動率</div>
                        <div style="font-size:22px; font-weight:800; color:${riskMetrics?.volatility > 35 ? '#ef4444' : (riskMetrics?.volatility < 20 ? '#4ade80' : '#fff')}">
                            ${riskMetrics ? riskMetrics.volatility + '%' : 'N/A'}
                        </div>
                        <div style="font-size:10px; color:#94a3b8; margin-top:4px;">
                            ${riskMetrics?.volatility > 35 ? '波動劇烈' : (riskMetrics?.volatility < 20 ? '走勢平穩' : '中度波動')}
                        </div>
                    </div>
                </div>

                <!-- RSR 相對強弱度 -->
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; align-items:center; margin-bottom:8px;">
                        <span class="analysis-label has-info" onclick="showTermExplainer('相對強弱 (RSR)', '20日: ${riskMetrics?.rsr20 || 'N/A'}x / 60日: ${riskMetrics?.rsr60 || 'N/A'}x')" style="font-size:11px; color:#cbd5e1; font-weight:700; cursor:pointer;">📊 相對強弱 (RSR)</span>
                    </div>
                    <div style="display:flex; gap:16px; font-size:13px; font-weight:800;">
                        <span style="color:#94a3b8;">20日: <span style="color:${riskMetrics?.rsr20 >= 1 ? '#ef4444' : '#4ade80'};">${riskMetrics?.rsr20 ? (riskMetrics.rsr20 > 0 ? '+' : '') + riskMetrics.rsr20 + 'x' : 'N/A'}</span></span>
                        <span style="color:#94a3b8;">60日: <span style="color:${riskMetrics?.rsr60 >= 1 ? '#ef4444' : '#4ade80'};">${riskMetrics?.rsr60 ? (riskMetrics.rsr60 > 0 ? '+' : '') + riskMetrics.rsr60 + 'x' : 'N/A'}</span></span>
                    </div>
                </div>

                <div style="font-size:11px; color:#cbd5e1; margin:8px 0 6px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:8px;">📌 指標含義說明:</div>
                <div style="display:flex; flex-direction:column; gap:6px; font-size:10px; color:#94a3b8; line-height:1.4;">
                    <div>• <b>Beta (β)</b>: 反映個股對大盤變動的敏感度。β > 1 表示漲跌幅通常大於大盤；β < 1 則較小。</div>
                    <div>• <b>RSR</b>: 相對強弱指標。數值 > 1 代表表現優於大盤（吸金力強）；< 1 代表表現落後。</div>
                    <div>• <b>波動率</b>: 數值愈高，代表股價在短期內上下震盪的幅度愈大。</div>
                    <div>• <b>計算基準</b>: 基於過去一年 (${riskMetrics?.sampleSize || 252} 個交易日) 的日回報率。</div>
                </div>

                ${renderDiagnostic(
                    riskMetrics ? (
                        (riskMetrics.beta > 1.5 ? "標的具備極高攻擊性，大盤回溫時漲勢厲害，但下殺時風險亦大。" : 
                         (riskMetrics.beta < 0.5 ? "標的極具防禦性，幾乎不隨大盤起舞，適合避險持股。" : "標的風險偏好與大盤基本同步。")) +
                        (riskMetrics.volatility > 50 ? " 警告：目前波動率極高，屬於投機或劇烈震盪期。" : "")
                    ) : "數據不足，無法計算風險指標。"
                )}
            </div>

            <!-- 4. 月營收表現 -->
            <div class="analysis-card" style="${_naCardStyle(isETF)}">
                ${_naCardOverlay(isETF)}
                <div class="analysis-card-title">📊 ${revData?._isQuarterly ? '季度營收趨勢（月報缺失）' : '月營收趨勢'}</div>
                ${revData?._isQuarterly ? `<div style="font-size:10px; color:#f59e0b; margin-bottom:6px; padding:4px 8px; background:rgba(245,158,11,0.1); border-radius:6px; border:1px solid rgba(245,158,11,0.3);">⚠️ 金融控股/銀行/保險股依法無月營收申報，已改以季報損益表估算</div>` : ''}
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px;">${revData?._isQuarterly ? '季度' : '月份'}: ${revData?.month || 'N/A'}</div>
                ${renderStatRow(revData?._isQuarterly ? '單季營收' : '單月營收', revData?.revenue ? formatCurrency(revData.revenue) : 'N/A')}
                ${renderPercentRow(revData?._isQuarterly ? '季增率 (QoQ)' : '月增率 (MoM)', revData?.mom, true, true, `showRevenueTrendChart('${symbol}', 'MoM')`)}
                ${renderPercentRow('年增率 (YoY)', revData?.yoy, true, true, `showRevenueTrendChart('${symbol}', 'YoY')`)}
                ${renderPercentRow('累計年增率', revData?.cumYoy, true, true, `showRevenueTrendChart('${symbol}', 'CumYoY')`)}
                ${renderStatRow(revData?._isQuarterly ? '近 4 季累計' : '近 12 月累計', revData?.cum12m ? formatCurrency(revData.cum12m) : 'N/A')}
                ${renderPercentRow('營收年複合成長率 (CAGR)', finData?.revCAGR?.value)}
                ${finData?.revCAGR?.period ? `<div style="font-size:10px; color:#94a3b8; margin-top:-8px; margin-bottom:8px; text-align:right;">🕒 區間: ${finData.revCAGR.period}</div>` : ''}
                ${renderStatRow('年增次數 (近 12 月)', revData ? `${revData.yoyUpMonths} / ${revData.totalMonths}` : 'N/A')}
                ${renderDiagnostic(
                    (revData?.yoy > 15 ? "營收年增顯著成長，動能強勁。" : (revData?.yoy < -10 ? "營收年減幅度較大，需留意衰退訊號。" : "營收持平波動，處於產業平穩期。")) +
                    (revData?.yoyUpMonths >= 9 ? " 近一年中絕大多數月份皆成長，趨勢穩健。" : "")
                )}
            </div>

            <!-- 3. 獲利能力 -->
            <div class="analysis-card" style="${_naCardStyle(isETF)}">
                ${_naCardOverlay(isETF)}
                <div class="analysis-card-title">💵 財報獲利能力</div>
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px;">季度: ${finData?.quarter || 'N/A'}</div>
                ${renderPercentRow('毛利率', finData?.grossMargin, false, false)}
                ${renderPercentRow('毛利改善 (YoY)', finData?.grossImproveYoY)}
                ${renderPercentRow('營業費用率', finData?.opExRatio, false, false)}
                ${renderPercentRow('營業利益率', finData?.opMargin, false, false)}
                ${renderPercentRow('稅後淨利率', finData?.netMargin, false, false)}
                ${renderStatRow('業外損益佔比', finData?.nonOpRate !== undefined ? safeFix(finData.nonOpRate, 1) + '%' : 'N/A')}
                <div style="font-size:11px; color:#cbd5e1; margin-top:8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">🚩 專業排雷診斷</div>
                ${renderStatRow('應收帳款狀態', `<span style="color:${accrualDiagnosis.arStatus === '惡化' ? '#ef4444' : '#4ade80'};">${accrualDiagnosis.arStatus}</span>`)}
                ${renderStatRow('存貨管理狀態', `<span style="color:${accrualDiagnosis.invStatus === '惡化' ? '#ef4444' : '#4ade80'};">${accrualDiagnosis.invStatus}</span>`)}
                <!-- 整合後的三率視覺化趨勢 -->
                <div style="font-size:11px; color:#cbd5e1; margin:15px 0 2px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:10px;">📈 獲利三率趨勢 (近四季)</div>
                <div style="font-size:9px; color:#94a3b8; margin-bottom:10px; opacity:0.8;">近 4 季毛利率、營業利益率、稅後淨利率</div>
                ${(() => {
                    const marginTrend = finData?.marginTrend || [];
                    if (marginTrend.length === 0) return '<div style="color:#94a3b8; font-size:11px; text-align:center; padding:10px;">無趨勢數據</div>';
                    return `
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:10px;">
                            ${[...marginTrend].reverse().map(m => {
                                const maxVal = Math.max(...marginTrend.map(x => Math.max(x.grossMargin || 0, x.operatingMargin || 0, x.netMargin || 0))) || 1;
                                return `
                                <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.03); display:flex; flex-direction:column; justify-content:space-between;">
                                    <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                                        <span style="color:#94a3b8;">${m.date || 'N/A'}</span>
                                        <span style="color:#fbbf24; font-weight:800;">ROE: ${m.roe ? safeFix(m.roe, 2)+'%' : 'N/A'}</span>
                                    </div>
                                    <div style="display:flex; flex-direction:column; gap:3px; margin:4px 0;">
                                        <div style="width:${Math.max(0, Math.min(100, ((m.grossMargin || 0) / maxVal * 100)))}%; background:#ef4444; height:4px; border-radius:2px;"></div>
                                        <div style="width:${Math.max(0, Math.min(100, ((m.operatingMargin || 0) / maxVal * 100)))}%; background:#3b82f6; height:4px; border-radius:2px;"></div>
                                        <div style="width:${Math.max(0, Math.min(100, ((m.netMargin || 0) / maxVal * 100)))}%; background:#f8fafc; height:4px; border-radius:2px; opacity:0.8;"></div>
                                    </div>
                                    <div style="display:flex; justify-content:space-between; font-size:8px; margin-top:2px;">
                                        <span style="color:#ef4444;">毛:${safeFix(m.grossMargin, 1)}%</span>
                                        <span style="color:#3b82f6;">營:${safeFix(m.operatingMargin, 1)}%</span>
                                        <span style="color:#f8fafc;">淨:${safeFix(m.netMargin, 1)}%</span>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    `;
                })()}

                <!-- 毛利率動能 -->
                <div style="margin-bottom:15px; padding:8px 12px; background:rgba(59, 130, 246, 0.05); border-radius:8px; border:1px dashed rgba(59, 130, 246, 0.2); display:flex; justify-content:space-between; align-items:center;">
                    <span class="analysis-label has-info" onclick="showTermExplainer('毛利率連續改善季數', '${finData?.marginMomentumCount || 0}')" style="font-size:11px; color:#cbd5e1; font-weight:700;">📈 毛利率連續改善季數</span>
                    <span style="font-size:14px; font-weight:800; color:${(finData?.marginMomentumCount || 0) >= 2 ? '#4ade80' : '#ffffff'};">
                        ${finData?.marginMomentumCount || 0} 季 ${(finData?.marginMomentumCount || 0) >= 2 ? '🔥' : ''}
                    </span>
                </div>
                ${renderStatRow('單季 EPS 📈', (finData?.eps ? finData.eps + ' 元' : 'N/A'), null, finData?.symbol ? `showEPSTrendChart('${finData.symbol}')` : null)}
                ${renderPercentRow('ROE (股東權益報酬)', finData?.roe, true, false)}
                ${renderPercentRow('ROIC (投入資本回報)', finData?.roic, true, false)}
                ${renderPercentRow('ROA (資產報酬率)', finData?.roa, true, false)}
                ${renderDiagnostic(
                    (finData?.grossImproveYoY > 0 ? "毛利率較去年同期改善，產品力轉強。" : (finData?.grossMargin < 10 ? "毛利率偏低，代工屬性強，獲利易受成本波動影響。" : "獲利能力穩定，三率維持常態水準。")) +
                    (finData?.roe > 4 ? " ROE 表現優異，資本運用效率高。" : "")
                )}
            </div>

            <!-- 9. 企業體質與獲利診斷 (F-Score + DuPont) -->
            <div class="analysis-card" style="${_naCardStyle(isETF)}">
                ${_naCardOverlay(isETF)}
                <div class="analysis-card-title">💎 基本面體質與獲利結構診斷</div>
                
                <!-- 🏆 Piotroski F-Score (上層) -->
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px;">1. 財務健全度 (Piotroski F-Score)</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:rgba(234, 179, 8, 0.1); padding:10px; border-radius:8px; border:1px solid rgba(234, 179, 8, 0.2);">
                    <span style="font-size:12px; color:#cbd5e1;">總分 (0-9)</span>
                    <span style="font-size:20px; font-weight:800; color:#eab308;">${finData?.fScore || 0} / 9</span>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:10px; margin-bottom:15px;">
                    ${(finData?.fDetails || []).map((f, idx, arr) => {
                        const isLast = idx === arr.length - 1;
                        return `
                        <div style="color: ${f.ok ? '#4ade80' : '#94a3b8'}; ${isLast ? 'grid-column: span 2; white-space: nowrap;' : ''}">
                            ${f.ok ? '✅' : '⚪'} ${f.msg}
                        </div>
                        `;
                    }).join('')}
                </div>

                <!-- 🔍 杜邦分析 (下層) -->
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
                    <span>2. ROE 獲利結構拆解 (杜邦分析)</span>
                    <span style="font-size:9px; opacity:0.8;">ROE = 淨利率 × 資產週轉 × 權益乘數</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px; background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    <div class="comparison-row" style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="has-info" style="font-size:12px; color:#cbd5e1;" onclick="showTermExplainer('淨利率 (獲利)', '${finData?.netMargin !== undefined ? safeFix(finData.netMargin, 2) + '%' : 'N/A'}')">1. 淨利率 (獲利)</span>
                        <span style="font-size:12px; font-weight:700; color:#ffffff;">${finData?.netMargin !== undefined ? safeFix(finData.netMargin, 2) + '%' : 'N/A'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="has-info" style="font-size:12px; color:#cbd5e1;" onclick="showTermExplainer('資產週轉 (效率)', '${finData?.assetTurnover !== undefined ? safeFix(finData.assetTurnover, 2) + ' 次' : 'N/A'}')">2. 資產週轉 (效率)</span>
                        <span style="font-size:12px; font-weight:700; color:#ffffff;">${finData?.assetTurnover !== undefined ? safeFix(finData.assetTurnover, 2) + ' 次' : 'N/A'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="has-info" style="font-size:12px; color:#cbd5e1;" onclick="showTermExplainer('權益乘數 (槓桿)', '${finData?.equityMultiplier !== undefined ? safeFix(finData.equityMultiplier, 2) + ' 倍' : 'N/A'}')">3. 權益乘數 (槓桿)</span>
                        <span style="font-size:12px; font-weight:700; color:#ffffff;">${finData?.equityMultiplier !== undefined ? safeFix(finData.equityMultiplier, 2) + ' 倍' : 'N/A'}</span>
                    </div>
                    <div style="height:1px; background:rgba(255,255,255,0.1); margin:4px 0;"></div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px; font-weight:800; color:#ffffff;">最終 ROE</span>
                        <span style="font-size:15px; font-weight:800; color:#ffffff;">${finData?.roe !== undefined ? safeFix(finData.roe, 2) + '%' : 'N/A'}</span>
                    </div>
                </div>

                ${(() => {
                    // --- 新增：杜邦趨勢診斷 ---
                    let dupontDiag = "";
                    let marginDiff = 0, turnoverDiff = 0, multiplierDiff = 0;
                    const trend = finData?.marginTrend;
                    if (trend && trend.length >= 2) {
                        const cur = trend[trend.length - 1];
                        const prev = trend[trend.length - 2];
                        
                        const roeDiff = cur.roe - prev.roe;
                        marginDiff = cur.netMargin - prev.netMargin;
                        turnoverDiff = cur.assetTurnover - prev.assetTurnover;
                        multiplierDiff = cur.equityMultiplier - prev.equityMultiplier;

                        if (roeDiff > 0.5) { // ROE 顯著成長
                            if (multiplierDiff > 0.1 && marginDiff <= 0 && turnoverDiff <= 0) {
                                dupontDiag = "⚠️ <b>警告：</b>ROE 成長來自於槓桿加大，而非經營效率提升。";
                            } else if (marginDiff > 0.5) {
                                dupontDiag = "🚀 <b>良性成長：</b>ROE 提升主要由「淨利率」改善驅動，顯示產品競爭力或成本控制能力增強。";
                            } else if (turnoverDiff > 0.02) {
                                dupontDiag = "🔥 <b>營運優化：</b>ROE 提升來自「資產週轉率」增加，顯示公司資產運用效率正大幅提升。";
                            } else {
                                dupontDiag = "📊 <b>ROE 成長：</b>獲利能力正在改善。";
                            }
                        } else if (roeDiff < -0.5) { // ROE 顯著下滑
                            if (turnoverDiff > 0.02) {
                                dupontDiag = "💡 <b>轉機訊號：</b>雖然獲利暫時下滑，但公司資產運用效率正在優化，具備轉機潛力。";
                            } else if (multiplierDiff < -0.1) {
                                dupontDiag = "🛡️ <b>財務穩健：</b>ROE 下滑主因是公司主動「降低槓桿」(乘數下降)，財務體質趨於穩健。";
                            } else {
                                dupontDiag = "📉 <b>ROE 下滑：</b>需留意獲利結構是否轉弱。";
                            }
                        } else {
                            dupontDiag = "📊 <b>獲利結構穩定：</b>本季 ROE 與上季相比無顯著變動。";
                        }
                    }

                    return `
                        <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.1);">
                            <div style="font-size:11px; color:#60a5fa; margin-bottom:10px; font-weight:700;">📈 杜邦因子季度消長拆解 (Delta Analysis)</div>
                            
                            <!-- 杜邦因子變動數值展示 -->
                            <div style="display:flex; justify-content:space-between; margin-bottom:15px; background:rgba(255,255,255,0.02); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05);">
                                <div style="flex:1; text-align:center;">
                                    <div style="font-size:9px; color:#94a3b8; margin-bottom:4px;">淨利率變動</div>
                                    <div style="font-size:13px; font-weight:800; color:${marginDiff >= 0 ? '#4ade80' : '#f87171'};">
                                        ${marginDiff >= 0 ? '↑' : '↓'} ${Math.abs(marginDiff).toFixed(2)}%
                                    </div>
                                </div>
                                <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                                <div style="flex:1; text-align:center;">
                                    <div style="font-size:9px; color:#94a3b8; margin-bottom:4px;">週轉率變動</div>
                                    <div style="font-size:13px; font-weight:800; color:${turnoverDiff >= 0 ? '#4ade80' : '#f87171'};">
                                        ${turnoverDiff >= 0 ? '↑' : '↓'} ${Math.abs(turnoverDiff).toFixed(2)}
                                    </div>
                                </div>
                                <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                                <div style="flex:1; text-align:center;">
                                    <div style="font-size:9px; color:#94a3b8; margin-bottom:4px;">槓桿乘數變動</div>
                                    <div style="font-size:13px; font-weight:800; color:${multiplierDiff >= 0 ? '#f97316' : '#3b82f6'};">
                                        ${multiplierDiff >= 0 ? '↑' : '↓'} ${Math.abs(multiplierDiff).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                            
                            <div style="font-size:11.5px; color:#cbd5e1; line-height:1.6;">
                                ${dupontDiag ? `<div style="margin-bottom:12px; background:rgba(59, 130, 246, 0.05); padding:10px; border-radius:8px; border-left:4px solid #3b82f6; color:#e2e8f0;">${dupontDiag}</div>` : ''}
                                ${renderDiagnostic(
                                    (finData?.fScore >= 7 ? "🏆 F-Score 優異，財務體質極佳。" : (finData?.fScore <= 3 ? "⚠️ F-Score 偏低，需留意財務惡化。" : "財務健全度尚可。")) +
                                    (finData?.netMargin > 20 ? " 高淨利率驅動 ROE，顯示產業地位高。" : (finData?.assetTurnover > 1 ? " 高週轉率驅動 ROE，薄利多銷經營。" : " 綜合獲利驅動模式。"))
                                )}
                            </div>
                        </div>
                    `;
                })()}
            </div>

            <!-- 6. 財務安全與 Z-Score -->
            <div class="analysis-card" style="${_naCardStyle(isETF)}">
                ${_naCardOverlay(isETF)}
                <div class="analysis-card-title">🛡️ 財務安全診斷</div>
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="analysis-label has-info" style="font-size:12px; color:#cbd5e1;" onclick="showTermExplainer('Altman Z-Score', '${zScore !== undefined ? safeFix(zScore, 2) : 'N/A'}')">Altman Z-Score</span>
                        <span style="font-size:18px; font-weight:800; color:${zColor};">${zScore !== undefined ? safeFix(zScore, 2) : 'N/A'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <span style="font-size:10px; color:#94a3b8;">風險等級</span>
                        <span style="font-size:11px; font-weight:700; color:${zColor};">${zRiskLevel}</span>
                    </div>
                </div>
                <!-- 斯隆比例 (Sloan Ratio) 盈餘品質診斷 -->
                ${(() => {
                    const sr = finData?.sloanRatio;
                    let srColor = '#94a3b8', srLabel = 'N/A';
                    if (sr !== null && sr !== undefined) {
                        if (sr > 10)       { srColor = '#ef4444'; srLabel = '⚠️ 高度警示'; }
                        else if (sr > 2)   { srColor = '#fbbf24'; srLabel = '留意'; }
                        else if (sr >= -2) { srColor = '#10b981'; srLabel = '正常'; }
                        else               { srColor = '#06b6d4'; srLabel = '優質現金盈餘'; }
                    }
                    return `
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="analysis-label has-info" style="font-size:12px; color:#cbd5e1;" onclick="showTermExplainer('斯隆比例 (Sloan Ratio)', '${sr !== null && sr !== undefined ? safeFix(sr, 2) : 'N/A'}')">斯隆比例 (Sloan Ratio)</span>
                        <span style="font-size:18px; font-weight:800; color:${srColor};">${sr !== null && sr !== undefined ? safeFix(sr, 2) + '%' : 'N/A'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <span style="font-size:10px; color:#94a3b8;">盈餘品質</span>
                        <span style="font-size:11px; font-weight:700; color:${srColor};">${srLabel}</span>
                    </div>
                </div>`;
                })()}
                <!-- Beneish M-Score 舞弊診斷 -->
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="analysis-label has-info" style="font-size:12px; color:#cbd5e1;" onclick="showTermExplainer('Beneish M-Score', '${finData?.mScore !== undefined ? safeFix(finData.mScore, 2) : 'N/A'}')">Beneish M-Score</span>
                        <span style="font-size:18px; font-weight:800; color:${mColor};">${finData?.mScore !== undefined ? safeFix(finData.mScore, 2) : 'N/A'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <span style="font-size:10px; color:#94a3b8;">舞弊診斷</span>
                        <span style="font-size:11px; font-weight:700; color:${mColor};">${mStatus}</span>
                    </div>
                </div>
                ${renderStatRow('流動比率', finData?.currentRatio !== undefined ? safeFix(finData?.currentRatio, 1) + '%' : 'N/A')}
                ${renderStatRow('速動比率', finData?.quickRatio !== undefined ? safeFix(finData?.quickRatio, 1) + '%' : 'N/A')}
                ${renderPercentRow('負債比率', finData?.debtRatio, false, false)}
                ${renderStatRow('淨負債比率', finData?.netDebtRatio !== undefined ? safeFix(finData?.netDebtRatio, 1) + '%' : 'N/A')}
                ${(() => {
                    const nd = finData?.netDebtEBITDA;
                    let ndColor = '#94a3b8', ndLabel = 'N/A';
                    if (nd !== null && nd !== undefined) {
                        if (nd < 0)      { ndColor = '#06b6d4'; ndLabel = '淨現金'; }
                        else if (nd < 2) { ndColor = '#10b981'; ndLabel = '健康'; }
                        else if (nd < 3) { ndColor = '#fbbf24'; ndLabel = '留意'; }
                        else if (nd < 4) { ndColor = '#f97316'; ndLabel = '偏高'; }
                        else             { ndColor = '#ef4444'; ndLabel = '⚠️ 危險'; }
                    }
                    const displayVal = nd !== null && nd !== undefined ? safeFix(nd, 1) + ' 倍' : 'N/A';
                    return renderStatRow('淨負債/EBITDA', displayVal, null, `showTermExplainer('淨負債/EBITDA', '${displayVal}')`);
                })()}
                ${renderStatRow('利息保障倍數', finData?.interestCoverage !== undefined ? (finData?.interestCoverage >= 999 ? '無負債/極高' : safeFix(finData?.interestCoverage, 1) + ' 倍') : 'N/A')}
                ${renderStatRow('獲利品質 (OCF/NI)', finData?.earningsQuality !== undefined ? safeFix(finData?.earningsQuality, 1) + '%' : 'N/A')}
                
                <div style="font-size:11px; color:#cbd5e1; margin:10px 0 6px; border-bottom:1px dashed rgba(255,255,255,0.05); padding-bottom:6px;">🚩 股東風險與長期資金</div>
                ${renderStatRow('董監持股質押比例', (chipsData?.pledgeRatio !== undefined) ? safeFix(chipsData.pledgeRatio, 1) + '%' : 'N/A', chipsData?.pledgeRatio)}
                ${renderStatRow('5年累計自由現金流', (finData?.totalFCF5Y !== undefined) ? formatCurrency(finData.totalFCF5Y) : 'N/A')}
                ${(() => {
                    const cont = finData?.fcfContinuity;
                    if (!cont) return renderStatRow('FCF 連貫性 (5年)', 'N/A');
                    const text = `${cont.positiveCount} / ${cont.totalYears} 年正向` + (cont.continuousPositiveYears >= 5 ? ` (連 ${cont.continuousPositiveYears} 年 🔥)` : "");
                    return renderStatRow('FCF 連貫性 (5年)', text);
                })()}

                <div style="font-size:11px; color:#cbd5e1; margin:10px 0 6px; border-bottom:1px dashed rgba(255,255,255,0.05); padding-bottom:6px;">💸 現金流量 (近四季 TTM)</div>
                ${renderStatRow('近四季營業現金流 (OCF)', (finData?.opCashFlow !== undefined) ? formatCurrency(finData.opCashFlow) : 'N/A')}
                ${renderStatRow('近四季投資現金流 (ICF)', (finData?.investingCashFlow !== undefined) ? formatCurrency(finData.investingCashFlow) : 'N/A')}
                ${renderStatRow('近四季自由現金流 (FCF)', (finData?.freeCashFlow !== undefined) ? formatCurrency(finData.freeCashFlow) : 'N/A')}
                ${renderStatRow('淨負債 (總負債-現金)', finData?.netDebt ? formatCurrency(finData.netDebt) : 'N/A')}
                ${renderDiagnostic(
                    (zScore > 2.99 ? "財務體質極佳，短期無倒閉風險。" : (zScore < 1.8 ? "財務壓力較大，需警惕債務違約風險。" : "財務結構尚可，屬正常範圍。")) +
                    (finData?.earningsQuality > 100 ? " 獲利品質佳，現金回收能力強。" : "") +
                    (chipsData?.pledgeRatio > 30 ? " ⚠️ 警告：董監質押比例過高 (>30%)，大跌時恐有連鎖賣壓風險。" : "") +
                    (marginData?.marginMaintenance && marginData.marginMaintenance < 140 ? ` ⚠️ 警告：融資維持率過低 (${safeFix(marginData.marginMaintenance, 1)}%)，需防範斷頭追繳引發的連鎖賣壓。` : "") +
                    (finData?.totalFCF5Y < 0 ? " ⚠️ 嚴重警告：近 5 年累計自由現金流為負值，公司長期處於「舉債燒錢」狀態，獲利恐為虛胖，投資風險極高。" : "") +
                    (finData?.fcfContinuity?.continuousPositiveYears >= 7 ? " 具備卓越的長期現金產生能力。" : "")
                )}
            </div>


            
            <!-- 10. 現金流量趨勢 (FCF Analysis) -->
            <div class="analysis-card" style="${_naCardStyle(isETF)}">
                ${_naCardOverlay(isETF)}
                <div class="analysis-card-title">💰 現金產生能力分析 (Cash Flow Analysis)</div>
                <div style="font-size:13px; font-weight:700; color:#60a5fa; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
                    <span>🌊 自由現金流 (FCF) 8季趨勢</span>
                </div>
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:12px;">
                    單位: 億元 (
                    <span class="has-info" style="text-decoration:underline dashed; cursor:pointer;" onclick="showTermExplainer('營業現金流 (OCF)', '本業獲取之現金')">OCF</span> - 
                    <span class="has-info" style="text-decoration:underline dashed; cursor:pointer;" onclick="showTermExplainer('CapEx (資本支出)', '投資廠房設備之支出')">CapEx</span> = 
                    <span class="has-info" style="text-decoration:underline dashed; cursor:pointer;" onclick="showTermExplainer('FCF (自由現金流)', '剩餘可支配現金')">FCF</span>)
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:15px;">
                    ${[...(finData?.fcfTrend || [])].reverse().map(d => {
                        const ocfB = d.ocf / 100000000;
                        const capB = Math.abs(d.capex / 100000000);
                        const fcfB = d.fcf / 100000000;
                        const maxVal = Math.max(...finData.fcfTrend.map(x => Math.max(Math.abs(x.ocf/100000000), Math.abs(x.capex/100000000)))) || 1;
                        
                        return `
                        <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.03); display:flex; flex-direction:column; justify-content:space-between; min-height:85px;">
                            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                                <span style="color:#94a3b8;">${d.date}</span>
                                <span style="color:${fcfB >= 0 ? '#4ade80' : '#f87171'}; font-weight:800;">${fcfB.toFixed(1)}</span>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:3px; margin:4px 0;">
                                <div style="width:${Math.max(0, Math.min(100, (ocfB / maxVal * 100)))}%; background:#3b82f6; height:4px; border-radius:2px;"></div>
                                <div style="width:${Math.max(0, Math.min(100, (capB / maxVal * 100)))}%; background:#ef4444; height:4px; border-radius:2px; opacity:0.6;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:9.5px; margin-top:2px;">
                                <span style="color:#3b82f6;">OCF: ${safeFix(ocfB, 2)}</span>
                                <span style="color:#ef4444;">CPX: ${safeFix(capB, 2)}</span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <!-- 新增：FCF 殖利率趨勢 (近 4 季) -->
                <div style="font-size:11px; color:#cbd5e1; margin:15px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:10px; display:flex; justify-content:space-between; align-items:flex-start;">
                    <span class="has-info" style="cursor:pointer; text-decoration:underline dashed;" onclick="showTermExplainer('FCF_YIELD_TREND_ANALYSIS', '${(() => {
                        const trend = [...(finData?.fcfTrend || [])].slice(-4);
                        if (trend.length < 2) return 'N/A';
                        const startY = (trend[0].fcf / 100000000) / marketCap * 100;
                        const endY = (trend[trend.length-1].fcf / 100000000) / marketCap * 100;
                        const icon = endY > startY ? '📈 趨勢向上' : (endY < startY ? '📉 趨勢向下' : '趨勢持平');
                        return `${safeFix(startY, 2)}% -> ${safeFix(endY, 2)}% (${icon})`;
                    })()}')">📈 FCF 殖利率趨勢 (近 4 季)</span>
                    <div style="text-align:right;">
                        <div style="font-size:9px; color:#94a3b8;">(單季 FCF / 目前市值)</div>
                        <div style="font-size:9px; color:#64748b; line-height:1.2; margin-top:2px;">註：分母統一使用「目前市值」計算，以排除股價干擾。</div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:12px;">
                    ${(() => {
                        const trend = [...(finData?.fcfTrend || [])].slice(-4);
                        if (!trend || trend.length === 0 || !marketCap) return '<div style="grid-column: span 4; text-align:center; color:#64748b; font-size:11px;">數據不足</div>';
                        
                        return trend.map((d, i) => {
                            const yieldVal = (d.fcf / 100000000) / marketCap * 100;
                            let arrow = '';
                            let arrowColor = '#94a3b8';
                            if (i > 0) {
                                const prevYield = (trend[i-1].fcf / 100000000) / marketCap * 100;
                                if (yieldVal > prevYield) { arrow = '↑'; arrowColor = '#4ade80'; }
                                else if (yieldVal < prevYield) { arrow = '↓'; arrowColor = '#f87171'; }
                            }
                            // 修正日期格式：將 2024-12-31 轉換為 2024 Q4
                            const dateParts = d.date.split('-');
                            const year = dateParts[0];
                            const month = parseInt(dateParts[1]);
                            const quarter = Math.ceil(month / 3);
                            const qLabel = `${year} Q${quarter}`;

                            return `
                                <div style="background:rgba(255,255,255,0.03); padding:6px 4px; border-radius:6px; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                                    <div style="font-size:9px; color:#94a3b8; margin-bottom:2px;">${qLabel}</div>
                                    <div style="font-size:12px; font-weight:800; color:#ffffff;">${safeFix(yieldVal, 2)}%</div>
                                    ${arrow ? `<div style="font-size:9px; color:${arrowColor}; font-weight:bold;">${arrow}</div>` : '<div style="height:11px;"></div>'}
                                </div>
                            `;
                        }).join('');
                    })()}
                </div>

                ${renderDiagnostic(
                    (() => {
                        if (!finData?.fcfTrend || finData.fcfTrend.length === 0) return "數據不足。";
                        const trend = [...finData.fcfTrend].slice(-4);
                        const yieldLatest = (trend[trend.length-1].fcf / 100000000) / marketCap * 100;
                        const yieldFirst = (trend[0].fcf / 100000000) / marketCap * 100;
                        
                        let yieldText = "";
                        if (yieldLatest > yieldFirst) yieldText = "🔥 FCF 殖利率呈上升趨勢，顯示公司創現能力增強。";
                        else if (yieldLatest < yieldFirst) yieldText = "⚠️ FCF 殖利率趨勢下滑，需留意現金回收效率。";
                        
                        const positiveFcfCount = finData.fcfTrend.filter(x => x.fcf > 0).length;
                        let diag = "";
                        if (positiveFcfCount === 8) {
                            diag = "🏆 極其優異：近 8 季「全數」維持正向現金流，展現強勁的現金產生能力。 ";
                        } else if (positiveFcfCount >= 6) {
                            diag = "✅ 表現優異：近 8 季幾乎全數維持正向現金流。 ";
                        } else {
                            diag = "現金流狀況尚可。 ";
                        }
                        return yieldText + diag;
                    })()
                )}
            </div>

            <!-- 11. 獲利品質分析 (Cash Flow Fidelity) -->
            <div class="analysis-card" style="${_naCardStyle(isETF)}">
                ${_naCardOverlay(isETF)}
                <div class="analysis-card-title">💎 現金流健康度 (Cash Flow Fidelity)</div>
                
                <!-- 累積 8 季含金量 -->
                <div style="background:linear-gradient(145deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05)); padding:12px; border-radius:12px; margin-bottom:15px; border:1px solid rgba(59, 130, 246, 0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:11px; color:#cbd5e1;" class="has-info" onclick="showTermExplainer('累積 8 季總含金量', '${safeFix(finData?.cashFlowFidelity?.totalRatio, 1)}%')">累積 8 季總含金量</span>
                        <span style="font-size:11px; padding:2px 8px; border-radius:10px; background:${finData?.cashFlowFidelity?.score === '卓越' ? '#4ade80' : (finData?.cashFlowFidelity?.score === '穩健' ? '#3b82f6' : '#ef4444')}; color:#ffffff; font-weight:800;">
                            ${finData?.cashFlowFidelity?.score || 'N/A'}
                        </span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                        <span style="font-size:24px; font-weight:800; color:#ffffff;">${safeFix(finData?.cashFlowFidelity?.totalRatio, 1)}%</span>
                        <span style="font-size:11px; color:#cbd5e1;">OCF > 淨利次數: ${finData?.cashFlowFidelity?.stableCount || 0} / 8</span>
                    </div>
                </div>

                <div style="font-size:11px; color:#cbd5e1; margin-bottom:12px;">
                    單位: 億元 (
                    藍: <span class="has-info" style="text-decoration:underline dashed; cursor:pointer;" onclick="showTermExplainer('營業現金流 (OCF)', '${safeFix(finData?.latestOCF/100000000, 1)}億', null, true)">OCF</span> / 
                    紅: <span class="has-info" style="text-decoration:underline dashed; cursor:pointer;" onclick="showTermExplainer('稅後淨利', '${safeFix((finData?.netIncomeTrend?.[finData.netIncomeTrend.length-1]?.ni || 0)/100000000, 1)}億', null, true)">淨利</span>)
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                    ${[...(finData?.netIncomeTrend || [])].reverse().map((d, idx) => {
                        const niB = d.ni / 100000000;
                        const ocfObj = finData.fcfTrend.find(x => x.date === d.date);
                        const ocfB = (ocfObj ? ocfObj.ocf : 0) / 100000000;
                        
                        const maxVal = Math.max(...finData.netIncomeTrend.map(x => Math.abs(x.ni/100000000)), ...finData.fcfTrend.map(x => Math.abs(x.ocf/100000000))) || 1;
                        const ratio = niB !== 0 ? (ocfB / niB * 100) : 0;
                        
                        return `
                        <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.03); display:flex; flex-direction:column; justify-content:space-between; min-height:80px;">
                            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                                <div style="display:flex; align-items:center; gap:3px;">
                                    <span style="color:#94a3b8;">${d.date}</span>
                                    ${ocfB > niB ? '<span style="font-size:9px; background:#4ade80; color:#064e3b; padding:0 3px; border-radius:3px; font-weight:800;">C+</span>' : ''}
                                </div>
                                <span style="color:${ratio >= 100 ? '#4ade80' : (ratio < 50 ? '#f87171' : '#fbbf24')}; font-weight:700;">
                                    ${ratio.toFixed(0)}%
                                </span>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:3px; margin:4px 0;">
                                <div style="width:${Math.max(0, Math.min(100, (ocfB / maxVal * 100)))}%; background:#3b82f6; height:4px; border-radius:2px;"></div>
                                <div style="width:${Math.max(0, Math.min(100, (niB / maxVal * 100)))}%; background:#ef4444; height:4px; border-radius:2px; opacity:0.7;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:9.5px; margin-top:2px;">
                                <span style="color:#3b82f6;">OCF: ${safeFix(ocfB, 2)}</span>
                                <span style="color:#ef4444;">淨利: ${safeFix(niB, 2)}</span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                ${renderDiagnostic(
                    (() => {
                        if (!finData?.cashFlowFidelity) return "";
                        const { totalRatio, stableCount, score } = finData.cashFlowFidelity;
                        let text = `長期 (8季) 獲利含金量為 ${safeFix(totalRatio, 1)}%。`;
                        if (score === '卓越') text += " 🔥 現金流極其充沛，獲利完全由現金流支撐，品質極佳。";
                        else if (score === '穩健') text += " 現金回收穩定，多數季度能將淨利轉換為現金。";
                        else text += " ⚠️ 警訊：營業現金流長期低於帳面淨利，需嚴防應收帳款過高或虛擬獲利風險。";
                        
                        if (stableCount < 4) text += " 獲利與現金流呈現脫鉤狀態，需留意財報透明度。";
                        return text;
                    })()
                )}
            </div>

            <!-- 12. 營運效率指標 -->
            <div class="analysis-card" style="${_naCardStyle(isETF)}">
                ${_naCardOverlay(isETF)}
                <div class="analysis-card-title">⚙️ 營運效率與獲利品質</div>
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:10px;">營運天數與現金循環 (CCC)</div>
                ${renderStatRow('存貨週轉天數 (DIO)', finData?.inventoryDays !== undefined ? safeFix(finData.inventoryDays, 1) + ' 天' : 'N/A')}
                ${renderStatRow('應收帳款天數 (DSO)', finData?.receivableDays !== undefined ? safeFix(finData.receivableDays, 1) + ' 天' : 'N/A')}
                ${renderStatRow('應付帳款天數 (DPO)', finData?.payableDays !== undefined ? safeFix(finData.payableDays, 1) + ' 天' : 'N/A')}
                ${renderStatRow('現金週期 (CCC) 📈', finData?.ccc !== undefined ? safeFix(finData.ccc, 1) + ' 天' : 'N/A', null, 'showCCCTrendChart()')}
                <div style="font-size:9px; color:#64748b; margin-top:4px; margin-left:2px;">* 以上指標均以「單季 (90天)」為計算基準</div>



                <!-- 強化：存貨與應收帳款天數 8 季趨勢 (SVG 折線圖) -->
                ${isFinancialSec ? `<div style="position:relative; overflow:hidden; border-radius:10px;">
                  <div style="position:absolute;inset:0;background:rgba(0,0,0,0.28);pointer-events:none;z-index:9;border-radius:inherit;"></div>
                  <svg style="position:absolute;inset:0;width:100%;height:100%;z-index:10;pointer-events:none;overflow:visible;" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="1%" y1="1%" x2="99%" y2="99%" stroke="#ef4444" stroke-width="2" opacity="0.72" stroke-linecap="round"/>
                    <line x1="99%" y1="1%" x2="1%" y2="99%" stroke="#ef4444" stroke-width="2" opacity="0.72" stroke-linecap="round"/>
                  </svg>` : ''}
                <div style="font-size:11px; color:${isFinancialSec ? '#6b7280' : '#cbd5e1'}; margin:15px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:8px; display:flex; justify-content:space-between; align-items:center; ${isFinancialSec ? 'opacity:0.52;' : ''}">
                    <span>📅 營運天數 (Q) 8 季趨勢 (<span class="has-info" onclick="showTermExplainer('DIO (存貨週轉天數)', '${Math.round(finData?.inventoryDays || 0)}天')">DIO</span> / <span class="has-info" onclick="showTermExplainer('DSO (應收帳款天數)', '${Math.round(finData?.receivableDays || 0)}天')">DSO</span>)</span>
                    <span style="font-size:9px; color:#94a3b8;">藍: DIO / 灰: DSO</span>
                </div>
                
                <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05); position:relative; height:110px; margin-bottom:12px;">
                    ${(() => {
                        const trend = finData?.dioDsoTrend || [];
                        if (trend.length < 2) return '<div style="color:#94a3b8; font-size:11px; text-align:center; padding-top:35px;">趨勢數據不足</div>';
                        
                        const maxVal = Math.max(...trend.map(t => Math.max(t.dio, t.dso)), 100) * 1.25;
                        const width = 280;
                        const height = 65;
                        const points_dio = trend.map((t, i) => `${(i / (trend.length - 1)) * width},${height - (t.dio / maxVal) * height}`).join(' ');
                        const points_dso = trend.map((t, i) => `${(i / (trend.length - 1)) * width},${height - (t.dso / maxVal) * height}`).join(' ');
                        
                        return `
                            <svg viewBox="0 -15 ${width} ${height + 30}" style="width:100%; height:100%; overflow:visible;">
                                <!-- Grid Lines -->
                                <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                                
                                <!-- DSO Line (Gray) -->
                                <polyline points="${points_dso}" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="2,2" />
                                
                                <!-- DIO Line (Blue) -->
                                <polyline points="${points_dio}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" />
                                
                                <!-- Data Points & Labels -->
                                ${trend.map((t, i) => {
                                    const x = (i / (trend.length - 1)) * width;
                                    const y_dio = height - (t.dio / maxVal) * height;
                                    const y_dso = height - (t.dso / maxVal) * height;
                                    
                                    // 修正日期解析
                                    const dateStr = String(t.date);
                                    const dateLabel = dateStr.includes('Q') ? dateStr.split('Q')[1] + 'Q' : dateStr.slice(-5);
                                    
                                    return `
                                        <!-- DSO Point -->
                                        <circle cx="${x}" cy="${y_dso}" r="2" fill="#cbd5e1" opacity="0.5"></circle>
                                        
                                        <!-- DIO Point -->
                                        <circle cx="${x}" cy="${y_dio}" r="4" fill="#3b82f6"></circle>
                                        
                                        <!-- 數值標註 (DIO - 上方) -->
                                        <text x="${x}" y="${y_dio - 8}" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle">${Math.round(t.dio)}天</text>
                                        
                                        <!-- 數值標註 (DSO - 下方) -->
                                        <text x="${x}" y="${y_dso + 14}" font-size="13" fill="#ffffff" text-anchor="middle">${Math.round(t.dso)}天</text>
                                        
                                        <!-- 日期標籤 (分兩行顯示：年份/季度) -->
                                        ${(() => {
                                            const dateStr = String(t.date);
                                            const year = dateStr.slice(0, 4);
                                            const q = dateStr.includes('Q') ? dateStr.split('Q')[1] + 'Q' : dateStr.slice(-5);
                                            return `
                                                <text x="${x}" y="${height + 22}" font-size="9" fill="#cbd5e1" text-anchor="middle">${year}</text>
                                                <text x="${x}" y="${height + 32}" font-size="9" font-weight="600" fill="#cbd5e1" text-anchor="middle">${q}</text>
                                            `;
                                        })()}
                                    `;
                                }).join('')}
                            </svg>
                        `;
                    })()}
                </div>
                ${isFinancialSec ? '</div>' : ''}

                <!-- 營收 vs 存貨成長背離分析 -->
                <div style="font-size:11px; color:#cbd5e1; margin:5px 0 8px; display:flex; justify-content:space-between; align-items:center;">
                    <span class="has-info" onclick="showTermExplainer('營收 vs 存貨成長趨勢 (YoY)', '${safeFix(finData?.revInvGrowthTrend?.[finData.revInvGrowthTrend.length-1]?.invYoY, 1)}%')">📈 營收 vs 存貨成長趨勢 (YoY)</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:9px; color:#94a3b8;">藍: 營收 / 灰: 存貨</span>
                        ${(() => {
                            const last = finData?.revInvGrowthTrend?.[finData.revInvGrowthTrend.length - 1];
                            if (last && last.invYoY > last.revYoY + 20) {
                                return '<span style="font-size:10px; background:#ef4444; color:#ffffff; padding:2px 6px; border-radius:4px; font-weight:800; animation: pulse 2s infinite;">⚠️ 營運背離警訊</span>';
                            }
                            return '';
                        })()}
                    </div>
                </div>
                
                <div style="background:rgba(255,255,255,0.02); padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.05); position:relative; height:110px; margin-bottom:12px;">
                    ${(() => {
                        const trend = finData?.revInvGrowthTrend || [];
                        if (trend.length < 2) return '<div style="color:#94a3b8; font-size:11px; text-align:center; padding-top:35px;">趨勢數據不足</div>';
                        
                        // 計算動態 Y 軸範圍 (包含正負值)
                        const allVals = trend.flatMap(t => [t.revYoY || 0, t.invYoY || 0]);
                        const minData = Math.min(...allVals);
                        const maxData = Math.max(...allVals);
                        const minVal = Math.min(minData, -10) * 1.2;
                        const maxVal = Math.max(maxData, 20) * 1.2;
                        const range = maxVal - minVal;
                        
                        const width = 280;
                        const height = 65;
                        const getY = (v) => height - ((v - minVal) / range) * height;
                        const y0 = getY(0); // 零軸位置
                        
                        const points_rev = trend.map((t, i) => `${(i / (trend.length - 1)) * width},${getY(t.revYoY || 0)}`).join(' ');
                        const points_inv = trend.map((t, i) => `${(i / (trend.length - 1)) * width},${getY(t.invYoY || 0)}`).join(' ');
                        
                        return `
                            <svg viewBox="0 -15 ${width} ${height + 30}" style="width:100%; height:100%; overflow:visible;">
                                <!-- Grid Lines (Zero Line) -->
                                <line x1="0" y1="${y0}" x2="${width}" y2="${y0}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2,2" />
                                <line x1="0" y1="${height}" x2="${width}" y2="${height}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                                
                                <!-- Inventory YoY Line (Gray/Red) -->
                                <polyline points="${points_inv}" fill="none" stroke="#ef4444" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="2,2" />
                                
                                <!-- Revenue YoY Line (Blue) -->
                                <polyline points="${points_rev}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" />
                                
                                <!-- Data Points & Labels -->
                                ${trend.map((t, i) => {
                                    const x = (i / (trend.length - 1)) * width;
                                    const y_rev = getY(t.revYoY || 0);
                                    const y_inv = getY(t.invYoY || 0);
                                    const isDivergent = (t.invYoY || 0) > (t.revYoY || 0) + 20;
                                    
                                    return `
                                        <!-- Revenue Point -->
                                        <circle cx="${x}" cy="${y_rev}" r="3" fill="#3b82f6"></circle>
                                        
                                        <!-- Inventory Point -->
                                        <circle cx="${x}" cy="${y_inv}" r="2" fill="${isDivergent ? '#ef4444' : '#cbd5e1'}" opacity="0.6"></circle>
                                        
                                        <!-- 數值標註 (Revenue) -->
                                        <text x="${x}" y="${y_rev - 8}" font-size="13" font-weight="700" fill="#ffffff" text-anchor="middle">${Math.round(t.revYoY)}%</text>
                                        
                                        <!-- 數值標註 (Inventory) -->
                                        <text x="${x}" y="${y_inv + 12}" font-size="13" fill="${isDivergent ? '#f87171' : '#cbd5e1'}" text-anchor="middle">${Math.round(t.invYoY)}%</text>
                                        
                                        <!-- 日期標籤 -->
                                        ${(() => {
                                            const dateStr = String(t.date);
                                            const year = dateStr.slice(0, 4);
                                            const q = dateStr.includes('Q') ? dateStr.split('Q')[1] + 'Q' : dateStr.slice(-5);
                                            return `
                                                <text x="${x}" y="${height + 22}" font-size="9" fill="#cbd5e1" text-anchor="middle">${year}</text>
                                                <text x="${x}" y="${height + 32}" font-size="9" font-weight="600" fill="#cbd5e1" text-anchor="middle">${q}</text>
                                            `;
                                        })()}
                                    `;
                                }).join('')}
                            </svg>
                        `;
                    })()}
                </div>

                <div style="font-size:11px; color:#cbd5e1; margin:15px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:8px;">📊 獲利與週轉率</div>
                ${renderStatRow('存貨週轉率', finData?.inventoryTurnover !== undefined ? safeFix(finData?.inventoryTurnover, 2) + ' 次' : 'N/A')}
                ${renderPercentRow('EPS 年增率 (YoY)', finData?.epsYoY)}
                
                ${renderDiagnostic(
                    (() => {
                        let diag = (finData?.inventoryDays < 60 ? "存貨週轉迅速，商品去化良好。" : (finData?.inventoryDays > 120 ? "存貨積壓風險較大，需留意去化速度。" : "存貨管理尚屬穩健。"));
                        diag += (finData?.ccc < 90 ? " 資金回收速度快，營運週轉效率高。" : "");
                        
                        const lastTrend = finData?.revInvGrowthTrend?.[finData.revInvGrowthTrend.length - 1];
                        const lastDio = finData?.dioDsoTrend?.[finData.dioDsoTrend.length - 1]?.dio;
                        const prevDio = finData?.dioDsoTrend?.[finData.dioDsoTrend.length - 2]?.dio;
                        
                        if (lastTrend && lastTrend.revYoY < -5 && lastTrend.invYoY > 10) {
                            diag += " ⚠️ <b>嚴重警告：</b>出現典型「塞貨背離」！營收年減但存貨年增顯著，代表通路端極可能積壓大量庫存，股價面臨下行壓力。";
                        } else if (lastTrend && lastTrend.invYoY > lastTrend.revYoY + 20) {
                            diag += " ⚠️ <b>注意：</b>存貨成長顯著快於營收成長，需嚴密追蹤下一季去化狀況。";
                        } else if (lastDio > prevDio * 1.2) {
                            diag += " ⚠️ 警訊：單季存貨天數(DIO)激增超過 20%，資金週轉壓力上升。";
                        }
                        
                        return diag;
                    })()
                )}
            </div>







            <!-- 16. 內部人持股變動 -->
            <div class="analysis-card" style="${_naCardStyle(isETF)}">
                ${_naCardOverlay(isETF)}
                <div class="analysis-card-title">👥 ${insiderActivity?.type === 'fallback_chips' ? '內部人大戶籌碼趨勢' : '內部人申報轉讓紀錄'}</div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:15px;">
                    ${insiderActivity && insiderActivity.history.length > 0 ? insiderActivity.history.map(h => `
                        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column; min-height:60px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                                <span style="font-size:10px; color:#94a3b8; font-family:monospace;">${h.date}</span>
                                <span style="font-size:12px; font-weight:800; color:${h.totalChange > 0 ? '#f87171' : (h.totalChange < 0 ? '#4ade80' : '#fff')}">
                                    ${h.totalChange > 0 ? '+' : ''}${h.isPercent ? h.totalChange.toFixed(2) + '%' : Math.round(h.totalChange) + '張'}
                                </span>
                            </div>
                            <div style="font-size:9px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${h.name || ''} ${h.position || ''} ${h.method || ''}">
                                ${h.name ? `${h.name} (${h.position})` : ''}
                                <span style="color:#94a3b8;">${h.method ? `(${h.method})` : ''}</span>
                            </div>
                        </div>
                    `).join('') : '<div style="grid-column: span 2; color:#94a3b8; font-size:12px; text-align:center; padding:20px;">近期暫無重大異動紀錄</div>'}
                </div>

                <div style="font-size:9px; color:#94a3b8; text-align:right; margin-bottom:4px;">
                    ${insiderActivity?.type === 'fallback_chips' ? '數據來源：籌碼結構百分比變動 (備援)' : '數據來源：MoneyDJ 申報轉讓明細'}
                </div>

                ${renderDiagnostic(
                    insiderActivity ? (
                        (insiderActivity.trend < -100 || (insiderActivity.isPercent && insiderActivity.trend < -1)) ? 
                        "注意：近期大戶或內部人有減持跡象，需留意賣壓。" : "內部籌碼動態相對穩定。"
                    ) : "數據不足，無法分析內部人動向。"
                )}
            </div>


        </div>
        </div>

        <div class="analysis-card" style="margin-top:16px;">
            <div class="analysis-card-title">🤖 AI 綜合診斷</div>
            <div class="analysis-summary">${summaryText}</div>
        </div>

        <!-- 15. 數據診斷面板 (Visible Debugging) -->
        <div id="analysisDiagnostic" style="margin-top:20px; padding:15px; background:rgba(0,0,0,0.3); border-radius:10px; border:1px solid rgba(255,255,255,0.1); font-family:monospace; font-size:11px;">
            <div style="color:#fbbf24; margin-bottom:8px; font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">🔍 數據來源診斷 (Diagnostic Console)</div>
            
            ${(() => {
                const getRetryBtn = (idx) => `<span onclick="retryAnalysisTask('${symbol}', '${name}', '${avgCost || ''}', ${idx})" style="text-decoration:underline; cursor:pointer; margin-left:5px; color:#fbbf24;">[重試]</span>`;
                return `
                <div style="color:${chartData ? '#10b981' : '#ef4444'}">● 股價歷史 (Price): ${chartData ? 'OK' : 'FAIL' + getRetryBtn(0)}</div>
                <div style="color:${twseBasic ? '#10b981' : '#ef4444'}">● 估值指標 (Basic): ${twseBasic ? 'OK' : 'FAIL' + getRetryBtn(1)}</div>
                <div style="color:${chipsData ? '#10b981' : '#ef4444'}">● 籌碼結構 (Shareholding): ${chipsData ? 'OK' : 'FAIL' + getRetryBtn(2)}</div>
                <div style="color:${revData ? '#10b981' : '#ef4444'}">● 營收數據 (Revenue): ${revData ? 'OK' : 'FAIL' + getRetryBtn(3)}</div>
                <div style="color:${finData && finData.equity > 1 ? '#10b981' : '#ef4444'}">● 財報數據 (Financial): ${finData ? (finData.equity > 1 ? 'OK' : 'EMPTY' + getRetryBtn(6)) : 'FAIL' + getRetryBtn(6)}</div>
                <div style="color:${institutionalData ? '#10b981' : '#ef4444'}">● 法人動態 (Inst.): ${institutionalData ? 'OK' : 'FAIL' + getRetryBtn(5)}</div>
                <div style="color:${riskMetrics ? '#10b981' : '#ef4444'}">● 風險指標 (Risk): ${riskMetrics ? 'OK' : 'FAIL' + getRetryBtn('[0, 7]')}</div>
                <div style="color:${(insiderActivity && insiderActivity.type !== 'none') ? '#10b981' : '#ef4444'}">● 內部人持股 (Insider): ${(insiderActivity && insiderActivity.type !== 'none') ? 'OK' : 'FAIL' + getRetryBtn(8)}</div>
                `;
            })()}

            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1); color:#fbbf24; font-size:10px; word-break:break-all;">
                [INTEGRITY] Equity:${finData?.equity ? 'YES' : 'NO'}, Shares:${shares ? 'YES' : (finData?.sharesIssued ? 'YES(B)' : 'NO')}, Holders:${chipsData?.holderTrend?.length || 0}, Norway:${chipsData?.norwayStatus || 'N/A'}
            </div>
            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1); color:#fbbf24; font-size:10px; word-break:break-all;">
                [INSIDER SAMPLE] ${insiderActivity ? insiderActivity.sample : `FAIL (DJ:${debugInfo?.dj}, DIR:${debugInfo?.dir}, CHIPS:${debugInfo?.holders || 0})`}
            </div>
            <div style="margin-top:8px; color:#94a3b8;">* 如果個別項目顯示 FAIL，可點擊該項目的 [重試] 進行局部更新。</div>
            <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:10px; color:#94a3b8;">本次分析總耗時: <span style="color:#60a5fa; font-weight:bold;">${totalTime || 'N/A'}s</span></div>
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}', true)" 
                        style="background:rgba(59, 130, 246, 0.2); color:#60a5fa; border:1px solid rgba(59, 130, 246, 0.3); padding:6px 15px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:700; transition:all 0.2s;">
                    🔄 全數重抓 (跳過快取)
                </button>
            </div>
        </div>
    `;
    // ── 清除 N/A Context，避免殘留狀態影響下一次載入 ──
    window._naCtx = null;
}

function retryAnalysisTask(symbol, name, avgCost, index) {
    if (!window._lastAnalysisResults) return;
    const results = [...window._lastAnalysisResults];
    if (Array.isArray(index)) {
        index.forEach(i => results[i] = null);
    } else {
        results[index] = null;
    }
    openAnalysisModal(symbol, name, avgCost, false, results);
}

function renderStatRow(label, value, percentVal = null, onClickOverride = null) {
    // ── N/A Field Overlay：該欄位對此股票類型不適用時，顯示紅色橫線劃除 ──
    if (window._naCtx?.naRows?.has(label)) {
        const cleanTxt = String(value).replace(/<[^>]*>/g, '');
        return `<div class="analysis-stat-row" style="position:relative; opacity:0.52; user-select:none;">
            <span class="analysis-label" style="text-decoration:line-through; color:#6b7280;">${label}</span>
            <span class="analysis-val"   style="text-decoration:line-through; color:#6b7280;">${cleanTxt}</span>
            <div style="position:absolute; left:0; right:0; top:50%; height:2px; background:#ef4444; opacity:0.85; pointer-events:none; border-radius:1px;"></div>
        </div>`;
    }
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef || onClickOverride ? 'analysis-label has-info' : 'analysis-label';
    const cleanVal = String(value).replace(/<[^>]*>/g, '').replace(/'/g, "\\'");
    let clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${cleanVal}')"` : '';
    
    if (onClickOverride) {
        clickAttr = `onclick="${onClickOverride}"`;
    }

    let barHtml = '';
    if (percentVal !== null && !isNaN(percentVal)) {
        barHtml = `
        <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${percentVal}%; background: ${percentVal > 30 ? '#3b82f6' : '#cbd5e1'};"></div>
        </div>`;
    }
    
    return `
        <div class="analysis-stat-row" style="flex-direction: ${barHtml ? 'column' : 'row'}; align-items: ${barHtml ? 'flex-start' : 'center'}; gap: 4px;">
            <div style="display:flex; justify-content:space-between; width:100%;">
                <span class="${labelClass}" ${clickAttr}>${label}</span>
                <span class="analysis-val">${value}</span>
            </div>
            ${barHtml}
        </div>
    `;
}

function renderDiagnostic(text) {
    if (!text) return '';
    return `
        <div style="margin-top:12px; padding:8px 12px; background:rgba(59, 130, 246, 0.05); border-radius:8px; border:1px solid rgba(59, 130, 246, 0.1); font-size:11px; color:#ffffff; line-height:1.5;">
            <span style="color:#60a5fa; font-weight:700; margin-right:4px;">💡 診斷：</span>${text}
        </div>
    `;
}

function renderPercentRow(label, percentVal, showSign = true, useColor = true, onClickOverride = null) {
    // ── N/A Field Overlay ──
    if (window._naCtx?.naRows?.has(label)) {
        const txt = (percentVal !== null && percentVal !== undefined && !isNaN(percentVal)) ? safeFix(percentVal, 2) + '%' : 'N/A';
        return `<div class="analysis-stat-row" style="position:relative; opacity:0.52; user-select:none;">
            <span class="analysis-label" style="text-decoration:line-through; color:#6b7280;">${label}</span>
            <span class="analysis-val"   style="text-decoration:line-through; color:#6b7280;">${txt}</span>
            <div style="position:absolute; left:0; right:0; top:50%; height:2px; background:#ef4444; opacity:0.85; pointer-events:none; border-radius:1px;"></div>
        </div>`;
    }
    if (percentVal === null || percentVal === undefined || isNaN(percentVal)) {
        return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">N/A</span></div>`;
    }
    const hasDef = termDefinitions && termDefinitions[label];
    const valStr = `${percentVal > 0 && showSign ? '+' : ''}${safeFix(percentVal, 2)}%`;
    
    let labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    let clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';
    
    if (onClickOverride) {
        labelClass = 'analysis-label has-info';
        clickAttr = `onclick="${onClickOverride}"`;
    }
    
    const color = useColor ? (percentVal > 0 ? '#ef4444' : (percentVal < 0 ? '#10b981' : '#ffffff')) : '#ffffff'; 
    const sign = (showSign && percentVal > 0) ? '+' : '';
    return `
        <div class="analysis-stat-row">
            <span class="${labelClass}" ${clickAttr}>${label}${onClickOverride ? ' 📈' : ''}</span>
            <span class="analysis-val" style="color:${color}; font-weight:700;">${sign}${safeFix(percentVal, 2)}%</span>
        </div>
    `;
}

function safeFix(val, n) {
    const num = Number(val);
    if (val === null || val === undefined || !Number.isFinite(num)) return 'N/A';
    return num.toFixed(n);
}

function formatCurrency(num) {
    const value = Number(num);
    if (num === null || num === undefined || !Number.isFinite(value)) return 'N/A';
    const absNum = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (absNum >= 1000000000000) return sign + (absNum / 1000000000000).toFixed(2) + ' 兆';
    if (absNum >= 100000000) return sign + (absNum / 100000000).toFixed(2) + ' 億';
    if (absNum >= 10000) return sign + (absNum / 10000).toFixed(2) + ' 萬';
    return value.toLocaleString();
}

function renderNetBuyRow(label, netLots) {
    if (netLots === null || netLots === undefined || isNaN(netLots)) {
        return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">N/A</span></div>`;
    }
    const rounded = Math.round(netLots);
    const color = rounded > 0 ? '#ef4444' : (rounded < 0 ? '#10b981' : '#cbd5e1');
    const sign = rounded > 0 ? '+' : '';
    return `
        <div class="analysis-stat-row">
            <span class="analysis-label">${label}</span>
            <span class="analysis-val" style="color:${color};">${sign}${rounded.toLocaleString()} 張</span>
        </div>
    `;
}

function renderMARow(label, maValue, currentPrice) {
    if (!maValue || isNaN(maValue)) return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">N/A</span></div>`;
    
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const diffVal = ((currentPrice - maValue) / maValue * 100);
    const diff = safeFix(diffVal, 1);
    const valStr = `${safeFix(maValue, 2)} (乖離 ${diffVal > 0 ? '+' : ''}${diff}%)`;
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';
    const color = diffVal > 0 ? '#ef4444' : '#10b981'; 
    const sign = diffVal > 0 ? '+' : '';
    
    return `
        <div class="analysis-stat-row">
            <span class="${labelClass}" ${clickAttr}>${label}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="analysis-val">${safeFix(maValue, 2)}</span>
                <span class="ma-tag" style="color:${color}; border: 1px solid ${color}40;">乖離 ${sign}${diff}%</span>
            </div>
        </div>
    `;
}

function renderValuationRow(label, value) {
    if (window._naCtx?.naRows?.has(label)) {
        const cleanTxt = (value === null || value === undefined) ? 'N/A' : (typeof value === 'number' ? `${safeFix(value, 2)} 元` : String(value).replace(/<[^>]*>/g, ''));
        return `<div class="analysis-stat-row" style="position:relative; opacity:0.52; user-select:none;">
            <span class="analysis-label" style="text-decoration:line-through; color:#6b7280;">${label}</span>
            <span class="analysis-val"   style="text-decoration:line-through; color:#6b7280;">${cleanTxt}</span>
            <div style="position:absolute; left:0; right:0; top:50%; height:2px; background:#ef4444; opacity:0.85; pointer-events:none; border-radius:1px;"></div>
        </div>`;
    }
    if (value === null || value === undefined) return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">N/A</span></div>`;
    
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const valStr = typeof value === 'number' ? `${safeFix(value, 2)} 元` : value;
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';

    let colorClass = 'reasonable';
    if (label.includes('便宜')) colorClass = 'cheap';
    if (label.includes('昂貴')) colorClass = 'expensive';
    
    return `
        <div class="analysis-stat-row">
            <span class="${labelClass}" ${clickAttr}>${label}</span>
            <span class="analysis-val ${colorClass}" ${label.includes('內在價值') ? 'style="color:#ffffff !important;"' : ''}>${valStr}</span>
        </div>
    `;
}

function renderValuationRiverMap(label, current, percentile, bands) {
    if (window._naCtx?.naRows?.has(label)) {
        return `<div class="analysis-stat-row" style="position:relative; opacity:0.52; user-select:none;">
            <span class="analysis-label" style="text-decoration:line-through; color:#6b7280;">${label}</span>
            <span class="analysis-val"   style="text-decoration:line-through; color:#6b7280;">N/A</span>
            <div style="position:absolute; left:0; right:0; top:50%; height:2px; background:#ef4444; opacity:0.85; pointer-events:none; border-radius:1px;"></div>
        </div>`;
    }
    if (current === null || current === undefined || percentile === null || percentile === undefined) {
        return `
            <div class="river-map-row">
                <div class="river-label">${label}</div>
                <div class="river-track" style="background:rgba(255,255,255,0.05); border:1px dashed rgba(255,255,255,0.1); justify-content:center; color:#94a3b8; font-size:10px;">
                    數據不足，無法生成位階圖
                </div>
            </div>
        `;
    }

    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const valStr = `${safeFix(current, 2)} (位階 ${safeFix(percentile, 1)}%)`;
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';

    const color = percentile < 30 ? '#4ade80' : (percentile > 70 ? '#f87171' : '#fbbf24');
    const pos = Math.max(0, Math.min(100, percentile));
    
    return `
        <div class="analysis-stat-row chart-internal" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 0;">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:8px; font-size:12px; flex-wrap:nowrap;">
                <span class="${labelClass}" style="white-space:nowrap; flex-shrink:1; min-width:0; overflow:hidden; text-overflow:ellipsis;" ${clickAttr}>${label}: <b style="color:#ffffff;">${safeFix(current, 2)}</b></span>
                <span style="color:${color}; font-weight:800; white-space:nowrap; flex-shrink:0;">${safeFix(percentile, 1)}% (位階)</span>
            </div>
            <div style="width:100%;">
            <div class="river-map-container" style="width:100%; height:14px; background:rgba(255,255,255,0.05); border-radius:7px; position:relative; margin:10px 0 -2px; border:1px solid rgba(255,255,255,0.1);">
                <!-- Scale markers -->
                <div style="position:absolute; left:0%; top:-12px; font-size:8px; color:#94a3b8;">${bands ? safeFix(bands.min, 1) : '極低'}</div>
                <div style="position:absolute; left:25%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.1);"></div>
                <div style="position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.2);"></div>
                <div style="position:absolute; left:75%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.1);"></div>
                <div style="position:absolute; right:0%; top:-12px; font-size:8px; color:#94a3b8;">${bands ? safeFix(bands.max, 1) : '極高'}</div>
                
                <!-- Current Position Pointer -->
                <div style="position:absolute; left:${pos}%; top:50%; transform:translate(-50%, -50%); width:8px; height:8px; background:${color}; border-radius:50%; box-shadow:0 0 10px ${color}; z-index:2;"></div>
                <div style="position:absolute; left:${pos}%; top:-18px; transform:translateX(-50%); font-size:9px; font-weight:700; color:${color};">▼</div>
                
                <!-- Background Gradient (Green to Red) -->
                <div style="position:absolute; left:0; top:0; bottom:0; width:100%; background:linear-gradient(90deg, rgba(74,222,128,0.2) 0%, rgba(251,191,36,0.2) 50%, rgba(248,113,113,0.2) 100%); border-radius:7px;"></div>
            </div>
            <div class="legend-horizontal" style="display:flex; justify-content:space-between; width:100%; font-size:8px; color:#94a3b8; padding:0 2px; margin-top:-8px;">
                <span>低估</span>
                <span>合理</span>
                <span>昂貴</span>
            </div>
            </div>
        </div>
    `;
}



/**
 * === Sector Benchmarks: Industry Averages (2024) ===
 * 包含 15+ 個產業的平均財務指標：毛利(gm), ROE(roe), 本益比(pe), 殖利率(yield), 營收成長(rev)
 */


function renderSectorComparison(industry, stats) {
    if (!industry) return '';
    
    let matchKey = Object.keys(sectorBenchmarks).find(k => 
        k === industry || k.includes(industry) || industry.includes(k)
    );
    
    const bench = sectorBenchmarks[matchKey] || sectorBenchmarks['其他電子'] || { gm: 15, roe: 10, pe: 15, yield: 3, rev: 5 };
    const finalIndustryName = matchKey || industry;

    const metricConfigs = [
        { key: 'rev', label: '營收成長', unit: '%', category: '成長動能' },
        { key: 'yield', label: '殖利率', unit: '%', category: '股利回報' },
        { key: 'gm', label: '毛利率', unit: '%', category: '獲利能力' },
        { key: 'om', label: '營業利益率', unit: '%', category: '獲利能力' },
        { key: 'nm', label: '稅後淨利率', unit: '%', category: '獲利能力' },
        { key: 'roe', label: 'ROE', unit: '%', category: '營運效率' },
        { key: 'roa', label: 'ROA', unit: '%', category: '營運效率' },
        { key: 'rd', label: '研發費用率', unit: '%', category: '技術領先' },
        { key: 'dio', label: '存貨週轉天數', unit: '天', category: '庫存管理', lowerBetter: true },
        { key: 'dso', label: '應收帳款天數', unit: '天', category: '營運效率', lowerBetter: true },
        { key: 'dpo', label: '應付帳款天數', unit: '天', category: '營運效率' },
        { key: 'ccc', label: '現金循環週期', unit: '天', category: '營運效率', lowerBetter: true },
        { key: 'at', label: '資產週轉率', unit: '次', category: '營運效率' },
        { key: 'dr', label: '負債比率', unit: '%', category: '財務健壯', lowerBetter: true },
        { key: 'cr', label: '流動比率', unit: '%', category: '財務健壯' },
        { key: 'qr', label: '速動比率', unit: '%', category: '財務健壯' },
        { key: 'pe', label: '本益比', unit: '倍', category: '估值位階', lowerBetter: true },
        { key: 'pb', label: '股價淨值比', unit: '倍', category: '估值位階', lowerBetter: true }
    ];

    const items = metricConfigs.map(cfg => {
        const val = Number(stats[cfg.key]);
        const avg = Number(bench[cfg.key]);
        return {
            ...cfg,
            val,
            avg: Number.isFinite(avg) ? avg : null
        };
    }).filter(i => Number.isFinite(i.val)); // 只要個股有數據就顯示，平均值缺失則顯示 N/A

    if (items.length === 0) return '';

    // 按類別分組
    const categories = [...new Set(items.map(i => i.category))];

    return `
        <div class="analysis-card" style="margin-top:16px; border: 1px solid rgba(59, 130, 246, 0.3); background: linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);">
            <div class="analysis-card-title chart-internal" style="display:flex; justify-content:space-between; align-items:center;">
                <span>📊 產業對比：${finalIndustryName}</span>
                <span style="font-size:10px; color:#94a3b8; font-weight:normal;">基準: 2025 產業年度報告 (最新)</span>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px 20px; margin-top:15px;">
                ${items.map(item => {
                    const hasAvg = item.avg != null;
                    const diff = hasAvg ? item.val - item.avg : 0;
                    const isBetter = hasAvg ? (item.lowerBetter ? diff <= 0 : diff >= 0) : true;
                    const color = isBetter ? '#4ade80' : '#f87171'; 
                    
                    const barMax = Math.max(Math.abs(item.val), hasAvg ? Math.abs(item.avg) : 0, 1) * 1.2;
                    const stockPos = Math.max(3, (Math.abs(item.val) / barMax) * 100);
                    const avgPos = hasAvg ? (Math.abs(item.avg) / barMax) * 100 : -10; // 隱藏
                    
                    return `
                        <div class="chart-internal" onclick="showTermExplainer('${item.label}', '${(item.unit === '次' || item.unit === '倍' ? item.val.toFixed(2) : item.val.toFixed(1))}${item.unit}', ${item.avg})" style="display:flex; flex-direction:column; gap:4px; background:${(window._naCtx?.naPeerKeys?.has(item.key)) ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)'}; padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); cursor:pointer; transition:all 0.2s; position:relative; ${(window._naCtx?.naPeerKeys?.has(item.key)) ? 'opacity:0.52; overflow:hidden;' : ''}" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='${(window._naCtx?.naPeerKeys?.has(item.key)) ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)'}'">
                            ${(window._naCtx?.naPeerKeys?.has(item.key)) ? `<div style="position:absolute;inset:0;pointer-events:none;z-index:2;"><svg style="width:100%;height:100%;" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><line x1="1%" y1="1%" x2="99%" y2="99%" stroke="#ef4444" stroke-width="1.5" opacity="0.7" stroke-linecap="round"/><line x1="99%" y1="1%" x2="1%" y2="99%" stroke="#ef4444" stroke-width="1.5" opacity="0.7" stroke-linecap="round"/></svg></div>` : ''}
                            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                                <span style="font-size:11px; font-weight:700; color:${(window._naCtx?.naPeerKeys?.has(item.key)) ? '#6b7280' : '#cbd5e1'}; ${(window._naCtx?.naPeerKeys?.has(item.key)) ? 'text-decoration:line-through;' : ''}">${item.label}</span>
                                <span style="font-size:11px; color:${(window._naCtx?.naPeerKeys?.has(item.key)) ? '#6b7280' : color}; font-weight:800; ${(window._naCtx?.naPeerKeys?.has(item.key)) ? 'text-decoration:line-through;' : ''}">
                                    ${(item.unit === '次' || item.unit === '倍' ? item.val.toFixed(2) : item.val.toFixed(1))}${item.unit}
                                </span>
                            </div>
                            <div style="height:8px; background:rgba(255,255,255,0.05); border-radius:4px; position:relative; margin:6px 0; width:100%;">
                                <div style="position:absolute; left:0; top:0; bottom:0; width:${stockPos}%; background:${color}; border-radius:4px; opacity:0.8; box-shadow: 0 0 8px ${color}44;"></div>
                                ${hasAvg ? `<div style="position:absolute; left:${avgPos}%; top:-3px; bottom:-3px; width:2px; background:#fbbf24; z-index:2; box-shadow: 0 0 5px #fbbf24;"></div>` : ''}
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:9px; color:#94a3b8; width:100%;">
                                <span>行業平均: ${hasAvg ? item.avg + item.unit : 'N/A'}</span>
                                ${hasAvg ? `<span style="color:${color}; opacity:0.8;">${diff >= 0 ? '超額' : '落後'} ${Math.abs(diff).toFixed(1)}</span>` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="legend-horizontal chart-internal" style="margin-top:15px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.05); display:flex; justify-content:center; gap:15px;">
                <div style="display:flex; align-items:center; gap:5px; font-size:9px; color:#94a3b8;">
                    <span style="width:8px; height:8px; background:#4ade80; border-radius:2px;"></span> 優於標竿
                </div>
                <div style="display:flex; align-items:center; gap:5px; font-size:9px; color:#94a3b8;">
                    <span style="width:8px; height:8px; background:#f87171; border-radius:2px;"></span> 低於標竿
                </div>
                <div style="display:flex; align-items:center; gap:5px; font-size:9px; color:#94a3b8;">
                    <span style="width:2px; height:10px; background:#fbbf24; border-radius:1px;"></span> 產業平均線
                </div>
            </div>
        </div>
    `;
    setTimeout(_initVPTouchTooltip, 0);
}

function _initVPTouchTooltip() {
    if (!('ontouchstart' in window)) return;
    const container = document.getElementById('vp-container');
    if (!container) return;

    let tip = document.getElementById('vp-touch-tip');
    if (!tip) {
        tip = document.createElement('div');
        tip.id = 'vp-touch-tip';
        tip.style.cssText = 'position:fixed;background:rgba(15,23,42,0.96);color:#fff;font-size:13px;font-weight:700;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);pointer-events:none;z-index:99999;display:none;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
        document.body.appendChild(tip);
    }

    container.querySelectorAll('.vp-row').forEach(row => {
        const barDiv = row.querySelector('[title]');
        if (!barDiv) return;
        row.addEventListener('touchstart', (e) => {
            const txt = barDiv.getAttribute('title');
            if (!txt) return;
            e.stopPropagation();
            tip.textContent = txt;
            tip.style.display = 'block';
            requestAnimationFrame(() => {
                const t = e.touches[0];
                const tipW = tip.offsetWidth;
                tip.style.left = Math.min(t.clientX + 16, window.innerWidth - tipW - 8) + 'px';
                tip.style.top  = Math.max(t.clientY - 48, 8) + 'px';
            });
        }, {passive: true});
        row.addEventListener('touchend', () => {
            setTimeout(() => { tip.style.display = 'none'; }, 1200);
        }, {passive: true});
    });
}




/**
 * 顯示指標百科彈窗，並根據目前數值與同業平均進行分析
 * @param {string} term 指標名稱
 * @param {string} currentVal 目前數值
 * @param {number} avgVal 同業平均數值 (選填)
 */
function showTermExplainer(term, currentVal = null, avgVal = null, hideDiagnosis = false) {
    let def = termDefinitions[term];
    if (!def) {
        // 修正：優先進行精確匹配，如果失敗才進行受控的模糊匹配
        const keys = Object.keys(termDefinitions);
        // 先找完全包含的（長度最接近的優先）
        const bestKey = keys.find(k => k === term || k.replace(/\s/g,'') === term.replace(/\s/g,''));
        if (bestKey) {
            def = termDefinitions[bestKey];
        } else {
            // 只有在完全找不到時，才嘗試包含關係，但要排除掉像 FCF 這種過短的關鍵字誤抓
            const fuzzyKey = keys.find(k => 
                (k.length > 3 && term.includes(k)) || 
                (term.length > 3 && k.includes(term))
            );
            if (fuzzyKey) def = termDefinitions[fuzzyKey];
        }
    }
    if (!def) return;

    // 建立或獲取彈窗元件
    let overlay = document.getElementById('termExplainerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'termExplainerOverlay';
        document.body.appendChild(overlay);
        
        // 點擊背景關閉
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeTermExplainer();
        });
    }

    // 根據類型選擇顏色
    const typeColors = {
        '估值': '#f59e0b',
        '獲利品質': '#3b82f6',
        '獲利能力': '#3b82f6',
        '成長動能': '#10b981',
        '技術面': '#ec4899',
        '風險': '#ef4444',
        '綜合診斷': '#10b981',
        '營運效率': '#8b5cf6',
        '償債能力': '#06b6d4',
        '財務健壯': '#6366f1',
        '技術領先': '#ec4899',
        '股利回報': '#f59e0b'
    };
    const badgeColor = typeColors[def.type] || '#94a3b8';

    // 嘗試解析數值並進行診斷
    let analysisHtml = '';
    if (currentVal && def.analyze) {
        let cleanVal;
        const valStr = String(currentVal);
        if (valStr.includes('位階')) {
            const match = valStr.match(/位階\s*([-\d.]+)/);
            if (match) cleanVal = parseFloat(match[1]);
        }
        // 特殊處理 RSR 或包含標籤的格式，優先抓取冒號後的數值
        if (cleanVal === undefined && valStr.includes('日:')) {
            const match = valStr.match(/日:\s*([-\d.]+)/);
            if (match) cleanVal = parseFloat(match[1]);
        }
        if (cleanVal === undefined) {
            const match = valStr.match(/[-\d.]+/);
            if (match) cleanVal = parseFloat(match[0]);
        }
        
        if (cleanVal !== undefined && !isNaN(cleanVal)) {
            const diagnosis = (!hideDiagnosis && def.analyze && typeof def.analyze === 'function') ? def.analyze(cleanVal, currentVal, avgVal) : null;
            
            // 構建同業對比小工具
            let comparisonWidget = '';
            const skipComparison = ['籌碼密集區 (POC)', '52週最高', '52週最低', '52週成交均價', '52週 加權平均成本'].some(k => term.includes(k));
            
            if (avgVal !== null && avgVal !== undefined && !skipComparison) {
                const diff = (cleanVal - avgVal);
                const lowerBetterKeys = ['PE', 'PB', '本益比', '淨值比', '天數', '週期', '負債'];
                const isLowerBetter = lowerBetterKeys.some(k => term.toUpperCase().includes(k.toUpperCase()));
                const isDPO = term.includes('應付');
                const finalLowerBetter = isLowerBetter && !isDPO;

                const isBetter = finalLowerBetter ? diff < 0 : diff > 0;
                const statusColor = isBetter ? '#4ade80' : '#f87171';
                
                let trendText = '';
                if (isBetter) {
                    trendText = finalLowerBetter ? '估值較低(優)' : '領先標竿';
                    if (term.includes('天數') || term.includes('週期')) trendText = '週轉較快(優)';
                } else {
                    trendText = finalLowerBetter ? '估值較高(貴)' : '低於平均';
                    if (term.includes('天數') || term.includes('週期')) trendText = '週轉較慢';
                }
                
                comparisonWidget = `
                    <div style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.1);">
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                            <span style="color:#cbd5e1;">同業標竿 (平均)</span>
                            <span style="color:#ffffff; font-weight:700;">${avgVal}${valStr.includes('%') ? '%' : (valStr.includes('倍') ? '倍' : (valStr.includes('天') ? '天' : ''))}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px;">
                            <span style="color:#cbd5e1;">對比表現</span>
                            <span style="color:${statusColor}; font-weight:700;">${trendText} (${Math.abs(diff).toFixed(1)})</span>
                        </div>
                    </div>
                `;
            }

            if (diagnosis) {
                analysisHtml = `
                    <div class="term-explainer-section" style="background: ${badgeColor}10; border: 1px solid ${badgeColor}30; border-radius: 12px; padding: 15px; margin-top: 15px;">
                        <div class="term-explainer-subtitle" style="color:${badgeColor}; margin-bottom:8px;">🔍 AI 智能診斷</div>
                        <div style="font-size:14px; font-weight:700; color:#ffffff; margin-bottom:4px;">
                            個股當前值: <span style="font-size:18px; color:${badgeColor};">${/^-\d+(?=\s|$)/.test(String(currentVal)) ? String(currentVal).replace(/^-(\d+)/, '$1天(尚未修復)') : currentVal}</span>
                        </div>
                        <div class="term-explainer-body" style="font-size:13px; line-height:1.5; color:#e2e8f0; opacity:1;">
                            ${diagnosis}
                        </div>
                        ${comparisonWidget}
                    </div>
                `;
            } else if (comparisonWidget) {
                analysisHtml = `
                    <div class="term-explainer-section" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; margin-top: 15px;">
                        <div class="term-explainer-subtitle" style="color:#94a3b8; margin-bottom:8px;">📊 同業對比</div>
                        <div style="font-size:14px; font-weight:700; color:#ffffff; margin-bottom:4px;">
                            個股當前值: <span style="font-size:18px; color:${badgeColor};">${/^-\d+(?=\s|$)/.test(String(currentVal)) ? String(currentVal).replace(/^-(\d+)/, '$1天(尚未修復)') : currentVal}</span>
                        </div>
                        ${comparisonWidget}
                    </div>
                `;
            }
        }
    }

    overlay.innerHTML = `
        <div class="term-explainer-content">
            <div class="term-explainer-close" onclick="closeTermExplainer()">✕</div>
            <div class="term-explainer-badge" style="background:${badgeColor}20; color:${badgeColor}; border:1px solid ${badgeColor}40;">
                ${def.type}
            </div>
            <div class="term-explainer-title">${def.title || term}</div>
            <div class="term-explainer-body">${def.desc}</div>
            
            ${analysisHtml}

            <div class="term-explainer-section">
                <div class="term-explainer-subtitle">💡 判斷準則</div>
                <div class="term-explainer-body" style="font-size:13px; opacity:0.9;">${def.rule}</div>
            </div>
            
            <div class="term-explainer-section" style="margin-top:15px; border-top:none; padding-top:0;">
                <div class="term-explainer-subtitle">🎯 投資建議</div>
                <div class="term-explainer-body" style="font-size:13px; font-style:italic; opacity:0.8;">${def.advice}</div>
            </div>
        </div>
    `;

    // 顯示
    setTimeout(() => overlay.classList.add('active'), 10);
}

function closeTermExplainer() {
    const overlay = document.getElementById('termExplainerOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// --- 籌碼深度分析助手 ---
function calculateInstitutionalCosts(dailyData, prices) {
    if (!dailyData || !prices) return null;
    const priceMap = new Map(prices.map(p => [p.date, p.close]));
    
    const calcVWAP = (type, days) => {
        const sub = dailyData.slice(-days);
        // 主要：以淨買超張數加權（買進成本估算）
        let totalBuy = 0, buySum = 0;
        // 備援：以交易量絕對值加權（適用投信長期賣超或金融股等窗口無淨買超情形）
        let totalAbs = 0, absSum = 0;
        sub.forEach(d => {
            const p = priceMap.get(d.date);
            const net = d[type] || 0;
            if (p) {
                if (net > 0)  { totalBuy += net;            buySum += net * p; }
                if (net !== 0){ totalAbs += Math.abs(net); absSum += Math.abs(net) * p; }
            }
        });
        if (totalBuy > 0) return buySum / totalBuy;   // 有淨買超：買進加權均價
        if (totalAbs > 0) return absSum / totalAbs;   // 無淨買超但有交易：活動加權均價（含賣出）
        return 0;                                      // 該期間完全無交易
    };

    return {
        foreign: { 
            cost5: calcVWAP('foreign', 5),
            cost10: calcVWAP('foreign', 10),
            cost20: calcVWAP('foreign', 20), 
            cost60: calcVWAP('foreign', 60),
            cost120: calcVWAP('foreign', 120),
            cost240: calcVWAP('foreign', 240)
        },
        trust: { 
            cost5: calcVWAP('trust', 5),
            cost10: calcVWAP('trust', 10),
            cost20: calcVWAP('trust', 20), 
            cost60: calcVWAP('trust', 60),
            cost120: calcVWAP('trust', 120),
            cost240: calcVWAP('trust', 240)
        }
    };
}

function identifyWinnerBrokers(brokerData, currentPrice) {
    const winners = [];
    const sellers = [];
    if (!brokerData?.d60?.topBrokers) return { winners, sellers };

    const d5BuyNames  = new Set((brokerData.d5?.topBrokers  || []).map(b => b.name));
    const d20BuyNames = new Set((brokerData.d20?.topBrokers || []).map(b => b.name));
    const d5SellNames  = new Set((brokerData.d5?.topSellers  || []).map(b => b.name));
    const d20SellNames = new Set((brokerData.d20?.topSellers || []).map(b => b.name));

    // ✅ 保留所有 60 日前五大買超券商，用標籤標示連續性
    brokerData.d60.topBrokers.forEach(b => {
        const isHot = d5BuyNames.has(b.name) || d20BuyNames.has(b.name);
        winners.push({
            name: b.name,
            label: isHot ? '🔥持續買進' : null,
            buyNet: b.buyNet
        });
    });

    // ✅ 保留所有 60 日前五大賣超券商，用標籤標示連續性
    (brokerData.d60.topSellers || []).forEach(b => {
        const isHot = d5SellNames.has(b.name) || d20SellNames.has(b.name);
        sellers.push({
            name: b.name,
            label: isHot ? '⚠️持續賣出' : null,
            sellNet: b.sellNet
        });
    });

    return {
        winners: winners.sort((a, b) => b.buyNet - a.buyNet).slice(0, 5),
        sellers: sellers.sort((a, b) => b.sellNet - a.sellNet).slice(0, 5)
    };
}

/**
 * 切換價格量能分佈 (Volume Profile) 的顯示行數
 */
function toggleVP(btn) {
    const container = document.getElementById('vp-container');
    if (!container) return;
    
    const hiddenRows = container.querySelectorAll('.vp-hidden-row');
    const isExpanded = btn.getAttribute('data-expanded') === 'true';
    
    hiddenRows.forEach(row => {
        row.style.display = isExpanded ? 'none' : 'flex';
    });
    
    if (isExpanded) {
        btn.innerText = '展開 ↓';
        btn.setAttribute('data-expanded', 'false');
    } else {
        btn.innerText = '收合 ↑';
        btn.setAttribute('data-expanded', 'true');
    }
}

function toggleInstCosts(btn) {
    const hiddenSections = document.querySelectorAll('.inst-costs-hidden');
    const isExpanded = btn.getAttribute('data-expanded') === 'true';
    
    hiddenSections.forEach(s => {
        s.style.display = isExpanded ? 'none' : 'block';
    });
    
    if (isExpanded) {
        btn.innerText = '看更多 (60/120/240日) ↓';
        btn.setAttribute('data-expanded', 'false');
    } else {
        btn.innerText = '收合 ↑';
        btn.setAttribute('data-expanded', 'true');
    }
}

function toggleTechnicalMA(btn) {
    const container = btn.closest('.analysis-card');
    const hiddenRows = container.querySelector('.ma-hidden-rows');
    if (!hiddenRows) return;
    
    const isExpanded = btn.getAttribute('data-expanded') === 'true';
    hiddenRows.style.display = isExpanded ? 'none' : 'block';
    
    if (isExpanded) {
        btn.innerText = '展開更多均線 (60/120/240) ↓';
        btn.setAttribute('data-expanded', 'false');
    } else {
        btn.innerText = '收合均線 ↑';
        btn.setAttribute('data-expanded', 'true');
    }
}


/**
 * 顯示法人持股趨勢圖
 * 採動態 DOM 注入，確保不依賴 index.html 修改，並將層級鎖定在分析視窗內
 */
function showHoldingTrendChart(symbol, type) {
    console.log(`[TrendChart] Triggered for ${symbol} - ${type}`);
    
    const chips = window._lastChipsData;
    const inst = window._lastInstitutionalData;
    if (!chips) return;

    const name = chips.stockName || symbol;
    const sharesIssued = chips.sharesIssued || 1;
    let history = [];

    if (type === '外資' && chips.holdingHistory && chips.holdingHistory.length > 0) {
        history = chips.holdingHistory.map(d => ({
            date: d.date,
            val: parseFloat(d.ForeignInvestmentSharesRatio || d.foreign_investment_shares_ratio || d.ForeignInvestmentRatio || d.foreign_investment_ratio || 0)
        }));
    } else if (inst && inst.daily && inst.daily.length > 0) {
        const daily = [...inst.daily].sort((a, b) => new Date(b.date) - new Date(a.date));
        let currentPct = (type === '投信' ? chips.trust : chips.dealer) || 0;
        history = daily.map(d => {
            const h = { date: d.date, val: currentPct };
            const netBuyShares = (type === '投信' ? d.trust : d.dealer) * 1000;
            currentPct -= (netBuyShares / sharesIssued) * 100;
            return h;
        }).reverse();
    }

    if (history.length === 0) {
        alert("暫無趨勢數據");
        return;
    }

    let overlay = document.getElementById('termExplainerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'termExplainerOverlay';
        overlay.className = 'term-explainer-overlay';
        const container = document.getElementById('analysisModal') || document.body;
        container.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    }

    const width = 360, height = 200, padding = 40;
    const sampling = history.length > 80 ? Math.ceil(history.length / 60) : 1;
    const sampled = history.filter((_, i) => i % sampling === 0);
    if (sampled[sampled.length-1].date !== history[history.length-1].date) sampled.push(history[history.length-1]);

    const values = sampled.map(d => d.val);
    const maxV = Math.max(...values, 0.1);
    const minV = Math.min(...values);
    const range = (maxV - minV) || 1;

    const points = sampled.map((d, i) => {
        const x = padding + (i / (sampled.length - 1)) * (width - 2 * padding);
        const y = (height - padding) - ((d.val - minV) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    const latestVal = history[history.length - 1].val;

    overlay.innerHTML = `
        <div class="term-explainer-content" style="max-width:420px; padding:25px;">
            <div class="term-explainer-close">&times;</div>
            <div class="term-explainer-badge" style="background:rgba(96,165,250,0.2); color:#60a5fa;">趨勢分析</div>
            <div class="term-explainer-title" style="font-size:20px; margin-bottom:5px;">${name} ${type}持股</div>
            <div style="font-size:11px; color:#64748b; margin-bottom:15px;">點擊或移動鼠標查看詳細比例</div>

            <div style="position:relative; background:rgba(255,255,255,0.03); border-radius:12px; padding:10px; border:1px solid rgba(255,255,255,0.05); margin-bottom:15px;">
                <svg id="trendSvg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible; cursor:crosshair;">
                    <!-- 網格線 -->
                    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                    <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="2,2" />
                    
                    <!-- 趨勢線 -->
                    <polyline points="${points}" fill="none" stroke="#60a5fa" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    
                    <!-- 互動層 -->
                    <g id="focusGroup" style="visibility:hidden;">
                        <line id="focusLineX" x1="0" y1="${padding}" x2="0" y2="${height - padding}" stroke="rgba(96,165,250,0.4)" stroke-width="1" stroke-dasharray="4,4" />
                        <circle id="focusPoint" r="5" fill="#60a5fa" stroke="#fff" stroke-width="2" />
                        <rect id="tooltipBg" x="0" y="0" width="85" height="35" rx="5" fill="rgba(15, 23, 42, 0.9)" stroke="#334155" stroke-width="1" />
                        <text id="tooltipTextDate" x="0" y="0" font-size="10" fill="#94a3b8" font-weight="bold"></text>
                        <text id="tooltipTextVal" x="0" y="0" font-size="12" fill="#fff" font-weight="900"></text>
                    </g>

                    <!-- X 軸標籤 -->
                    ${sampled.filter((_, i) => i % Math.ceil(sampled.length / 5) === 0 || i === sampled.length - 1).map((d, i, arr) => {
                        const x = padding + (sampled.indexOf(d) / (sampled.length - 1)) * (width - 2 * padding);
                        // 使用 YY/MM 格式避免重複
                        const label = d.date.substring(2, 7).replace('-', '/');
                        return `<text x="${x}" y="${height - 10}" font-size="9" fill="#64748b" text-anchor="middle">${label}</text>`;
                    }).join('')}
                </svg>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(59, 130, 246, 0.1); padding:12px; border-radius:10px; border:1px solid rgba(59, 130, 246, 0.2);">
                <div style="font-size:11px; color:#60a5fa;">目前持股比例</div>
                <div style="font-size:18px; font-weight:900; color:#fff;">${latestVal.toFixed(2)}%</div>
            </div>
            
            <div class="term-explainer-body" style="font-size:12px; opacity:0.7; margin-top:15px; line-height:1.6;">
                顯示該法人近一年的持有變化。${type !== '外資' ? '投信與自營商趨勢是由買賣超數據回推還原。' : '數據來自 FinMind 官方持股統計。'}
            </div>
        </div>
    `;

    const svg = document.getElementById('trendSvg');
    const focusGroup = document.getElementById('focusGroup');
    const focusLineX = document.getElementById('focusLineX');
    const focusPoint = document.getElementById('focusPoint');
    const tooltipBg = document.getElementById('tooltipBg');
    const tooltipTextDate = document.getElementById('tooltipTextDate');
    const tooltipTextVal = document.getElementById('tooltipTextVal');

    const updateFocus = (clientX) => {
        const rect = svg.getBoundingClientRect();
        const mouseX = (clientX - rect.left) * (width / rect.width);
        
        if (mouseX < padding || mouseX > width - padding) {
            focusGroup.style.visibility = 'hidden';
            return;
        }

        // 尋找最近的資料點
        const i = Math.round(((mouseX - padding) / (width - 2 * padding)) * (sampled.length - 1));
        const d = sampled[Math.max(0, Math.min(i, sampled.length - 1))];
        
        const x = padding + (sampled.indexOf(d) / (sampled.length - 1)) * (width - 2 * padding);
        const y = (height - padding) - ((d.val - minV) / range) * (height - 2 * padding);

        focusGroup.style.visibility = 'visible';
        focusLineX.setAttribute('x1', x);
        focusLineX.setAttribute('x2', x);
        focusPoint.setAttribute('cx', x);
        focusPoint.setAttribute('cy', y);

        // Tooltip 位置
        let tx = x + 10;
        let ty = y - 40;
        if (tx + 90 > width) tx = x - 95;
        if (ty < 5) ty = y + 20;

        tooltipBg.setAttribute('x', tx);
        tooltipBg.setAttribute('y', ty);
        tooltipTextDate.setAttribute('x', tx + 8);
        tooltipTextDate.setAttribute('y', ty + 12);
        tooltipTextDate.textContent = d.date;
        tooltipTextVal.setAttribute('x', tx + 8);
        tooltipTextVal.setAttribute('y', ty + 28);
        tooltipTextVal.textContent = d.val.toFixed(2) + '%';
    };

    svg.addEventListener('mousemove', (e) => updateFocus(e.clientX));
    svg.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) updateFocus(e.touches[0].clientX);
    }, {passive: true});
    svg.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) { e.preventDefault(); updateFocus(e.touches[0].clientX); }
    }, {passive: false});
    svg.addEventListener('mouseleave', () => { focusGroup.style.visibility = 'hidden'; });
    svg.addEventListener('touchend', () => { focusGroup.style.visibility = 'hidden'; });

    overlay.querySelector('.term-explainer-close').onclick = () => overlay.classList.remove('active');
    setTimeout(() => overlay.classList.add('active'), 10);
}

/**
 * 現金週期 (CCC) 多季趨勢折線圖 + 百科說明 + AI 診斷
 * 四條線：DSO(藍) / DIO(橘) / DPO(灰虛線) / CCC(紫)
 */
function showCCCTrendChart() {
    const fin = window._lastFinData;
    const name = window._lastChipsData?.stockName || '';
    if (!fin) return;
    const rawTrend = (fin.cccTrend || []).filter(d => d.dio > 0 || d.dso > 0);
    if (rawTrend.length < 2) { alert('CCC 趨勢數據不足'); return; }

    const latest = rawTrend[rawTrend.length - 1];
    const prev   = rawTrend.length >= 5 ? rawTrend[rawTrend.length - 5] : rawTrend[0];
    const cccCur = latest.ccc ?? 0, cccPrev = prev.ccc ?? 0;
    const cccDelta = cccCur - cccPrev;

    const width = 360, height = 210;
    const padL = 38, padR = 12, padT = 15, padB = 34;
    const W = width - padL - padR, H = height - padT - padB;

    const allVals = rawTrend.flatMap(d => [d.dio, d.dso, d.dpo, d.ccc ?? 0]).filter(v => v > 0);
    const maxV = Math.max(...allVals, 10) * 1.12;
    const minV = Math.min(...allVals.filter(v => v >= 0), 0);
    const range = (maxV - minV) || 1;
    const gx = (i) => padL + (i / Math.max(rawTrend.length - 1, 1)) * W;
    const gy = (v) => (height - padB) - ((v - minV) / range) * H;

    const mkPts = (key) => rawTrend.map((d, i) => `${gx(i)},${gy(d[key] ?? 0)}`).join(' ');
    const dsoP = mkPts('dso'), dioP = mkPts('dio'), dpoP = mkPts('dpo'), cccP = mkPts('ccc');

    const nTicks = 4;
    const step = range / nTicks;
    const yTicks = Array.from({ length: nTicks + 1 }, (_, i) => minV + step * i);
    const xIdxs = (() => {
        const step = Math.ceil(rawTrend.length / 5);
        const acc = [];
        for (let i = 0; i < rawTrend.length; i++) {
            if (i % step === 0) acc.push(i);
        }
        const last = rawTrend.length - 1;
        if (acc[acc.length - 1] !== last) {
            if (last - acc[acc.length - 1] < Math.ceil(step / 2)) {
                acc[acc.length - 1] = last;
            } else {
                acc.push(last);
            }
        }
        return acc;
    })();

    // AI 診斷文字
    const diagParts = [];
    const dsoChg = latest.dso - prev.dso, dioChg = latest.dio - prev.dio, dpoChg = latest.dpo - prev.dpo;
    if (Math.abs(cccDelta) < 3) {
        diagParts.push(`近 ${rawTrend.length >= 5 ? 4 : rawTrend.length - 1} 季 CCC 維持穩定（${cccCur.toFixed(1)} 天），現金轉換效率無明顯惡化。`);
    } else if (cccDelta > 0) {
        diagParts.push(`⚠️ CCC 近期拉長 +${cccDelta.toFixed(1)} 天，資金占用加重。`);
        if (dsoChg > 3)  diagParts.push(`應收帳款天數 (DSO) 增加 +${dsoChg.toFixed(1)} 天，收款效率下滑。`);
        if (dioChg > 3)  diagParts.push(`存貨週轉天數 (DIO) 增加 +${dioChg.toFixed(1)} 天，庫存積壓風險上升。`);
        if (dpoChg < -3) diagParts.push(`應付帳款天數 (DPO) 縮短 ${dpoChg.toFixed(1)} 天，對供應商議價能力減弱。`);
    } else {
        diagParts.push(`✅ CCC 改善 ${cccDelta.toFixed(1)} 天，現金轉換效率提升。`);
        if (dsoChg < -3)  diagParts.push(`應收帳款天數縮短 ${dsoChg.toFixed(1)} 天，收款加速。`);
        if (dioChg < -3)  diagParts.push(`存貨週轉天數縮短 ${dioChg.toFixed(1)} 天，庫存去化良好。`);
        if (dpoChg > 3)   diagParts.push(`應付帳款天數拉長 +${dpoChg.toFixed(1)} 天，供應商付款談判能力增強。`);
    }
    const diagText = diagParts.join(' ');

    let badgeColor = '#a855f7';
    if (cccCur < 30)       badgeColor = '#10b981';
    else if (cccCur < 60)  badgeColor = '#3b82f6';
    else if (cccCur < 100) badgeColor = '#fbbf24';
    else                   badgeColor = '#ef4444';

    let overlay = document.getElementById('termExplainerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'termExplainerOverlay';
        overlay.className = 'term-explainer-overlay';
        (document.getElementById('analysisModal') || document.body).appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    }

    overlay.innerHTML = `
        <div class="term-explainer-content" style="max-width:430px; padding:22px 20px;">
            <div class="term-explainer-close">&times;</div>
            <div class="term-explainer-badge" style="background:rgba(168,85,247,0.15); color:#c084fc;">營運效率</div>
            <div class="term-explainer-title" style="font-size:17px; margin-bottom:2px;">${name} 現金轉換週期 (CCC) 多季趨勢</div>
            <div style="font-size:11px; color:#64748b; margin-bottom:12px;">共 ${rawTrend.length} 季資料 · 單位：天</div>

            <!-- 最新四指標 -->
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:7px; margin-bottom:12px;">
                ${[['DSO','dso','#3b82f6','應收天數'],['DIO','dio','#f97316','存貨天數'],['DPO','dpo','#94a3b8','應付天數'],['CCC','ccc','#c084fc','現金週期']].map(([label,key,color,sub]) => `
                <div style="background:rgba(255,255,255,0.04); border:1px solid ${color}33; border-radius:8px; padding:6px 8px; text-align:center;">
                    <div style="font-size:9px; color:#94a3b8; margin-bottom:1px;">${sub}</div>
                    <div style="font-size:15px; font-weight:800; color:${color};">${(latest[key] ?? 0).toFixed(1)}</div>
                    <div style="font-size:9px; color:#64748b;">${label}</div>
                </div>`).join('')}
            </div>

            <!-- 折線圖 -->
            <div style="background:rgba(255,255,255,0.02); border-radius:10px; padding:8px; border:1px solid rgba(255,255,255,0.06); margin-bottom:10px;">
                <svg id="cccSvg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block; overflow:visible; cursor:crosshair;">
                    ${yTicks.map(v => {
                        const y = gy(v);
                        return `<line x1="${padL}" y1="${y}" x2="${width-padR}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="${v===yTicks[0]?'0':'2,3'}"/>
                                <text x="${padL-3}" y="${y+3.5}" font-size="8" fill="#64748b" text-anchor="end">${Math.round(v)}</text>`;
                    }).join('')}
                    <line x1="${padL}" y1="${height-padB}" x2="${width-padR}" y2="${height-padB}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
                    <polyline points="${dpoP}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.6"/>
                    <polyline points="${dsoP}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
                    <polyline points="${dioP}" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
                    <polyline points="${cccP}" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <g id="cccFG" style="visibility:hidden;">
                        <line id="cccFL" x1="0" y1="${padT}" x2="0" y2="${height-padB}" stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="3,3"/>
                        <circle id="cccDso" r="3.5" fill="#3b82f6" stroke="#fff" stroke-width="1.2"/>
                        <circle id="cccDio" r="3.5" fill="#f97316" stroke="#fff" stroke-width="1.2"/>
                        <circle id="cccDpo" r="3"   fill="#94a3b8" stroke="#fff" stroke-width="1.2"/>
                        <circle id="cccCcc" r="4"   fill="#a855f7" stroke="#fff" stroke-width="1.5"/>
                        <rect id="cccTBg" x="0" y="0" width="118" height="66" rx="5" fill="rgba(15,23,42,0.93)" stroke="#334155" stroke-width="1"/>
                        <text id="cccTDate" x="0" y="0" font-size="9"  fill="#94a3b8" font-weight="bold"/>
                        <text id="cccTDso"  x="0" y="0" font-size="9.5" fill="#93c5fd"/>
                        <text id="cccTDio"  x="0" y="0" font-size="9.5" fill="#fb923c"/>
                        <text id="cccTDpo"  x="0" y="0" font-size="9.5" fill="#94a3b8"/>
                        <text id="cccTCcc"  x="0" y="0" font-size="10" fill="#d8b4fe" font-weight="800"/>
                    </g>
                    ${xIdxs.map(i => {
                        const raw = rawTrend[i].date || '';
                        // 格式如 2024-03-31 → 24/03，移除 Q 字樣
                        const lbl = raw.replace(/^(\d{2})(\d{2})[-/](\d{1,2}).*/, '$1$2/$3') ||
                                    raw.slice(2, 5).replace('-', '/');
                        return `<text x="${gx(i)}" y="${height-padB+13}" font-size="9" fill="#64748b" text-anchor="middle">${lbl}</text>`;
                    }).join('')}
                </svg>
            </div>
            <!-- 圖例 -->
            <div style="display:flex; flex-wrap:wrap; gap:10px 16px; font-size:10px; color:#94a3b8; margin-bottom:12px; padding:0 4px;">
                <span><span style="color:#3b82f6;">─</span> DSO 應收</span>
                <span><span style="color:#f97316;">─</span> DIO 存貨</span>
                <span><span style="color:#94a3b8; opacity:.7;">╌</span> DPO 應付</span>
                <span><span style="color:#a855f7; font-weight:700;">─</span> CCC 現金週期</span>
            </div>

            <!-- 百科說明 -->
            <div style="background:rgba(168,85,247,0.06); border:1px solid rgba(168,85,247,0.2); border-radius:10px; padding:12px; margin-bottom:10px;">
                <div style="font-size:11px; font-weight:700; color:#c084fc; margin-bottom:6px;">📖 什麼是 CCC？</div>
                <div style="font-size:11.5px; color:#cbd5e1; line-height:1.55;">
                    現金轉換週期（Cash Conversion Cycle）= DSO + DIO − DPO。
                    衡量公司從「付錢買原料」到「收回貨款」所需的天數。
                    天數越短代表資金周轉越快；若持續拉長，往往是財務壓力的早期訊號。
                </div>
                <div style="font-size:10px; color:#64748b; margin-top:6px;">判斷基準：&lt;30天 極佳 · 30–60天 良好 · 60–100天 正常 · >100天 偏長</div>
            </div>

            <!-- AI 診斷 -->
            <div style="background:${badgeColor}18; border:1px solid ${badgeColor}40; border-radius:10px; padding:12px;">
                <div style="font-size:11px; font-weight:700; color:${badgeColor}; margin-bottom:6px;">🔍 AI 智能診斷</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;">個股當前值：<span style="font-size:16px; font-weight:800; color:${badgeColor};">${cccCur.toFixed(1)} 天</span></div>
                <div style="font-size:12px; line-height:1.55; color:#e2e8f0;">${diagText}</div>
            </div>
        </div>
    `;

    overlay.classList.add('active');
    document.querySelector('.term-explainer-close').addEventListener('click', () => overlay.classList.remove('active'));

    // Tooltip 互動
    const svg = document.getElementById('cccSvg');
    const fg  = document.getElementById('cccFG');
    const _cccUpdate = (clientX) => {
        const rect = svg.getBoundingClientRect();
        const mx = (clientX - rect.left) * (width / rect.width);
        let ni = 0, md = Infinity;
        rawTrend.forEach((_, i) => { const dx = Math.abs(gx(i) - mx); if (dx < md) { md = dx; ni = i; } });
        const pt = rawTrend[ni];
        const x = gx(ni);
        fg.style.visibility = 'visible';
        document.getElementById('cccFL').setAttribute('x1', x); document.getElementById('cccFL').setAttribute('x2', x);
        [['cccDso','dso'],['cccDio','dio'],['cccDpo','dpo'],['cccCcc','ccc']].forEach(([id,k]) => {
            const el = document.getElementById(id);
            el.setAttribute('cx', x); el.setAttribute('cy', gy(pt[k] ?? 0));
        });
        const tx = (x + 8 > width - 126) ? x - 126 : x + 8;
        const ty = Math.max(padT, gy(Math.max(pt.dso, pt.dio, pt.ccc ?? 0)) - 8);
        const bg = document.getElementById('cccTBg');
        bg.setAttribute('x', tx); bg.setAttribute('y', ty);
        [['cccTDate', 0, pt.date || '', '#94a3b8'],
         ['cccTDso',  1, `DSO: ${(pt.dso).toFixed(1)} 天`, '#93c5fd'],
         ['cccTDio',  2, `DIO: ${(pt.dio).toFixed(1)} 天`, '#fb923c'],
         ['cccTDpo',  3, `DPO: ${(pt.dpo).toFixed(1)} 天`, '#94a3b8'],
         ['cccTCcc',  4, `CCC: ${(pt.ccc ?? 0).toFixed(1)} 天`, '#d8b4fe']
        ].forEach(([id, row, txt]) => {
            const el = document.getElementById(id);
            el.setAttribute('x', tx + 5); el.setAttribute('y', ty + 13 + row * 13);
            el.textContent = txt;
        });
    };
    svg.addEventListener('mousemove', (e) => _cccUpdate(e.clientX));
    svg.addEventListener('touchstart', (e) => { if (e.touches.length > 0) _cccUpdate(e.touches[0].clientX); }, {passive: true});
    svg.addEventListener('touchmove', (e) => { if (e.touches.length > 0) { e.preventDefault(); _cccUpdate(e.touches[0].clientX); } }, {passive: false});
    svg.addEventListener('mouseleave', () => { fg.style.visibility = 'hidden'; });
    svg.addEventListener('touchend', () => { fg.style.visibility = 'hidden'; });
}

/**
 * 顯示集保大戶 vs 散戶持股比例雙線趨勢圖
 * 大戶(>400張)紅色，散戶(<50張)綠色，全期資料
 */
function showHolderTrendChart() {
    const chips = window._lastChipsData;
    if (!chips) return;
    const trend = (chips.holderTrend || []).filter(d =>
        d.large > 0 && d.large <= 100 && d.retail >= 0 && d.retail <= 100 && (d.large + d.retail) <= 100
    );
    if (trend.length === 0) { alert('暫無集保持股趨勢數據'); return; }

    const name = chips.stockName || '';
    const width = 360, height = 220;
    const padL = 38, padR = 12, padT = 18, padB = 32;
    const W = width - padL - padR, H = height - padT - padB;

    const sampling = trend.length > 80 ? Math.ceil(trend.length / 65) : 1;
    const sampled = trend.filter((_, i) => i % sampling === 0);
    if (sampled[sampled.length - 1].date !== trend[trend.length - 1].date) sampled.push(trend[trend.length - 1]);

    const allVals = sampled.flatMap(d => [d.large, d.retail]);
    const maxV = Math.max(...allVals, 0.1);
    const minV = Math.min(...allVals, 0);
    const range = (maxV - minV) || 1;

    const gx = (i) => padL + (i / Math.max(sampled.length - 1, 1)) * W;
    const gy = (v) => (height - padB) - ((v - minV) / range) * H;

    const lPts = sampled.map((d, i) => `${gx(i)},${gy(d.large)}`).join(' ');
    const rPts = sampled.map((d, i) => `${gx(i)},${gy(d.retail)}`).join(' ');

    const nTicks = 4;
    const yTicks = Array.from({ length: nTicks + 1 }, (_, i) => minV + (range / nTicks) * i);
    const xIdxs = sampled.reduce((acc, _, i) => {
        if (i % Math.ceil(sampled.length / 5) === 0 || i === sampled.length - 1) acc.push(i);
        return acc;
    }, []);

    const latest = trend[trend.length - 1];
    const prev4 = trend.length >= 5 ? trend[trend.length - 5] : trend[0];
    const ldiff = latest.large - prev4.large;
    const rdiff = latest.retail - prev4.retail;

    let overlay = document.getElementById('termExplainerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'termExplainerOverlay';
        overlay.className = 'term-explainer-overlay';
        (document.getElementById('analysisModal') || document.body).appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    }

    overlay.innerHTML = `
        <div class="term-explainer-content" style="max-width:420px; padding:22px 20px;">
            <div class="term-explainer-close">&times;</div>
            <div class="term-explainer-badge" style="background:rgba(239,68,68,0.15); color:#f87171;">籌碼趨勢</div>
            <div class="term-explainer-title" style="font-size:17px; margin-bottom:3px;">${name} 大戶 vs 散戶持股趨勢</div>
            <div style="font-size:11px; color:#64748b; margin-bottom:12px;">集保週報 · 共 ${trend.length} 期資料</div>

            <div style="display:flex; gap:10px; margin-bottom:12px;">
                <div style="flex:1; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:8px; padding:8px 10px;">
                    <div style="font-size:10px; color:#94a3b8; margin-bottom:2px;">大戶 (&gt;400張)</div>
                    <div style="font-size:20px; font-weight:800; color:#f87171;">${latest.large.toFixed(2)}%</div>
                    <div style="font-size:10px; color:${ldiff >= 0 ? '#f87171' : '#4ade80'};">4週 ${ldiff >= 0 ? '+' : ''}${ldiff.toFixed(2)}%</div>
                </div>
                <div style="flex:1; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.25); border-radius:8px; padding:8px 10px;">
                    <div style="font-size:10px; color:#94a3b8; margin-bottom:2px;">散戶 (&lt;50張)</div>
                    <div style="font-size:20px; font-weight:800; color:#4ade80;">${latest.retail.toFixed(2)}%</div>
                    <div style="font-size:10px; color:${rdiff >= 0 ? '#f87171' : '#4ade80'};">4週 ${rdiff >= 0 ? '+' : ''}${rdiff.toFixed(2)}%</div>
                </div>
            </div>

            <div style="position:relative; background:rgba(255,255,255,0.03); border-radius:12px; padding:8px; border:1px solid rgba(255,255,255,0.06); margin-bottom:10px;">
                <svg id="holderSvg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible; cursor:crosshair; display:block;">
                    ${yTicks.map(v => {
                        const y = gy(v);
                        return `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="${v === yTicks[0] ? '0' : '2,3'}"/>
                                <text x="${padL - 3}" y="${y + 3.5}" font-size="8" fill="#64748b" text-anchor="end">${v.toFixed(1)}</text>`;
                    }).join('')}
                    <line x1="${padL}" y1="${height - padB}" x2="${width - padR}" y2="${height - padB}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
                    <polyline points="${rPts}" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
                    <polyline points="${lPts}" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <g id="hFG" style="visibility:hidden;">
                        <line id="hFL" x1="0" y1="${padT}" x2="0" y2="${height - padB}" stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="3,3"/>
                        <circle id="hD1" r="4.5" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>
                        <circle id="hD2" r="4.5" fill="#10b981" stroke="#fff" stroke-width="1.5"/>
                        <rect id="hTBg" x="0" y="0" width="110" height="52" rx="5" fill="rgba(15,23,42,0.93)" stroke="#334155" stroke-width="1"/>
                        <text id="hTDate" x="0" y="0" font-size="9" fill="#94a3b8" font-weight="bold"/>
                        <text id="hTL"    x="0" y="0" font-size="10" fill="#f87171" font-weight="800"/>
                        <text id="hTR"    x="0" y="0" font-size="10" fill="#4ade80" font-weight="800"/>
                    </g>
                    ${xIdxs.map(i => `<text x="${gx(i)}" y="${height - padB + 13}" font-size="9" fill="#64748b" text-anchor="middle">${sampled[i].date.substring(2, 7).replace('-', '/')}</text>`).join('')}
                </svg>
            </div>

            <div style="display:flex; justify-content:center; gap:20px; font-size:11px; color:#94a3b8;">
                <span><span style="color:#ef4444; font-weight:700;">─</span> 大戶 (&gt;400張)</span>
                <span><span style="color:#10b981; font-weight:700;">─</span> 散戶 (&lt;50張)</span>
            </div>
        </div>
    `;

    overlay.classList.add('active');
    document.querySelector('.term-explainer-close').addEventListener('click', () => overlay.classList.remove('active'));

    // 互動 tooltip
    const svg    = document.getElementById('holderSvg');
    const fg     = document.getElementById('hFG');
    const fl     = document.getElementById('hFL');
    const d1     = document.getElementById('hD1');
    const d2     = document.getElementById('hD2');
    const tbg    = document.getElementById('hTBg');
    const tdate  = document.getElementById('hTDate');
    const tl     = document.getElementById('hTL');
    const tr_el  = document.getElementById('hTR');

    const _holderUpdate = (clientX) => {
        const rect = svg.getBoundingClientRect();
        const mx = (clientX - rect.left) * (width / rect.width);
        let ni = 0, md = Infinity;
        sampled.forEach((_, i) => { const dx = Math.abs(gx(i) - mx); if (dx < md) { md = dx; ni = i; } });
        const pt = sampled[ni];
        const x = gx(ni), y1 = gy(pt.large), y2 = gy(pt.retail);
        fg.style.visibility = 'visible';
        fl.setAttribute('x1', x); fl.setAttribute('x2', x);
        d1.setAttribute('cx', x); d1.setAttribute('cy', y1);
        d2.setAttribute('cx', x); d2.setAttribute('cy', y2);
        const tx = (x + 8 > width - 118) ? x - 118 : x + 8;
        const ty = Math.max(padT, Math.min(y1, y2) - 8);
        tbg.setAttribute('x', tx); tbg.setAttribute('y', ty);
        tdate.setAttribute('x', tx + 5); tdate.setAttribute('y', ty + 13); tdate.textContent = pt.date.substring(5);
        tl.setAttribute('x', tx + 5);   tl.setAttribute('y', ty + 28);   tl.textContent = `大戶: ${pt.large.toFixed(2)}%`;
        tr_el.setAttribute('x', tx + 5); tr_el.setAttribute('y', ty + 43); tr_el.textContent = `散戶: ${pt.retail.toFixed(2)}%`;
    };
    svg.addEventListener('mousemove', (e) => _holderUpdate(e.clientX));
    svg.addEventListener('touchstart', (e) => { if (e.touches.length > 0) _holderUpdate(e.touches[0].clientX); }, {passive: true});
    svg.addEventListener('touchmove', (e) => { if (e.touches.length > 0) { e.preventDefault(); _holderUpdate(e.touches[0].clientX); } }, {passive: false});
    svg.addEventListener('mouseleave', () => { fg.style.visibility = 'hidden'; });
    svg.addEventListener('touchend', () => { fg.style.visibility = 'hidden'; });
}

/**
 * 顯示月營收趨勢圖 (MoM/YoY)
 * @param {string} symbol 股票代號
 * @param {string} type 'MoM' 或 'YoY'
 */
function showRevenueTrendChart(symbol, type) {
    console.log(`[RevenueTrendChart] Triggered for ${symbol} - ${type}`);
    
    const revData = window._lastRevData;
    if (!revData || !revData.history) {
        alert("尚未載入營收歷史數據。\n這可能是因為舊有的快取資料不完整，請點擊右上方「重新整理」按鈕或重新搜尋該股，以抓取完整的趨勢紀錄。");
        return;
    }

    const name = window._lastChipsData?.stockName || symbol;
    const historyRaw = revData.history;
    const toNumber = (value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    };
    const getRevenue = (item) => toNumber(item?.revenue ?? item?.Revenue ?? 0);
    const getRevenueYear = (item) => toNumber(item?.revenue_year ?? (item?.date || '').slice(0, 4));
    const getRevenueMonth = (item) => toNumber(item?.revenue_month ?? (item?.date || '').slice(5, 7));
    
    // 計算趨勢歷史數據
    let trendHistory = [];
    historyRaw.forEach((item, index) => {
        const curRev = getRevenue(item);
        const itemYear = getRevenueYear(item);
        const itemMonth = getRevenueMonth(item);
        let val = 0;
        
        if (type === 'MoM') {
            const prev = historyRaw[index - 1];
            const preRev = prev ? getRevenue(prev) : 0;
            if (preRev > 0) {
                val = ((curRev - preRev) / preRev) * 100;
            } else {
                return; // 跳過無前期資料點
            }
        } else if (type === 'YoY') {
            // YoY (年增率)
            const ly = historyRaw.find(x => getRevenueYear(x) === itemYear - 1 && getRevenueMonth(x) === itemMonth);
            const lyRev = ly ? getRevenue(ly) : 0;
            if (lyRev > 0) {
                val = ((curRev - lyRev) / lyRev) * 100;
            } else {
                return; // 跳過無去年同期資料點
            }
        } else if (type === 'CumYoY') {
            // 累計年增率 (YTD YoY)
            const ytdData = historyRaw.filter(x => getRevenueYear(x) === itemYear && getRevenueMonth(x) <= itemMonth);
            const lyYtdData = historyRaw.filter(x => getRevenueYear(x) === itemYear - 1 && getRevenueMonth(x) <= itemMonth);
            
            if (lyYtdData.length === itemMonth) { // 確保去年同期數據完整
                const ytdSum = ytdData.reduce((s, x) => s + getRevenue(x), 0);
                const lyYtdSum = lyYtdData.reduce((s, x) => s + getRevenue(x), 0);
                if (lyYtdSum > 0) val = ((ytdSum - lyYtdSum) / lyYtdSum) * 100;
                else return;
            } else {
                return;
            }
        }
        
        trendHistory.push({
            date: `${itemYear}/${String(itemMonth).padStart(2, '0')}`,
            val: val,
            revenue: curRev
        });
    });

    // 僅顯示最近 24 個月數據以保持清晰
    if (trendHistory.length > 24) {
        trendHistory = trendHistory.slice(-24);
    }

    if (trendHistory.length === 0) {
        alert("暫無足夠趨勢數據 (需要至少兩期數據)");
        return;
    }

    let overlay = document.getElementById('termExplainerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'termExplainerOverlay';
        overlay.className = 'term-explainer-overlay';
        const container = document.getElementById('analysisModal') || document.body;
        container.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    }

    const width = 360, height = 200, padding = 40;
    const values = trendHistory.map(d => d.val);
    let maxV = Math.max(...values, 0);
    let minV = Math.min(...values, 0);
    
    // 增加一點邊距
    const absMax = Math.max(Math.abs(maxV), Math.abs(minV));
    if (absMax === 0) { maxV = 10; minV = -10; }
    else {
        maxV += absMax * 0.1;
        minV -= absMax * 0.1;
    }
    
    const range = (maxV - minV) || 1;

    const points = trendHistory.map((d, i) => {
        const x = padding + (i / (trendHistory.length - 1)) * (width - 2 * padding);
        const y = (height - padding) - ((d.val - minV) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    // 計算 0 軸位置
    const zeroY = (height - padding) - ((0 - minV) / range) * (height - 2 * padding);
    const latestVal = trendHistory[trendHistory.length - 1].val;

    overlay.innerHTML = `
        <div class="term-explainer-content" style="max-width:420px; padding:25px;">
            <div class="term-explainer-close">&times;</div>
            <div class="term-explainer-badge" style="background:rgba(16,185,129,0.2); color:#10b981;">營收趨勢</div>
            <div class="term-explainer-title" style="font-size:20px; margin-bottom:5px;">${name} 月營收 ${type === 'CumYoY' ? '累計年增' : type}</div>
            <div style="font-size:11px; color:#64748b; margin-bottom:15px;">顯示最近 24 個月的 ${type === 'MoM' ? '月增率' : (type === 'YoY' ? '年增率' : '累計年增率')} 變化</div>

            <div style="position:relative; background:rgba(255,255,255,0.03); border-radius:12px; padding:10px; border:1px solid rgba(255,255,255,0.05); margin-bottom:15px;">
                <svg id="revenueTrendSvg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible; cursor:crosshair;">
                    <!-- 背景網格與 0 軸 -->
                    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                    <line x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="4,2" />
                    
                    <!-- 趨勢路徑 -->
                    <polyline points="${points}" fill="none" stroke="${type === 'MoM' ? '#60a5fa' : (type === 'YoY' ? '#fbbf24' : '#f472b6')}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    
                    <!-- 互動層 -->
                    <g id="revFocusGroup" style="visibility:hidden;">
                        <line id="revFocusLineX" x1="0" y1="${padding}" x2="0" y2="${height - padding}" stroke="rgba(255,255,255,0.4)" stroke-width="1" stroke-dasharray="4,4" />
                        <circle id="revFocusPoint" r="5" fill="${type === 'MoM' ? '#60a5fa' : (type === 'YoY' ? '#fbbf24' : '#f472b6')}" stroke="#fff" stroke-width="2" />
                        <rect id="revTooltipBg" x="0" y="0" width="100" height="45" rx="5" fill="rgba(15, 23, 42, 0.95)" stroke="#334155" stroke-width="1" />
                        <text id="revTooltipDate" x="0" y="0" font-size="10" fill="#94a3b8" font-weight="bold"></text>
                        <text id="revTooltipVal" x="0" y="0" font-size="12" fill="#fff" font-weight="900"></text>
                        <text id="revTooltipRev" x="0" y="0" font-size="10" fill="#cbd5e1"></text>
                    </g>

                    <!-- X 軸標籤 -->
                    ${trendHistory.filter((_, i) => i % 6 === 0 || i === trendHistory.length - 1).map((d) => {
                        const x = padding + (trendHistory.indexOf(d) / (trendHistory.length - 1)) * (width - 2 * padding);
                        return `<text x="${x}" y="${height - 10}" font-size="9" fill="#64748b" text-anchor="middle">${d.date.substring(2)}</text>`;
                    }).join('')}
                </svg>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(16, 185, 129, 0.1); padding:12px; border-radius:10px; border:1px solid rgba(16, 185, 129, 0.2);">
                <div style="font-size:11px; color:#10b981;">最新 ${type === 'CumYoY' ? '累計年增' : type}</div>
                <div style="font-size:18px; font-weight:900; color:#fff;">${latestVal > 0 ? '+' : ''}${latestVal.toFixed(2)}%</div>
            </div>
            
            <div class="term-explainer-body" style="font-size:12px; opacity:0.7; margin-top:15px; line-height:1.6;">
                ${type === 'MoM' ? '月增率 (MoM) 反映短期動能。' : (type === 'YoY' ? '年增率 (YoY) 觀察成長性。' : '累計年增率反映年初至今的營收累積相對於去年同期的成長，能有效平滑單月波動，是判斷年度業績達標率的重要參考。')}
            </div>

        </div>
    `;

    const svg = document.getElementById('revenueTrendSvg');
    const focusGroup = document.getElementById('revFocusGroup');
    const focusLineX = document.getElementById('revFocusLineX');
    const focusPoint = document.getElementById('revFocusPoint');
    const tooltipBg = document.getElementById('revTooltipBg');
    const tooltipDate = document.getElementById('revTooltipDate');
    const tooltipVal = document.getElementById('revTooltipVal');
    const tooltipRev = document.getElementById('revTooltipRev');

    const updateFocus = (clientX) => {
        const rect = svg.getBoundingClientRect();
        const mouseX = (clientX - rect.left) * (width / rect.width);
        
        if (mouseX < padding || mouseX > width - padding) {
            focusGroup.style.visibility = 'hidden';
            return;
        }

        const i = Math.round(((mouseX - padding) / (width - 2 * padding)) * (trendHistory.length - 1));
        const d = trendHistory[Math.max(0, Math.min(i, trendHistory.length - 1))];
        
        const x = padding + (trendHistory.indexOf(d) / (trendHistory.length - 1)) * (width - 2 * padding);
        const y = (height - padding) - ((d.val - minV) / range) * (height - 2 * padding);

        focusGroup.style.visibility = 'visible';
        focusLineX.setAttribute('x1', x);
        focusLineX.setAttribute('x2', x);
        focusPoint.setAttribute('cx', x);
        focusPoint.setAttribute('cy', y);

        let tx = x + 10;
        let ty = y - 50;
        if (tx + 110 > width) tx = x - 115;
        if (ty < 5) ty = y + 20;

        tooltipBg.setAttribute('x', tx);
        tooltipBg.setAttribute('y', ty);
        tooltipDate.setAttribute('x', tx + 8);
        tooltipDate.setAttribute('y', ty + 12);
        tooltipDate.textContent = d.date;
        tooltipVal.setAttribute('x', tx + 8);
        tooltipVal.setAttribute('y', ty + 28);
        const color = d.val > 0 ? '#ff4d4f' : (d.val < 0 ? '#52c41a' : '#fff');
        tooltipVal.innerHTML = `<tspan fill="${color}">${type}: ${d.val > 0 ? '+' : ''}${d.val.toFixed(2)}%</tspan>`;
        tooltipRev.setAttribute('x', tx + 8);
        tooltipRev.setAttribute('y', ty + 40);
        tooltipRev.textContent = `營收: ${Math.round(d.revenue/1000000).toLocaleString()} 百萬`;
    };

    svg.addEventListener('mousemove', (e) => updateFocus(e.clientX));
    svg.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) updateFocus(e.touches[0].clientX);
    }, {passive: true});
    svg.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) { e.preventDefault(); updateFocus(e.touches[0].clientX); }
    }, {passive: false});
    svg.addEventListener('mouseleave', () => { focusGroup.style.visibility = 'hidden'; });
    svg.addEventListener('touchend', () => { focusGroup.style.visibility = 'hidden'; });

    overlay.querySelector('.term-explainer-close').onclick = () => overlay.classList.remove('active');
    setTimeout(() => overlay.classList.add('active'), 10);
}

function showEPSTrendChart(symbol) {
    const finData = window._lastFinData;
    if (!finData || !finData.epsTrendFull) {
        alert("尚未載入財報歷史數據，請重新分析。");
        return;
    }

    const name = window._lastChipsData?.stockName || symbol;
    
    const getQ = (dateStr) => {
        const m = dateStr.substring(5, 7);
        const yr = dateStr.substring(2, 4);
        if (m === '01' || m === '02' || m === '03') return yr + 'Q1';
        if (m === '04' || m === '05' || m === '06') return yr + 'Q2';
        if (m === '07' || m === '08' || m === '09') return yr + 'Q3';
        if (m === '10' || m === '11' || m === '12') return yr + 'Q4';
        return yr + 'Q?';
    };

    let fullHistory = finData.epsTrendFull.map((d, i, arr) => {
        const prev = arr[i - 1];
        let growth = null;
        if (prev && prev.eps !== 0) growth = ((d.eps - prev.eps) / Math.abs(prev.eps)) * 100;
        return { date: d.date, displayDate: getQ(d.date), val: d.eps, growth };
    });
    
    let trendHistory = fullHistory.slice(-12);
    const annualData = (finData.annualEpsTrend || []).map((d, i, arr) => {
        const prev = arr[i - 1];
        let growth = null;
        if (prev && prev.eps !== 0) growth = ((d.eps - prev.eps) / Math.abs(prev.eps)) * 100;
        return { ...d, growth };
    });

    let overlay = document.getElementById('termExplainerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'termExplainerOverlay';
        overlay.className = 'term-explainer-overlay';
        const container = document.getElementById('analysisModal') || document.body;
        container.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
    }

    const width = 360, height = 180, padding = 40;
    const values = trendHistory.map(d => d.val);
    let maxV = Math.max(...values, 0.1);
    let minV = Math.min(...values, -0.1);
    const range = (maxV - minV) || 1;
    const zeroY = (height - padding) - ((0 - minV) / range) * (height - 2 * padding);
    const points = trendHistory.map((d, i) => {
        const x = padding + (i / (trendHistory.length - 1)) * (width - 2 * padding);
        const y = (height - padding) - ((d.val - minV) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    overlay.innerHTML = `
        <div class="term-explainer-content" style="max-width:420px; padding:25px;">
            <div class="term-explainer-close">&times;</div>
            <div class="term-explainer-badge" style="background:rgba(59,130,246,0.2); color:#3b82f6;">財報趨勢分析</div>
            <div class="term-explainer-title" style="font-size:22px; margin-bottom:5px;">${name} EPS 成長動能</div>
            
            <div style="font-size:13px; color:#cbd5e1; margin-bottom:10px; margin-top:20px;">📈 單季 EPS 趨勢 (最近 12 季)</div>
            <div style="position:relative; background:rgba(255,255,255,0.03); border-radius:12px; padding:10px; border:1px solid rgba(255,255,255,0.05); margin-bottom:20px;">
                <svg id="epsTrendSvg" width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible; cursor:crosshair;">
                    <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
                    <line x1="${padding}" y1="${zeroY}" x2="${width - padding}" y2="${zeroY}" stroke="rgba(255,255,255,0.3)" stroke-width="1" stroke-dasharray="4,2" />
                    <polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                    ${trendHistory.map((d, i) => {
                        const x = padding + (i / (trendHistory.length - 1)) * (width - 2 * padding);
                        const y = (height - padding) - ((d.val - minV) / range) * (height - 2 * padding);
                        return `
                            <circle cx="${x}" cy="${y}" r="3" fill="#3b82f6" />
                            ${(i % 3 === 0 || i === trendHistory.length - 1) ? `<text x="${x}" y="${height - 10}" font-size="10" fill="#64748b" text-anchor="middle">${d.displayDate}</text>` : ''}
                        `;
                    }).join('')}
                    <g id="epsFocus" style="visibility:hidden;">
                        <line id="epsFocusLine" y1="${padding}" y2="${height-padding}" stroke="white" stroke-width="1" stroke-dasharray="3,3" />
                        <circle id="epsFocusDot" r="6" fill="#3b82f6" stroke="white" stroke-width="2" />
                        <rect id="epsTipBg" rx="6" width="110" height="55" fill="rgba(15,23,42,0.95)" stroke="rgba(255,255,255,0.2)" />
                        <text id="epsTipDate" font-size="14" fill="#94a3b8" x="8" y="20"></text>
                        <text id="epsTipVal" font-size="16" fill="white" font-weight="bold" x="8" y="42"></text>
                    </g>
                </svg>
            </div>

            <div style="font-size:13px; color:#cbd5e1; margin-bottom:10px;">📊 年度 EPS 統計 (Annual)</div>
            <div style="position:relative; background:rgba(255,255,255,0.02); border-radius:12px; padding:10px; border:1px solid rgba(255,255,255,0.05); margin-bottom:15px;">
                ${(() => {
                    if (annualData.length === 0) return '<div style="color:#64748b; font-size:12px; text-align:center; padding:20px;">無年度數據</div>';
                    const h = 120, p = 30;
                    const epsVals = annualData.map(d => d.eps);
                    const maxE = Math.max(...epsVals, 1), minE = Math.min(...epsVals, 0);
                    const rE = (maxE - minE) || 1;
                    const zeroY_e = (h - p) - ((0 - minE) / rE) * (h - 2 * p);
                    const barW = (width - 2 * p) / annualData.length * 0.7;
                    return `
                        <svg id="annualEpsSvg" width="100%" height="${h}" viewBox="0 0 ${width} ${h}" style="overflow:visible; cursor:crosshair;">
                            <line x1="${p}" y1="${zeroY_e}" x2="${width - p}" y2="${zeroY_e}" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
                            ${annualData.map((d, i) => {
                                const x = p + (i / annualData.length) * (width - 2 * p) + (barW / 2);
                                const bH = Math.abs(d.eps / rE * (h - 2 * p));
                                const y = d.eps >= 0 ? zeroY_e - bH : zeroY_e;
                                return `<rect x="${x - barW/2}" y="${y}" width="${barW}" height="${bH}" fill="${d.eps >= 0 ? '#ef4444' : '#10b981'}" rx="3" opacity="0.8" />
                                        <text x="${x}" y="${h - 5}" font-size="10" fill="#64748b" text-anchor="middle">${d.year}</text>`;
                            }).join('')}
                            <g id="annFocus" style="visibility:hidden;">
                                <rect id="annTipBg" rx="6" width="110" height="55" fill="rgba(15,23,42,0.95)" stroke="rgba(255,255,255,0.2)" />
                                <text id="annTipDate" font-size="14" fill="#94a3b8" x="8" y="20"></text>
                                <text id="annTipVal" font-size="16" fill="white" font-weight="bold" x="8" y="42"></text>
                            </g>
                        </svg>
                    `;
                })()}
            </div>
            <div style="font-size:12px; color:#64748b; line-height:1.6; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px;">
                💡 提示：紅色代表增長，綠色代表衰退。百分比為與上一期相比之變動率。
            </div>
        </div>
    `;

    const setupInteractive = (svgId, groupId, data, xFunc, yFunc, dateId, valId, bgId) => {
        const svg = document.getElementById(svgId);
        const group = document.getElementById(groupId);
        if (!svg || !group) return;
        const line = group.querySelector('line');
        const dot = group.querySelector('circle');
        const dateTxt = document.getElementById(dateId);
        const valTxt = document.getElementById(valId);
        const bg = document.getElementById(bgId);

        const update = (clientX) => {
            const rect = svg.getBoundingClientRect();
            const mouseX = (clientX - rect.left) * (width / rect.width);
            const p = (svgId === 'epsTrendSvg' ? padding : 30);
            if (mouseX < p || mouseX > width - p) { group.style.visibility = 'hidden'; return; }
            const i = Math.round(((mouseX - p) / (width - 2 * p)) * (data.length - 1));
            const d = data[Math.max(0, Math.min(i, data.length - 1))];
            const x = xFunc(d, i); const y = yFunc(d, i);
            group.style.visibility = 'visible';
            if (line) { line.setAttribute('x1', x); line.setAttribute('x2', x); }
            if (dot) { dot.setAttribute('cx', x); dot.setAttribute('cy', y); }
            
            let tx = x + 15; let ty = y - 60;
            if (tx + 120 > width) tx = x - 125;
            if (ty < 5) ty = y + 20;
            bg.setAttribute('x', tx); bg.setAttribute('y', ty);
            dateTxt.setAttribute('x', tx + 10); dateTxt.setAttribute('y', ty + 20);
            valTxt.setAttribute('x', tx + 10); valTxt.setAttribute('y', ty + 42);
            
            dateTxt.textContent = d.displayDate || d.year;
            const gText = d.growth !== null ? ` (${d.growth > 0 ? '+' : ''}${d.growth.toFixed(1)}%)` : '';
            const gColor = d.growth > 0 ? '#ff4d4f' : (d.growth < 0 ? '#52c41a' : '#fff');
            valTxt.innerHTML = `<tspan fill="white">${(d.val || d.eps).toFixed(2)}</tspan><tspan fill="${gColor}" font-size="12">${gText}</tspan>`;
        };
        svg.addEventListener('mousemove', (e) => update(e.clientX));
        svg.addEventListener('touchstart', (e) => { if (e.touches.length > 0) update(e.touches[0].clientX); }, {passive: true});
        svg.addEventListener('touchmove', (e) => { if (e.touches.length > 0) { e.preventDefault(); update(e.touches[0].clientX); } }, {passive: false});
        svg.addEventListener('mouseleave', () => group.style.visibility = 'hidden');
        svg.addEventListener('touchend', () => group.style.visibility = 'hidden');
    };

    setupInteractive('epsTrendSvg', 'epsFocus', trendHistory, 
        (d, i) => padding + (i / (trendHistory.length - 1)) * (width - 2 * padding),
        (d, i) => (height - padding) - ((d.val - minV) / range) * (height - 2 * padding),
        'epsTipDate', 'epsTipVal', 'epsTipBg'
    );

    if (annualData.length > 0) {
        const epsVals = annualData.map(d => d.eps);
        const maxE = Math.max(...epsVals, 1), minE = Math.min(...epsVals, 0), rE = (maxE - minE) || 1;
        const h = 120, p = 30;
        const zeroY_e = (h - p) - ((0 - minE) / rE) * (h - 2 * p);
        const barW = (width - 2 * p) / annualData.length * 0.7;
        setupInteractive('annualEpsSvg', 'annFocus', annualData,
            (d, i) => p + (i / annualData.length) * (width - 2 * p) + (barW / 2),
            (d, i) => d.eps >= 0 ? zeroY_e - Math.abs(d.eps / rE * (h - 2 * p)) : zeroY_e,
            'annTipDate', 'annTipVal', 'annTipBg'
        );
    }

    overlay.querySelector('.term-explainer-close').onclick = () => overlay.classList.remove('active');
    setTimeout(() => overlay.classList.add('active'), 10);
}
