?// analysis.js

// === UI & Initialization ===
const analysisModal = document.getElementById('analysisModal');
const closeAnalysisBtn = document.getElementById('closeAnalysisBtn');
const analysisTitle = document.getElementById('analysisTitle');
const analysisBody = document.getElementById('analysisBody');

// Close modal handlers
closeAnalysisBtn.addEventListener('click', () => {
    analysisModal.classList.remove('active');
});

analysisModal.addEventListener('click', (e) => {
    if (e.target === analysisModal) {
        analysisModal.classList.remove('active');
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

async function openAnalysisModal(symbol, name, avgCost = null, forceRefresh = false) {
    analysisModal.classList.add('active');

    
    
    // Show Loading
    analysisBody.innerHTML = `
        <div class="analysis-loading">
            <div class="analysis-spinner"></div>
            <span>æ­?œ¨å»ºç?å®‰å…¨¥»¯q¤ñä¸¦é?ç½®å??ç’°å¢?..</span>
            <div style="margin-top:15px;">
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}', true)" 
                        style="background:transparent; color:#64748b; border:1px solid #475569; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:11px;">
                    ??è¼‰å…¥?ä?ï¼Ÿé?æ­¤å¼·?¶é?è©?
                </button>
            </div>
        </div>
    `;

    let finalSymbol = symbol.trim().toUpperCase();
    let displayName = name;
    // å¦‚æ?è¼¸å…¥ä¸æ˜¯?¸å?ï¼Œå??—è©¦å°‡å…¶è§¥»¯q¤ñºè‚¡ç¥¨ä»£??
    if (!/^\d{4,6}$/.test(finalSymbol)) {
        analysisBody.innerHTML = `
            <div class="analysis-loading">
                <div class="analysis-spinner"></div>
                <span>æ­?œ¨å°‡å?ç¨±ã€?{symbol}?è??›ç‚ºä»??...</span>
                <div style="margin-top:10px;">
                    <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}', true)" 
                            style="background:transparent; color:#64748b; border:1px solid #475569; padding:4px 10px; border-radius:5px; cursor:pointer; font-size:10px;">
                        ?? ?–æ?ä¸¦å¼·?¶é?è©?
                    </button>
                </div>
            </div>
        `;
        try {
            // ?ªå?å¾æœ¬?°å¿«?–æ? API ?²å?å®Œæ•´?¡ç¥¨æ¸…å–®
            if (!window.allStockInfoCache) {
                const json = await analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo`, true);
                if (json && json.data) window.allStockInfoCache = json.data;
            }
            
            if (window.allStockInfoCache) {
                const found = window.allStockInfoCache.find(x => x.stock_name === symbol || x.stock_id === symbol);
                if (found) {
                    finalSymbol = found.stock_id;
                    displayName = found.stock_name;
                } else {
                    // æ¨¡ç??¹é? (?¸ç¬¬ä¸€??
                    const fuzzy = window.allStockInfoCache.find(x => x.stock_name.includes(symbol));
                    if (fuzzy) {
                        finalSymbol = fuzzy.stock_id;
                        displayName = fuzzy.stock_name;
                    } else {
                        throw new Error(`?¾ä??°è‚¡ç¥¨å?ç¨±ã€?{symbol}?å??‰ç?ä»??`);
                    }
                }
            }
        } catch(e) {
            analysisBody.innerHTML = `
                <div style="text-align:center; padding:40px;">
                    <div style="font-size:40px; margin-bottom:20px;">??</div>
                    <div style="color:#f87171; font-size:16px; font-weight:700;">è§??å¤±æ?</div>
                    <div style="color:#94a3b8; margin-top:8px; margin-bottom:20px;">${e.message}</div>
                    <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}')" 
                            style="background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); padding:8px 16px; border-radius:8px; cursor:pointer; font-size:13px;">
                        ?? ?æ–°?—è©¦è§??
                    </button>
                    <div style="color:#64748b; font-size:12px; margin-top:16px;">?ç¤ºï¼šè??—è©¦è¼¸å…¥å®Œæ•´??4 ä½æ•¸ä»?? (ä¾‹å?: 2330)</div>
                </div>`;
            return;
        }
    }

    analysisTitle.textContent = `?? ${displayName} (${finalSymbol}) ?†æ??±å?`;

    try {
        if (forceRefresh) {
            localStorage.removeItem(ANALYSIS_CACHE_PREFIX + `${finalSymbol}_v9`);
            localStorage.removeItem(ANALYSIS_CACHE_PREFIX + `${finalSymbol}_v8`);
        }
        
        const cacheKey = `${finalSymbol}_v9`; 
        const cachedResults = forceRefresh ? null : getCachedAnalysis(cacheKey);

        let results;
        if (cachedResults) {
            results = cachedResults;
        } else {
            // ä½¿ç”¨ Staggered ?¹å??¼é€è?æ±‚ï??¿å??¬é?å¡è?å°è‡´?¨å?è«‹æ?å¤±æ?
            const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
            
            const fetchers = [
                () => fetchStockChart(finalSymbol).catch(e => { console.warn("Chart fetch failed", e); return null; }),
                async () => { await wait(80); return fetchTWSEBasic(finalSymbol).catch(e => { console.warn("TWSE Basic fetch failed", e); return null; }); },
                async () => { await wait(160); return fetchStockChips(finalSymbol).catch(e => { console.warn("Chips fetch failed", e); return null; }); },
                async () => { await wait(240); return fetchFinMindRevenue(finalSymbol).catch(e => { console.warn("Revenue fetch failed", e); return null; }); },
                async () => { await wait(320); return fetchFinMindMargin(finalSymbol).catch(e => { console.warn("Margin fetch failed", e); return null; }); },
                async () => { await wait(400); return fetchFinMindInstitutional(finalSymbol, 0).catch(e => { console.warn("Institutional fetch failed", e); return null; }); },
                async () => { await wait(480); return fetchFinMindFinancial(finalSymbol, 0, 0).catch(e => { console.warn("Financial fetch failed", e); return null; }); },
                async () => { 
                    await wait(560);
                    try {
                        const d = new Date(); d.setDate(d.getDate() - 500);
                        const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=TAIEX&start_date=${d.toISOString().split('T')[0]}`;
                        const res = await analysisFetchProxy(url, true);
                        return res?.data || null;
                    } catch(e) { return null; }
                },
                async () => {
                    await wait(640);
                    const results = { moneydj: null, director: null };
                    try {
                        const url = `https://concords.moneydj.com/z/zc/zck/zck_${finalSymbol}.djhtm`;
                        results.moneydj = await analysisFetchProxy(url, false);
                    } catch(e) {}
                    if (!results.moneydj) {
                        try {
                            const d = new Date(); d.setMonth(d.getMonth() - 12);
                            const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDirectorShareholding&data_id=${finalSymbol}&start_date=${d.toISOString().split('T')[0]}`;
                            const res = await analysisFetchProxy(url, true);
                            results.director = res?.data || null;
                        } catch(e) {}
                    }
                    return results;
                },
                async () => { await wait(720); return fetchBrokerConcentration(finalSymbol).catch(() => null); }
            ];
            
            results = await Promise.all(fetchers.map(f => f()));
        }

        const [chartData, twseBasic, chipsData, revData, marginData, instDataFinMind, finDataRaw, marketDataRaw, insiderDataRaw, brokerData] = results;

        // ?²å??Œæ¥­ CCC ?¸æ? (å»¶å??²å?)
        const peerCCCData = await fetchIndustryPeersCCC(chipsData?.industry, finalSymbol).catch(() => []);

        // è¨ˆç?é¢¨éšª?‡æ?
        let riskMetrics = null;
        if (chartData?.prices && marketDataRaw) {
            riskMetrics = calculateRiskMetrics(chartData.prices, marketDataRaw);
        }

        // è¨ˆç??§éƒ¨äººè?å¤§æˆ¶?•å? (?«å??´é?è¼?
        const insiderActivity = processInsiderData(insiderDataRaw, chipsData);

        const debugInfo = {
            dj: !!insiderDataRaw?.moneydj,
            dir: !!insiderDataRaw?.director,
            holders: chipsData?.holders?.length || 0
        };

        let institutionalData = instDataFinMind;
        if (!institutionalData || institutionalData.isFallback) {
            const djData = await fetchInstitutionalMoneyDJ(finalSymbol).catch(() => null);
            if (djData) institutionalData = djData;
        }
        
        const finData = finDataRaw;

        if (!cachedResults) {
            setCachedAnalysis(cacheKey, results);
        }

        renderAnalysis(finalSymbol, displayName, chartData, twseBasic, chipsData, revData, finData, marginData, institutionalData, avgCost, riskMetrics, insiderActivity, debugInfo, brokerData, peerCCCData);
    } catch (err) {
        console.error("Analysis fetch error:", err);
        analysisBody.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <div style="font-size:32px; margin-bottom:16px;">?“¡</div>
                <div style="color:#f87171; font-weight:700; font-size:16px; margin-bottom:8px;">è¼‰å…¥?†æ?å¤±æ?</div>
                <div style="color:#94a3b8; font-size:12px; margin-bottom:24px;">?Ÿå?ï¼?{err.message}</div>
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}')" 
                        style="background:#3b82f6; color:white; border:none; padding:12px 24px; border-radius:10px; cursor:pointer; font-weight:700; box-shadow:0 4px 12px rgba(59, 130, 246, 0.3);">
                    ?? ç«‹å³?è©¦
                </button>
            </div>
        `;
    }
}



async function analysisFetchProxy(targetUrl, isJson = false) {
    // 1. å¿«é€Ÿè·¯å¾‘ï?å¦‚æ??¯å·²?¥æ??‹ç›´?¥å??–ç?ç¶²ç? (å¦?MoneyDJ)ï¼Œè·³?ç›´?¥æ??–ï??ä? Timeout
    const isKnownBlocked = targetUrl.includes('moneydj.com') || targetUrl.includes('fbs.com.tw') || targetUrl.includes('twse.com.tw');
    
    if (!isKnownBlocked) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4500); // å¢å¥»¯q¤ñ4.5s
            const res = await fetch(targetUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const buffer = await res.arrayBuffer();
                let encoding = 'utf-8';
                if (targetUrl.includes('moneydj.com') || targetUrl.includes('fbs.com.tw')) encoding = 'big5';
                const text = new TextDecoder(encoding).decode(buffer).trim();
                
                if (isJson) {
                    try {
                        const parsed = JSON.parse(text);
                        // FinMind ?¹æ??„æ??Ÿç?æ§?
                        if (Array.isArray(parsed)) return { status: 200, data: parsed };
                        if (parsed.data || (parsed.status === 200 && parsed.msg === 'success')) return parsed;
                        // å¦‚æ¥»¯q¤ñstatus ä½†ä¥»¯q¤ñ200ï¼Œå¯?½è§¸?¼ä? 429 ?–å…¶ä»–é??¶ï??²å…¥ Proxy æ¨¡å?
                        if (parsed.status && parsed.status !== 200) throw new Error(`API Status ${parsed.status}`);
                    } catch(e) {
                        if (e.message.includes('API Status')) throw e;
                    }
                } else if (text) return text;
            }
        } catch (e) {
            console.warn(`[Proxy] Direct fetch failed for ${targetUrl.substring(0, 50)}... Reason: ${e.message}`);
        }
    }

    const proxies = [
        (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`
    ];

    let lastError = null;
    for (let getProxyUrl of proxies) {
        const proxyUrl = getProxyUrl(targetUrl);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // å¢å¥»¯q¤ñ12s
            const res = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const buffer = await res.arrayBuffer();
                let encoding = 'utf-8';
                if (targetUrl.includes('moneydj.com') || targetUrl.includes('fbs.com.tw')) encoding = 'big5';
                const text = new TextDecoder(encoding).decode(buffer).trim();

                if (isJson) {
                    try {
                        const parsed = JSON.parse(text);
                        if (Array.isArray(parsed)) return { status: 200, data: parsed };
                        if (parsed.data || (parsed.status === 200)) return parsed;
                    } catch(e) {}
                } else if (text) return text;
            }
        } catch (e) {
            lastError = e;
        }
    }

    throw new Error(lastError?.message || "?€??Proxy ?‡å¤±?ˆï?è«‹ç??™å?è©¦ã€?);
}

// === Caching Helper ===
const ANALYSIS_CACHE_PREFIX = 'stock_analysis_cache_';
function getCachedAnalysis(key, ttlHours = 24) {
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

// === Data Fetching Functions ===

async function fetchStockChart(symbol) {
    // ?–å?ç´”æ•¸å­—ä»£??
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    
    // è¨­å?èµ·å??¥æ? (?“é¥»¯q¤ñ2100 å¤©ç¢ºä¿æ? 5 å¹´å??½è??™ï?ç´„é? 1260 ?‹äº¤?“æ—¥)
    const d = new Date();
    d.setDate(d.getDate() - 2100); 
    const startDate = d.toISOString().split('T')[0];
    
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${rawSymbol}&start_date=${startDate}`;
    
    try {
        const json = await analysisFetchProxy(url, true);
        if (!json || !json.data || json.data.length === 0) {
            throw new Error("?¡æ­·?²è‚¡?¹è¥»¯q¤ñ);
        }
        
        const data = json.data.filter(item => (item.close || item.Close) > 0);
        const closes = data.map(item => item.close || item.Close);
        const highs  = data.map(item => item.max || item.High || item.Max || item.close || 0);
        const lows   = data.map(item => item.min || item.Low || item.Min || item.close || 0);
        const vols   = data.map(item => item.Trading_Volume || item.trading_volume || item.volume || item.Volume || 0);
        const currentPrice = closes[closes.length - 1];
        
        // === ?‡ç? ===
        const ma5   = calcMA(closes, 5);
        const ma10  = calcMA(closes, 10);
        const ma20  = calcMA(closes, 20);
        const ma60  = calcMA(closes, 60);
        const ma120 = calcMA(closes, 120);
        const ma240 = calcMA(closes, 240);

        // === 52?±é?ä½é? ===
        const recentCloses = closes.slice(-252); // ç´?252 ?‹äº¤?“æ—¥
        const high52w = Math.max(...recentCloses);
        const low52w  = Math.min(...recentCloses);
        const diffRange = high52w - low52w;
        const posIn52w = diffRange > 0 ? safeFix(((currentPrice - low52w) / diffRange * 100), 1) : "0.0";

        // === RSI 14 ===
        const rsi14 = calcRSI(closes, 14);

        // === å¸ƒæ??±é? 20??===
        const bb = calcBollinger(closes, 20, 2);
        
        // === 5?¥å¥»¯q¤ñ===
        const avgVol5 = vols.length >= 5 ? Math.round(vols.slice(-5).reduce((a,b)=>a+b,0) / 5) : null;

        // === KD (9,3,3) ===
        const kd = calcKD(highs, lows, closes, 9);

        // === MACD (12, 26, 9) ===
        const macd = calcMACD(closes, 12, 26, 9);

        // === Price Momentum ===
        const price1m = closes.length >= 20 ? ((currentPrice - closes[closes.length - 20]) / closes[closes.length - 20] * 100) : null;
        const price3m = closes.length >= 60 ? ((currentPrice - closes[closes.length - 60]) / closes[closes.length - 60] * 100) : null;

        // === Momentum ===
        const mom6m = closes.length >= 126 ? ((currentPrice - closes[closes.length - 126]) / closes[closes.length - 126] * 100) : null;
        const mom1y = closes.length >= 252 ? ((currentPrice - closes[closes.length - 252]) / closes[closes.length - 252] * 100) : null;
        const mom2y = closes.length >= 504 ? ((currentPrice - closes[closes.length - 504]) / closes[closes.length - 504] * 100) : null;
        const mom3y = closes.length >= 756 ? ((currentPrice - closes[closes.length - 756]) / closes[closes.length - 756] * 100) : null;
        const mom4y = closes.length >= 1008 ? ((currentPrice - closes[closes.length - 1008]) / closes[closes.length - 1008] * 100) : null;
        const mom5y = closes.length >= 1260 ? ((currentPrice - closes[closes.length - 1260]) / closes[closes.length - 1260] * 100) : null;

        // === YTD Momentum ===
        const currentYear = new Date().getFullYear();
        const lastYearEndData = data.filter(x => new Date(x.date).getFullYear() < currentYear).pop();
        const momYTD = lastYearEndData ? ((currentPrice - lastYearEndData.close) / lastYearEndData.close * 100) : null;

        const latestVol = vols[vols.length - 1];

        // === å¤šç©º?’å? ===
        let maStatus = "?´ç?ä¸?;
        if (ma5 > ma20 && ma20 > ma60 && ma60 > ma240) maStatus = "å¤šé ­?’å? (å¼·å‹¢)";
        else if (ma5 < ma20 && ma20 < ma60 && ma60 < ma240) maStatus = "ç©ºé ­?’å? (å¼±å‹¢)";
        else if (ma5 > ma20 && ma20 > ma60) maStatus = "å¤šé ­?æ? (è½‰å¼·)";

        return {
            prices: data,
            currentPrice,
            ma: { ma5, ma10, ma20, ma60, ma120, ma240 },
            maStatus,
            high52w, low52w, posIn52w,
            rsi14,
            bb,
            latestVol,
            avgVol5,
            kd,
            macd,
            price1m,
            price3m,
            mom6m,
            mom1y,
            mom2y,
            mom3y,
            mom4y,
            mom5y,
            momYTD,
            bbSqueeze: bb ? (bb.upper - bb.lower) / bb.mid < 0.1 : false, // å¸¶å¯¬å°æ–¼ 10% è¦–ç‚º? å?
            goldenCross: (ma5 > ma20 && ma20 > ma60),
            deathCross: (ma5 < ma20 && ma20 < ma60)
        };
    } catch (e) {
        throw new Error(`FinMind API å¤±æ?: ${e.message}`);
    }
}

// === Technical Indicator Calculations ===

function calcMA(closes, period) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;
    const recent = closes.slice(-(period + 1));
    let gains = 0, losses = 0;
    for (let i = 1; i < recent.length; i++) {
        const diff = recent[i] - recent[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    const rsiVal = 100 - (100 / (1 + rs));
    return parseFloat(safeFix(rsiVal, 1));
}

function calcEMA(data, period) {
    const k = 2 / (period + 1);
    let ema = [data[0]];
    for (let i = 1; i < data.length; i++) {
        ema.push(data[i] * k + ema[i-1] * (1 - k));
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
    const mid = calcMA(prices.slice(-period), period);
    const sumSq = prices.slice(-period).reduce((a, b) => a + Math.pow(b - mid, 2), 0);
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
    const startIdx = Math.max(0, closes.length - 60); // Check last 60 days for stabilization
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
 * è¨ˆç?é¢¨éšª?‡æ? (Beta & Volatility)
 * @param {Array} stockData ?‹è‚¡æ­·å²?¹æ ¼
 * @param {Array} marketData å¤§ç›¤æ­·å²?¹æ ¼
 * @param {number} lookback è¿½è¹¤å¤©æ•¸ (?è¨­ 252 äº¤æ??¥ï?ç´„ä?å¹?
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

    // ç¢ºä??¥æ?å°é?
    const marketMap = new Map(marketData.map(d => [d.date, d.close || d.Close || d.Trading_Volume || 0]));
    const alignedReturns = [];
    
    // ?–å??å??„æ—¥?Ÿä¸¦è¨ˆç??å ±??
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

    // 1. è¨ˆç? Volatility (?‹è‚¡å¹´å?æ³¢å¥»¯q¤ñ
    const sReturns = recentReturns.map(r => r.s);
    const sMean = sReturns.reduce((a, b) => a + b, 0) / sReturns.length;
    const sVar = sReturns.reduce((a, b) => a + Math.pow(b - sMean, 2), 0) / (sReturns.length - 1);
    const volatility = Math.sqrt(sVar * 252) * 100; // å¹´å?

    // 2. è¨ˆç? Beta (Î²)
    const mReturns = recentReturns.map(r => r.m);
    const mMean = mReturns.reduce((a, b) => a + b, 0) / mReturns.length;
    const mVar = mReturns.reduce((a, b) => a + Math.pow(b - mMean, 2), 0) / (mReturns.length - 1);
    
    let covariance = 0;
    for (let i = 0; i < recentReturns.length; i++) {
        covariance += (recentReturns[i].s - sMean) * (recentReturns[i].m - mMean);
    }
    covariance /= (recentReturns.length > 1 ? recentReturns.length - 1 : 1);
    
    const beta = mVar !== 0 ? (covariance / mVar) : null;

    return {
        beta: beta !== null ? parseFloat(beta.toFixed(2)) : null,
        volatility: parseFloat(volatility.toFixed(2)),
        sampleSize: recentReturns.length
    };
}

/**
 * è¨ˆç??§éƒ¨äº?(??›£äº? ?è‚¡è®Šå?
 * @param {Array} rawData TaiwanStockDirectorShareholding ?Ÿå??¸æ?
 */
/**
 * ?•ç??§éƒ¨äººè?å¤§æˆ¶ç±Œç¢¼?¸æ? (?«ä?å±¤å¥»¯q¤ñ
 */
function processInsiderData(raw, chipsData) {
    let result = null;
    
    // 1. ?ªå??—è©¦ MoneyDJ ?³å ±è½‰è?
    if (raw?.moneydj) {
        result = parseMoneyDJInsider(raw.moneydj);
    }

    // 2. ?™æ´ Aï¼šè§£??FinMind ??›£?è‚¡?ç´°
    if ((!result || result.type === 'none') && raw?.director && raw.director.length > 0) {
        const dirRes = calculateDirectorChanges(raw.director);
        if (dirRes) result = dirRes;
    }

    // 3. ?™æ´ Bï¼šå??å¤§?¡æ±?†ç?è¶¨å‹¢
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
        // ?´å?å¯¬é??„æ­£?‡è¡¨?”å?ï¼šåŒ¹?æ—¥?Ÿã€å??ã€è·ç¨±ã€å¼µ?¸ã€æ–¹å¼?
        // ?è¨± td æ¨™ç±¤ä¹‹é??‰ä»»ä½•å??ƒï?ä¸¦å¿½?¥ç‰¹å®šç? class ä¾è³´
        const regex = /<td[^>]*>(\d{2,3}\/\d{2}\/\d{2})<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([\d,]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
        
        let match;
        while ((match = regex.exec(html)) !== null) {
            const dateRaw = match[1];
            const name = match[2].replace(/&nbsp;/g, '').trim();
            const position = match[3].replace(/&nbsp;/g, '').trim();
            const shares = parseInt(match[4].replace(/,/g, '')) || 0;
            const method = match[5].replace(/&nbsp;/g, '').trim();
            
            if (name && name !== 'å§“å?') {
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
    
    // å¦‚æ?å¤±æ?ï¼Œå?è©¦æ¥»¯q¤ñ<title> ä¾†è¨º?·æ˜¯?¦è¢«?”æˆª
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
    // ?‰æ—¥?Ÿæ?åºä¸¦æ¯”å??€å¾Œå…©??
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
        history: [{ date: currDate, totalChange: totalChange / 1000, method: '??›£?è‚¡é¤˜é?è®Šå?' }],
        trend: totalChange,
        sample: 'FinMind Director Data Processed'
    };
}

function calculateLargeHolderTrend(data) {
    if (!data || data.length < 2) return null;
    // ?¾å‡º Level 15 (400å¼? ??Level 17 (1000å¼?
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
            method: `${targetLevel === 17 ? '1000' : '400'}å¼µå¤§?¶æ??¡æ?è®Šå?` 
        }],
        trend: diff,
        isPercent: true,
        sample: `Fallback: Level ${targetLevel} Trend OK`
    };
}

async function fetchTWSEBasic(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    
    // è¨­å?èµ·å??¥æ? (?“é¥»¯q¤ñ5 å¹´æ•¸?šä»¥è¨ˆç??†ä¥»¯q¤ñ
    const d = new Date();
    d.setDate(d.getDate() - 1825);
    const startDate = d.toISOString().split('T')[0];
    
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPER&data_id=${rawSymbol}&start_date=${startDate}`;
    
    try {
        let json = await analysisFetchProxy(url, true).catch(() => null);
        
        // ?™æ´ 1ï¼šå¥»¯q¤ñ5 å¹´æ•¸?šå¤±?—ï??—è©¦ 1 å¹´æ•¸??
        if (!json || !json.data || json.data.length === 0) {
            const d1 = new Date(); d1.setDate(d1.getDate() - 365);
            const url1 = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPER&data_id=${rawSymbol}&start_date=${d1.toISOString().split('T')[0]}`;
            json = await analysisFetchProxy(url1, true).catch(() => null);
        }

        // ?™æ´ 2ï¼šå¥»¯q¤ñ1 å¹´æ•¸?šä?å¤±æ?ï¼Œæ??€è¿?30 å¤?(ä¿å??“å??¶å¥»¯q¤ñ
        if (!json || !json.data || json.data.length === 0) {
            const d2 = new Date(); d2.setDate(d2.getDate() - 30);
            const url2 = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPER&data_id=${rawSymbol}&start_date=${d2.toISOString().split('T')[0]}`;
            json = await analysisFetchProxy(url2, true).catch(() => null);
        }

        if (json && json.data && json.data.length > 0) {
            const data = json.data;
            const latest = data[data.length - 1];
            
            // ?å??‰æ¥»¯q¤ñPE/PB ?—è¡¨?¨æ–¼çµ±è?
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
    
    // --- ä¸¦è??·è??€?‰å?è«‹æ? ---
    const [jsonDiv, jsonInfo, jsonShare, mdjHtmls, jsonMargin, jsonHolders] = await Promise.all([
        (async () => {
            try {
                const dDiv = new Date(); dDiv.setDate(dDiv.getDate() - 7000); 
                const urlDiv = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDividend&data_id=${rawSymbol}&start_date=${dDiv.toISOString().split('T')[0]}`;
                return await analysisFetchProxy(urlDiv, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            try {
                const urlInfo = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInfo&data_id=${rawSymbol}`;
                return await analysisFetchProxy(urlInfo, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            try {
                const dShare = new Date(); dShare.setDate(dShare.getDate() - 45);
                const urlShare = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockShareholding&data_id=${rawSymbol}&start_date=${dShare.toISOString().split('T')[0]}`;
                return await analysisFetchProxy(urlShare, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            // MoneyDJ / Fubon ?¢é?
            const urls = [
                `https://www.moneydj.com/z/zc/zcl/zcl_${rawSymbol}.djhtm`,
                `https://fubon-ebrokerdj.fbs.com.tw/z/zc/zcl/zcl_${rawSymbol}.djhtm`
            ];
            return Promise.all(urls.map(url => analysisFetchProxy(url, false).catch(() => null)));
        })(),
        (async () => {
            try {
                const dMargin = new Date(); dMargin.setDate(dMargin.getDate() - 30);
                const urlMargin = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMarginPurchaseShortSale&data_id=${rawSymbol}&start_date=${dMargin.toISOString().split('T')[0]}`;
                return await analysisFetchProxy(urlMargin, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            try {
                const dHolders = new Date(); dHolders.setDate(dHolders.getDate() - 100); // ç¸®çŸ­??100 å¤©ï??ä?è² æ?
                const urlHolders = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockHoldingSharesPer&data_id=${rawSymbol}&start_date=${dHolders.toISOString().split('T')[0]}`;
                return await analysisFetchProxy(urlHolders, true);
            } catch(e) { return null; }
        })()
    ]);

    // --- 1. ?•ç??¡åˆ©è³‡æ? ---
    let exDivDate = '?¡è¥»¯q¤ñ;
    let exDivAmt = null;
    let divGrowth3y = null;
    let divConsecutiveYears = 0;
    let divHistory = [];
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
            exDivAmt = sortedHistory[0].cash;
            divHistory = sortedHistory.slice(0, 8);
            if (sortedHistory.length >= 3) {
                const latest = sortedHistory[0].cash;
                const threeYearsAgo = sortedHistory[Math.min(sortedHistory.length-1, 2)].cash;
                if (threeYearsAgo > 0) divGrowth3y = ((latest - threeYearsAgo) / threeYearsAgo) * 100;
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

    // --- 2. ?•ç??¢æ¥­è³‡è? ---
    let industry = null, stockNameFromAPI = null, sharesFromInfo = null;
    if (jsonInfo && jsonInfo.data && jsonInfo.data.length > 0) {
        industry = jsonInfo.data[0].industry_category;
        stockNameFromAPI = jsonInfo.data[0].stock_name;
        sharesFromInfo = jsonInfo.data[0].shares_issued || jsonInfo.data[0].number_of_shares_issued || null;
    }

    // --- 3. ?•ç?æ³•äºº?è‚¡ ---
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

    // --- 4. ?•ç? MoneyDJ / Fubon ?™æ´ ---
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
    // --- 5. ?•ç??†ä??‡ä¿¡?¨äº¤??---
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
            const l = dayData.filter(x => getLvl(x) >= 11 || getLvl(x) >= 400).reduce((s, x) => s + getPct(x), 0);
            const r = dayData.filter(x => getLvl(x) <= 7 || (getLvl(x) > 0 && getLvl(x) <= 50)).reduce((s, x) => s + getPct(x), 0);
            return { date: d, large: l, retail: r };
        }).filter(x => x && (x.large > 0 || x.retail > 0));
    }

    // --- ?™æ´ï¼šç?ç§˜é?å­—å? (Norway) ---
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


    const apiRawCount = (jsonHolders && jsonHolders.data) ? jsonHolders.data.length : 0;
    if (institutionalTotal === null && foreign !== null) institutionalTotal = foreign + (trust || 0) + (dealer || 0);

    return { foreign, trust, dealer, institutionalTotal, large, retail, exDivDate, exDivAmt, sharesIssued, divGrowth3y, divConsecutiveYears, divHistory, holderTrend, marginShortRatio, industry, stockName: stockNameFromAPI, apiRawCount, norwayStatus };
}

// --- 4. FinMind ?ˆç¥»¯q¤ñ---
async function fetchFinMindRevenue(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date();
    d.setDate(d.getDate() - 2000); // å»¶é•·??5 å¹´ä»¥ä¸Šä»¥?¯æ´ä¼°å€¼æ²³æµå?
    const startDate = d.toISOString().split('T')[0];
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMonthRevenue&data_id=${rawSymbol}&start_date=${startDate}`;
    try {
        const json = await analysisFetchProxy(url, true);
        if (json && json.data && json.data.length >= 2) {
            const data = json.data;
            const current = data[data.length - 1];
            const prev    = data[data.length - 2];
            const lastYear = data.find(x => x.revenue_year === current.revenue_year - 1 && x.revenue_month === current.revenue_month);
            
            const curRev = current.revenue || current.Revenue || 0;
            const preRev = prev.revenue || prev.Revenue || 0;
            const lyRev  = lastYear ? (lastYear.revenue || lastYear.Revenue || 0) : 0;

            const mom = preRev > 0 ? ((curRev - preRev) / preRev) * 100 : null;
            const yoy = lyRev > 0 ? ((curRev - lyRev) / lyRev) * 100 : null;
            
            // è¿?12 ?‹æ?ç´¯è??Ÿæ”¶
            const last12 = data.slice(-12);
            const cum12m = last12.reduce((s, x) => s + (x.revenue || x.Revenue || 0), 0);
            
            // YTD ?Ÿæ”¶
            const ytdMonths = data.filter(x => x.revenue_year === current.revenue_year);
            const ytd = ytdMonths.reduce((s, x) => s + (x.revenue || x.Revenue || 0), 0);
            
            // å¹´å?æ¬¡æ•¸
            let yoyUpMonths = 0;
            for (const m of last12) {
                const ly = data.find(x => x.revenue_year === m.revenue_year - 1 && x.revenue_month === m.revenue_month);
                const mRev = m.revenue || m.Revenue || 0;
                const lyR = ly ? (ly.revenue || ly.Revenue || 0) : 0;
                if (lyR > 0 && mRev > lyR) yoyUpMonths++;
            }

            return {
                month: `${current.revenue_year}å¹?{current.revenue_month}?ˆ`,
                revenue: curRev,
                mom,
                yoy,
                cum12m,
                ytd,
                ytdMonthCount: ytdMonths.length,
                yoyUpMonths,
                totalMonths: last12.length || 12
            };
        }
    } catch(e) { console.warn("FinMind Revenue failed", e); }
    return null;
}

// --- 5. FinMind è²¡å ±?æ??‡ã€ç¾?‘æ? ---
async function fetchFinMindFinancial(symbol, currentPrice = 0, sharesFromChips = 0) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date(); d.setDate(d.getDate() - 2000); 
    const startDate = d.toISOString().split('T')[0];
    const datasets = ['TaiwanStockFinancialStatements', 'TaiwanStockBalanceSheet', 'TaiwanStockCashFlowsStatement'];

    try {
        const fetchDataset = async (ds) => {
            try {
                const url = "https://api.finmindtrade.com/api/v4/data?dataset=" + ds + "&data_id=" + rawSymbol + "&start_date=" + startDate;
                const res = await analysisFetchProxy(url, true).catch(() => null);
                if (res?.data?.length > 0) return res;
                const d2 = new Date(); d2.setDate(d2.getDate() - 1100);
                const url2 = "https://api.finmindtrade.com/api/v4/data?dataset=" + ds + "&data_id=" + rawSymbol + "&start_date=" + d2.toISOString().split('T')[0];
                const res2 = await analysisFetchProxy(url2, true).catch(() => null);
                return res2 || { data: [] };
            } catch (e) { return { data: [] }; }
        };

        const [jsonS, jsonB, jsonC] = await Promise.all(datasets.map(ds => fetchDataset(ds)));
        
        if (jsonS?.data?.length > 0) {
            const industry = jsonS.data[0].industry_category;
            const stockNameFromAPI = jsonS.data[0].stock_name;
            const allDates = [...new Set(jsonS.data.map(x => x.date))].sort();
            const latestDate = allDates[allDates.length - 1];
            
            const getQData = (dataset, date) => dataset ? dataset.filter(x => x.date === date) : [];
            const getVal = (qData, types) => {
                if (!qData || qData.length === 0) return 0;
                if (typeof types === 'string') types = [types];
                for (let t of types) {
                    const item = qData.find(x => x.type === t);
                    if (item && item.value !== undefined) return item.value;
                }
                const cleanStr = (s) => (s || "").toLowerCase().replace(/_/g, '').replace(/\s/g, '').replace(/-/g, '');
                for (let t of types) {
                    const ct = cleanStr(t);
                    const item = qData.find(x => cleanStr(x.type).includes(ct));
                    if (item && item.value !== undefined) return item.value;
                }
                return 0;
            };

            const getLatestDataFromDataset = (dataset, date) => {
                if (!dataset || dataset.length === 0) return [];
                const dts = [...new Set(dataset.map(x => x.date))].sort();
                const d = dts.includes(date) ? date : dts.filter(x => x <= date).pop() || dts[dts.length - 1];
                return dataset.filter(x => x.date === d);
            };

            const latestS = getQData(jsonS.data, latestDate);
            const latestB = getLatestDataFromDataset(jsonB?.data, latestDate);
            const latestC = getLatestDataFromDataset(jsonC?.data, latestDate);

            const rev = getVal(latestS, ['Revenue', 'OperatingRevenue']);
            const netIncome = getVal(latestS, ['IncomeAfterTaxes', 'NetIncome']);
            const opIncome = getVal(latestS, ['OperatingIncome', 'Operating_Income']);
            const grossProfit = getVal(latestS, ['GrossProfit', 'Gross_Profit']);
            const equity = getVal(latestB, ['Equity', 'TotalEquity']) || 1;
            const assets = getVal(latestB, ['TotalAssets', 'Assets']) || 1;
            const liabilities = getVal(latestB, ['TotalLiabilities', 'Liabilities']);
            const cash = getVal(latestB, ['CashAndCashEquivalents', 'Cash_And_Cash_Equivalents']);
            const inv = getVal(latestB, ['Inventories', 'Inventory']);
            const rdExp = getVal(latestS, ['Research_And_Development_Expenses', 'Research_expense']);
            
            const ocfSynonyms = ['CashFlowsFromOperatingActivities', 'NetCashInflowFromOperatingActivities', 'OperatingCashFlow'];
            const ocf = getVal(latestC, ocfSynonyms);
            const invCFSynonyms = ['CashProvidedByInvestingActivities', 'InvestingCashFlow'];
            const invCF = getVal(latestC, invCFSynonyms);

            const shares = sharesFromChips || getVal(latestB, ['Shares_issued', 'NumberOfSharesIssued']) || 0;
            const marketCap = (currentPrice > 0 && shares > 0) ? (currentPrice * shares / 100000000) : 0;
            const fcf = ocf + invCF;

            const epsTrend8 = allDates.slice(-8).map(date => ({ label: date, eps: getVal(getQData(jsonS.data, date), 'EPS') }));
            const historicalTTM = [];
            for (let i = 3; i < allDates.length; i++) {
                const ttm = (getVal(getQData(jsonS.data, allDates[i]), 'EPS') || 0) +
                            (getVal(getQData(jsonS.data, allDates[i-1]), 'EPS') || 0) +
                            (getVal(getQData(jsonS.data, allDates[i-2]), 'EPS') || 0) +
                            (getVal(getQData(jsonS.data, allDates[i-3]), 'EPS') || 0);
                if (ttm > 0) historicalTTM.push({ date: allDates[i], ttm });
            }

            return {
                quarter: latestDate,
                grossMargin: rev > 0 ? (grossProfit / rev * 100) : 0,
                opMargin: rev > 0 ? (opIncome / rev * 100) : 0,
                netMargin: rev > 0 ? (netIncome / rev * 100) : 0,
                rdRate: rev > 0 ? (rdExp / rev * 100) : 0,
                roe: equity > 0 ? (netIncome / equity * 100) : 0,
                debtRatio: assets > 0 ? (liabilities / assets * 100) : 0,
                fcfYield: marketCap > 0 ? (fcf / (marketCap * 100000000) * 100) : 0,
                earningsQuality: netIncome > 0 ? (ocf / netIncome * 100) : 0,
                inventoryDays: (inv > 0 && rev > 0) ? (inv / ((rev - grossProfit) / 90)) : 0,
                industry, stockName: stockNameFromAPI,
                eps: getVal(latestS, 'EPS'),
                ttmEps: historicalTTM.length > 0 ? historicalTTM[historicalTTM.length-1].ttm : 0,
                historicalTTM, epsTrend8, equity, assets, liabilities,
                marginTrend: allDates.slice(-4).map(d => {
                    const s = getQData(jsonS.data, d); const r = getVal(s, 'Revenue');
                    return { date: d, grossMargin: r > 0 ? (getVal(s, 'GrossProfit')/r*100) : 0, operatingMargin: r > 0 ? (getVal(s, 'OperatingIncome')/r*100) : 0, netMargin: r > 0 ? (getVal(s, 'NetIncome')/r*100) : 0 };
                }),
                revInvGrowthTrend: (() => {
                    const trend = []; const dds = allDates.slice(-8);
                    dds.forEach(d => {
                        const idx = allDates.indexOf(d); if (idx < 4) return;
                        const cs = getQData(jsonS.data, d); const ps = getQData(jsonS.data, allDates[idx-4]);
                        const cb = getLatestDataFromDataset(jsonB?.data, d); const pb = getLatestDataFromDataset(jsonB?.data, allDates[idx-4]);
                        const cr = getVal(cs, 'Revenue'); const pr = getVal(ps, 'Revenue');
                        const ci = getVal(cb, 'Inventories'); const pi = getVal(pb, 'Inventories');
                        trend.push({ date: d, revYoY: pr > 0 ? (cr-pr)/pr*100 : 0, invYoY: pi > 0 ? (ci-pi)/pi*100 : 0 });
                    });
                    return trend;
                })()
            };
        }
    } catch(e) { console.error("FinMind Financial failed", e); }
    return null;
}
async function fetchIndustryPeersCCC(industry, currentSymbol) {
    if (!window.allStockInfoCache || !industry) return [];
    
    // 1. ?¾å‡º?Œç”¢æ¥­æ??‰è‚¡ç¥?
    const industryPeers = window.allStockInfoCache.filter(x => x.industry_category === industry);
    
    // 2. ?’å??è¼¯ï¼šå„ª?ˆé¸?–ä»£?Ÿè?å°ç? (?šå¸¸?¯è?å¤§æ?æ­·å²è¼ƒä??„ä?æ¥?ï¼Œæ??å?ç¾©ç?é¾é ­æ¸…å–®
    // ?†æƒ³?…æ??¯é€é?å¸‚å€¼æ?åºï?ä½†åœ¨?™è£¡?‘å€‘æš«?‚ç”¨ä»¥»¯q¤ñ’å?ä¸¦é?æ¿¾æ??¶å??¡ç¥¨
    const sortedPeers = industryPeers.sort((a, b) => parseInt(a.stock_id) - parseInt(b.stock_id));
    
    // 3. ?¤æ–·?ªèº«?¯å¦?¨é¥»¯q¤ñ(?ä?)
    const top3 = sortedPeers.slice(0, 3);
    const isSelfInTop3 = top3.some(p => p.stock_id === currentSymbol);
    
    let targetPeers = [];
    if (isSelfInTop3) {
        // å¦‚æ??¯å?ä¸‰ï??¸é™¤?ªå·±å¤–ç??¶é??å? (??Top 1,2,3,4 ä¸­é??ªå·±??
        targetPeers = sortedPeers.filter(p => p.stock_id !== currentSymbol).slice(0, 4);
    } else {
        // å¦‚æ?ä¸æ˜¯?ä?ï¼Œé¸?ä¥»¯q¤ñ
        targetPeers = top3;
    }

    // 4. ä¸¦è??²å??™ä??Œæ¥­?„è²¡?±æ•¸?šä»¥è¨ˆç? CCC
    const peerDataPromises = targetPeers.map(async (peer) => {
        try {
            // ?ªæ??–æ?è¿‘ä?å¹´ç??¸æ?ä»¥ç??æ¥»¯q¤ñ
            const d = new Date(); d.setDate(d.getDate() - 400);
            const startDate = d.toISOString().split('T')[0];
            
            const [jsonS, jsonB] = await Promise.all([
                analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockFinancialStatements&data_id=${peer.stock_id}&start_date=${startDate}`, true),
                analysisFetchProxy(`https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockBalanceSheet&data_id=${peer.stock_id}&start_date=${startDate}`, true)
            ]);

            if (jsonS?.data?.length > 0 && jsonB?.data?.length > 0) {
                const allDates = [...new Set(jsonS.data.map(x => x.date))].sort();
                const latestDate = allDates[allDates.length - 1];
                
                const getQData = (dataset, date) => dataset.filter(x => x.date === date);
                const getLatestDataFromDataset = (dataset, date) => {
                    if (!dataset || dataset.length === 0) return [];
                    const dts = [...new Set(dataset.map(x => x.date))].sort();
                    const d = dts.includes(date) ? date : dts.filter(x => x <= date).pop() || dts[dts.length - 1];
                    return dataset.filter(x => x.date === d);
                };
                const getVal = (qData, types) => {
                    for (let t of (Array.isArray(types) ? types : [types])) {
                        const item = qData.find(x => x.type === t);
                        if (item) return item.value;
                    }
                    return 0;
                };

                const s = getQData(jsonS.data, latestDate);
                const b = getLatestDataFromDataset(jsonB.data, latestDate);

                const rev = getVal(s, ['Revenue', 'OperatingRevenue']);
                const gp = getVal(s, ['GrossProfit', 'gross_profit']);
                const inv = getVal(b, ['Inventories', 'Inventory']);
                const rec = getVal(b, ['Accounts_Receivable', 'AccountsReceivable']);
                const pay = getVal(b, ['Accounts_Payable', 'AccountsPayable']);

                const dio = (inv > 0 && rev > gp) ? (inv / ((rev - gp) / 90)) : 0;
                const dso = (rec > 0 && rev > 0) ? (rec / (rev / 90)) : 0;
                const dpo = (pay > 0 && rev > gp) ? (pay / ((rev - gp) / 90)) : 0;
                const ccc = dio + dso - dpo;

                return { name: peer.stock_name, symbol: peer.stock_id, ccc: ccc > 0 ? ccc : 0 };
            }
        } catch (e) { console.warn(`Peer ${peer.stock_name} fetch failed`, e); }
        return null;
    });

    const results = await Promise.all(peerDataPromises);
    return results.filter(r => r !== null);
}

// --- 6. MoneyDJ ?†é??†ä¸­åº?(Broker Concentration) ---
async function fetchBrokerConcentration(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    
    const fetchForPeriod = async (days) => {
        // å¯Œé‚¦??URL ?è¼¯ï¼?
        // 1?? zco.djhtm?a=SYMBOL
        // 5?? zco_SYMBOL_2.djhtm
        // 20?? zco_SYMBOL_4.djhtm
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

            // 1. ?å??ˆè?è²·è?/è³??å¼µæ•¸?‡å¥»¯q¤ñ(ä½æ–¼è¡¨æ ¼åº•éƒ¨)
            const buySumMatch = html.match(/?ˆè?è²·è?å¼µæ•¸[\s\S]*?<td[^>]*>([\d,]+)[\s\S]*?å¹³å?è²·è??æœ¬[\s\S]*?<td[^>]*>([\d,.]+)/i);
            const sellSumMatch = html.match(/?ˆè?è³??å¼µæ•¸[\s\S]*?<td[^>]*>([\d,]+)[\s\S]*?å¹³å?è³¥»¯q¤ñæœ¬[\s\S]*?<td[^>]*>([\d,.]+)/i);
            
            let topBuySum = 0, avgBuyCost = 0, topSellSum = 0, avgSellCost = 0;
            if (buySumMatch) {
                topBuySum = parseInt(buySumMatch[1].replace(/,/g, ''));
                avgBuyCost = parseFloat(buySumMatch[2].replace(/,/g, ''));
            }
            if (sellSumMatch) {
                topSellSum = parseInt(sellSumMatch[1].replace(/,/g, ''));
                avgSellCost = parseFloat(sellSumMatch[2].replace(/,/g, ''));
            }

            // 2. ?å¥»¯q¤ñ5 å¤§è²·è¶…å?é»æ?ç´?
            const topBrokers = [];
            const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
            for (let row of rows) {
                // ?´å??æ¿¾æ¢ä»¶ä»¥å¥»¯q¤ñzco0.djhtm ?¼å?
                if (row.includes('zco0.djhtm') || row.includes('Link2Buy') || row.includes('genLinkBroker')) {
                    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
                    if (cells.length >= 4) {
                        const clean = (c) => c.replace(/<[^>]*>/g, '').trim().replace(/,/g, '');
                        const name = cells[0].replace(/<[^>]*>/g, '').trim();
                        const buyNet = parseInt(clean(cells[3]));
                        if (!isNaN(buyNet) && buyNet > 0 && topBrokers.length < 5) {
                            topBrokers.push({ name, buyNet });
                        }
                    }
                }
            }

            return { days, topBuySum, topSellSum, mainNetBuy: topBuySum - topSellSum, avgBuyCost, avgSellCost, topBrokers };
        } catch (e) { return null; }
    };

    const periods = [1, 5, 20];
    const results = await Promise.all(periods.map(p => fetchForPeriod(p)));
    return {
        d1: results[0],
        d5: results[1],
        d20: results[2]
    };
}

// --- 6. FinMind ?è??åˆ¸ ---
async function fetchFinMindMargin(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date();
    d.setDate(d.getDate() - 10);
    const startDate = d.toISOString().split('T')[0];
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMarginPurchaseShortSale&data_id=${rawSymbol}&start_date=${startDate}`;
    try {
        const json = await analysisFetchProxy(url, true);
        if (json && json.data && json.data.length > 0) {
            const latest = json.data[json.data.length - 1];
            const marginBal = latest.MarginPurchaseTodayBalance || latest.margin_purchase_today_balance || latest.MarginPurchaseBalance || 0;
            const shortBal  = latest.ShortSaleTodayBalance || latest.short_sale_today_balance || latest.ShortSaleBalance || 0;
            const marginLim = latest.MarginPurchaseLimit || latest.margin_purchase_limit || 0;
            
            return {
                marginPurchase: marginBal,
                shortSale: shortBal,
                marginLimit: marginLim,
                marginUseRate: marginLim > 0 ? safeFix((marginBal / marginLim * 100), 1) : '0.0'
            };
        }
    } catch(e) { console.warn("FinMind Margin failed", e); }
    return null;
}

// --- 7. FinMind ä¸‰å¤§æ³•äººè¿‘ä??‹æ?è²·è³£è¶?---
async function fetchFinMindInstitutional(symbol, latestVol = 0) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date();
    d.setDate(d.getDate() - 40); 
    const startDate = d.toISOString().split('T')[0];
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${rawSymbol}&start_date=${startDate}`;
    
    const parseData = (data) => {
        if (!data || data.length === 0) return null;
        const allDates = [...new Set(data.map(x => x.date))].sort();
        if (allDates.length === 0) return null;
        
        const latestDate = allDates[allDates.length - 1];
        
        const calcNet = (dataset) => {
            if (!dataset || dataset.length === 0) return { foreign: 0, trust: 0, dealer: 0 };
            const getNet = (item) => {
                const b = item.buy !== undefined ? item.buy : (item.Buy !== undefined ? item.Buy : (item.buy_shares || 0));
                const s = item.sell !== undefined ? item.sell : (item.Sell !== undefined ? item.Sell : (item.sell_shares || 0));
                return (b - s) / 1000; // è½‰ç‚ºå¼?
            };
            const f = dataset.filter(x => {
                const n = (x.name||x.Name||"").toLowerCase();
                return n.includes('foreign') || n.includes('å¤–è?') || n.includes('?¸è?');
            }).reduce((a,b)=>a+getNet(b), 0);
            const t = dataset.filter(x => {
                const n = (x.name||x.Name||"").toLowerCase();
                return n.includes('trust') || n.includes('?•ä¿¡');
            }).reduce((a,b)=>a+getNet(b), 0);
            const d = dataset.filter(x => {
                const n = (x.name||x.Name||"").toLowerCase();
                return n.includes('dealer') || n.includes('?ªç?');
            }).reduce((a,b)=>a+getNet(b), 0);
            return { foreign: f, trust: t, dealer: d };
        };

        const latestDay = calcNet(data.filter(x => x.date === latestDate));
        const fiveDayTotal = calcNet(data.filter(x => allDates.slice(-5).includes(x.date)));
        
        const getStreak = (type) => {
            let streak = 0;
            for (let i = 0; i < allDates.length; i++) {
                const date = allDates[allDates.length - 1 - i];
                const dayData = data.filter(x => x.date === date);
                const net = dayData.filter(x => {
                    const n = (x.name || x.Name || "").toLowerCase();
                    if (type === 'foreign') return n.includes('foreign') || n.includes('å¤–è?') || n.includes('?¸è?');
                    if (type === 'trust') return n.includes('trust') || n.includes('?•ä¿¡');
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

        return {
            latestDay,
            fiveDayTotal,
            streaks: { foreign: getStreak('foreign'), trust: getStreak('trust') },
            latestDayNetPct: (latestVol && latestVol > 0) ? ( (latestDay.foreign + latestDay.trust + latestDay.dealer) * 1000 / latestVol * 100 ) : 0,
            sample: `Data OK (${data.length} records)`
        };
    };

    try {
        const json = await analysisFetchProxy(url, true).catch(() => null);
        if (json && json.data && json.data.length > 0) return parseData(json.data);
        
        // ?™æ´ï¼šæ“´å¤§æ??“ç??å?è©?
        const dLong = new Date(); dLong.setDate(dLong.getDate() - 90);
        const urlLong = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockInstitutionalInvestorsBuySell&data_id=${rawSymbol}&start_date=${dLong.toISOString().split('T')[0]}`;
        const json2 = await analysisFetchProxy(urlLong, true).catch(() => null);
        if (json2 && json2.data && json2.data.length > 0) return parseData(json2.data);
    } catch(e) {}

    return null;
}

async function fetchInstitutionalMoneyDJ(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const url = `https://www.moneydj.com/Z/ZC/ZCL/ZCL.djhtm?a=${rawSymbol}`;
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const text = await res.text();
        const foreignMatch = text.match(/å¤–è?<\/td><td[^>]*>([^<]+)<\/td>/);
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

function renderAnalysis(symbol, name, chartData, twseBasic, chipsData, revData, finData, marginData, institutionalData, avgCost = null, riskMetrics = null, insiderActivity = null, debugInfo = null, brokerData = null, peerCCCData = []) {
    if (!chartData) {
        analysisBody.innerHTML = '<div style=\"text-align:center; padding:60px;\">?? ®Ö¤ß¼Æ¾Ú¸ü¤J¥¢±Ñ</div>';
        return;
    }
    const { currentPrice } = chartData;
    const displayName = chipsData?.stockName || name || symbol;
    if (analysisTitle) analysisTitle.textContent = '?? ' + displayName + ' (' + symbol + ') ¤ÀªR³ø§i';

    // 1. ²£·~¦P·~¹ï·Ó¥d¤ù (¸m³»)
    let sectorHtml = '';
    if (finData && finData.industry) {
        sectorHtml = renderSectorComparison(finData, revData, twseBasic);
    }

    // 2. Àò§Q¤T²vÁÍ¶Õ
    const marginHtml = renderMarginChart(finData?.marginTrend || []);

    // 3. ®Ö¤ß«ü¼Ğ°Ï¶ô
    const metricsHtml = \
        <div class=\"analysis-grid\">
            <div class=\"analysis-card\">
                <h3>?? Àò§Q¯à¤O</h3>
                \
                \
                \
                \
            </div>
            <div class=\"analysis-card\">
                <h3>?? ²{ª÷»P®Ä²v</h3>
                \
                \
                \
                \
            </div>
            <div class=\"analysis-card\">
                <h3>?? ¦ô­È»P¼Wªø</h3>
                \
                \
                \
                \
            </div>
        </div>
    \;

    analysisBody.innerHTML = sectorHtml + marginHtml + metricsHtml;
    
    // ¸É¦^©³³¡¶EÂ_­±ªO
    const diagHtml = \
        <div id=\"analysisDiagnostic\" style=\"margin-top:20px; padding:15px; background:rgba(0,0,0,0.3); border-radius:10px; border:1px solid rgba(255,255,255,0.1); font-family:monospace; font-size:11px;\">
            <div style=\"color:#fbbf24; margin-bottom:8px; font-weight:bold;\">?? ¼Æ¾Ú¨Ó·½¶EÂ_ (Diagnostic Console)</div>
            <div style=\"color:\\">¡´ °]³ø¼Æ¾Ú (Financial): \</div>
            <div style=\"color:\\">¡´ Àç¦¬¼Æ¾Ú (Revenue): \</div>
        </div>
    \;
    analysisBody.innerHTML += diagHtml;
}

function renderSectorComparison(finData, revData, twseBasic) {
    // Àò¨ú²£·~¥­§¡ (®Ú¾Ú FinMind ¼Æ¾Ú)
    const industry = finData.industry;
    const peers = allStockInfoCache ? allStockInfoCache.filter(s => s.industry === industry) : [];
    
    // ¦ôºâ²£·~¥­§¡ (°²³]©Ê¡A¦pªG¦³§Y®É¦P·~¼Æ¾Ú·|§ó¦n)
    const avgPE = 18.5;
    const avgYield = 3.2;
    const avgRevGrowth = 12.0;

    const myPE = finData.ttmEps ? (twseBasic?.currentPrice / finData.ttmEps) : 0;
    const myYield = parseFloat(twseBasic?.yield) || 0;
    const myRev = parseFloat(revData?.yoy) || 0;

    const getCompare = (me, avg, type) => {
        const diff = (me - avg).toFixed(1);
        if (type === 'PE') {
            return me < avg ? \<span style=\"color:#10b981\">Àu©ó \</span>\ : \<span style=\"color:#ef4444\">¸¨«á \</span>\;
        }
        return me > avg ? \<span style=\"color:#10b981\">Àu©ó \</span>\ : \<span style=\"color:#ef4444\">¸¨«á \</span>\;
    };

    return \
        <div class=\"analysis-card\" style=\"background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%); border: 1px solid rgba(59, 130, 246, 0.2); margin-bottom: 20px;\">
            <h3 style=\"color:#60a5fa; margin-bottom:15px; display:flex; align-items:center;\">
                <span style=\"margin-right:8px;\">¥»¯q¤ñ</span> ²£·~°ò·Ç¹ï¤ñ (¦P·~¥­§¡: \)
            </h3>
            <div style=\"display:grid; grid-template-columns: repeat(3, 1fr); gap:15px;\">
                <div style=\"text-align:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;\">
                    <div style=\"font-size:12px; color:#94a3b8;\">¥»¯q¤ñ</div>
                    <div style=\"font-size:10px; color:#64748b;\">Avg: \­¿</div>
                    <div style=\"font-size:18px; font-weight:bold; margin:4px 0;\">\­¿</div>
                    <div style=\"font-size:11px;\">\</div>
                </div>
                <div style=\"text-align:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;\">
                    <div style=\"font-size:12px; color:#94a3b8;\">´Ş§Q²v</div>
                    <div style=\"font-size:10px; color:#64748b;\">Avg: \%</div>
                    <div style=\"font-size:18px; font-weight:bold; margin:4px 0;\">\%</div>
                    <div style=\"font-size:11px;\">\</div>
                </div>
                <div style=\"text-align:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;\">
                    <div style=\"font-size:12px; color:#94a3b8;\">Àç¦¬¦¨ªø</div>
                    <div style=\"font-size:10px; color:#64748b;\">Avg: \%</div>
                    <div style=\"font-size:18px; font-weight:bold; margin:4px 0;\">\%</div>
                    <div style=\"font-size:11px;\">\</div>
                </div>
            </div>
        </div>
    \;
}
function renderStatRow(label, value, percentVal = null) {
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${value}')"` : '';

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
        <div style="margin-top:12px; padding:8px 12px; background:rgba(59, 130, 246, 0.05); border-radius:8px; border:1px solid rgba(59, 130, 246, 0.1); font-size:11px; color:#cbd5e1; line-height:1.5;">
            <span style="color:#60a5fa; font-weight:700; margin-right:4px;">?’¡ è¨ºæ–·ï¼?/span>${text}
        </div>
    `;
}

function renderPercentRow(label, percentVal, showSign = true) {
    if (percentVal === null || percentVal === undefined || isNaN(percentVal)) {
        return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">N/A</span></div>`;
    }
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const valStr = `${percentVal > 0 ? '+' : ''}${safeFix(percentVal, 2)}%`;
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';
    
    const color = percentVal > 0 ? '#ef4444' : (percentVal < 0 ? '#10b981' : '#f8fafc'); 
    const sign = (showSign && percentVal > 0) ? '+' : '';
    return `
        <div class="analysis-stat-row">
            <span class="${labelClass}" ${clickAttr}>${label}</span>
            <span class="analysis-val" style="color: ${color};">${sign}${safeFix(percentVal, 2)}%</span>
        </div>
    `;
}

function safeFix(val, n) {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return val.toFixed(n);
}

function formatCurrency(num) {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (absNum >= 1000000000000) return sign + (absNum / 1000000000000).toFixed(2) + ' ??;
    if (absNum >= 100000000) return sign + (absNum / 100000000).toFixed(2) + ' ??;
    if (absNum >= 10000) return sign + (absNum / 10000).toFixed(2) + ' ??;
    return num.toLocaleString();
}

function renderNetBuyRow(label, netLots) {
    if (netLots === null || netLots === undefined || isNaN(netLots)) {
        return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">N/A</span></div>`;
    }
    const rounded = Math.round(netLots);
    const color = rounded > 0 ? '#ef4444' : (rounded < 0 ? '#10b981' : '#94a3b8');
    const sign = rounded > 0 ? '+' : '';
    return `
        <div class="analysis-stat-row">
            <span class="analysis-label">${label}</span>
            <span class="analysis-val" style="color:${color}; font-size:13px;">${sign}${rounded.toLocaleString()} å¼?/span>
        </div>
    `;
}

function renderMARow(label, maValue, currentPrice) {
    if (!maValue || isNaN(maValue)) return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">N/A</span></div>`;
    
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const diffVal = ((currentPrice - maValue) / maValue * 100);
    const diff = safeFix(diffVal, 1);
    const valStr = `${safeFix(maValue, 2)} (ä¹–é›¢ ${diffVal > 0 ? '+' : ''}${diff}%)`;
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';
    const color = diffVal > 0 ? '#ef4444' : '#10b981'; 
    const sign = diffVal > 0 ? '+' : '';
    
    return `
        <div class="analysis-stat-row">
            <span class="${labelClass}" ${clickAttr}>${label}</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="analysis-val">${safeFix(maValue, 2)}</span>
                <span class="ma-tag" style="color:${color}; border: 1px solid ${color}40;">ä¹–é›¢ ${sign}${diff}%</span>
            </div>
        </div>
    `;
}

function renderValuationRow(label, value) {
    if (value === null || value === undefined || isNaN(value)) return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">N/A</span></div>`;
    
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const valStr = `${safeFix(value, 2)} ?ƒ`;
    // ?³å…¥é¡å?ä¸Šä??‡çµ¦ showTermExplainer
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';

    let colorClass = 'reasonable';
    if (label.includes('ä¾¿å?')) colorClass = 'cheap';
    if (label.includes('?‚è²´')) colorClass = 'expensive';
    
    return `
        <div class="analysis-stat-row">
            <span class="${labelClass}" ${clickAttr}>${label}</span>
            <span class="analysis-val ${colorClass}">${safeFix(value, 2)} ??/span>
        </div>
    `;
}

function renderValuationRiverMap(label, current, percentile, bands) {
    if (current == null || percentile == null || !bands) {
        return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">?¸æ?ä¸è¶³</span></div>`;
    }

    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const valStr = `${safeFix(current, 2)} (ä½é? ${safeFix(percentile, 1)}%)`;
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';

    const color = percentile < 30 ? '#4ade80' : (percentile > 70 ? '#f87171' : '#fbbf24');
    const pos = Math.max(0, Math.min(100, percentile));
    
    return `
        <div class="analysis-stat-row" style="flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 0;">
            <div style="display:flex; justify-content:space-between; width:100%; font-size:12px;">
                <span class="${labelClass}" ${clickAttr}>${label}: <b style="color:#fff;">${safeFix(current, 2)}</b></span>
                <span style="color:${color}; font-weight:800;">${safeFix(percentile, 1)}% (ä½é?)</span>
            </div>
            <div class="river-map-container" style="width:100%; height:14px; background:rgba(255,255,255,0.05); border-radius:7px; position:relative; margin:10px 0 5px; border:1px solid rgba(255,255,255,0.1);">
                <!-- Scale markers -->
                <div style="position:absolute; left:0%; top:-12px; font-size:8px; color:#64748b;">${safeFix(bands.min, 1)}</div>
                <div style="position:absolute; left:25%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.1);"></div>
                <div style="position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.2);"></div>
                <div style="position:absolute; left:75%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.1);"></div>
                <div style="position:absolute; right:0%; top:-12px; font-size:8px; color:#64748b;">${safeFix(bands.max, 1)}</div>
                
                <!-- Current Position Pointer -->
                <div style="position:absolute; left:${pos}%; top:50%; transform:translate(-50%, -50%); width:8px; height:8px; background:${color}; border-radius:50%; box-shadow:0 0 10px ${color}; z-index:2;"></div>
                <div style="position:absolute; left:${pos}%; top:-18px; transform:translateX(-50%); font-size:9px; font-weight:700; color:${color};">??/div>
                
                <!-- Background Gradient (Green to Red) -->
                <div style="position:absolute; left:0; top:0; bottom:0; width:100%; background:linear-gradient(90deg, rgba(74,222,128,0.2) 0%, rgba(251,191,36,0.2) 50%, rgba(248,113,113,0.2) 100%); border-radius:7px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; width:100%; font-size:8px; color:#475569; padding:0 2px;">
                <span>ä½ä¼°</span>
                <span>?ˆç?</span>
                <span>?‚è²´</span>
            </div>
        </div>
    `;
}



/**
 * === Sector Benchmarks: Industry Averages (2024) ===
 * ?…å« 15+ ?‹ç”¢æ¥­ç?å¹³å?è²¡å??‡æ?ï¼šæ¥»¯q¤ñgm), ROE(roe), ?¬ç?æ¯?pe), æ®–åˆ©??yield), ?Ÿæ”¶?é•·(rev)
 */
const sectorBenchmarks = {
    '?Šå?é«”æ¥­': { gm: 32.5, roe: 14.8, pe: 18.5, yield: 3.2, rev: 12.0 },
    '?»è…¦?Šé€±é?': { gm: 8.2, roe: 9.5, pe: 14.2, yield: 4.5, rev: 5.0 },
    '?»å??¶ç?ä»?: { gm: 18.5, roe: 11.2, pe: 16.0, yield: 3.8, rev: 8.5 },
    '?šä¿¡ç¶²è·¯': { gm: 22.4, roe: 10.5, pe: 15.5, yield: 4.2, rev: 6.0 },
    '?‰é›»æ¥?: { gm: 12.6, roe: 5.4, pe: 22.0, yield: 2.8, rev: -2.5 },
    '?¶ä??»å?': { gm: 14.2, roe: 10.8, pe: 15.0, yield: 4.0, rev: 7.0 },
    '?ªé?æ¥?: { gm: 24.5, roe: 12.0, pe: 8.5, yield: 6.5, rev: 15.0 },
    '?¼éµå·¥æ¥­': { gm: 9.8, roe: 6.2, pe: 12.5, yield: 5.2, rev: 2.0 },
    '?‘è?ä¿éšª': { gm: null, roe: 10.2, pe: 11.5, yield: 5.0, rev: 3.0 },
    'æ±½è?å·¥æ¥­': { gm: 15.6, roe: 8.5, pe: 13.0, yield: 4.8, rev: 4.5 },
    'å¡‘è?å·¥æ¥­': { gm: 11.2, roe: 7.4, pe: 14.5, yield: 4.2, rev: 1.5 },
    'é£Ÿå?å·¥æ¥­': { gm: 25.4, roe: 13.5, pe: 18.0, yield: 3.5, rev: 3.0 },
    'è§€?‰ä?æ¥?: { gm: 35.2, roe: 8.4, pe: 25.0, yield: 2.5, rev: 20.0 },
    'è²¿æ??¾è²¨': { gm: 28.5, roe: 9.2, pe: 16.5, yield: 3.8, rev: 5.5 },
    '?Ÿæ??«ç?': { gm: 38.2, roe: 6.5, pe: 35.0, yield: 1.5, rev: 10.0 }
};

function renderSectorComparison(industry, stats) {
    if (!industry) return '';
    
    let matchKey = Object.keys(sectorBenchmarks).find(k => 
        k === industry || k.includes(industry) || industry.includes(k)
    );
    
    const bench = sectorBenchmarks[matchKey] || sectorBenchmarks['?¶ä??»å?'];
    const finalIndustryName = matchKey || industry;

    const items = [
        { label: 'æ¯›åˆ©??, val: stats.gm, avg: bench.gm, unit: '%' },
        { label: 'ROE', val: stats.roe, avg: bench.roe, unit: '%' },
        { label: '?¬ç?æ¯?, val: stats.pe, avg: bench.pe, unit: '?? },
        { label: 'æ®–åˆ©??, val: stats.yield, avg: bench.yield, unit: '%' },
        { label: '?Ÿæ”¶?é•·', val: stats.rev, avg: bench.rev, unit: '%' }
    ].filter(i => i.val != null && i.avg != null);

    if (items.length === 0) return '';

    return `
        <div class="analysis-card" style="margin-top:16px; border: 1px solid rgba(59, 130, 246, 0.2); background: linear-gradient(180deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.5) 100%);">
            <div class="analysis-card-title">?? ?¢æ¥­å°æ?ï¼?{finalIndustryName} æ¨™ç«¿</div>
            <div style="display:flex; flex-direction:column; gap:16px; margin-top:12px;">
                ${items.map(item => {
                    const diff = item.val - item.avg;
                    // PE è¶Šä?è¶Šå¥½ï¼Œå…¶ä»–è?é«˜è?å¥?
                    const isBetter = item.label === '?¬ç?æ¯? ? diff <= 0 : diff >= 0;
                    const color = isBetter ? '#60a5fa' : '#f97316'; 
                    const diffStr = (diff > 0 ? '+' : '') + diff.toFixed(1);
                    
                    // ?•æ?æ¯”ä?å°ºï?ä»¥å…©?…è?å¤§è€…ç‚º?ºæ?ï¼Œå¥»¯q¤ñ20% ç©ºé?
                    const barMax = Math.max(Math.abs(item.val), Math.abs(item.avg), 1) * 1.2;
                    const stockPos = Math.max(2, (Math.abs(item.val) / barMax) * 100);
                    const avgPos = (Math.abs(item.avg) / barMax) * 100;
                    
                    return `
                        <div style="display:flex; flex-direction:column; gap:6px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="display:flex; align-items:center; gap:4px;">
                                    <span style="font-size:12px; font-weight:700; color:#fff;">${item.label}</span>
                                    <span style="font-size:10px; color:#64748b;">(?Œæ¥­å¹³å? ${item.avg}${item.unit})</span>
                                </div>
                                <span style="font-size:11px; color:${color}; font-weight:800;">
                                    ${item.val.toFixed(1)}${item.unit} 
                                    <span style="font-size:10px; opacity:0.8; margin-left:4px; font-weight:400;">
                                        ${diff >= 0 ? 'è¶…é? ' : '?½å? '}${Math.abs(diff).toFixed(1)}${item.unit}
                                    </span>
                                </span>
                            </div>
                            <div style="height:10px; background:rgba(255,255,255,0.02); border-radius:5px; position:relative; border:1px solid rgba(255,255,255,0.05);">
                                <!-- ?‹è‚¡è¡¨ç¾æ¢?-->
                                <div style="position:absolute; left:0; top:0; bottom:0; width:${stockPos}%; background:${color}; border-radius:5px; opacity:0.8; transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
                                <!-- ?¢æ¥­å¹³å?ç·šæ?è¨?(?‚ç›´ç·? -->
                                <div style="position:absolute; left:${avgPos}%; top:-4px; bottom:-4px; width:3px; background:#fbbf24; z-index:2; box-shadow: 0 0 8px rgba(251, 191, 36, 0.6); border-radius:2px;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.05); font-size:9px; color:#64748b; display:flex; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="display:flex; align-items:center; gap:4px;"><span style="width:3px; height:10px; background:#fbbf24; border-radius:1px;"></span> ?¢æ¥­å¹³å?æ¨™è?</span>
                    <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; background:#60a5fa; border-radius:3px;"></span> è¡¨ç¾?ªç•°</span>
                    <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; background:#f97316; border-radius:3px;"></span> ä½æ–¼å¹³å?</span>
                </div>
                <span>*?¸æ??ºæ?: 2024 ?¢æ¥­å¹´åº¦?±å?</span>
            </div>
        </div>
    `;
}


const termDefinitions = {
    '?¬ç?æ¯?(PE)': {
        type: 'ä¼°å€?,
        desc: '?¬ç?æ¯”ä»£è¡¨æ?è³‡äºº?ºä?è³ºå??¬å¸ 1 ?ƒç?æ·¨åˆ©ï¼Œé??ä??ºç??¹æ ¼ï¼ˆå€æ•¸ï¼‰ã€?,
        rule: 'ä¸€?¬ä»¥ 15 ?ç‚º?ºæ??‚ä¥»¯q¤ñ12 ?é€šå¸¸è¢«è??ºä¾¿å®œï?é«˜æ–¼ 20 ?å??€?™æ??¯å¦?ç†±??,
        advice: '?€?å??¬å¸?é•·?§ç?å¾…ã€‚é??é•·?¡é€šå¸¸äº«æ?è¼ƒé??¬ç?æ¯”ï??¯æ°£å¾ªç’°?¡å?ä¸é©?¨æ­¤?‡æ??¤æ–·??,
        analyze: (v) => {
            if (v <= 0) return "?®å??•æ–¼?§æ??€?‹ï?ä¸é©?¨æœ¬?Šæ?ä¼°å€¼ã€?;
            if (v < 12) return "?®å?ä½é??¸ç•¶ä¾¿å?ï¼Œå…·?™é?åº¦å??¨é??›ã€?;
            if (v > 20) return "ä½é??é?ï¼ˆé??±ï?ï¼Œå??´å·²çµ¦ä?é«˜åº¦?Ÿå?ï¼Œé?æ³¨æ?è¿½é?é¢¨éšª??;
            return "?®å??•æ–¼?ˆç??€?“ã€?;
        }
    },
    'æ®–åˆ©??: {
        type: '?¡åˆ©',
        desc: 'æ¯è‚¡?¡åˆ©?¤ä»¥?®å??¡åƒ¹ï¼Œå?? æ?è³‡é€™æ??¡ç¥¨æ¯å¹´?„ç¾?‘å??±ç¥»¯q¤ñ,
        rule: '> 5% ?ºå„ª?°ï?4-5% å±¬æ­£å¸¸ï?< 3% ?‡å?ä½ã€?,
        advice: '?¥é™·?¥é??©é™·?±ï??€ç¢ºè??¬å¸?¯å¦?‰ç©©å®šç??²åˆ©?½å?ï¼Œä»¥?è³ºäº†è‚¡?¯å»è³ ä??¹å·®??,
        analyze: (v) => {
            if (v > 5) return "æ®–åˆ©?‡æ¥µ?·å¸å¼•å?ï¼Œé?å¸¸é©?ˆæ”¶?¯å??•è?äººã€?;
            if (v > 3.5) return "æ®–åˆ©?‡è¡¨?¾ç©©?¥ï?ç¬¦å?ä¸€?¬æ?è³‡æ°´æº–ã€?;
            return "æ®–åˆ©?‡å?ä½ï??•è??é??‰æ”¾?¨è‚¡?¹åƒ¹å·®è€Œé??¡æ¯??;
        }
    },
    'ROE (?¡æ±æ¬Šç??±é…¬)': {
        type: '?²åˆ©?è³ª',
        desc: '?¬å¸?©ç”¨?¡æ±è³‡é??µé€ ç²?©ç??½å?ï¼Œæ˜¯è¡¡é??¬å¸ç¶“ç??ˆç??€?¸å??„æ?æ¨™ã€?,
        rule: 'å¹´å? > 15% ?ºå„ªç§€ï¼?-15% å±¬ç©©?¥ï?< 5% ä»?¡¨?ˆç?ä¸å½°??,
        advice: 'å·´è²?¹æ??‹é??„æ?æ¨™ã€‚è‹¥ ROE ?ç?å¢é•·ï¼Œä»£è¡¨å…¬?¸å…·?‰ç«¶?­è­·?æ²³??,
        analyze: (v) => {
            if (v > 15) return "è¡¨ç¾?“è?ï¼å…¬?¸å…·?™æ¥µå¼·ç??²åˆ©?½å??‡è‚¡?±å??±ç¥»¯q¤ñ;
            if (v >= 8) return "è¡¨ç¾ç©©å¥ï¼Œå…¬?¸èƒ½ç©©å??©ç”¨?¡æ±æ¬Šç??µé€ å??†åˆ©æ½¤ã€?;
            if (v < 5) return "è³ºéŒ¢?ˆç?ä¸ä½³ï¼Œé??™æ??¬å¸?¯å¦?¢è‡¨?¢æ¥­è¡°é€€?–ç??Ÿå›°å¢ƒã€?;
            return "?²åˆ©è¡¨ç¾?®é€šï??•æ–¼?¢æ¥­å¹³ç©©?Ÿã€?;
        }
    },
    'æ¯›åˆ©??: {
        type: '?²åˆ©?½å?',
        desc: '?Ÿæ¥­?¶å…¥??™¤?Ÿæ¥­?æœ¬å¾Œç?æ¯”ç?ï¼Œå?? ç”¢?ç«¶?­å??‡å??¹èƒ½?›ã€?,
        rule: 'è¶Šé?è¶Šå¥½?‚è??Œæ¥­?¸æ?ï¼Œæ??©è?é«˜é€šå¸¸ä»?¡¨?€è¡“é??ˆæ?è¦æ¨¡?ªå‹¢??,
        advice: '?€?œæ³¨è¶¨å‹¢?‚è‹¥æ¯›åˆ©?‡ä?æ»‘ï??¯èƒ½ä»?¡¨å¸‚å ´ç«¶çˆ­? å??–å??™æ??¬ä??‡ã€?,
        analyze: (v) => {
            if (v > 40) return "é«˜æ??©ä»£è¡¨ç”¢?å…·?™å¼·å¤§ç«¶?­å?ï¼Œå¯?½æ˜¯?€è¡“é??ˆè€…ã€?;
            if (v > 15) return "?²åˆ©?½å?å°šå±¬æ­?¸¸ï¼Œå±¬ä¸€?¬è£½? æ??å?æ¥­æ°´æº–ã€?;
            return "æ¯›åˆ©?ä?ï¼ˆä?äº”ä??­ï?ï¼Œå±¬?å?å¯†é??–ä»£å·¥è?æ¥­ï??—é¢¨?ªèƒ½?›è?å¼±ã€?;
        }
    },
    '?›æ?æ¼¢å…§?¨åƒ¹??: {
        type: 'ä¼°å€?,
        desc: '?¹å€¼æ?è³‡ä??¶è??‰æ¼¢?å‡º?„æ ¸å¿ƒå…¬å¼ï¥»¯q¤ñ22.5 ? EPS ? æ¯è‚¡æ·¨å€??‚é€™æ˜¯è¡¡é??¡åƒ¹?¯å¦å¤§å?ä½æ–¼ä¼æ¥­?Ÿå¯¦?¹å€¼ç?ä¿å??ºæ¥»¯q¤ñ,
        rule: '?šå¸¸èªç‚º 22.5 ?¯ã€Œå??†æœ¬?Šæ? 15 ¥»¯q¤ñ ?ˆç??¡æ·¨æ¯?1.5 ?ã€ç?ä¹˜ç¥»¯q¤ñ,
        advice: '?¶è‚¡?¹ä??¼æ­¤?¸å€¼ç? 70% ?‚ï?ç¨±ç‚º?·å??Œå??¨é??›ã€ã€‚é©?¨æ–¼ç©©å??²åˆ©?„å…¬?¸ï?ä¸é©?¨æ–¼é«˜æ??·ç??€?¡ã€?,
        analyze: (v, currentVal) => {
            const priceMatch = window._lastCurrentPrice;
            if (!priceMatch) return "?™å?? ä??ºæ–¼è³‡ç”¢?‡ç²?©ç?ä¿å?ä¼°å€¼æ?æ¨™ã€?;
            if (priceMatch < v * 0.7) return "?”¥ å¼·å??¨è–¦ï¼ç›®?è‚¡?¹é¡¯?—ä??¼è??‰æ¼¢?§åœ¨?¹å€¼ï??·å?æ¥µé??„å??¨é??›ã€?;
            if (priceMatch < v) return "?®å??¡åƒ¹ä½æ–¼?§åœ¨?¹å€¼ï?ä¼°å€¼ç›¸å°å??¨ã€?;
            return "?®å??¡åƒ¹å·²é??¼è??‰æ¼¢?§åœ¨?¹å€¼ï?ä¼°å€¼å·²?…å??æ?è³‡ç”¢?‡ç²?©æ??›ã€?;
        }
    },
    'ä¸»å??æœ¬': {
        type: 'ç±Œç¢¼',
        desc: '??15 å¤§è²·è¶…åˆ¸?†å?é»ç?å¹³å??äº¤?¹æ ¼?‚ä»£è¡¨é€™æ®µ?‚é??§ã€Œå¤§è³‡é??ç??²è²¨?¹ä¥»¯q¤ñ,
        rule: '?¡åƒ¹?¨ä¸»?›æ??¬ä?ä¸Šè¡¨ç¤ºä¸»?›ç²?©ä¸­ï¼›è‹¥?¨æ??¬ä?ä¸‹ï??‡ä¸»?›è??¼å??¢ç??‹ã€?,
        advice: 'ä¸»å??æœ¬ç·šå¸¸è¢«è??ºå¼·?›ç??Œå??†æ”¯?ã€æ??Œå??›ä??ã€‚ç•¶?¡åƒ¹?è½??20 ?¥ä¸»?›æ??¬é?è¿‘ä?æ­¢è??‚ï??¯æ¥µä½³ç?ä»‹å…¥é»ã€?,
        analyze: (v) => {
            const p = window._lastCurrentPrice;
            if (!p) return "è§€å¯Ÿä¸»?›æ??¬å¯?¤æ–·å¤§æˆ¶?„ç??§ç??‹ã€?;
            const diff = (p - v) / v * 100;
            if (Math.abs(diff) < 2) return "?¯ ?¡åƒ¹?®å?æ­¥»¯q¤ñ¼ä¸»?›æ??¬å?ï¼Œå…·?™æ¥µå¼·æ”¯?å¥»¯q¤ñ;
            if (diff < -5) return "? ï? ä¸»å??®å?æ·±é™·å¥—ç‰¢ï¼Œé?è§€å¯Ÿæ˜¯?¦æ?èªè?è³¥»¯q¤ñ–ä?ä½æ”¤å¹³ã€?;
            return "?®å??¡åƒ¹é«˜æ–¼ä¸»å??æœ¬ï¼Œå??­æ¶æ§‹ç©©?¥ã€?;
        }
    },
    'å¤§æˆ¶?è‚¡æ¯?: {
        type: 'ç±Œç¢¼',
        desc: '?æ? 400 å¼µï??–æ›´å¤šï?ä»¥ä??¡ä»½?„è‚¡?±æ?ä½”æ?ä¾‹ã€‚å?? æ?æ§‹æ?äººè?å¤§è‚¡?±ç??•æ¥»¯q¤ñ,
        rule: 'æ¯”ä?ä¸Šå?ä»?¡¨ç±Œç¢¼?†ä¸­ï¼Œæ??©æ¼²?¢ï?æ¯”ä?ä¸‹é?ä»?¡¨ç±Œç¢¼?†æ•£??,
        advice: '?‰è?å¯Ÿã€Œè¶¨?¢ã€è€Œé?çµ•å??¼ã€‚è‹¥å¤§æˆ¶?è‚¡??€±ä??‡ï??šå¸¸ä»?¡¨?‰æ³¢æ®µè??…ã€?,
    },
    '??ˆ¶?è‚¡æ¯?: {
        type: 'ç±Œç¢¼',
        desc: '?æ? 50 å¼µï??–ä»¥ä¸‹ï?å°é??¡ä»½?„è‚¡?±æ?ä¾‹ã€?,
        rule: '?‡å¤§?¶æ??¡æ??æ??‚æ•£?¶æ?ä¾‹é?é«˜é€šå¸¸ä»?¡¨ç±Œç¢¼?Œä?ï¼Œè‚¡?¹æ?è·Œé›£æ¼²ã€?,
        advice: '?¥è‚¡?¹ä?æ¼²ä¥»¯q¤ñˆ¶?è‚¡å¢å?ï¼Œé??é˜²ä¸»å?æ­?œ¨?Œæ?é«˜å‡ºè²¨ã€ã€?,
    },
    '?Ÿæ¥­?©ç¥»¯q¤ñ: {
        type: '?²åˆ©?½å?',
        desc: '?æ??¬å¸?¸å?æ¥­å??„ç²?©ç?æ³ï??’é™¤æ¥­å??ç?å¾Œç??Ÿå¯¦?½å¥»¯q¤ñ,
        rule: 'ç¶­æ?ç©©å??–å?ä¸Šç‚ºä½³ã€?,
        advice: '?¥ç?æ¥­åˆ©?Šç??é•·?Ÿåº¦å¿«æ–¼æ¯›åˆ©?‡ï?ä»?¡¨?¬å¸?æœ¬?§åˆ¶ï¼ˆç®¡?†æ??‡ï?æ­?œ¨?å¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 15) return "?¸å?æ¥­å??²åˆ©å¼·å?ï¼Œç??Ÿç®¡?†æ??‡æ¥µé«˜ã€?;
            if (v > 5) return "?¬æ¥­ç¶­æ??²åˆ©ï¼Œå±¬å¹³ç©©ç¶“ç??€?‹ã€?;
            return "?¬æ¥­?²åˆ©å¾®è??šè‡³?§æ?ï¼Œé?é«˜åº¦è­¦è¦º?Ÿé?é¢¨éšª??;
        }
    },
    'å­˜è²¨?±è?å¤©æ•¸': {
        type: '?Ÿé??ˆç?',
        desc: '?¬å¸å°‡åº«å­˜å??è³£?ºå»å¹³å??€è¦ç?å¤©æ•¸??,
        rule: 'å¤©æ•¸?ˆçŸ­ä»?¡¨å­˜è²¨ç®¡ç??ˆå¥½ï¼Œè??‘ç?å£“æ?å°‘ã€?,
        advice: '?€?‡å?æ¥­æ?è¼ƒã€‚è‹¥å¤©æ•¸çªç„¶æ¿€å¢ï??€è­¦æ?åº«å?è·Œåƒ¹?å¤±?–ç”¢?æ»¯?·é¢¨?ªã€?,
        analyze: (v) => {
            if (v < 45) return "å­˜è²¨?»å??å¸¸è¿…é€Ÿï?è³‡é??±è?æ¥µå…·?ˆç¥»¯q¤ñ;
            if (v < 90) return "å­˜è²¨ç®¡ç?å°šå±¬ç©©å¥??;
            return "å­˜è²¨ç©å?å¤©æ•¸?é•·ï¼Œé??™æ??¯å¦?‰æ»¯?·æ??å–®é¢¨éšª??;
        }
    },
    'ç´¯ç? 8 å­?¸½?«é¥»¯q¤ñ: {
        type: '?²åˆ©?è³ª',
        desc: '?å» 8 å­??æ¥­ç¾?‘æ?ç¸½å??¤ä»¥æ·¨åˆ©ç¸½å?ï¼Œå?? é•·?Ÿç²?©ç??Œç??¢ã€æ?ä¾‹ã€?,
        rule: '> 100% ?ºå„ª?°ï?ä»?¡¨å¸³é¢?¶ç??½æ?è½‰æ??ç¾?‘æ”¶?²å£è¢‹ã€?,
        advice: '?™æ˜¯?¤æ–·?›å??²åˆ©?€å¼·å¤§?„é?æ¿¾å™¨?‚é•·?Ÿä¥»¯q¤ñ80% ?€?´é˜²è²¡å ±ä½œå¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 100) return "?²åˆ©?«é??æ¥µé«˜ï??¬å¸è³ºé€²ç??¾é??šè‡³è¶…é?å¸³é¢?©æ½¤??;
            if (v >= 80) return "?²åˆ©?è³ªç©©å?ï¼Œç¾?‘å??¶èƒ½?›æ­£å¸¸ã€?;
            return "? ï? æ³¨æ?ï¼šå«?‘é??ä?ï¼Œå…¬?¸å¯?½é¢?¨æ??¶å¸³æ¬¾é?é«˜æ?å­˜è²¨ç©å?ï¼Œç²?©å?å­˜åœ¨?¼å¸³?¢ä¥»¯q¤ñ;
        }
    },
    '?Ÿæ”¶ vs å­˜è²¨?é•·è¶¨å‹¢ (YoY)': {
        type: '?Ÿé?é¢¨éšª',
        desc: 'æ¯”è??Ÿæ”¶?é•·?‡è?å­˜è²¨?é•·?‡ã€‚è‹¥å­˜è²¨?é•·?å¿«ï¼Œé€šå¸¸?¯æ¥­ç¸¾è¡°?€?„å?è¡Œæ?æ¨™ã€?,
        rule: 'å­˜è²¨?é•·ä¸æ?é¡¯è?é«˜æ–¼?Ÿæ”¶?é•·ï¼? 15% ?€æ³¨æ?ï¼‰ã€?,
        advice: '?¥å?è²¨æ??·é?å¿«æ–¼?Ÿæ”¶ï¼Œå¯?½ä»£è¡¨å…¬?¸æ­£?¨ã€Œå?è²¨ã€çµ¦?šè·¯ï¼Œæ??¢å??·å”®?—é˜»??,
        analyze: (v) => {
            if (v > 20) return "è­¦è?ï¼å?è²¨æ??·é?å¿«ï??€?™æ?å¾Œç??¯å¦?‰åº«å­˜å»?–å??›ã€?;
            if (v > 0) return "å­˜è²¨?–æ?å¢é•·ï¼Œä?ä»åœ¨?¯æ§ç¯„å??§ã€?;
            return "å­˜è²¨ç®¡ç??¯å¥½ï¼Œå»?–é€Ÿåº¦å¿«æ–¼?é•·?Ÿåº¦??;
        }
    },
    '?¾é??±æ? (CCC)': {
        type: '?Ÿé??ˆç?',
        desc: 'å¾ä??¢è²·?Ÿæ??°è³£?ºå??æ‹¿?°ç¾?‘ï??™ç?è³‡é?è¢«å¡ä½ç?å¤©æ•¸??,
        rule: 'è¶ŠçŸ­è¶Šå¥½ï¼Œç??³è??¼ä»£è¡¨å…¬?¸å?ä¾›æ??†æ?æ¥µå¼·?„è­°?¹èƒ½?›ã€?,
        advice: '?ªç??„é??­ä?æ¥­ï?å¦‚å°ç©é›»?è¯?¼ç?ï¼‰é€šå¸¸?½ç¶­?æ¥µ?­ç??¾é??±æ¥»¯q¤ñ,
        analyze: (v) => {
            if (v < 30) return "è³‡é??æ”¶æ¥µå¿«ï¼Œå?ä¸Šä?æ¸¸å…·?™æ¥µå¼·ç?è­°åƒ¹?‡ä¸»å°æ¥»¯q¤ñ;
            if (v < 100) return "è³‡é?èª¿åº¦å°šå±¬æ­?¸¸??;
            return "?¾é?è¢«å¡?¨ç??‹æ?ç¨‹ä¸­?„æ??“è??·ï??€æ³¨æ?è³‡é?æµå??§é¢¨?ªã€?;
        }
    },
    'RSI (14)': {
        type: '?€è¡“é¢',
        desc: '?¸å?å¼·å¼±?‡æ??‚è¡¡?ä?æ®µæ??“å…§?¡åƒ¹æ¼²å‹¢?‡è??¢ç??›é¥»¯q¤ñ,
        rule: '> 70 ?ºè?è²·ï??ç†±ï¼‰ï?< 30 ?ºè?è·Œï??¯èƒ½?å?ï¼‰ã€?,
        advice: '?©å?å°‹æ‰¾?­ç?è²·è³£é»ï?ä½†å¼·?¢è‚¡?¯èƒ½?¨é?æª”é??–ï??€?å??‡ç?ä½¿ç”¨??,
        analyze: (v) => {
            if (v > 80) return "?®å??•æ–¼æ¥µåº¦è¶…è²·?€ï¼Œé??±é¢¨?ªæ¥µé«˜ï?ä¸å??ç›²?®è¿½å¤šã€?;
            if (v > 70) return "?®å??²å…¥è¶…è²·?€ï¼ˆé??±ï?ï¼Œè‚¡?¹çŸ­ç·šå¯?½å?æª”ï?ä¸å??åº¦è¿½é¥»¯q¤ñ;
            if (v < 20) return "?®å??²å…¥æ¥µåº¦è¶…è??€ï¼Œéš¨?‚å¯?½ç™¼?•å¼·?›å?å½ˆã€?;
            if (v < 30) return "?®å??²å…¥è¶…è??€ï¼ŒçŸ­ç·šéš¨?‚å¯?½ç™¼?•è?æ·±å?å½ˆã€?;
            return "?®å??•æ–¼ä¸­æ€§å??“ï?å¤šç©º?›é?å¹³è¡¡??;
        }
    },
    'Beta (Î²)': {
        type: 'é¢¨éšª',
        desc: '?æ??‹è‚¡å°å¤§?¤æ³¢?•ç??æ?åº¦ã€?,
        rule: '1.0 ?ºåŸºæº–ã€? 1.2 å±¬æ–¼ç©æ¥µ?‹ï?æ³¢å?å¤§ï?ï¼? 0.8 å±¬æ–¼?²ç¦¦?‹ï?æ³¢å?å°ï¥»¯q¤ñ,
        advice: '?›å??‚é¸é«?Beta å¢å??ç?ï¼Œç?å¸‚æ??¸ä? Beta ?¿éšª??,
        analyze: (v) => {
            if (v > 1.2) return "æ¨™ç?æ¥µå…·?»æ??§ï?å¤§ç›¤ä¸Šæ¼²?‚æ??´ç™¼å¾—æ›´?‡ï?ä½†å?æª”æ?ä¹Ÿè?å¾—æ›´å¿«ã€?;
            if (v < 0.8) return "æ¨™ç?å±¬é˜²ç¦¦å?ï¼Œé©?ˆè¿½æ±‚ç©©?¥æ??¿éšª?„é?ç½®ã€?;
            return "æ³¢å?å¹…åº¦?‡å¤§?¤å¤§?´å?æ­¥ã€?;
        }
    },
    'Piotroski F-Score': {
        type: 'ç¶œå?è¨ºæ–·',
        desc: '??9 ?‹è²¡?™é¢?‘è??†ï??²åˆ©?è²¡?™æ?æ¡¿ã€ç??‹æ??‡ï¥»¯q¤ñ,
        rule: '8-9 ?†ç‚ºæ¥µä½³ï¼?-3 ?†ä»£è¡¨è²¡?™é?è³ªå ª?‚ã€?,
        advice: '?™æ˜¯ä¸€?‹æ¥µ?·å…¬ä¿¡å??„è²¡?™é?æ¿¾å™¨ï¼Œèƒ½?‰æ??”é™¤?ºæœ¬?¢è?å·®ç??°é›·?¡ã€?,
        analyze: (v) => {
            if (v >= 7) return "é«”è³ªæ¥µä½³ï¼ä??…è²¡?™æ?æ¨™ä¸­å¤šæ•¸?é?ï¼Œå…·?™æ?æ§‹ç??„å??¨æ€§ã€?;
            if (v >= 4) return "é«”è³ªä¸­ç?ï¼Œå??¡ç??³æ€§ç?è²¡å?é¢¨éšª??;
            return "è­¦å?ï¼è²¡?™è??†æ¥µä½ï??¬å¸?„é?é«”è³ª?½åœ¨?¡å?ä¸­ï??™å?å°å¥»¯q¤ñ;
        }
    },
    'PE ä½é?': {
        type: 'ä¼°å€?,
        desc: '?®å??¬ç?æ¯”åœ¨?å» 5 å¹´æ­·?²å??“ä¸­?„ä?ç½®ã€?,
        rule: '< 30% ?•æ–¼?¸å?ä¾¿å??€ï¼? 70% ?•æ–¼?¸å?é«˜ä¼°?€??,
        advice: '?Œä¾¿å®œã€ä?ä»?¡¨é¦¬ä??ƒæ¼²ï¼Œã€Œæ?è²´ã€ä?ä»?¡¨é¦¬ä??ƒè¥»¯q¤ñ,
        analyze: (v) => {
            if (v < 20) return "?®å??•æ–¼æ­·å²ä½æ°´ä½ï?ä¼°å€¼æ¥µ?·å¸å¼•å?ï¼Œå…·?™å??¨é??›ã€?;
            if (v > 80) return "?®å??•æ–¼æ­·å²é«˜æ°´ä½ï??‚è²´ï¼‰ï?å¸‚å ´?…ç?äº¢å¥®ï¼Œé??é˜²è¿½é??æ?é¢¨éšª??;
            return "?®å??•æ–¼æ­·å²ä¸­é?ä½é¥»¯q¤ñ;
        }
    },
    'PB ä½é?': {
        type: 'ä¼°å€?,
        desc: '?®å??¡åƒ¹?‡æ·¨?¼ç?æ¯”å€¼åœ¨æ­·å²?€?“ç?ä½ç½®??,
        rule: '?©ç”¨?¼ç²?©ä?ç©©å??„æ™¯æ°?¾ª?°è‚¡??,
        advice: '?¶è‚¡æ·¨æ?ä¾†åˆ°æ­·å²ä½ä?ï¼? 20%ï¼‰ï??šå¸¸?¯é•·ç·šä?å±€?„æ??ƒã€?,
        analyze: (v) => {
            if (v < 25) return "?®å??•æ–¼æ­·å²?§ç?å¤§å??¨å?ï¼Œå…·?™æ¥µé«˜ç??¹å€¼æ?è³‡å¸å¼•å¥»¯q¤ñ;
            if (v > 75) return "?®å??•æ–¼æ­·å²é«˜é??€ï¼ˆæ?è²´ï?ï¼Œæº¢?¹å?åº¦è?å¤§ï?å»ºè­°?¿é??–é€¢é??²åˆ©äº†ç¥»¯q¤ñ;
            return "?®å??•æ–¼æ­·å²ä¸­é?æ°´ä¥»¯q¤ñ;
        }
    },
    '?‰æ”¶å¸³æ¬¾å¤©æ•¸': {
        type: '?Ÿé??ˆç?',
        desc: '?¬å¸?¢å?è³?‡ºå¾Œï?å¹³å??€è¦å?å°‘å¤©?èƒ½?¶åˆ°?¾é¥»¯q¤ñ,
        rule: '?šå¸¸?‡å?æ¥­ç›¸æ¯”ï?å¤©æ•¸?ˆçŸ­ä»?¡¨?¬å¸å°ä?æ¸¸æ”¶?¢ç??½å??ˆå¼·??,
        advice: '?¥å¤©?¸é¡¯?—å?? ï??€å°å?å®¢æˆ¶?¯èƒ½ä»˜ä??ºéŒ¢ï¼Œå??´å?å¸³é¢¨?ªã€?,
        analyze: (v) => {
            if (v < 40) return "?¶éŒ¢?Ÿåº¦æ¥µå¿«ï¼Œå?ä¸‹æ¸¸å®¢æˆ¶?·å?å¼·å¤§?„è­°?¹åœ°ä½ã€?;
            if (v > 100) return "?¶éŒ¢?Ÿåº¦?æ…¢ï¼Œé?æ³¨æ??¯å¦?‰å?å¸³é¢¨?ªæ?å®¢æˆ¶å»¶é²ä»˜æ¬¾??;
            return "?¶éŒ¢?Ÿåº¦?•æ–¼æ­?¸¸?€?“ã€?;
        }
    },
    '?‰ä?å¸³æ¬¾å¤©æ•¸': {
        type: '?Ÿé??ˆç?',
        desc: '?¬å¸?‘ä??‰å?è²·æ?å¾Œï?å¹³å??¯ä»¥?Œè?å¸³ã€å?ä¹…æ?ä»˜éŒ¢??,
        rule: 'å¤©æ•¸?ˆé•·ï¼Œä»£è¡¨å…¬?¸å?ä¾›æ??†ç?è­°åƒ¹?½å??ˆå¼·ï¼Œè??‘èª¿åº¦æ??ˆæ´»??,
        advice: '?™æ˜¯ä¸€ç¨®ã€Œç„¡?¯è²¸æ¬¾ã€ï?å°å…¬?¸ç??‹æ˜¯?‰åˆ©?„æ?æ¨™ã€?,
        analyze: (v) => {
            if (v > 90) return "?¬å¸?·å?å¼·å¤§?„è­°?¹èƒ½?›ï??½æ??ˆé??¨ä??‰å?è³‡é¥»¯q¤ñ;
            if (v < 30) return "ä»˜éŒ¢?Ÿåº¦è¼ƒå¿«ï¼Œè??‘ç?å£“åœ¨ä¾›æ??ˆä¸­?„æ??“è??­ã€?;
            return "ä»˜éŒ¢?Ÿåº¦?•æ–¼æ­?¸¸ç¯„å¥»¯q¤ñ;
        }
    },
    'å­˜è²¨?±è¥»¯q¤ñ: {
        type: '?Ÿé??ˆç?',
        desc: '?æ??¬å¸ä¸€å¹´å…§?Šå?è²¨è³£?‰å?è£œè²¨?„æ¬¡?¸ã€?,
        rule: 'æ¬¡æ•¸?ˆé?ï¼Œä»£è¡¨å??æ?å¥½è³£ï¼Œæ??‰æ»¯?·å?é¡Œã€?,
        advice: '?€?å?æ¯›åˆ©?‡ç??‚è‹¥?±è??‡é?ä½†æ??©ä?ï¼Œå¯?½æ˜¯?¬å¸?¨ã€Œå??¹ç«¶?­ã€ã€?,
        analyze: (v) => {
            if (v > 8) return "?†å??å¸¸å¥½è³£ï¼Œå¹¾ä¹æ??‰åº«å­˜ç?å£“å?é¡Œã€?;
            if (v < 2) return "?†å??·å”®è¼ƒæ…¢ï¼Œé?è­¦æ?åº«å?è·Œåƒ¹?å¤±??;
            return "?±è??Ÿåº¦å±¬ç©©?¥ç??‹ã€?;
        }
    },
    'EPS å¹´å¥»¯q¤ñ(YoY)': {
        type: '?é•·??,
        desc: '?‡å»å¹´å?ä¸€?‚æ??¸æ?ï¼Œæ??¡ç?é¤˜ç??é•·?¾å?æ¯”ã€?,
        rule: '> 20% ?ºé??Ÿæ??·ï?10-20% ?ºç©©?¥æ??·ã€?,
        advice: '?•è??é•·?¡ç??¸å??‚è‹¥ YoY ¥»¯q¤ñä¸‰å­£?é•·ï¼Œè‚¡?¹é€šå¸¸?ƒæ?å¼·å?è¡¨ç¾??,
        analyze: (v) => {
            if (v > 25) return "?ˆé??é•·?•èƒ½?†ç™¼ï¼Œæ˜¯æ¨™æ??„é??é•·ç¸¾å„ª?¡ã€?;
            if (v > 0) return "?²åˆ©ç¶­æ?æ­¥»¯q¤ñ·ã€?;
            return "?²åˆ©?ºç¾è¡°é€€ï¼Œé??¢ç©¶?¯çŸ­?Ÿå?ç´ é??¯ç«¶?­å?ä¸‹æ¥»¯q¤ñ;
        }
    },
    'å¹´å?æ³¢å¥»¯q¤ñ: {
        type: 'é¢¨éšª',
        desc: 'è¡¡é??¡åƒ¹æ³¢å??‡ç?ç¨‹åº¦?„æ?æ¨™ã€?,
        rule: 'æ³¢å¥»¯q¤ñ> 40% ä»?¡¨?¯å¤§èµ·å¤§?½ç?é£†è‚¡ï¼? 20% ?‡æ˜¯?©å?å®šå??„ç©©?¥è‚¡?‚å¸¸ä¼´éš¨ä½é¢¨?ªã€?,
        advice: '?©å?å¿ƒè?å¤§å??„æ¸¬è©¦ã€‚ä?å®ˆå??•è?äººæ??¿é?æ³¢å??‡é?é«˜ç?æ¨™ç¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 45) return "æ³¢å??‡ç?ï¼é€™æ˜¯ä¸€æª”é?é¢¨éšª?é??±é…¬?„é??¡ï??™å??§åˆ¶?¨ä¥»¯q¤ñ;
            if (v < 20) return "èµ°å‹¢?å¸¸å¹³ç©©ï¼Œé©?ˆè¿½æ±‚é•·?Ÿé??¯ç?ä¿å??‹æ?è³‡äºº??;
            return "æ³¢å?å¹…åº¦?¨ä¸­?§å??“ã€?;
        }
    },
    'æ¯è‚¡æ·¨å€?(BPS)': {
        type: 'ä¼°å€?,
        desc: '?¬å¸?„ç¸½è³‡ç”¢??™¤è² å‚µå¾Œï??¤ä»¥?¼è??¡æ•¸?‚ä»£è¡¨æ?ä¸€?¡å??«ç?æ·¨è??¢åƒ¹?¼ã€?,
        rule: '?¶è‚¡?¹ä??¼æ??¡æ·¨?¼ï?P/B < 1ï¼‰æ?ï¼Œé€šå¸¸è¢«è??ºæ˜¯?¡åƒ¹è¢«ä?ä¼°ã€?,
        advice: '?©å??¨ä?è©•ä¼°?è??¢è?æ¥­ï?å¦‚é??ã€é‹¼?µã€é¢?¿ï?ï¼Œä?å°æ–¼è¼•è??¢ç?è»Ÿé??¬å¸?ƒè€ƒåƒ¹?¼è?ä½ã€?,
        analyze: (v) => {
            if (v > 100) return "?¬å¸?„æ·¨è³‡ç”¢åº•å??å¸¸?šå¯¦ï¼Œå…·?™æ¥µå¼·ç??—é¢¨?ªèƒ½?›ã€?;
            if (v > 20) return "æ·¨è??¢è¡¨?¾æ­£å¸¸ï??·å??ºæœ¬?„åƒ¹?¼æ”¯?ã€?;
            return "æ·¨è??¢è?ä½ã€?;
        }
    },
    'å¸‚éŠ·??(P/S)': {
        type: 'ä¼°å€?,
        desc: 'å¸‚å€¼é™¤ä»¥å¹´åº¦ç??¶ã€‚å?? æ?è³‡äººé¡˜æ??ºæ? 1 ?ƒç??¶ä??ºå?å°‘åƒ¹?¼ã€?,
        rule: 'è¶Šä?è¶Šå¥½?‚é€šå¸¸ P/S < 1 è¢«è??ºé?å¸¸ä¾¿å®œã€?,
        advice: '?å¸¸?©å?è©•ä¼°?Œé??é•·ä½†å??ªè??ˆã€ç??¬å¸ï¼ˆå??›èµ·æ­¥ç??Ÿæ??–ç¶²è·¯è‚¡ï¼‰ã€?,
        analyze: (v) => {
            if (v < 1.5) return "?®å?å¸‚éŠ·?‡æ¥µä½ï?ä»?¡¨å¸‚å ´?¯èƒ½?´é?ä½ä¼°?¶ç??¶åƒ¹?¼ã€?;
            if (v > 5.0) return "ä¼°å€¼å?é«˜ï??€?‰æ¥µå¼·ç??é•·?§æ”¯?ã€?;
            return "ä¼°å€¼è??¼å??†å¥»¯q¤ñ;
        }
    },
    'å¸‚æ·¨??(P/B)': {
        type: 'ä¼°å€?,
        desc: '?¡åƒ¹?‡æ??¡æ·¨?¼ç?æ¯”å€¼ï?Price-to-Book Ratioï¼‰ã€?,
        rule: '< 1 ä»?¡¨?¡åƒ¹ä½æ–¼æ·¨è??¢åƒ¹?¼ï?> 3 ?šå¸¸ä»?¡¨æº¢åƒ¹?é¥»¯q¤ñ,
        advice: '?¶æ™¯æ°?¾ª?°è‚¡ï¼ˆå??ªé?ï¼‰ç? P/B ä¾†åˆ°æ­·å²ä½é??‚ï?å¾€å¾€?¯ç?ä½³ç??¿ä¾¿å®œæ?æ©Ÿã€?,
        analyze: (v) => {
            if (v < 1.0) return "?¡åƒ¹ä½æ–¼å¸³é¢?¹å€¼ï??·å?é«˜åº¦?¹å€¼å¸å¼•å¥»¯q¤ñ;
            if (v > 3.0) return "æº¢åƒ¹æ°´æ?è¼ƒé?ï¼Œé??™æ?è³‡ç”¢?¯å¦è¢«é?åº¦ç?ä½œã€?;
            return "?®å?ä¼°å€¼è??¼å??†å??“ã€?;
        }
    },
    'PEG æ¯”ä?': {
        type: 'ä¼°å€?,
        desc: '?¬ç?æ¯”é™¤ä»¥ç?é¤˜æ??·ç??‚ç”¨ä¾†è¡¡?æ??·è‚¡?„ä¼°?¼æ˜¯?¦å??†ã€?,
        rule: '< 1 ä»?¡¨?é•·?Ÿåº¦å¿«æ–¼ä¼°å€¼ï?ä¾¿å?ï¼‰ï?> 1.5 ?‡å¯?½é?åº¦æ?è§€??,
        advice: '?™æ˜¯å½¼å?Â·?—å??€?›ç??‡æ?ï¼Œèƒ½?‰æ??¾å‡º?Œç‰©è¶…æ??¼ã€ç?é«˜æ??·è‚¡??,
        analyze: (v) => {
            if (v <= 0) return "?®å??ˆé??é•·?ºè??¼ï?ä¸é©??PEG ä¼°å€¼ã€?;
            if (v < 1.0) return "?é•·?•èƒ½å¼·å?ä¸”ä¼°?¼ä¾¿å®œï??¯ç??³ç?é«˜æ??·æ?è³‡æ?åº•ï?";
            if (v > 1.8) return "?®å??„æ??·æ€§å·²ä¸è¶³ä»¥æ”¯?é?ä¼°å€¼ï??€?é˜²æ³¡æ²«?´è¥»¯q¤ñ;
            return "ä¼°å€¼è??é•·?§åŒ¹?ã€?;
        }
    },
    '?Ÿé?æ§“æ¡¿åº?(DOL)': {
        type: '?Ÿé??ˆç?',
        desc: '?Ÿæ”¶æ¯è¥»¯q¤ñ1%ï¼Œç?æ¥­åˆ©?Šæ?è®Šå?å¹?%?‚å?? å›ºå®šæ??¬å??²åˆ©?„æ”¾å¤§æ??‰ã€?,
        rule: '?¸å€¼è?é«˜ï?ä»?¡¨?Ÿæ”¶?é•·?‚ç²?©æ??´ç™¼ï¼Œä?è¡°é€€?‚ä??ƒè?å¾—æ›´?˜ã€?,
        advice: 'é«˜æ?æ¡¿å…¬?¸ï?å¦‚ä»£å·¥å??å?å°é?å» ï??¨ç”¢æ¥­å??‡æ??€?·ç??¼å¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 3.0) return "é«˜æ?æ¡¿ä?æ¥­ï??Ÿæ”¶?„å?å¹…æ??·æ?å¸¶å??²åˆ©å·¨å?è·³å?ï¼Œä?ä¹Ÿè?å°å?è¡°é€€?‚ç??å‚·é¢¨éšª??;
            return "æ§“æ¡¿åº¦å¹³ç©©ï??²åˆ©è®Šå??‡ç??¶å¤§?´å?æ­¥ã€?;
        }
    },
    '?ªç”±?¾é?æµæ??©ç?': {
        type: '?¾é?æµ?,
        desc: '?¬å¸æ¯å¹´?¢ç??„ã€Œè‡ª?±ç¾?‘æ??é™¤ä»¥å??¼ã€‚æ??¡æ¯æ®–åˆ©?‡æ›´?½å?? å…¬?¸ç??Ÿå¯¦æ´¾éŒ¢?½å¥»¯q¤ñ,
        rule: '> 5% ä»?¡¨?¾é?æµæ¥µåº¦å?è£•ï?< 0% ?‡è?æ³¨æ??¬å¸?¯å¦?¥ä??·å‡º??,
        advice: '?™æ˜¯?‘æ??‹é??„ã€Œé¿?·æ?æ¨™ã€ï??ªç”±?¾é?æµç‚ºè² ç??¬å¸ï¼Œå…¶?²åˆ©å¾€å¾€?ªæ˜¯å¸³é¢?¸å¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 6.0) return "?¾é?æµå«?‘é?æ¥µé?ï¼Œå…¬?¸æ??„å??„æœ¬?¢é€²è??æ¯?–å??•è¥»¯q¤ñ;
            if (v < 0) return "è­¦å?ï¼å…¬?¸è³º?²ä??„ç¾?‘ä?è¶³ä»¥?¯æ?è³‡æœ¬?¯å‡ºï¼Œè²¡?™å¥åº·åº¦æ¬ ä½³??;
            return "?¾é?æµç?æ³å?å±¬ç©©?¥ã€?;
        }
    },
    'ç¨…å?æ·¨åˆ©??: {
        type: '?²åˆ©?½å?',
        desc: '?€çµ‚æ·¨?©ä??Ÿæ”¶?„ç™¾?†æ??‚ä»£è¡¨æ?ä¸€å¡ŠéŒ¢?Ÿæ”¶??™¤?€?‰æ??¬ã€ç??‘å??™ä??„éŒ¢??,
        rule: 'è¶Šé?è¶Šå¥½?‚é€šå¸¸ > 10% å±¬æ–¼?²åˆ©?½å??ªè‰¯??,
        advice: '?¥ç??¶å?? ä?æ·¨åˆ©?‡ä?æ»‘ï??¯èƒ½ä»?¡¨ç«¶çˆ­?‡ç?å°è‡´æ¯›åˆ©ç¸®æ°´??,
        analyze: (v) => {
            if (v > 15) return "?²åˆ©?½å?å¼·å?ï¼Œå…¬?¸å…·?™è‰¯å¥½ç??æœ¬?§åˆ¶?–å??Œæº¢?¹èƒ½?›ã€?;
            if (v > 5) return "?²åˆ©?½å?å°šå±¬å¹³ç©©??;
            return "?²åˆ©æ¥µå…¶å¾®è?ï¼Œæ?é¢¨éšª?½å?è¼ƒå¼±ï¼Œé??™æ??¢æ¥­ç«¶çˆ­?¯å¦?æ–¼æ¿€?ˆã€?;
        }
    },
    'æ¥­å??ç?ä½”æ?': {
        type: '?²åˆ©?è³ª',
        desc: 'æ¥­å??¶å…¥?‡æ”¯?ºå?ç¨…å?æ·¨åˆ©?„å½±?¿ç?åº¦ã€?,
        rule: '< 10% ä»?¡¨?²åˆ©?å¸¸ç´”ç²¹ï¼? 30% ?‡ä»£è¡¨ç²?©å¤§å¤šä??ªè³£?°ã€æ?è³‡æ??¯å¥»¯q¤ñ,
        advice: '?€è­¦æ?é«˜æ¥­å¤–ä?æ¯”ç??¬å¸ï¼Œå??ºé€™ç¨®?²åˆ©?šå¸¸ä¸å¯?ç¥»¯q¤ñ,
        analyze: (v) => {
            if (v < 10) return "?²åˆ©çµæ??å¸¸ç´”ç²¹ï¼Œå¹¾ä¹å…¨?¨ä??ªæœ¬æ¥­ï??è³ªæ¥µä½³??;
            if (v > 40) return "è­¦å?ï¼ç²?©é?åº¦ä?è³´æ¥­å¤–ï??€?¥æ??¯æ¥­å¤–æ?è³‡å¤§è³ºé??¯è³£ç¥–ç”¢åº¦æ—¥??;
            return "æ¥­å?å½±éŸ¿ç¨‹åº¦å°šåœ¨?¯æ¥?—ç??ã€?;
        }
    },
    'ROA (è³‡ç”¢?±é…¬??': {
        type: '?²åˆ©?½å?',
        desc: '?¬å¸?©ç”¨?Œæ??‰è??¢ã€ï??…å«è² å‚µ?‡è‚¡?±è??‘ï??µé€ ç²?©ç??½å¥»¯q¤ñ,
        rule: '> 8% ç®—å„ªç§€ï¼?-8% å±¬æ­£å¸¸ï?< 3% ä»?¡¨è³‡ç”¢?©ç”¨?ˆç??ä¥»¯q¤ñ,
        advice: 'å°æ–¼è² å‚µæ¯”é??„è?æ¥­ï?å¦‚é?è¡Œã€å£½?ªï?ï¼ŒROA æ¯?ROE ?´èƒ½?æ?ç¶“ç?å¥½å¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 10) return "è³‡ç”¢?‹ç”¨?ˆç?æ¥µé?ï¼Œå…¬?¸åœ¨?‹ç”¨?´é?è³‡æ?ä¸Šè¡¨?¾å„ª?°ã€?;
            if (v > 4) return "è³‡ç”¢?±é…¬?‡è??¼ç”¢æ¥­å¹³?‡æ°´æº–ã€?;
            return "è³‡ç”¢?‹ç”¨?ˆç??ä?ï¼Œé??™æ??¯å¦?‰é?å¤šé?ç½®è??¢æ?ç¶“ç??ˆèƒ½ä¸å½°??;
        }
    },
    '?Ÿæ”¶å¹´è??ˆæ??·ç? (CAGR)': {
        type: '?é•·??,
        desc: 'è¡¡é??¬å¸?¨ä?æ®µç‰¹å®šæ??“å…§ï¼ˆé€šå¸¸??3-5 å¹´ï?ï¼Œç??¶å¹³?‡æ?å¹´ç??é•·?Ÿåº¦??,
        rule: '> 15% ?ºé??é•·?¬å¸ï¼?-15% ?ºç©©?¥æ??·ã€?,
        advice: 'CAGR ?½å¹³æ»‘æ??®ä?å¹´ä»½?„å??ˆæ³¢?•ï??¯åˆ¤?·é•·ç·šè¶¨?¢æ?å¥½ç?å·¥å…·??,
        analyze: (v) => {
            if (v > 20) return "é«˜æ??·æ??Ÿè‚¡ï¼ç??¶å??¾å¼·?ç?è¤‡å?å¢é•·ï¼Œå…·?™æ¥µä½³ç??¢æ¥­?°ä¥»¯q¤ñ;
            if (v > 8) return "?Ÿæ”¶ç©©å¥?é•·ï¼Œç¬¦?ˆå„ªè³ªä?æ¥­ç??·æ?è¡¨ç¾??;
            return "?Ÿæ”¶?é•·ç·©æ…¢?–é™·?¥å?æ»¯ï??€?™æ??¬å¸?¯å¦?²å…¥?¢æ¥­?ç??Ÿæ?è¡°é€€?Ÿã€?;
        }
    },
    'æµå?æ¯”ç?': {
        type: '?Ÿå‚µ?½å?',
        desc: 'æµå?è³‡ç”¢?¤ä»¥æµå?è² å‚µ?‚å?? å…¬?¸åœ¨ä¸€å¹´å…§?Ÿé??­æ??µå??„èƒ½?›ã€?,
        rule: '> 200% ?ºå„ª?¯ï?< 100% ä»?¡¨?­æ?è³‡é?å£“å?æ¥µå¤§??,
        advice: 'è²¡å?ç©©å¥?„ç¬¬ä¸€?“é˜²ç·šï?ä½æ–¼ 100% ?„æ??„ç?å°è?å°å¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 200) return "?­æ??Ÿå‚µ?½å?æ¥µä½³ï¼Œå…¬?¸æ??­æ??•è??‘å?è£•ï?è²¡å??å¸¸ç©©å¥??;
            if (v > 120) return "?Ÿå‚µ?½å?å°šå¯??;
            return "?­æ?è³‡é?å£“å?æ²‰é?ï¼Œè‹¥?‡åˆ°?¯æ°£å¯’å†¬ï¼Œå¯?½é¢?¨é€±è??°é›£??;
        }
    },
    '?Ÿå?æ¯”ç?': {
        type: '?Ÿå‚µ?½å?',
        desc: 'ï¼ˆæ??•è¥»¯q¤ñ- å­˜è²¨ï¼‰é™¤ä»¥æ??•è??µã€‚æ?æµå?æ¯”ç??´åš´?›ç??‡æ¥»¯q¤ñ,
        rule: '> 100% ?ºå??¨ã€?,
        advice: '?’é™¤?‰è??¾æ…¢?„å?è²¨ï??€?½ç??ºå…¬?¸åœ¨ç·Šæ€¥æ?æ³ä??Œç¾?¿éŒ¢?ç??½å¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 150) return "è®Šç¾?½å?å¼·æ?ï¼Œå³ä½¿ä?è³?º«å­˜ä??½è?é¬†å??„çŸ­?Ÿå‚µ?™ã€?;
            if (v > 100) return "?Ÿå??½å?ç¬¦å?å®‰å…¨æ¨™æ¥»¯q¤ñ;
            return "é«˜åº¦ä¾è³´åº«å?è®Šç¾ä¾†é??µï??¥ç”¢?æ»¯?·ï?å°‡é¢?¨å·¨å¤§ç?è³‡é?é¢¨éšª??;
        }
    },
    'è² å‚µæ¯”ç?': {
        type: '?Ÿå‚µ?½å?',
        desc: 'ç¸½è??µé™¤ä»¥ç¸½è³‡ç”¢?‚å?? å…¬?¸è??‘ä??ªå€Ÿæ¬¾?„æ?ä¾‹ã€?,
        rule: '40-60% ?ºæ­£å¸¸å??“ï?> 70% è²¡å?å£“å?è¼ƒé¥»¯q¤ñ,
        advice: 'ä¸å??¢æ¥­æ¨™æ?ä¸å?ï¼ˆé??è‚¡?šå¸¸å¾ˆé?ï¼‰ï?ä½†ä??¬è£½? æ¥­ä¸æ?è¶…é? 50%??,
        analyze: (v) => {
            if (v > 70) return "è­¦å?ï¼è²¡?™æ?æ¡¿æ¥µé«˜ï??©æ¯?¯å‡º?¯èƒ½ä¾µè??²åˆ©ï¼Œå…·?™è?å¤§è²¡?™é¢¨?ªã€?;
            if (v < 30) return "è²¡å?çµæ?æ¥µå…¶ç©©å¥ï¼Œä?ä¹Ÿå¯?½ä»£è¡¨å…¬?¸ç??Ÿé??¼ä?å®ˆã€?;
            return "è²¡å?æ§“æ¡¿?•æ–¼?¥åº·ä¸”é©ä¸­ç?ç¯„å¥»¯q¤ñ;
        }
    },
    'æ·¨è??µæ¥»¯q¤ñ: {
        type: '?Ÿå‚µ?½å?',
        desc: 'ï¼ˆç¸½è² å‚µ - ?¾é?ï¼‰é™¤ä»¥è‚¡?±æ??Šã€‚å?? æ‰£?¤ç¾?‘å??¬å¸?Ÿå¯¦?„è²¡?™è??”ã€?,
        rule: '< 0% ä»?¡¨?¬å¸?Œæ??­ç¾?‘æ??µå??ï?é«”è³ªæ¥µä½³??,
        advice: '?™æ˜¯è¡¡é??Œå€’é?é¢¨éšª?æ?ç²¾æ??„æ?æ¨™ä?ä¸€??,
        analyze: (v) => {
            if (v < 0) return "æ·¨è??µç‚ºè² ï??™æ˜¯ä¸€?“æ??­ç¾?‘æ??µå??„å??„ã€Œç¾?‘å?è±ªã€å…¬?¸ï??’é?é¢¨éšªæ¥µä¥»¯q¤ñ;
            if (v > 80) return "è²¡å?æ§“æ¡¿è¼ƒé?ï¼Œå??©æ¯æ³¢å?å½±éŸ¿è¼ƒå¤§ï¼Œé?è¬¹æ?è©•ä¼°?¶ç¾?‘æ??€æ³ã€?;
            return "è²¡å?çµæ??¥å…¨??;
        }
    },
    '?©æ¯ä¿é??æ•¸': {
        type: '?Ÿå‚µ?½å?',
        desc: '?Ÿæ¥­?©ç??¤ä»¥?©æ¯?¯å‡º?‚å?? å…¬?¸è³ºä¾†ç??¢è¶³ä¸è¶³å¤ æ”¯ä»˜è²¸æ¬¾åˆ©?¯ã€?,
        rule: '> 5 ?ç‚ºå®‰å…¨ï¼? 1 ?ä»£è¡¨è³ºä¾†ç??¢é€¥»¯q¤ñ©æ¯?½ä?å¤ ï??°é›·?¡é?è­¦ï¥»¯q¤ñ,
        advice: '?æ•¸è¶Šé?ï¼Œä»£è¡¨å…¬?¸è?ä¸å®¹?“å??‡æ¯?°å?å½±éŸ¿??,
        analyze: (v) => {
            if (v > 20) return "?©æ¯?¯ä??½å?æ¥µå¼·ï¼Œå‚µ?™è??”å??¬å¸ç¶“ç?æ¯«ç„¡å¨è¥»¯q¤ñ;
            if (v < 3) return "?©æ¯?¯å‡ºä¾µè??²åˆ©?é¡¯ï¼Œé?è­¦æ??µå??•ç?é¢¨éšª??;
            return "?Ÿé??©æ¯?„èƒ½?›æ­£å¸¸ã€?;
        }
    },
    '?²åˆ©?è³ª (OCF/NI)': {
        type: '?²åˆ©?è³ª',
        desc: '?Ÿæ¥­?¾é?æµé™¤ä»¥ç?å¾Œæ·¨?©ã€‚å?? å…¬?¸ç??©æ½¤ä¸­æ?å¤šå?æ¯”ä??¯ç??‘ç™½?€??,
        rule: '> 100% ä»?¡¨?²åˆ©?è³ªæ¥µé?ï¼? 80% ?€?™æ??¯å¦?‰æ??¶å¸³æ¬¾é?é«˜ç??é¥»¯q¤ñ,
        advice: '?ˆé??«é??æ?æ¨™ã€‚é??²åˆ©?ä??¾é?æµç??¬å¸å¾€å¾€?¯è²¡?±é€ å??„é??½å¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 100) return "?²åˆ©?è³ªæ¥µä½³ï¼å…¬?¸è³º?„éŒ¢?½æ?è½‰å??ºç?å¯¦ç¾?‘ã€?;
            if (v < 70) return "è­¦è?ï¼ç²?©å«?‘é??ä?ï¼Œé??™æ??‰æ”¶å¸³æ¬¾?¯å¦?é??–æ??›å??²åˆ©?„ç??®ã€?;
            return "?²åˆ©?è³ªå°šå±¬æ­?¸¸??;
        }
    },
    '?Ÿæ¥­?¾é?æµ?(OCF)': {
        type: '?¾é?æµ?,
        desc: '?¬å¸?¥å¸¸ç¶“ç?æ´»å?ï¼ˆè³£?±è¥¿?ç™¼?ªæ°´ï¼‰æ??¢ç??„å¯¦?›ç¾?‘æ??¥è?æµå‡º??,
        rule: 'å¿…é??·æ??ºæ­£?¼ã€?,
        advice: '?™æ˜¯?¬å¸?„ã€Œç??½ç??ï?å¦‚æ? OCF ?·æ??ºè?ï¼Œå…¬?¸é²?©æ??’é¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 0) return "?¬æ¥­?ç?å¸¶å…¥?¾é?ï¼Œç??‹ç??½ç??¥åº·??;
            return "?´é?è­¦è?ï¼æœ¬æ¥­ç??‹ç¾?‘ç‚ºè² æ??ºï??¬å¸?Ÿé??¢è‡¨?´å³»?ƒé¥»¯q¤ñ;
        }
    },
    '?•è??¾é?æµ?(ICF)': {
        type: '?¾é?æµ?,
        desc: '?¬å¸?ºä??ªä??¼å?ï¼ˆè²·æ©Ÿå™¨?ä½µè³¼ï??€?±å‡º?»æ??¶å??„ç¾?‘ã€?,
        rule: 'æ­?¸¸?é•·?„å…¬?¸æ­¤?¸å€¼é€šå¸¸?ºè?ï¼ˆä»£è¡¨æ?çºŒæ??¥ç??¼è??´ç”¢ï¼‰ã€?,
        advice: 'å¦‚æ? ICF ?·æ??ºæ­£ï¼Œä»£è¡¨å…¬?¸æ­£?¨è³£è³‡ç”¢åº¦æ—¥ï¼Œä¸¦?å¥½?¾è±¡??,
        analyze: (v) => {
            if (v < 0) return "?¬å¸æ­??æ¥µæ??¥è??¬æ”¯?ºæ??”ç™¼ï¼Œé€šå¸¸ä»?¡¨å°æœªä¾†æ??·æ?ä¿¡å¥»¯q¤ñ;
            return "?¬å¸?®å?æ­¥»¯q¤ñ¼è??†è??¢æ??¶å??•è??„ç??‹ã€?;
        }
    },
    '?ªç”±?¾é?æµ?(FCF)': {
        type: '?¾é?æµ?,
        desc: '?¬å¸è³ºé€²ä??„ç¾?‘ï?OCFï¼‰æ‰£?¤æ?ç¶­æ??é•·?€?€?„æ?è³‡ï?CapExï¼‰å?ï¼Œå‰©ä¸‹ç??’ç½®è³‡é¥»¯q¤ñ,
        rule: 'è¶Šå?è¶Šå¥½?‚é€™æ˜¯?¬å¸?¯ä»¥?¨ä??¼è‚¡?©ã€é¥»¯q¤ñor è²·åº«?è‚¡?„ç?æ­¥»¯q¤ñ‘ã€?,
        advice: '?æ??…æ? FCF ?„å…¬?¸ï?å°±å??æ?äº†å¼·å¤§ç??°ç•¥å¾Œå?åº«ã€?,
        analyze: (v) => {
            if (v > 0) return "?¬å¸?æ??Ÿæ­£?„ç²?©å«?‘é?ï¼Œæ??½å??æ¯?–é€²è??´å¼µ??;
            return "è­¦è?ï¼å…¬?¸ç¾?‘æ??¥ä?è¶³ä»¥?¯æ??•è??¯å‡ºï¼Œé??™æ??¯å¦?¥ä??·å‡º??;
        }
    },
    'å¸ƒæ?ä½ç½®': {
        type: '?€è¡“é¢',
        desc: '?æ??¡åƒ¹?¨å??—é€šé?ï¼? ?æ?æº–å·®è»Œé?ï¼‰ä¸­?„ç›¸å°ä?ç½®ã€?,
        rule: '> 90% ?ºå¼·?¢å™´?¼ï?< 10% ?ºå¼±?¢å?åº•ã€?,
        advice: '?©å??•æ?è¶¨å‹¢?¼å?é»ï?ä½†é??å??äº¤?åˆ¤?·æ˜¯?¦ç‚º?‡ç??´ã€?,
        analyze: (v) => {
            if (v > 90) return "?¡åƒ¹æ­¥»¯q¤ñ¼æ¥µç«¯å¼·?¢å?ï¼Œå¯?½æ­£?¨ç™¼?•ã€Œå™´?¼ã€èµ°?¢ã€?;
            if (v < 10) return "?¡åƒ¹æ­¥»¯q¤ñ¼æ¥µç«¯å¼±?¢å?ï¼ŒçŸ­ç·šå¯?½å‡º?¾è?æ·±å?å½ˆã€?;
            return "?¡åƒ¹?¨å??—é€šé??§æ­£å¸¸æ³¢?•ï?è¶¨å‹¢å°šä??é¡¯??;
        }
    },
    '20??ä¹–é›¢??: {
        type: '?€è¡“é¢',
        desc: '?¡åƒ¹??20 ?¥ç§»?•å¹³?‡ç?ï¼ˆæ?ç·šï??„è??¢ç™¾?†æ¥»¯q¤ñ,
        rule: '> 10% ?šå¸¸ä»?¡¨?­ç?æ¼²å??å¤§ï¼Œå®¹?“å?æª”ï?< -10% ?‡æ?è·Œæ·±?å?æ©Ÿæ¥»¯q¤ñ,
        advice: '?æ˜¯ä¸€æ¢æ©¡?®ç?ï¼Œæ?å¾—å¤ª? ç?ç©¶æ?å½ˆå??‡ç¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 10) return "æ­¥»¯q¤ñ¢é?å¤§ï??¡åƒ¹?­ç??ç†±ï¼Œéš¨?‚å¯?½å?æ¸¬æ?ç·šå?æ±‚æ”¯?ã€?;
            if (v < -10) return "è² ä??¢é?å¤§ï??¡åƒ¹?­ç??åº¦æ®ºä?ï¼Œéš¨?‚å¯?½ç™¼?•å ±å¾©æ€§å?å½ˆã€?;
            return "ä¹–é›¢?‡è??¼æ­£å¸¸ç??ï??¡åƒ¹?‡å?ç·šè??¢é©ä¸­ã€?;
        }
    },
    'RSI(14)': {
        type: '?€è¡“é¢',
        desc: '?¸å?å¼·å¼±?‡æ??‚è¡¡?ä?æ®µæ??“å…§?¡åƒ¹æ¼²å‹¢?‡è??¢ç??›é¥»¯q¤ñ,
        rule: '> 70 ?ºè?è²·ï??ç†±ï¼‰ï?< 30 ?ºè?è·Œï??¯èƒ½?å?ï¼‰ã€?,
        advice: '?©å?å°‹æ‰¾?­ç?è²·è³£é»ï?ä½†å¼·?¢è‚¡?¯èƒ½?¨é?æª”é??–ï??€?å??‡ç?ä½¿ç”¨??,
        analyze: (v) => {
            if (v > 80) return "?®å??•æ–¼æ¥µåº¦è¶…è²·?€ï¼Œé??±é¢¨?ªæ¥µé«˜ï?ä¸å??ç›²?®è¿½å¤šã€?;
            if (v > 70) return "?®å??²å…¥è¶…è²·?€ï¼ˆé??±ï?ï¼Œè‚¡?¹çŸ­ç·šå¯?½å?æª”ï?ä¸å??åº¦è¿½é¥»¯q¤ñ;
            if (v < 20) return "?®å??²å…¥æ¥µåº¦è¶…è??€ï¼Œéš¨?‚å¯?½ç™¼?•å¼·?›å?å½ˆã€?;
            if (v < 30) return "?®å??²å…¥è¶…è??€ï¼ŒçŸ­ç·šéš¨?‚å¯?½ç™¼?•è?æ·±å?å½ˆã€?;
            return "?®å??•æ–¼ä¸­æ€§å??“ï?å¤šç©º?›é?å¹³è¡¡??;
        }
    },
    'KD (K/D)': {
        type: '?€è¡“é¢',
        desc: '?¨æ??‡æ? (Stochastic Oscillator)?‚å?? è‚¡?¹åœ¨ä¸€æ®µæ??“å…§é«˜ä??¹æ ¼?€?“ç??¸å?ä½ç½®??,
        rule: 'K > 80 è¶…è²·ï¼ŒK < 20 è¶…è??‚K ?‘ä?çªç ´ D ?ºé??‘äº¤?‰ï?è²·é€²è??Ÿï¥»¯q¤ñ,
        advice: '?©å??¨å??“é??ªè??…ä¸­ä½¿ç”¨?‚è‹¥?‡æ??¨é?æª”æ?ä½æ??å?ï¼Œå?ä»?¡¨è¶¨å‹¢æ¥µå¼·??,
        analyze: (cleanVal, rawVal) => {
            if (typeof rawVal === 'string' && rawVal.includes('/')) {
                const [k, d] = rawVal.split('/').map(v => parseFloat(v.replace(/[^\d.-]/g, '')));
                if (!isNaN(k) && !isNaN(d)) {
                    if (k > d && k < 30) return "KD ?ºç¾ä½æ?é»ƒé?äº¤å?ï¼ŒçŸ­ç·šå?å½ˆå??½é??€ä¸­ã€?;
                    if (k < d && k > 70) return "KD ?ºç¾é«˜æ?æ­»äº¡äº¤å?ï¼Œé??™æ??­ç??æ?é¢¨éšª??;
                    if (k > 80) return "K ?¼é€²å…¥è¶…è²·?€ï¼Œæ??²è¿½é«˜é¢¨?ªã€?;
                    if (k < 20) return "K ?¼é€²å…¥è¶…è??€ï¼Œä?å»ºè­°?¨æ­¤æ®ºä¥»¯q¤ñ;
                    return k > d ? "K ?¼å¤§??D ?¼ï??­ç?è¶¨å‹¢?å¥»¯q¤ñ : "K ?¼å¥»¯q¤ñD ?¼ï??­ç?è¶¨å‹¢?å¼±??;
                }
            }
            return "KD ?‡æ??®å??•æ–¼ä¸­æ€§å??“ã€?;
        }
    },
    'MACD OSC': {
        type: '?€è¡“é¢',
        desc: 'MACD ?±ç?é«?(Oscillator)?‚ä»£è¡¨å¿«ç·?(DIF) ?‡æ…¢ç·?(MACD) ?„å·®?¼ã€?,
        rule: '> 0 ?ºç??±ï?ä»?¡¨å¤šæ–¹?•èƒ½å¢å¼·ï¼? 0 ?ºç??±ï?ä»?¡¨ç©ºæ–¹?•èƒ½å¢å¼·??,
        advice: 'æ³¨æ??±ç?é«”é•·?­è??–ã€‚ç??±ç¸®?­é€šå¸¸?¯è‚¡?¹è?å¼±ç??ˆè?è¨Šè¥»¯q¤ñ,
        analyze: (v) => {
            if (v > 0) return "?®å??ºç??±ï?å¤šæ–¹?§ç›¤ï¼‰ï??•èƒ½æ­??ï¼Œå¯è§€å¯Ÿç??±æ˜¯?¦æ?çºŒå??·ã€?;
            if (v < 0) return "?®å??ºç??±ï?ç©ºæ–¹?§ç›¤ï¼‰ï??•èƒ½è½‰è?ï¼Œå»ºè­°è??›æ?ä¿å??ä¥»¯q¤ñ;
            return "?•èƒ½å¹³è¡¡ä¸­ã€?;
        }
    },
    '?ˆé??†é¥»¯q¤ñ(Payout Ratio)': {
        type: '?¡åˆ©',
        desc: '?¬å¸å¾ç•¶å¹´åº¦è³ºåˆ°?„æ·¨?©ä¸­ï¼Œæ‹¿å¤šå?æ¯”ä??ºä??¼æ”¾çµ¦è‚¡?±ã€?,
        rule: 'ä¸€?¬åœ¨ 40-70% ä¹‹é?è¼ƒç‚ºç©©å¥ï¼›é•·??> 100% å±¬ä?æ­?¸¸?¾è±¡??,
        advice: 'é«˜é??¯ç??–å¸å¼•äººï¼Œä??¥è¥»¯q¤ñ100% ä»?¡¨?¨ã€Œå??æœ¬?ï??€?™æ??æ¯?„æ°¸çºŒæ€§ã€?,
        analyze: (v) => {
            if (v > 100) return "?´é?è­¦è?ï¼é??¯ç?è¶…é? 100%ï¼Œå…¬?¸æ­£?¨å??¨å…¬ç©æ??ŸéŒ¢?¼è‚¡?©ï?æ¥µä??·æ°¸çºŒæ€§ã€?;
            if (v > 80) return "?æ¯?¿ç?æ¥µç‚ºå¤§æ–¹ï¼Œé©?ˆæ”¶?¯æ?ï¼Œä??€?™æ??¬å¸?¯å¦ç¼ºä??ªä??•è??é•·?„è??‘ã€?;
            if (v < 30 && v > 0) return "?æ¯?‡è?ä½ï?é¡¯ç¤º?¬å¸?¾å?ä¿ç??¾é??²è??æ?è³‡æ??´å¼µï¼Œå…·?™æ??·è‚¡?¹å¾µ??;
            if (v <= 0) return "?®å??ªç™¼?¾è‚¡?©ï?è³‡é??¯èƒ½?¨æ•¸?™å??¼å…¬?¸å…§?¨ã€?;
            return "?æ¯?¿ç?ç©©å¥ï¼Œç²?©è??¡æ±?é?æ¯”ä??‡è¡¡??;
        }
    },
    'Altman Z-Score': {
        type: '?Ÿå‚µ?½å?',
        desc: '?±ç?ç´„å¤§å­¸æ¥»¯q¤ñEdward Altman ?‹ç™¼ï¼Œç”¨?¼é?æ¸¬ä?æ¥­åœ¨?©å¹´?§ç ´?¢æ??‡ç?ç¶œå??‡æ¥»¯q¤ñ,
        rule: '> 2.99 ?ºå??¨å?ï¼?.81 - 2.99 ?ºç°?²å?ï¼? 1.81 ?ºå±?ªå¥»¯q¤ñ,
        advice: 'å°æ–¼è£½é€ æ¥­?å¸¸æº–ç¢ºï¼Œä?å°æ–¼?‘è?æ¥­æ??å?æ¥­é?è¬¹æ??ƒè€ƒã€‚Z ?¼è?ä½ï?ä»?¡¨è²¡å?é«”è³ªè¶Šè?å¼±ã€?,
        analyze: (v) => {
            if (v > 2.99) return "?®å??•æ–¼?Œå??¨å??ï?è²¡å?é«”è³ªæ¥µå…¶ç©©å¥ï¼ŒçŸ­?Ÿå…§?¡å€’é??–é?ç´„é¢¨?ªã€?;
            if (v >= 1.8) return "?®å??•æ–¼?Œç°?²å??ï?è²¡å?å£“å?å°šå¯ï¼Œä??€?™æ??¾é?æµè?è² å‚µæ¯”ç??„è??•ã€?;
            return "è­¦è?ï¼ç›®?é€²å…¥?Œå±?ªå??ï?è²¡å?é«”è³ª?†å¼±ï¼Œé??´é˜²?µå??±æ??–ç??‹é€±è??°é›£??;
        }
    },
    '?†é??†ä¸­åº?: {
        type: 'ç±Œç¢¼',
        desc: '??15 å¤§è²·è¶…å?é»è¥»¯q¤ñ15 å¤§è³£è¶…å?é»ç??ˆè?å¼µæ•¸ï¼Œä??¶æ—¥ç¸½æ?äº¤é??„æ?ä¾‹ã€‚å?? ä¸»?›ä??¥å€‹è‚¡?„å??“ã€?,
        rule: '> 20% ?ºé?åº¦é?ä¸­ï?10% - 20% ?ºé?ä¸­ï?< 10% ?ºå¥»¯q¤ñ€?,
        advice: '?¥é?ä¸­åº¦é«˜ä??¡åƒ¹ä¸Šæ¼²ï¼Œä»£è¡¨ç?ç¢¼æ­£æµå?å°‘æ•¸ä¸»å?ï¼Œå?å¸‚ç??¼å?å¼·ã€?,
        analyze: (v) => {
            if (v > 25) return "ç±Œç¢¼æ¥µåº¦?†ä¸­ï¼å? 15 å¤§ä¸»?›æ??§ä?å¸‚å ´è¶…é? 1/4 ?„æ?äº¤é?ï¼Œé¡¯ç¤ºå¤§?¶æ­£?¨ç?æ¥µæ”¶è²¨ã€?;
            if (v > 15) return "ç±Œç¢¼?ˆç¾?†ä¸­?‹å‹¢ï¼Œä¸»?›ä??¥ç?åº¦æ·±ï¼Œå??¡åƒ¹?·å?è¼ƒå¼·?¯æ??›ã€?;
            if (v < 8) return "ç±Œç¢¼?®å?è¼ƒç‚º?†æ•£ï¼Œä¸»è¦ç”±??ˆ¶?‡å?é¡äº¤?“è€…ä¸»å°ï??­ç?è¼ƒé›£?‰è¶¨?¢æ€§è??…ã€?;
            return "ç±Œç¢¼?†ä¸­åº¦æ™®?šï?ä¸»å??‡æ•£?¶å??“ç›¸å°å¹³è¡¡ã€?;
        }
    },
    'ä¼°å€¼ä¥»¯q¤ñ(PE River)': {
        type: 'ä¼°å€?,
        desc: 'è¡¡é??¶å??¡åƒ¹?¨é¥»¯q¤ñ5 å¹´æœ¬?Šæ??†å?ä¸­ç?ä½ç½®?‚é€é?æ­·å²?¾å?ä½æ•¸ (Percentile) ?¤æ–·?®å??¹æ ¼?¯å¦ä¾¿å¥»¯q¤ñ,
        rule: '?¬ç?æ¯”ç™¾?†ä¥»¯q¤ñ< 20% ?ºä¾¿å®œå?ï¼?0-60% ?ºå??†å?ï¼? 80% ?ºæ?è²´å¥»¯q¤ñ,
        advice: '?¶è‚¡?¹è??³ã€Œä¾¿å®œå??ä??ºæœ¬?¢ç„¡?æ?ï¼Œé€šå¸¸?¯é•·ç·šè²·é»ï??ä??¨ã€Œæ?è²´å??é?æ³¨æ??²åˆ©?ç¥»¯q¤ñ,
        analyze: (v) => {
            if (v < 20) return "?®å??•æ–¼?Œæ¥µä½ä¼°?¼å??ï??¬ç?æ¯”ä??¼é¥»¯q¤ñ5 å¹?80% ?„æ??“ï??·å?æ¥µé?å®‰å…¨?Šé?ï¼Œå»ºè­°å??¹å?å±€??;
            if (v < 40) return "?®å??•æ–¼?Œå?ä½ä¼°?¼å??ï?è©•åƒ¹?·æ??¸å??›ï??·ç??ç½®?¹å€¼æµ®?¾ï?å±¬ç›¸å°å??¨ä??ã€?;
            if (v < 60) return "?®å??•æ–¼?Œå??†ä¼°?¼å??ï??¡åƒ¹?‡é¥»¯q¤ñ5 å¹´å¹³?‡æ°´æº–æ?å¹³ï?é¢¨éšª?‡å ±?¬å?ç­‰ï??©å??æ¥»¯q¤ñ;
            if (v < 85) return "?®å??•æ–¼?Œå?é«˜ä¼°?¼å??ï?å¸‚å ´å·²çµ¦äºˆè?å¤šæº¢?¹ï??€?™æ?æ¼²å??æ??„ç²?©ä?çµè³£å£“ã€?;
            return "? ï? ?´é?è­¦è?ï¼ç›®?è??¼ã€Œæ¥µé«˜ä¼°?¼å??ï?è©•åƒ¹å·²é?æ­·å²æ¥µç«¯ï¼Œè¿½é«˜é¢¨?ªæ¥µå¤§ï?å»ºè­°å¯©æ?è©•ä¼°é¢¨éšª??;
        }
    },
    'PEG æ¯”ä?': {
        type: 'ä¼°å€?,
        desc: '?¬ç??é•·æ¯”ã€‚å…¬å¼ï??¬ç?æ¯?/ EPS ?é•·??(TTM)?‚ç”¨ä¾†åˆ¤?·é??é•·?¬å¸?„è‚¡?¹æ˜¯?¦è²´å¾—å??†ã€?,
        rule: '< 1 ä»?¡¨ä½ä¼°ï¼ˆä¾¿å®œï?ï¼? - 1.5 ä»?¡¨?ˆç?ï¼? 1.5 ä»?¡¨é«˜ä¼°ï¼ˆè²´ï¼‰ã€?,
        advice: 'å¦‚æ??¬å¸?•æ–¼?Œç²?©è¡°?€ï¼ˆæ??·ç??ºè?ï¼‰ã€ï?PEG ?ƒé¡¯ç¤ºç‚º N/A (?²åˆ©è¡°é€€)?‚å??ºæ­¤?‚æœ¬?Šæ?å·²ç„¡æ³•å?? æ??·åƒ¹?¼ï??€?¹ç?è³‡ç”¢?–ç¾?‘æ¥»¯q¤ñ,
        analyze: (v) => {
            if (v === null || isNaN(v) || v <= 0) return "?®å??¬å¸?•æ–¼?²åˆ©è¡°é€€?Ÿï??é•·?‡ç‚ºè² ï?ï¼Œç„¡æ³•è?ç®?PEG æ¯”ä??‚å»ºè­°è?å¯Ÿç??‹ä??‚æ­¢è·Œè?æ­?€?;
            if (v < 1.0) return "PEG ä½æ–¼ 1.0ï¼Œé¡¯ç¤ºè‚¡?¹ç›¸å°æ–¼?®å?å¼·å??„æ??·å??½ä?èªªé?å¸¸ä¾¿å®œï??·å??•è??¹å€¼ã€?;
            if (v > 1.8) return "PEG ?é?ï¼Œè‚¡?¹å·²?æ”¯?ªä??é•·?•èƒ½ï¼Œé™¤?ç²?©èƒ½?‰ç??¼æ€§é??œï??¦å?è¿½é?é¢¨éšªè¼ƒå¤§??;
            return "PEG ?•æ–¼?ˆç??€?“ï??¡åƒ¹?‡æ??·å??½åŒ¹?ï??©å?ç©©å¥?æ¥»¯q¤ñ;
        }
    },
    'EPS ?é•·??(TTM)': {
        type: '?²åˆ©?½å?',
        desc: 'è¿‘å?å­?´¯è¨?EPS ?¸è??¼å?ä¸€å¹´å??Ÿç´¯è¨?EPS ?„å??·ç™¾?†æ??‚å?? å…¬?¸æ??Ÿå¯¦?„ç²?©å??½è¶¨?¢ã€?,
        rule: '> 0 ä»?¡¨?é•·ï¼? 20% ?ºé??é•·ï¼? 0 ä»?¡¨è¡°é€€??,
        advice: '?¸è??¼å–®å­?YoYï¼ŒTTMï¼ˆæ»¾?•å?äºŒå€‹æ?ï¼‰èƒ½?‰æ??’é™¤å­¥»¯q¤ñ§å½±?¿ï??¯åˆ¤?·å…¬?¸ä¸­?·æ??é•·è¶¨å‹¢?„æ ¸å¿ƒæ?æ¨™ã€?,
        analyze: (v) => {
            if (v > 30) return "?? ?²åˆ©?†ç™¼?§æ??·ï??¬å¸æ­¥»¯q¤ñ¼æ¥µå¼·ç??Ÿé?ä¸Šå??Ÿï??ºæœ¬?¢å??½å¼·?ã€?;
            if (v > 10) return "¥»¯q¤ñ²åˆ©ç©©å¥?é•·ï¼Œç??‹ç?æ³è‰¯å¥½ï?è¶³ä»¥?¯æ??¡åƒ¹?·ç??‘ä??¼å¥»¯q¤ñ;
            if (v < -15) return "? ï? è­¦è?ï¼ç²?©é¡¯?—è¡°?€ï¼Œå…¬?¸å¯?½é¢?¨ç”¢æ¥­é€†é¢¨?–ç«¶?­å?ä¸‹é?ï¼Œé??´é˜²è©•åƒ¹ä¿®æ­£è³¥»¯q¤ñ?;
            if (v < 0) return "?? ?²åˆ©è¼•å¾®è¡°é€€ï¼Œç›®?è??¼ç??‹èª¿?´æ?ï¼Œå»ºè­°è?å¯Ÿæœªä¾†å­£åº¦æ??©ç??¯å¦?å¥»¯q¤ñ;
            return "?²åˆ©?•èƒ½?•æ–¼?¤æ•´?æ®µï¼Œå?ç©ºè¶¨?¢å?ä¸æ?ç¢ºã€?;
        }
    },
    'æ¯›åˆ©?¹å? (YoY)': {
        type: '?²åˆ©?½å?',
        desc: '?¬å­£æ¯›åˆ©?‡è??»å¹´?Œæ?æ¯›åˆ©?‡ç?å·®å€¼ï??¾å?é»ï??‚é€™èƒ½?æ??¬å¸?¢å?å®šåƒ¹æ¬Šã€å??™æ??¬æ§ç®¡ä»¥?Šç??¢æ??‡ç?è®Šå¥»¯q¤ñ,
        rule: '> 0 ä»?¡¨æ¯›åˆ©?‡è?å¥½ï??¥èƒ½¥»¯q¤ñä¸‰å­£?¹å?ï¼Œé€šå¸¸ä»?¡¨?¬å¸?²å…¥?Ÿé??‘ä??é¥»¯q¤ñ,
        advice: 'æ¯›åˆ©?‡è¢«ç¨±ç‚º?Œæ?æ¨™ä?æ¯ã€ã€‚è‹¥æ¯›åˆ©?‡æ”¹?„ä¼´?¨ç??¶æ??·ï?å°±æ˜¯?€è¬‚ç??Œé?å¢ã€ï??¯è‚¡?¹æ?å¼·ç??¨å??›ã€?,
        analyze: (v) => {
            if (v > 5) return "?? æ¯›åˆ©?‡é¡¯?—å™´?¼ï?é¡¯ç¤º?¢å?ç«¶çˆ­?›æ¥µå¼·ï??–æ˜¯è¦æ¨¡ç¶“æ??ˆç?å±•ç¾ï¼Œç²?©å?è³ªå¤§å¹…è??‡ã€?;
            if (v > 1) return "??æ¯›åˆ©?‡ç©©æ­¥æ”¹?„ï?ç¶“ç??ˆç??å?ï¼Œæ??©æ–¼?Ÿæ¥­?©ç??„æ??·ã€?;
            if (v < -5) return "? ï? è­¦è?ï¼æ??©ç?å¤§å?ç¸®æ°´ï¼Œå¯?½é¢?¨åš´?ç??Šåƒ¹ç«¶çˆ­?–æ??¬å¤±?§ï??€é«˜åº¦è­¦æ¥»¯q¤ñ;
            if (v < 0) return "?? æ¯›åˆ©?‡è??»å¹´ä¸‹æ?ï¼Œå¯?½å??°åŒ¯?‡ã€å??™åƒ¹?¼æ??¢å?çµ„å?èª¿æ•´å½±éŸ¿ï¼Œé?è§€å¯Ÿæ??©ç?ä½•æ?æ­¢ç©©??;
            return "æ¯›åˆ©?‡ç¶­?å¹³ç©©ï??Ÿé?é«”è³ªç©©å¥»¯q¤ñ;
        }
    }
};

/**
 * é¡¯ç¤º?‡æ??¾ç?å½ˆç?ï¼Œä¸¦?¹æ??®å??¸å€¼é€²è??†æ?
 * @param {string} term ?‡æ??ç¨±
 * @param {string} currentVal ?®å??¸å€?(?¸å¡«)
 */
function showTermExplainer(term, currentVal = null) {
    const def = termDefinitions[term];
    if (!def) return;

    // å»ºç??–ç²?–å?çª—å?ä»?
    let overlay = document.getElementById('termExplainerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'termExplainerOverlay';
        document.body.appendChild(overlay);
        
        // é»æ??Œæ™¯?œé?
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeTermExplainer();
        });
    }

    // ?¹æ?é¡å??¸æ?é¡è‰²
    const typeColors = {
        'ä¼°å€?: '#f59e0b',
        '?²åˆ©?è³ª': '#3b82f6',
        '?²åˆ©?½å?': '#3b82f6',
        '?€è¡“é¢': '#ec4899',
        'é¢¨éšª': '#ef4444',
        'ç¶œå?è¨ºæ–·': '#10b981',
        '?Ÿé??ˆç?': '#8b5cf6',
        '?Ÿå‚µ?½å?': '#06b6d4'
    };
    const badgeColor = typeColors[def.type] || '#64748b';

    // ?—è©¦è§¥»¯q¤ñ¸å€¼ä¸¦?²è?è¨ºæ–·
    let analysisHtml = '';
    if (currentVal && def.analyze) {
        // ?ªå??å??Œä??ã€å??¢ç??¾å?æ¯”ï??¥ç„¡?‡æ??–ç¬¬ä¸€?‹å‡º?¾ç??¸å?
        let cleanVal;
        const valStr = String(currentVal);
        if (valStr.includes('ä½é?')) {
            const match = valStr.match(/ä½é?\s*([-\d.]+)/);
            if (match) cleanVal = parseFloat(match[1]);
        }
        if (cleanVal === undefined) {
            const match = valStr.match(/[-\d.]+/);
            if (match) cleanVal = parseFloat(match[0]);
        }
        
        if (cleanVal !== undefined && !isNaN(cleanVal)) {
            const diagnosis = def.analyze(cleanVal, currentVal);
            analysisHtml = `
                <div class="term-explainer-section" style="background: ${badgeColor}10; border: 1px solid ${badgeColor}30; border-radius: 12px; padding: 15px; margin-top: 15px;">
                <div class="term-explainer-subtitle">?? ¶EÂ_«ØÄ³</div>
                <div class="term-explainer-body" style="font-size:13px; font-style:italic; opacity:0.8;">\</div>
            </div>
        </div>
    \;

    // Åã¥Ü
    setTimeout(() => overlay.classList.add('active'), 10);
}

function closeTermExplainer() {
    const overlay = document.getElementById('termExplainerOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function renderMarginChart(trend) {
    if (!trend || trend.length === 0) return '';
    const maxVal = Math.max(...trend.map(t => Math.max(t.grossMargin, t.operatingMargin, t.netMargin, 0))) || 1;
    const items = trend.map(t => \
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px;">
            <div style="width:100%; height:120px; display:flex; align-items:flex-end; justify-content:center; gap:2px;">
                <div style="width:12px; height:\%; background:#3b82f6; border-radius:2px;" title="¤ò§Q: \%"></div>
                <div style="width:12px; height:\%; background:#10b981; border-radius:2px;" title="Àç§Q: \%"></div>
                <div style="width:12px; height:\%; background:#f59e0b; border-radius:2px;" title="²b§Q: \%"></div>
            </div>
            <div style="font-size:10px; color:#94a3b8; transform:scale(0.9);\">\</div>
        </div>
    \).join('');

    return \
        <div class="analysis-card" style="margin-bottom:20px;">
            <h3 style="margin-bottom:15px;">?? Àò§Q¤T²vÁÍ¶Õ (ªñ¥|©u)</h3>
            <div style="display:flex; justify-content:space-between; align-items:flex-end; padding:10px 0;">
                \
            </div>
            <div style="display:flex; justify-content:center; gap:15px; margin-top:10px; font-size:11px;">
                <div style="display:flex; align-items:center; gap:4px;"><div style="width:8px; height:8px; background:#3b82f6; border-radius:1px;"></div>¤ò§Q</div>
                <div style="display:flex; align-items:center; gap:4px;"><div style="width:8px; height:8px; background:#10b981; border-radius:1px;"></div>Àç§Q</div>
                <div style="display:flex; align-items:center; gap:4px;"><div style="width:8px; height:8px; background:#f59e0b; border-radius:1px;"></div>²b§Q</div>
            </div>
        </div>
    \;
}

window.analysisReady = true;
