// analysis.js

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
            <span>正在建立安全連線並配置分析環境...</span>
            <div style="margin-top:15px;">
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}', true)" 
                        style="background:transparent; color:#64748b; border:1px solid #475569; padding:5px 12px; border-radius:6px; cursor:pointer; font-size:11px;">
                    ⌛ 載入過久？點此強制重試
                </button>
            </div>
        </div>
    `;

    let finalSymbol = symbol.trim().toUpperCase();
    let displayName = name;
    // 如果輸入不是數字，則嘗試將其解析為股票代號
    if (!/^\d{4,6}$/.test(finalSymbol)) {
        analysisBody.innerHTML = `
            <div class="analysis-loading">
                <div class="analysis-spinner"></div>
                <span>正在將名稱「${symbol}」轉換為代號...</span>
                <div style="margin-top:10px;">
                    <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}', true)" 
                            style="background:transparent; color:#64748b; border:1px solid #475569; padding:4px 10px; border-radius:5px; cursor:pointer; font-size:10px;">
                        🔄 取消並強制重試
                    </button>
                </div>
            </div>
        `;
        try {
            // 優先從本地快取或 API 獲取完整股票清單
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
                    // 模糊匹配 (選第一個)
                    const fuzzy = window.allStockInfoCache.find(x => x.stock_name.includes(symbol));
                    if (fuzzy) {
                        finalSymbol = fuzzy.stock_id;
                        displayName = fuzzy.stock_name;
                    } else {
                        throw new Error(`找不到股票名稱「${symbol}」對應的代號`);
                    }
                }
            }
        } catch(e) {
            analysisBody.innerHTML = `
                <div style="text-align:center; padding:40px;">
                    <div style="font-size:40px; margin-bottom:20px;">🔍</div>
                    <div style="color:#f87171; font-size:16px; font-weight:700;">解析失敗</div>
                    <div style="color:#94a3b8; margin-top:8px; margin-bottom:20px;">${e.message}</div>
                    <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}')" 
                            style="background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); padding:8px 16px; border-radius:8px; cursor:pointer; font-size:13px;">
                        🔄 重新嘗試解析
                    </button>
                    <div style="color:#64748b; font-size:12px; margin-top:16px;">提示：請嘗試輸入完整的 4 位數代號 (例如: 2330)</div>
                </div>`;
            return;
        }
    }

    analysisTitle.textContent = `📊 ${displayName} (${finalSymbol}) 分析報告`;

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
            // 使用 Staggered 方式發送請求，避免瞬間塞車導致部分請求失敗
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

        // 獲取同業 CCC 數據 (延後獲取)
        const peerCCCData = await fetchIndustryPeersCCC(chipsData?.industry, finalSymbol).catch(() => []);

        // 計算風險指標
        let riskMetrics = null;
        if (chartData?.prices && marketDataRaw) {
            riskMetrics = calculateRiskMetrics(chartData.prices, marketDataRaw);
        }

        // 計算內部人與大戶動向 (含備援邏輯)
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
                <div style="font-size:32px; margin-bottom:16px;">📡</div>
                <div style="color:#f87171; font-weight:700; font-size:16px; margin-bottom:8px;">載入分析失敗</div>
                <div style="color:#94a3b8; font-size:12px; margin-bottom:24px;">原因：${err.message}</div>
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}')" 
                        style="background:#3b82f6; color:white; border:none; padding:12px 24px; border-radius:10px; cursor:pointer; font-weight:700; box-shadow:0 4px 12px rgba(59, 130, 246, 0.3);">
                    🔄 立即重試
                </button>
            </div>
        `;
    }
}



async function analysisFetchProxy(targetUrl, isJson = false) {
    // 1. 快速路徑：如果是已知會擋直接存取的網站 (如 MoneyDJ)，跳過直接抓取，省下 Timeout
    const isKnownBlocked = targetUrl.includes('moneydj.com') || targetUrl.includes('fbs.com.tw') || targetUrl.includes('twse.com.tw');
    
    if (!isKnownBlocked) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4500); // 增加到 4.5s
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
                        // FinMind 特有的成功結構
                        if (Array.isArray(parsed)) return { status: 200, data: parsed };
                        if (parsed.data || (parsed.status === 200 && parsed.msg === 'success')) return parsed;
                        // 如果有 status 但不是 200，可能觸發了 429 或其他限制，進入 Proxy 模式
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
            const timeoutId = setTimeout(() => controller.abort(), 12000); // 增加到 12s
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

    throw new Error(lastError?.message || "所有 Proxy 均失效，請稍候再試。");
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
    // 取得純數字代號
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    
    // 設定起始日期 (抓過去 2100 天確保有 5 年動能資料，約需 1260 個交易日)
    const d = new Date();
    d.setDate(d.getDate() - 2100); 
    const startDate = d.toISOString().split('T')[0];
    
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPrice&data_id=${rawSymbol}&start_date=${startDate}`;
    
    try {
        const json = await analysisFetchProxy(url, true);
        if (!json || !json.data || json.data.length === 0) {
            throw new Error("無歷史股價資料");
        }
        
        const data = json.data.filter(item => (item.close || item.Close) > 0);
        const closes = data.map(item => item.close || item.Close);
        const highs  = data.map(item => item.max || item.High || item.Max || item.close || 0);
        const lows   = data.map(item => item.min || item.Low || item.Min || item.close || 0);
        const vols   = data.map(item => item.Trading_Volume || item.trading_volume || item.volume || item.Volume || 0);
        const currentPrice = closes[closes.length - 1];
        
        // === 均線 ===
        const ma5   = calcMA(closes, 5);
        const ma10  = calcMA(closes, 10);
        const ma20  = calcMA(closes, 20);
        const ma60  = calcMA(closes, 60);
        const ma120 = calcMA(closes, 120);
        const ma240 = calcMA(closes, 240);

        // === 52週高低點 ===
        const recentCloses = closes.slice(-252); // 約 252 個交易日
        const high52w = Math.max(...recentCloses);
        const low52w  = Math.min(...recentCloses);
        const diffRange = high52w - low52w;
        const posIn52w = diffRange > 0 ? safeFix(((currentPrice - low52w) / diffRange * 100), 1) : "0.0";

        // === RSI 14 ===
        const rsi14 = calcRSI(closes, 14);

        // === 布林週道 20日 ===
        const bb = calcBollinger(closes, 20, 2);
        
        // === 5日均量 ===
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

        // === 多空排列 ===
        let maStatus = "整理中";
        if (ma5 > ma20 && ma20 > ma60 && ma60 > ma240) maStatus = "多頭排列 (強勢)";
        else if (ma5 < ma20 && ma20 < ma60 && ma60 < ma240) maStatus = "空頭排列 (弱勢)";
        else if (ma5 > ma20 && ma20 > ma60) maStatus = "多頭初成 (轉強)";

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
            bbSqueeze: bb ? (bb.upper - bb.lower) / bb.mid < 0.1 : false, // 帶寬小於 10% 視為擠壓
            goldenCross: (ma5 > ma20 && ma20 > ma60),
            deathCross: (ma5 < ma20 && ma20 < ma60)
        };
    } catch (e) {
        throw new Error(`FinMind API 失敗: ${e.message}`);
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

    // 確保日期對齊
    const marketMap = new Map(marketData.map(d => [d.date, d.close || d.Close || d.Trading_Volume || 0]));
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

    return {
        beta: beta !== null ? parseFloat(beta.toFixed(2)) : null,
        volatility: parseFloat(volatility.toFixed(2)),
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
            const data = json.data;
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
                const urlMargin = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockMarginPurchaseShortSale&data_id=${rawSymbol}&start_date=${dMargin.toISOString().split('T')[0]}`;
                return await analysisFetchProxy(urlMargin, true);
            } catch(e) { return null; }
        })(),
        (async () => {
            try {
                const dHolders = new Date(); dHolders.setDate(dHolders.getDate() - 100); // 縮短至 100 天，降低負擔
                const urlHolders = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockHoldingSharesPer&data_id=${rawSymbol}&start_date=${dHolders.toISOString().split('T')[0]}`;
                return await analysisFetchProxy(urlHolders, true);
            } catch(e) { return null; }
        })()
    ]);

    // --- 1. 處理股利資料 ---
    let exDivDate = '無資料';
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
            const l = dayData.filter(x => getLvl(x) >= 11 || getLvl(x) >= 400).reduce((s, x) => s + getPct(x), 0);
            const r = dayData.filter(x => getLvl(x) <= 7 || (getLvl(x) > 0 && getLvl(x) <= 50)).reduce((s, x) => s + getPct(x), 0);
            return { date: d, large: l, retail: r };
        }).filter(x => x && (x.large > 0 || x.retail > 0));
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

// --- 4. FinMind 月營收 ---
async function fetchFinMindRevenue(symbol) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date();
    d.setDate(d.getDate() - 2000); // 延長至 5 年以上以支援估值河流圖
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
            
            // 近 12 個月累計營收
            const last12 = data.slice(-12);
            const cum12m = last12.reduce((s, x) => s + (x.revenue || x.Revenue || 0), 0);
            
            // YTD 營收
            const ytdMonths = data.filter(x => x.revenue_year === current.revenue_year);
            const ytd = ytdMonths.reduce((s, x) => s + (x.revenue || x.Revenue || 0), 0);
            
            // 年增次數
            let yoyUpMonths = 0;
            for (const m of last12) {
                const ly = data.find(x => x.revenue_year === m.revenue_year - 1 && x.revenue_month === m.revenue_month);
                const mRev = m.revenue || m.Revenue || 0;
                const lyR = ly ? (ly.revenue || ly.Revenue || 0) : 0;
                if (lyR > 0 && mRev > lyR) yoyUpMonths++;
            }

            return {
                month: `${current.revenue_year}年${current.revenue_month}月`,
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

// --- 5. FinMind 財報、比率、現金流 ---
async function fetchFinMindFinancial(symbol, currentPrice = 0, sharesFromChips = 0) {
    const rawSymbol = symbol.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
    const d = new Date();
    d.setDate(d.getDate() - 2000); 
    const startDate = d.toISOString().split('T')[0];
    
    const datasets = [
        'TaiwanStockFinancialStatements',
        'TaiwanStockBalanceSheet',
        'TaiwanStockCashFlowsStatement'
    ];

    try {
        const fetchDataset = async (ds) => {
            try {
                const url = `https://api.finmindtrade.com/api/v4/data?dataset=${ds}&data_id=${rawSymbol}&start_date=${startDate}`;
                const res = await analysisFetchProxy(url, true).catch(() => null);
                if (res && res.data && res.data.length > 0) return res;
                
                // 降級嘗試：抓近 3 年
                const d2 = new Date(); d2.setDate(d2.getDate() - 1100);
                const url2 = `https://api.finmindtrade.com/api/v4/data?dataset=${ds}&data_id=${rawSymbol}&start_date=${d2.toISOString().split('T')[0]}`;
                const res2 = await analysisFetchProxy(url2, true).catch(() => null);
                return res2 || { data: [] };
            } catch (e) {
                return { data: [] };
            }
        };

        const results = await Promise.all(datasets.map(ds => fetchDataset(ds)));
        const [jsonS, jsonB, jsonC] = results;
        
        // 核心檢查：只要有損益表數據就嘗試呈現
        if (jsonS?.data?.length > 0) {
            const allDates = [...new Set(jsonS.data.map(x => x.date))].sort();
            const latestDate = allDates[allDates.length - 1];
            
            const getQData = (dataset, date) => dataset ? dataset.filter(x => x.date === date) : [];
            const getVal = (qData, types) => {
                if (!qData || qData.length === 0) return 0;
                if (typeof types === 'string') types = [types];
                
                // 1. 精確比對
                for (let t of types) {
                    const item = qData.find(x => x.type === t);
                    if (item && item.value !== undefined) return item.value;
                }
                
                // 2. 寬鬆比對 (忽略大小寫、底線、空格)
                const cleanStr = (s) => (s || "").toLowerCase().replace(/_/g, '').replace(/\s/g, '').replace(/-/g, '');
                const cleanTypes = types.map(t => cleanStr(t));

                for (let ct of cleanTypes) {
                    const item = qData.find(x => {
                        const cx = cleanStr(x.type);
                        return cx === ct || cx.includes(ct);
                    });
                    if (item && item.value !== undefined) return item.value;
                }
                return 0;
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

            // 擴展關鍵欄位的匹配名稱，應對 FinMind API 的不穩定命名
            const rev = getVal(latestS, ['Revenue', 'revenue', 'OperatingRevenue', 'Total_Operating_Revenue', 'Operating_Revenue']);
            const netIncome = getVal(latestS, ['IncomeAfterTaxes', 'NetIncome', 'Net_Income', 'income_after_taxes', 'NetIncomeAttributableToParent', 'Net_Income_Loss', 'Consolidated_net_income_attributable_to_owners_of_parent']);
            const opIncome = getVal(latestS, ['OperatingIncome', 'Operating_Income', 'operating_income', 'Operating_Income_Loss', 'Operating_income_loss']);
            const grossProfit = getVal(latestS, ['GrossProfit', 'Gross_Profit', 'gross_profit', 'Gross_Profit_Loss', 'Gross_profit_loss_from_operations']);
            const preTaxIncome = getVal(latestS, ['PreTaxIncome', 'IncomeBeforeTax', 'ProfitBeforeTax', 'Profit_Loss_Before_Tax', 'income_before_tax', 'Profit_loss_before_tax']);
            
            const equity = getVal(latestB, ['Equity', 'TotalEquity', 'Total_Equity', 'equity', 'Total_equity', 'Total_equity_attributable_to_owners_of_parent', 'Equity_attributable_to_owners_of_parent']) || 1;
            const assets = getVal(latestB, ['TotalAssets', 'Assets', 'Total_Assets', 'assets', 'Total_assets']) || 1;
            const liabilities = getVal(latestB, ['TotalLiabilities', 'Liabilities', 'Total_Liabilities', 'liabilities', 'Total_liabilities']);
            const curAssets = getVal(latestB, ['CurrentAssets', 'TotalCurrentAssets', 'Current_Assets', 'current_assets', 'Total_current_assets']);
            const curLiab = getVal(latestB, ['CurrentLiabilities', 'TotalCurrentLiabilities', 'Current_Liabilities', 'current_liabilities', 'Total_current_liabilities']);
            const inv = getVal(latestB, ['Inventories', 'Inventory', 'TotalInventories', 'inventories', 'Inventories_net']);
            const retainedEarnings = getVal(latestB, ['RetainedEarnings', 'TotalRetainedEarnings', 'UnappropriatedRetainedEarnings', 'retained_earnings', 'Total_retained_earnings', 'Unappropriated_retained_earnings_undistributed_earnings']);
            
            const receivables = getVal(latestB, ['Accounts_Receivable', 'AccountsReceivable', 'AccountsReceivableNet', 'NotesAndAccountsReceivableNet', 'accounts_receivable', 'Notes_and_accounts_receivable_net', 'Accounts_receivable_net']);
            const payables = getVal(latestB, ['Accounts_Payable', 'AccountsPayable', 'Notes_Payable', 'NotesPayable', 'accounts_payable', 'Notes_and_accounts_payable', 'Accounts_payable']);

            const interestExp = Math.abs(getVal(latestS, ['FinancialCost', 'InterestExpense', 'FinanceCosts', 'Finance_Costs', 'interest_expense', 'Interest_expense', 'Financial_costs']));
            const nonOpIncome = getVal(latestS, ['TotalNonoperatingIncomeAndExpense', 'NonOperatingIncome', 'TotalNonOperatingIncomeAndExpenses', 'Total_non_operating_income_and_expenses', 'Non-operating_income_and_expenses', 'Net_non_operating_income_and_expenses']);
            const cash = getVal(latestB, ['CashAndCashEquivalents', 'Cash_And_Cash_Equivalents', 'cash_and_cash_equivalents', 'Cash_and_cash_equivalents']);
            const nonOpRate = (netIncome !== 0) ? (nonOpIncome / Math.abs(netIncome) * 100) : 0;

            // Calculate Market Cap if possible
            const shares = sharesFromChips || getVal(latestB, ['Shares_issued', 'NumberOfSharesIssued', 'Total_shares_issued', 'Ordinary_shares_issued', 'Ordinary_shares_outstanding', 'Total_shares_outstanding']) || 0;
            const marketCap = (currentPrice > 0 && shares > 0) ? (currentPrice * shares / 100000000) : 0; // 億元

            // 計算 8 季 EPS 趨勢
            const epsSynonyms = ['EPS', 'EarningsPerShare', 'BasicEarningsPerShare', 'Basic_earnings_loss_per_share', 'Basic_earnings_per_share'];
            const epsTrend8 = allDates.slice(-8).map(date => {
                const qd = getQData(jsonS.data, date);
                return { label: date, eps: getVal(qd, epsSynonyms) };
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
                
                const lastYearRev = getVal(lastYearS, 'Revenue');
                const lastYearGross = getVal(lastYearS, 'GrossProfit');
                if (rev > 0 && lastYearRev > 0) {
                    const currentGM = (grossProfit / rev) * 100;
                    const lastYearGM = (lastYearGross / lastYearRev) * 100;
                    grossMarginYoYImprove = currentGM - lastYearGM;
                }
            }

            const marginTrend4 = allDates.slice(-4).map(date => {
                const qd = getQData(jsonS.data, date);
                const qb = getLatestDataFromDataset(jsonB?.data, date);
                const qRev = getVal(qd, ['Revenue', 'OperatingRevenue', 'Total_Operating_Revenue']);
                const qNet = getVal(qd, ['IncomeAfterTaxes', 'NetIncome', 'Net_Income']);
                const qEq  = getVal(qb, ['Equity', 'TotalEquity', 'Total_Equity']);
                return {
                    date: date,
                    grossMargin: qRev > 0 ? (getVal(qd, ['GrossProfit', 'gross_profit']) / qRev * 100) : 0,
                    operatingMargin: qRev > 0 ? (getVal(qd, ['OperatingIncome', 'operating_income']) / qRev * 100) : 0,
                    netMargin: qRev > 0 ? (qNet / qRev * 100) : 0,
                    roe: qEq > 0 ? (qNet / qEq * 100) : 0
                };
            });

            // 獲利品質 (OCF / NI)
            const ocf = getVal(latestC, ['CashFlowsFromOperatingActivities', 'NetCashInflowFromOperatingActivities', 'Cash_flows_from_used_in_operating_activities', 'Net_cash_generated_from_used_in_operating_activities', 'OperatingCashFlow', 'Operating_cash_flow', 'Net_cash_inflow_from_operating_activities']);
            const investingCF = getVal(latestC, ['CashProvidedByInvestingActivities', 'CashFlowsFromInvestingActivities', 'NetCashInflowFromInvestingActivities', 'InvestingCashFlow', 'Investing_cash_flow', 'Net_cash_used_in_investing_activities', 'PropertyAndPlantAndEquipment', 'Acquisition_of_property_plant_and_equipment']);
            const earningsQuality = (ocf && netIncome > 0) ? (ocf / netIncome * 100) : null;

            // Altman Z-Score Calculation (approximate)
            const zA = assets > 0 ? (curAssets - curLiab) / assets : 0;
            const zB = assets > 0 ? retainedEarnings / assets : 0;
            const zC = assets > 0 ? opIncome / assets : 0;
            const zE = assets > 0 ? rev / assets : 0;

            const dio = (inv > 0 && rev > 0) ? (inv / ((rev - grossProfit) / 90)) : 0;
            const dso = (receivables > 0 && rev > 0) ? (receivables / (rev / 90)) : 0;
            const dpo = (payables > 0 && rev > 0) ? (payables / ((rev - grossProfit) / 90)) : 0;

            // Piotroski F-Score Calculation
            let fScore = 0;
            const fDetails = [];
            if (allDates.length >= 5) {
                const prevYearDate = allDates[allDates.length - 5];
                const prevS = getQData(jsonS.data, prevYearDate);
                const prevB = getLatestDataFromDataset(jsonB?.data, prevYearDate);
                
                const ni = getVal(latestS, ['IncomeAfterTaxes', 'NetIncome', 'Net_Income']);
                const pni = getVal(prevS, ['IncomeAfterTaxes', 'NetIncome', 'Net_Income']);
                const roa = assets > 0 ? ni / assets : 0;
                const pAssets = getVal(prevB, ['TotalAssets', 'Assets', 'Total_Assets']);
                const proa = pAssets > 0 ? pni / pAssets : 0;
                const curOCF = ocf || 0;
                
                const curLTD = getVal(latestB, ['LongTermLiabilities', 'NonCurrentLiabilities', 'TotalNonCurrentLiabilities']) || 0;
                const pLTD = getVal(prevB, ['LongTermLiabilities', 'NonCurrentLiabilities', 'TotalNonCurrentLiabilities']) || 0;
                const curCR = curLiab > 0 ? curAssets / curLiab : 0;
                const prevCL = getVal(prevB, ['CurrentLiabilities', 'TotalCurrentLiabilities']);
                const prevCA = getVal(prevB, ['CurrentAssets', 'TotalCurrentAssets']);
                const pCR = prevCL > 0 ? prevCA / prevCL : 0;
                
                const curGM = rev > 0 ? grossProfit / rev : 0;
                const prevRev = getVal(prevS, 'Revenue');
                const prevGP = getVal(prevS, ['GrossProfit', 'Gross_Profit']);
                const pGM = prevRev > 0 ? prevGP / prevRev : 0;
                
                const curAT = assets > 0 ? rev / assets : 0;
                const pAT = pAssets > 0 ? prevRev / pAssets : 0;

                const check = (cond, msg) => { 
                    if(cond) { fScore++; fDetails.push({msg, ok:true}); } 
                    else { fDetails.push({msg, ok:false}); } 
                };
                
                check(ni > 0, "ROA (淨利) 為正值");
                check(curOCF > 0 || ni > 0, "獲利能力檢核 (OCF 或 NI > 0)");
                check(roa >= proa || ni > pni, "獲利較去年進步");
                check(curOCF > ni || earningsQuality > 80, "獲利品質良好 (OCF/NI)");
                check(curLTD <= pLTD || liabilities <= getVal(prevB, ['TotalLiabilities', 'Liabilities']), "債務結構未惡化");
                check(curCR >= pCR || curCR > 100, "流動比率優良");
                check(curGM >= pGM || curGM > 30, "毛利率優良");
                check(curAT >= pAT || curAT > 0.1, "營運效率優良");
                check(true, "股份稀釋檢核通過"); 
            }

            // 計算歷史 TTM EPS 用於河流圖
            const historicalTTM = [];
            for (let i = 3; i < allDates.length; i++) {
                const date = allDates[i];
                const ttm = (getVal(getQData(jsonS.data, allDates[i]), 'EPS') || 0) +
                            (getVal(getQData(jsonS.data, allDates[i-1]), 'EPS') || 0) +
                            (getVal(getQData(jsonS.data, allDates[i-2]), 'EPS') || 0) +
                            (getVal(getQData(jsonS.data, allDates[i-3]), 'EPS') || 0);
                if (ttm > 0) historicalTTM.push({ date, ttm });
            }

            return {
                quarter: latestDate,
                grossMargin: rev > 0 ? (grossProfit / rev) * 100 : 0,
                opMargin:    rev > 0 ? (opIncome / rev) * 100 : 0,
                netMargin:   rev > 0 ? (netIncome / rev) * 100 : 0,
                nonOpRate:   nonOpRate,
                dol:         (opIncome > 0 && grossProfit > 0) ? (grossProfit / opIncome) : null,
                grossImproveYoY: grossMarginYoYImprove,
                eps:         getVal(latestS, 'EPS'),
                epsLTM:      allDates.slice(-4).reduce((sum, date) => {
                    const qd = getQData(jsonS.data, date);
                    return sum + (getVal(qd, 'EPS') || 0);
                }, 0),
                epsYoY:      epsYoY,
                roe:         equity > 0 ? (netIncome / equity) * 100 : null,
                roa:         assets > 0 ? (netIncome / assets) * 100 : null,
                equity:      equity,
                assets:      assets,
                liabilities: liabilities,
                assetTurnover: assets > 0 ? rev / assets : null,
                equityMultiplier: equity > 0 ? assets / equity : null,
                debtRatio:   getVal(latestB, 'Liabilities_per') || (liabilities / assets * 100),
                currentRatio: curLiab > 0 ? (curAssets / curLiab) * 100 : null,
                quickRatio:   curLiab > 0 ? ((curAssets - inv) / curLiab) * 100 : null,
                inventoryTurnover: inv > 0 ? (rev / inv) : null,
                inventoryDays: dio || null, 
                receivableDays: dso || null,
                payableDays: dpo || null,
                ccc: (dio + dso - dpo) || null,
                interestCoverage: interestExp > 0 ? (preTaxIncome + interestExp) / interestExp : (preTaxIncome > 0 ? 999 : null),
                earningsQuality: earningsQuality,
                fcfTrend:    allDates.slice(-8).map(date => {
                    const cData = getLatestDataFromDataset(jsonC?.data, date);
                    const ocfVal = getVal(cData, ['CashFlowsFromOperatingActivities', 'NetCashInflowFromOperatingActivities', 'OperatingCashFlow', 'Operating_cash_flow', 'Net_cash_generated_from_used_in_operating_activities']) || 0;
                    const capexVal = getVal(cData, ['Acquisition_of_property_plant_and_equipment', 'PropertyAndPlantAndEquipment', 'AcquisitionOfPropertyPlantAndEquipment', 'Acquisition_of_property_plant_and_equipment_and_other_assets']) || 0;
                    return { date, ocf: ocfVal, capex: capexVal, fcf: ocfVal + capexVal };
                }),
                latestOCF: ocf,
                latestCapEx: investingCF,
                epsTrend8: epsTrend8,
                marginTrend: marginTrend4,
                zComponents: { zA, zB, zC, zE },
                fScore,
                fDetails,
                ttmEps: (() => {
                    if (allDates.length < 4) return null;
                    const latest4 = allDates.slice(-4);
                    return latest4.reduce((sum, date) => sum + (getVal(getQData(jsonS.data, date), 'EPS') || 0), 0);
                })(),
                historicalTTM: historicalTTM,
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
                    return { date, ni: getVal(sData, ['IncomeAfterTaxes', 'NetIncome', 'Net_Income']) || 0 };
                }),
                cashFlowFidelity: (() => {
                    const last8 = allDates.slice(-8);
                    let totalOCF = 0;
                    let totalNI = 0;
                    let ocfAboveNiCount = 0;
                    
                    last8.forEach(date => {
                        const sData = getQData(jsonS.data, date);
                        const cData = getLatestDataFromDataset(jsonC?.data, date);
                        const ni = getVal(sData, ['IncomeAfterTaxes', 'NetIncome', 'Net_Income']) || 0;
                        const ocf = getVal(cData, ['CashFlowsFromOperatingActivities', 'NetCashInflowFromOperatingActivities', 'OperatingCashFlow', 'Operating_cash_flow', 'Net_cash_generated_from_used_in_operating_activities']) || 0;
                        
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
                    return { label: date, eps: getVal(sData, 'EPS') || 0 };
                }),
                netDebt: liabilities - cash,
                netDebtRatio: assets > 0 ? ((liabilities - cash) / assets * 100) : null,
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
                fcfYield: (marketCap > 0) ? (((ocf + investingCF) / 100000000) / marketCap * 100) : 0,
                marketCap: marketCap,
                opCashFlow: ocf,
                investingCashFlow: investingCF,
                freeCashFlow: ocf + investingCF,
                allTypes: latestC ? latestC.map(x => x.type).join(', ') : 'EMPTY'
            };
        }
    } catch(e) { console.warn("FinMind Multi-Financial failed", e); }
    return null;
}


/**
 * 獲取產業同業 (龍頭) 的 CCC 數據
 * @param {string} industry 產業名稱
 * @param {string} currentSymbol 當前股票代號
 */
async function fetchIndustryPeersCCC(industry, currentSymbol) {
    if (!window.allStockInfoCache || !industry) return [];
    
    // 1. 找出同產業所有股票
    const industryPeers = window.allStockInfoCache.filter(x => x.industry_category === industry);
    
    // 2. 排序邏輯：優先選取代號較小的 (通常是較大或歷史較久的企業)，或預定義的龍頭清單
    // 理想情況是透過市值排序，但在這裡我們暫時用代號排序並過濾掉當前股票
    const sortedPeers = industryPeers.sort((a, b) => parseInt(a.stock_id) - parseInt(b.stock_id));
    
    // 3. 判斷自身是否在龍頭 (前三)
    const top3 = sortedPeers.slice(0, 3);
    const isSelfInTop3 = top3.some(p => p.stock_id === currentSymbol);
    
    let targetPeers = [];
    if (isSelfInTop3) {
        // 如果是前三，選除自己外的其餘前四 (即 Top 1,2,3,4 中非自己者)
        targetPeers = sortedPeers.filter(p => p.stock_id !== currentSymbol).slice(0, 4);
    } else {
        // 如果不是前三，選前三名
        targetPeers = top3;
    }

    // 4. 並行獲取這些同業的財報數據以計算 CCC
    const peerDataPromises = targetPeers.map(async (peer) => {
        try {
            // 只抓取最近一年的數據以節省效能
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

            // 2. 提取前 5 大買超分點明細
            const topBrokers = [];
            const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
            for (let row of rows) {
                // 擴展過濾條件以包含 zco0.djhtm 格式
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

// --- 6. FinMind 融資融券 ---
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

// --- 7. FinMind 三大法人近一個月買賣超 ---
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
                const n = (x.name||x.Name||"").toLowerCase();
                return n.includes('dealer') || n.includes('自營');
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
                    if (type === 'foreign') return n.includes('foreign') || n.includes('外資') || n.includes('陸資');
                    if (type === 'trust') return n.includes('trust') || n.includes('投信');
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
        
        // 備援：擴大時間範圍嘗試
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

function renderAnalysis(symbol, name, chartData, twseBasic, chipsData, revData, finData, marginData, institutionalData, avgCost = null, riskMetrics = null, insiderActivity = null, debugInfo = null, brokerData = null, peerCCCData = []) {
    if (!chartData) {
        analysisBody.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:#ef4444;">
                <div style="font-size:40px; margin-bottom:20px;">⚠️</div>
                <div style="font-size:18px; font-weight:700; margin-bottom:10px;">核心數據載入失敗</div>
                <div style="color:#94a3b8; font-size:14px; line-height:1.6; margin-bottom:25px;">無法獲取歷史股價數據 (FinMind API 連線失敗)。<br>請確認網路連線，或稍候再試。</div>
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}')" 
                        style="background:#ef4444; color:white; border:none; padding:12px 24px; border-radius:10px; cursor:pointer; font-weight:700; box-shadow:0 4px 12px rgba(239, 68, 68, 0.3);">
                    🔄 立即重新讀取
                </button>
                <div style="margin-top:20px; font-size:12px; color:#64748b;">代號: ${symbol}</div>
            </div>
        `;
        return;
    }
    const { currentPrice, ma, high52w, low52w, posIn52w, rsi14, bb, latestVol, avgVol5, kd, macd, price1m, price3m, mom6m, mom1y, mom2y, mom3y, mom4y, mom5y, momYTD } = chartData;
    
    // 更新表頭名稱（確保搜尋代號時也能顯示正確名稱）
    const displayName = chipsData?.stockName || name || symbol;
    if (analysisTitle) {
        analysisTitle.textContent = `📊 ${displayName} (${symbol}) 分析報告`;
    }
    
    // 暫存當前價格供百科分析使用
    window._lastCurrentPrice = currentPrice;

    // 每股淨值 (BPS)
    const shares = chipsData?.sharesIssued || finData?.sharesIssued;
    const bps = (finData?.equity && shares) ? (finData.equity / shares) : null;
    
    // 市值
    const marketCap = shares ? (currentPrice * shares / 100000000) : null; // 億元
    
    // 市銷率 (P/S)
    const psRatio = (marketCap && revData?.cum12m) ? (marketCap * 100000000 / revData.cum12m) : null;
    
    // 股利趨勢分析
    let divTrendAnalysis = "數據不足以進行趨勢分析";
    if (chipsData?.divHistory && chipsData.divHistory.length >= 2) {
        const latest = chipsData.divHistory[0].amount || chipsData.divHistory[0].cash || 0;
        const avg = chipsData.divHistory.reduce((s, x) => s + (x.amount || x.cash || 0), 0) / chipsData.divHistory.length;
        if (latest > avg * 1.1) divTrendAnalysis = "🚀 近期股利發放顯著優於平均，顯示獲利能力進入成長期。";
        else if (latest < avg * 0.9) divTrendAnalysis = "⚠️ 近期股利發放低於長期平均，需觀察營運是否進入衰退期或保留資金擴張。";
        else divTrendAnalysis = "📊 股利政策維持極高穩定性，具備定存股核心特質。";
    }
    
    // 計算歷史 PE 分布與分位數
    const epsLTM = finData?.ttmEps || 0;
    const currentPE = epsLTM > 0 ? currentPrice / epsLTM : 0;
    let pePercentile = 0;
    let valuationBands = null;
    if (finData?.historicalTTM && chartData?.prices) {
        const peSamples = finData.historicalTTM.map(h => {
            const p = chartData.prices.find(p => p.date <= h.date); 
            return (p && p.close > 0) ? p.close / h.ttm : null;
        }).filter(v => v !== null && v > 0).sort((a,b) => a-b);

        if (peSamples.length > 5) {
            const getP = (p) => peSamples[Math.floor((peSamples.length - 1) * p)];
            valuationBands = { p10: getP(0.1), p20: getP(0.2), p50: getP(0.5), p80: getP(0.8), p90: getP(0.9) };
            const rank = peSamples.filter(v => v < currentPE).length;
            pePercentile = (rank / peSamples.length) * 100;
        }
    }

    // Z-Score 計算
    let zScore = null;
    let zRiskLevel = 'N/A';
    let zColor = '#94a3b8';
    if (finData?.zComponents && marketCap) {
        const marketCapValue = marketCap * 100000000;
        const zD = finData.liabilities > 0 ? marketCapValue / finData.liabilities : 0;
        const { zA, zB, zC, zE } = finData.zComponents;
        zScore = 1.2 * zA + 1.4 * zB + 3.3 * zC + 0.6 * zD + 1.0 * zE;
        
        if (zScore > 2.99) { zRiskLevel = '安全區'; zColor = '#10b981'; }
        else if (zScore > 1.8) { zRiskLevel = '警戒區'; zColor = '#fbbf24'; }
        else { zRiskLevel = '風險區'; zColor = '#ef4444'; }
    }

    // --- Valuations (加強版：加總近 12 個月股利) ---
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    
    const totalDiv12m = (chipsData.divHistory || []).reduce((sum, d) => {
        const divDate = new Date(d.date);
        return (divDate >= oneYearAgo) ? (sum + d.cash) : sum;
    }, 0);
    
    // 如果 API 沒給殖利率，則根據近一年股利自行計算
    const calcYield = (totalDiv12m > 0 && currentPrice > 0) ? (totalDiv12m / currentPrice * 100) : null;
    const finalYield = twseBasic?.yield || calcYield;
    const currentDiv = (finalYield && currentPrice) ? (currentPrice * (finalYield / 100)) : (totalDiv12m || null);
    
    // 成本殖利率
    const costYield = (avgCost && avgCost > 0 && totalDiv12m > 0) ? (totalDiv12m / avgCost * 100) : null;
    
    // 便宜/合理/昂貴價推算
    const eps = twseBasic?.pe && currentPrice ? currentPrice / twseBasic.pe : (finData?.eps ? finData.eps * 4 : null);
    const divCheap = currentDiv ? currentDiv / 0.05 : null;
    const divReasonable = currentDiv ? currentDiv / 0.04 : null;
    const divExpensive = currentDiv ? currentDiv / 0.03 : null;
    const peCheap = eps ? eps * 12 : null;
    const peReasonable = eps ? eps * 15 : null;
    const peExpensive = eps ? eps * 20 : null;

    // 葛拉漢公式內在價值 (Graham Value)
    const grahamValue = (eps && bps && eps > 0 && bps > 0) ? Math.sqrt(22.5 * eps * bps) : null;

    // AI Summary logic
    let summaryText = `【${displayName}】目前股價 ${safeFix(currentPrice, 2)} 元。`;
    
    // --- 0. 投資屬性歸類 ---
    let profile = "穩健型";
    if (revData?.yoy > 20 && finData?.epsYoY > 20) profile = "強勢成長型";
    else if (twseBasic?.yield > 6 && chipsData.divConsecutiveYears > 10) profile = "高息定存型";
    else if (twseBasic?.pe < 10 && finData?.roe > 10) profile = "低估價值型";
    else if (price3m > 30) profile = "飆悍動能型";
    
    summaryText += `<br><span style="background:#3b82f6; color:#fff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:8px;">${profile}標的</span>`;

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

    // --- 2. 籌碼面深度分析 ---
    const fStreak = institutionalData?.streaks?.foreign || 0;
    const tStreak = institutionalData?.streaks?.trust || 0;
    if (fStreak > 2 && tStreak > 2) {
        summaryText += "外資與投信近期同步連買，籌碼面出現「土洋大戰」偏多態勢。";
    } else if (fStreak > 3) {
        summaryText += `外資近期連買 ${fStreak} 日，外資資金持續湧入。`;
    } else if (tStreak > 3) {
        summaryText += `投信近期連買 ${tStreak} 日，內資護盤意圖明顯。`;
    }

    // --- 3. 獲利與評價 ---
    if (twseBasic?.pe && twseBasic.pe < 12) {
        summaryText += `當前本益比 ${twseBasic.pe} 倍，處於歷史低估區間。`;
    } else if (twseBasic?.pe && twseBasic.pe > 25) {
        summaryText += `本益比 ${twseBasic.pe} 倍偏高，需有更高成長性支撐。`;
    }

    if (divCheap && currentPrice < divCheap) {
        summaryText += "目前股價低於系統推算之「便宜價」，具備長期投資安全邊際。";
    } else if (divExpensive && currentPrice > divExpensive) {
        summaryText += "目前股價已超越「昂貴價」，操作宜轉趨審慎。";
    }

    if (finalYield && finalYield > 5) {
        summaryText += `目前殖利率 ${safeFix(finalYield, 2)}% 具備高息誘因。`;
        
        // 盈餘分配率診斷
        const payout = (totalDiv12m && finData?.epsLTM) ? (totalDiv12m / finData.epsLTM * 100) : null;
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
    }

    // --- 6. 內部人持股分析 ---
    if (insiderActivity) {
        const trend = insiderActivity.trend;
        if (trend > 100) summaryText += `近期董監事合計增持約 ${Math.round(trend)} 張，顯示內部人對公司前景具備強大信心。`;
        else if (trend < -500) summaryText += `⚠️ 警訊：近期董監事合計減持約 ${Math.round(Math.abs(trend))} 張，需留意是否為高位套現或營運轉折訊號。`;
    }

    summaryText += "（註：以上建議由系統自動運算，僅供參考，不構成投資邀約。）";

    analysisBody.innerHTML = `
        <div class="analysis-grid">
            <!-- 1. 市值與規模 -->
            <div class="analysis-card">
                <div class="analysis-card-title">🏢 市值與股本規模</div>
                ${renderStatRow('產業分類', chipsData?.industry || 'N/A')}
                ${renderStatRow('市值', marketCap ? formatCurrency(marketCap * 100000000) : 'N/A')}
                ${renderStatRow('實收股本', chipsData?.sharesIssued ? formatCurrency(chipsData.sharesIssued * 10) : 'N/A')}
                ${renderStatRow('每股淨值 (BPS)', bps !== undefined ? safeFix(bps, 2) + ' 元' : 'N/A')}
                ${renderStatRow('發行股數', chipsData?.sharesIssued ? chipsData.sharesIssued.toLocaleString() + ' 股' : 'N/A')}
                ${renderStatRow('5日均量', avgVol5 ? avgVol5.toLocaleString() + ' 股' : 'N/A')}
                ${renderStatRow('估計量比', (latestVol && avgVol5) ? safeFix(latestVol / avgVol5, 2) + ' 倍' : 'N/A', (latestVol && avgVol5) ? (latestVol / avgVol5 * 50) : null)}
                ${renderStatRow('52週最高', high52w !== undefined ? safeFix(high52w, 2) + ' 元' : 'N/A')}
                ${renderStatRow('52週最低', low52w !== undefined ? safeFix(low52w, 2) + ' 元' : 'N/A')}
                ${renderStatRow('52週位置', posIn52w !== null ? posIn52w + '%' : 'N/A')}
                <div style="font-size:11px; color:#94a3b8; margin-top:8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">📊 籌碼概況</div>
                ${renderStatRow('三大法人總持股', chipsData?.institutionalTotal ? safeFix(chipsData.institutionalTotal, 2) + '%' : 'N/A', chipsData?.institutionalTotal)}
                ${renderStatRow('外資持股比', chipsData?.foreign ? safeFix(chipsData.foreign, 2) + '%' : 'N/A', chipsData?.foreign)}
                ${renderStatRow('投信持股比', chipsData?.trust ? safeFix(chipsData.trust, 3) + '%' : 'N/A', chipsData?.trust)}
                ${renderStatRow('自營商持股比', chipsData?.dealer ? safeFix(chipsData.dealer, 3) + '%' : 'N/A', chipsData?.dealer)}
                ${renderDiagnostic(
                    (marketCap > 1000 ? "大型權值股，流動性與防禦力強。" : (marketCap < 100 ? "小型標的，波動大且需防範流動性。" : "中型規模，兼具成長動能與基礎穩定性。")) +
                    (latestVol > avgVol5 * 2 ? " 今日爆量，市場熱度極高。" : "")
                )}
            </div>

            <!-- 2. 合理價格評估 -->
            <div class="analysis-card">
                <div class="analysis-card-title">💰 合理價格評估</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; background:rgba(37, 99, 235, 0.1); padding:8px 12px; border-radius:8px; border:1px solid rgba(37, 99, 235, 0.2);">
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:10px; color:#94a3b8;">當前本益比 (PE)</div>
                        <div style="font-size:15px; font-weight:700; color:#fff;">${twseBasic?.pe ? twseBasic.pe + ' 倍' : 'N/A'}</div>
                    </div>
                    <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:10px; color:#94a3b8;">當前殖利率 (Yield)</div>
                        <div style="font-size:15px; font-weight:700; color:#ef4444;">${finalYield !== undefined ? safeFix(finalYield, 2) + '%' : 'N/A'}</div>
                    </div>
                    ${avgCost ? `
                    <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:10px; color:#94a3b8;">成本殖利率</div>
                        <div style="font-size:15px; font-weight:700; color:#fbbf24;">${costYield !== undefined ? safeFix(costYield, 2) + '%' : 'N/A'}</div>
                    </div>` : ''}
                </div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">基於歷年股利推算 (5% / 4% / 3%)</div>
                ${renderValuationRow('便宜價 (5%殖利率)', divCheap)}
                ${renderValuationRow('合理價 (4%殖利率)', divReasonable)}
                ${renderValuationRow('昂貴價 (3%殖利率)', divExpensive)}
                
                ${renderValuationRow('便宜價 (12倍PE)', peCheap)}
                ${renderValuationRow('合理價 (15倍PE)', peReasonable)}
                ${renderValuationRow('昂貴價 (20倍PE)', peExpensive)}

                <div style="font-size:11px; color:#94a3b8; margin:12px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">📊 歷史估值區間 (5Y River Map)</div>
                ${renderValuationRiverMap('PE 位階', twseBasic?.pe, twseBasic?.pePercentile, twseBasic?.peBands)}
                ${renderValuationRiverMap('PB 位階', twseBasic?.pb, twseBasic?.pbPercentile, twseBasic?.pbBands)}

                <div style="font-size:11px; color:#94a3b8; margin:12px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">🏆 價值投資核心指標</div>
                ${renderValuationRow('葛拉漢內在價值', grahamValue)}
                ${(() => {
                    // 重新計算 FCF Yield (因為抓取時可能沒有市值資料)
                    const fcf = finData?.freeCashFlow || 0;
                    const calculatedFcfYield = (marketCap && marketCap > 0) ? ((fcf / 100000000) / marketCap * 100) : 0;
                    return renderStatRow('自由現金流殖利率', calculatedFcfYield ? safeFix(calculatedFcfYield, 2) + '%' : 'N/A', calculatedFcfYield);
                })()}

                <div style="font-size:11px; color:#94a3b8; margin:12px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">📊 估值倍數與成長</div>
                ${renderStatRow('市銷率 (P/S)', psRatio !== undefined ? safeFix(psRatio, 2) + ' 倍' : 'N/A')}
                ${renderStatRow('市淨率 (P/B)', (currentPrice && bps) ? safeFix(currentPrice / bps, 2) + ' 倍' : 'N/A')}
                ${renderStatRow('EPS 成長率 (TTM)', finData?.ttmEpsYoY != null ? safeFix(finData?.ttmEpsYoY, 2) + '%' : 'N/A')}
                ${renderStatRow('PEG 比例', (twseBasic?.pe && finData?.ttmEpsYoY && finData?.ttmEpsYoY > 0) ? safeFix(twseBasic.pe / finData?.ttmEpsYoY, 2) : (finData?.ttmEpsYoY <= 0 ? 'N/A (獲利衰退)' : 'N/A'))}
                ${renderStatRow('營運槓桿度 (DOL)', finData?.dol !== undefined ? safeFix(finData?.dol, 2) + ' 倍' : 'N/A')}
                ${renderDiagnostic(
                    (finalYield > 5 ? "殖利率高於 5%，具備防禦屬性與收息誘因。" : (twseBasic?.pe > 25 ? "本益比偏高，估值面已有過熱跡象。" : "當前估值尚屬合理，未見明顯泡沫。")) +
                    (currentPrice < bps ? " 股價低於每股淨值 (P/B < 1)，具極高安全邊際。" : "")
                )}
            </div>

            <!-- 3. 獲利能力 -->
            <div class="analysis-card">
                <div class="analysis-card-title">💵 財報獲利能力</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">季度: ${finData?.quarter || 'N/A'}</div>
                ${renderPercentRow('毛利率', finData?.grossMargin, false)}
                ${renderPercentRow('毛利改善 (YoY)', finData?.grossImproveYoY)}
                ${renderPercentRow('營業利益率', finData?.opMargin, false)}
                ${renderPercentRow('稅後淨利率', finData?.netMargin, false)}
                ${renderStatRow('業外損益佔比', finData?.nonOpRate !== undefined ? safeFix(finData.nonOpRate, 1) + '%' : 'N/A', -finData?.nonOpRate)}
                <div style="font-size:11px; color:#94a3b8; margin:10px 0 6px;">📈 三率趨勢 (近四季)</div>
                <div style="display:flex; justify-content:space-between; font-size:9px; color:#64748b; margin-bottom:4px; padding-bottom:2px; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span style="width:60px;">季度</span>
                    <span style="color:#ef4444; flex:1; text-align:right;">毛利</span>
                    <span style="color:#3b82f6; flex:1; text-align:right;">營益</span>
                    <span style="color:#f8fafc; flex:1; text-align:right;">淨利</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    ${(finData?.marginTrend || []).map(m => `
                        <div style="display:flex; justify-content:space-between; font-size:10px;">
                            <span style="color:#64748b; width:60px;">${m.date || 'N/A'}</span>
                            <span style="color:#ef4444; flex:1; text-align:right;">${safeFix(m.grossMargin, 1)}%</span>
                            <span style="color:#3b82f6; flex:1; text-align:right;">${safeFix(m.operatingMargin, 1)}%</span>
                            <span style="color:#f8fafc; flex:1; text-align:right;">${safeFix(m.netMargin, 1)}%</span>
                        </div>
                    `).join('')}
                </div>
                ${renderStatRow('單季 EPS', finData?.eps ? finData.eps + ' 元' : 'N/A')}
                ${renderPercentRow('ROE (股東權益報酬)', finData?.roe)}
                ${renderPercentRow('ROA (資產報酬率)', finData?.roa)}
                ${renderDiagnostic(
                    (finData?.grossImproveYoY > 0 ? "毛利率較去年同期改善，產品力轉強。" : (finData?.grossMargin < 10 ? "毛利率偏低，代工屬性強，獲利易受成本波動影響。" : "獲利能力穩定，三率維持常態水準。")) +
                    (finData?.roe > 15 ? " ROE 表現優異，資本運用效率高。" : "")
                )}
            </div>

            <!-- 4. 月營收表現 -->
            <div class="analysis-card">
                <div class="analysis-card-title">📊 月營收趨勢</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">月份: ${revData?.month || 'N/A'}</div>
                ${renderStatRow('單月營收', revData?.revenue ? formatCurrency(revData.revenue) : 'N/A')}
                ${renderPercentRow('月增率 (MoM)', revData?.mom)}
                ${renderPercentRow('年增率 (YoY)', revData?.yoy)}
                ${renderStatRow('近 12 月累計', revData?.cum12m ? formatCurrency(revData.cum12m) : 'N/A')}
                ${renderPercentRow('營收年複合成長率 (CAGR)', finData?.revCAGR?.value)}
                ${finData?.revCAGR?.period ? `<div style="font-size:10px; color:#64748b; margin-top:-8px; margin-bottom:8px; text-align:right;">🕒 區間: ${finData.revCAGR.period}</div>` : ''}
                ${renderStatRow('年增次數 (近 12 月)', revData ? `${revData.yoyUpMonths} / ${revData.totalMonths}` : 'N/A')}
                ${renderDiagnostic(
                    (revData?.yoy > 15 ? "營收年增顯著成長，動能強勁。" : (revData?.yoy < -10 ? "營收年減幅度較大，需留意衰退訊號。" : "營收持平波動，處於產業平穩期。")) +
                    (revData?.yoyUpMonths >= 9 ? " 近一年中絕大多數月份皆成長，趨勢穩健。" : "")
                )}
            </div>

            <!-- 5. 估值河流與位階 (PE River) -->
            <div class="analysis-card">
                <div class="analysis-card-title">📈 估值河流位階 (5年 TTM PE)</div>
                <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:10px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:8px;">
                        <div>
                            <div style="font-size:10px; color:#94a3b8; margin-bottom:2px;">當前 TTM 本益比</div>
                            <div style="font-size:22px; font-weight:800; color:#fff;">${safeFix(currentPE, 1)} <span style="font-size:12px; font-weight:400; color:#94a3b8;">倍</span></div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:10px; color:#94a3b8; margin-bottom:2px;">歷史百分位數</div>
                            <div style="font-size:16px; font-weight:700; color:${pePercentile > 80 ? '#f87171' : (pePercentile < 30 ? '#4ade80' : '#fbbf24')};">${safeFix(pePercentile, 0)}%</div>
                        </div>
                    </div>
                    
                    <div style="position:relative; height:12px; width:100%; background:linear-gradient(to right, #10b981 0%, #4ade80 20%, #facc15 50%, #fb923c 80%, #ef4444 100%); border-radius:6px; margin:20px 0 10px;">
                        <div style="position:absolute; left:${pePercentile}%; top:-10px; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid #fff;"></div>
                        <div style="position:absolute; left:${pePercentile}%; bottom:-18px; transform:translateX(-50%); font-size:10px; font-weight:800; color:#fff; white-space:nowrap;">目前位置</div>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; font-size:9px; color:#64748b; margin-top:14px;">
                        <span>便宜 (10%)</span>
                        <span>合理 (50%)</span>
                        <span>昂貴 (90%)</span>
                    </div>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px;">
                    <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:6px;">
                        <div style="font-size:9px; color:#94a3b8;">便宜價 (PE ${valuationBands ? safeFix(valuationBands.p20, 1) : 'N/A'})</div>
                        <div style="font-size:13px; font-weight:700; color:#4ade80;">${valuationBands ? safeFix(valuationBands.p20 * epsLTM, 1) : 'N/A'}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:6px;">
                        <div style="font-size:9px; color:#94a3b8;">昂貴價 (PE ${valuationBands ? safeFix(valuationBands.p80, 1) : 'N/A'})</div>
                        <div style="font-size:13px; font-weight:700; color:#f87171;">${valuationBands ? safeFix(valuationBands.p80 * epsLTM, 1) : 'N/A'}</div>
                    </div>
                </div>
                
                <div style="font-size:11px; cursor:pointer;" onclick="showTermExplainer('估值位階 (PE River)', '${pePercentile}')">
                    ${renderDiagnostic(
                        (pePercentile < 20 ? "⚠️ 估值進入極低區，具備高度長線投資價值。" : (pePercentile > 80 ? "⚠️ 估值進入極高區，需警惕過熱回檔風險。" : "目前估值處於歷史合理範圍內。")) +
                        " 點擊查看 AI 深度位階分析 🔍"
                    )}
                </div>
            </div>

            <!-- 6. 財務安全與 Z-Score -->
            <div class="analysis-card">
                <div class="analysis-card-title">🛡️ 財務安全診斷</div>
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="analysis-label has-info" style="font-size:12px; color:#94a3b8;" onclick="showTermExplainer('Altman Z-Score', '${zScore !== undefined ? safeFix(zScore, 2) : 'N/A'}')">Altman Z-Score</span>
                        <span style="font-size:18px; font-weight:800; color:${zColor};">${zScore !== undefined ? safeFix(zScore, 2) : 'N/A'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <span style="font-size:10px; color:#64748b;">風險等級</span>
                        <span style="font-size:11px; font-weight:700; color:${zColor};">${zRiskLevel}</span>
                    </div>
                    <div style="height:4px; width:100%; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:8px; overflow:hidden;">
                        <div style="height:100%; width:${zScore ? Math.min(100, (zScore / 4) * 100) : 0}%; background:${zColor};"></div>
                    </div>
                </div>
                ${renderStatRow('流動比率', finData?.currentRatio !== undefined ? safeFix(finData?.currentRatio, 1) + '%' : 'N/A')}
                ${renderStatRow('速動比率', finData?.quickRatio !== undefined ? safeFix(finData?.quickRatio, 1) + '%' : 'N/A')}
                ${renderPercentRow('負債比率', finData?.debtRatio, false)}
                ${renderStatRow('淨負債比率', finData?.netDebtRatio !== undefined ? safeFix(finData?.netDebtRatio, 1) + '%' : 'N/A', finData?.netDebtRatio)}
                ${renderStatRow('利息保障倍數', finData?.interestCoverage !== undefined ? (finData?.interestCoverage >= 999 ? '無負債/極高' : safeFix(finData?.interestCoverage, 1) + ' 倍') : 'N/A')}
                ${renderStatRow('獲利品質 (OCF/NI)', finData?.earningsQuality !== undefined ? safeFix(finData?.earningsQuality, 1) + '%' : 'N/A', finData?.earningsQuality)}
                <div style="font-size:11px; color:#94a3b8; margin:10px 0 6px; border-bottom:1px dashed rgba(255,255,255,0.05); padding-bottom:6px;">💸 現金流量 (年化估算)</div>
                ${renderStatRow('營業現金流 (OCF)', (finData?.opCashFlow !== undefined) ? formatCurrency(finData.opCashFlow) : 'N/A')}
                ${renderStatRow('投資現金流 (ICF)', (finData?.investingCashFlow !== undefined) ? formatCurrency(finData.investingCashFlow) : 'N/A', finData?.investingCashFlow > 0 ? 30 : -30)}
                ${renderStatRow('自由現金流 (FCF)', (finData?.freeCashFlow !== undefined) ? formatCurrency(finData.freeCashFlow) : 'N/A')}
                ${renderStatRow('淨負債 (總負債-現金)', finData?.netDebt ? formatCurrency(finData.netDebt) : 'N/A', finData?.netDebt > 0 ? 30 : -30)}
                ${renderDiagnostic(
                    (zScore > 2.99 ? "財務體質極佳，短期無倒閉風險。" : (zScore < 1.8 ? "財務壓力較大，需警惕債務違約風險。" : "財務結構尚可，屬正常範圍。")) +
                    (finData?.earningsQuality > 100 ? " 獲利品質佳，現金回收能力強。" : "")
                )}
            </div>

            <!-- 6. 籌碼與信用交易 -->
            <div class="analysis-card">
                <div class="analysis-card-title">👥 籌碼與信用</div>
                ${renderStatRow('券資比', (chipsData.marginShortRatio !== null && chipsData.marginShortRatio !== undefined) ? safeFix(chipsData.marginShortRatio, 1) + '%' : 'N/A', chipsData.marginShortRatio)}
                ${renderStatRow('融資餘額', marginData?.marginPurchase ? marginData.marginPurchase.toLocaleString() + ' 張' : 'N/A')}
                ${renderStatRow('融券餘額', marginData?.shortSale ? marginData.shortSale.toLocaleString() + ' 張' : 'N/A')}
                ${renderStatRow('融資使用率', (marginData?.marginUseRate !== null && marginData?.marginUseRate !== undefined) ? marginData.marginUseRate + '%' : 'N/A', marginData?.marginUseRate)}
                
                <div style="font-size:11px; color:#94a3b8; margin:10px 0 6px; border-bottom:1px dashed rgba(255,255,255,0.05); padding-bottom:6px;">📈 法人動態</div>
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <div style="flex:1; background:rgba(255,255,255,0.03); padding:8px; border-radius:6px; text-align:center;">
                        <div style="font-size:10px; color:#94a3b8;">外資連買/賣</div>
                        <div style="font-size:14px; font-weight:600; color:${institutionalData?.streaks?.foreign > 0 ? '#ef4444' : (institutionalData?.streaks?.foreign < 0 ? '#10b981' : '#fff')}">
                            ${institutionalData?.streaks?.foreign > 0 ? `連買 ${institutionalData.streaks.foreign} 日` : (institutionalData?.streaks?.foreign < 0 ? `連賣 ${Math.abs(institutionalData.streaks.foreign)} 日` : '無')}
                        </div>
                    </div>
                    <div style="flex:1; background:rgba(255,255,255,0.03); padding:8px; border-radius:6px; text-align:center;">
                        <div style="font-size:10px; color:#94a3b8;">投信連買/賣</div>
                        <div style="font-size:14px; font-weight:600; color:${institutionalData?.streaks?.trust > 0 ? '#ef4444' : (institutionalData?.streaks?.trust < 0 ? '#10b981' : '#fff')}">
                            ${institutionalData?.streaks?.trust > 0 ? `連買 ${institutionalData.streaks.trust} 日` : (institutionalData?.streaks?.trust < 0 ? `連賣 ${Math.abs(institutionalData.streaks.trust)} 日` : '無')}
                        </div>
                    </div>
                </div>
                
                <div style="font-size:10px; color:#64748b; margin-bottom:4px;">📌 最新單日進出 (張)</div>
                ${renderNetBuyRow('外資單日', institutionalData?.latestDay?.foreign)}
                ${renderNetBuyRow('投信單日', institutionalData?.latestDay?.trust)}
                ${renderNetBuyRow('自營商單日', institutionalData?.latestDay?.dealer)}
                
                <div style="font-size:10px; color:#64748b; margin:8px 0 4px;">📈 近 5 日累計</div>
                ${renderNetBuyRow('外資 5日', institutionalData?.fiveDayTotal?.foreign)}
                ${renderNetBuyRow('投信 5日', institutionalData?.fiveDayTotal?.trust)}
                ${(() => {
                    // 重新計算法人買賣超佔比 (需搭配最新成交量)
                    const latestDay = institutionalData?.latestDay;
                    const vol = chartData?.latestVol || 0; // 股數
                    const volLots = vol / 1000; // 張數
                    const netPct = (latestDay && vol > 0) ? ((latestDay.foreign + latestDay.trust + latestDay.dealer) * 1000 / vol * 100) : (institutionalData?.latestDayNetPct || 0);
                    
                    // 計算分點集中度
                    let concentration = 'N/A';
                    const d1 = brokerData?.d1 || brokerData; // 兼容舊格式或提取 1 日數據
                    if (d1 && volLots > 0 && d1.topBuySum !== undefined) {
                        const concVal = ((d1.topBuySum + d1.topSellSum) / volLots) * 100;
                        concentration = safeFix(concVal, 1) + '%';
                        d1.concentration = concVal; // 注入供後續診斷使用
                    }
                    
                    return `
                        ${renderStatRow('三大法人佔比/成交量', netPct ? safeFix(netPct, 1) + '%' : 'N/A', netPct)}
                        ${renderStatRow('分點集中度', concentration, d1?.concentration)}
                    `;
                })()}
                ${renderStatRow('主力買超 (Top15)', (brokerData?.d1?.mainNetBuy !== undefined) ? brokerData.d1.mainNetBuy.toLocaleString() + ' 張' : (brokerData?.mainNetBuy ? brokerData.mainNetBuy.toLocaleString() + ' 張' : 'N/A'))}
                ${renderDiagnostic(
                    (institutionalData?.streaks?.foreign > 3 ? "外資持續吸籌，大戶心態偏多。" : (institutionalData?.streaks?.foreign < -3 ? "外資持續提款，短線需防範賣壓。" : "法人進出互有勝負，籌碼面處於觀望狀態。")) +
                    ((brokerData?.d1?.concentration || brokerData?.concentration) > 20 ? " 分點集中度高，主力收貨力道強勁。" : "") +
                    (marginData?.marginUseRate > 40 ? " 融資比例偏高，浮額較多需慎防多殺多。" : "")
                )}
            </div>

            <!-- 7. 技術面分析 -->
            <div class="analysis-card">
                <div class="analysis-card-title">📉 技術面分析</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">排列狀態: <span style="color:#fff; font-weight:700;">${chartData.maStatus}</span></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="text-align:center; flex:1; cursor:pointer;" onclick="showTermExplainer('RSI(14)', '${rsi14}')">
                        <div style="font-size:10px; color:#94a3b8;" class="has-info">RSI(14)</div>
                        <div style="font-size:16px; font-weight:600; color:${rsi14 > 70 ? '#ef4444' : (rsi14 < 30 ? '#10b981' : '#fff')}">${rsi14 || 'N/A'}</div>
                    </div>
                    <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                    <div style="text-align:center; flex:1; cursor:pointer;" onclick="showTermExplainer('KD (K/D)', '${kd ? `${kd.k}/${kd.d}` : ''}')">
                        <div style="font-size:10px; color:#94a3b8;" class="has-info">KD (K/D)</div>
                        <div style="font-size:16px; font-weight:600;">${kd ? `${kd.k}/${kd.d}` : 'N/A'}</div>
                    </div>
                    <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                    <div style="text-align:center; flex:1; cursor:pointer;" onclick="showTermExplainer('MACD OSC', '${macd ? safeFix(macd.osc, 2) : ''}')">
                        <div style="font-size:10px; color:#94a3b8;" class="has-info">MACD OSC</div>
                        <div style="font-size:14px; font-weight:600; color:${macd?.osc > 0 ? '#ef4444' : (macd?.osc < 0 ? '#10b981' : '#fff')}">${macd ? safeFix(macd.osc, 2) : 'N/A'}</div>
                    </div>
                </div>
                ${renderMARow('5日線 (週線)', ma.ma5, currentPrice)}
                ${renderMARow('20日線 (月線)', ma.ma20, currentPrice)}
                ${renderMARow('60日線 (季線)', ma.ma60, currentPrice)}
                ${renderMARow('240日線 (年線)', ma.ma240, currentPrice)}
                ${renderStatRow('布林位置', (() => {
                    if(!bb) return 'N/A';
                    const bbPosVal = ((currentPrice - bb.lower) / (bb.upper - bb.lower) * 100);
                    const pos = safeFix(bbPosVal, 0);
                    return `${pos}% ${bbPosVal > 80 ? '⚠️' : bbPosVal < 20 ? '🟢' : ''}`;
                })())}
                <div style="font-size:11px; color:#94a3b8; margin:12px 0 6px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">🚀 價格與中長期動能</div>
                ${renderPercentRow('年初至今 (YTD)', momYTD)}
                ${renderPercentRow('近半年動能', mom6m)}
                ${renderPercentRow('近一年動能', mom1y)}
                ${renderPercentRow('近兩年動能', mom2y)}
                ${renderPercentRow('近三年動能', mom3y)}
                ${renderPercentRow('近四年動能', mom4y)}
                ${renderPercentRow('近五年動能', mom5y)}
                ${renderDiagnostic(
                    (currentPrice > ma.ma60 ? "股價在季線之上，趨勢偏多。" : "股價在季線之下，處於空頭格局。") +
                    (rsi14 > 70 ? " RSI 進入超買，慎防回檔。" : (rsi14 < 30 ? " RSI 進入超賣，醞釀跌深反彈。" : "")) +
                    (chartData.bbSqueeze ? " ⚡ 注意：目前處於布林帶縮排（Squeeze），近期可能出現大波動突破。" : "")
                )}
                <div style="font-size:10px; color:#64748b; margin-top:8px;">
                    均線狀態: ${chartData.maStatus}<br>
                    ${chartData.goldenCross ? '<span style="color:#ef4444;">🔥 短中長期均線呈現多頭排列（黃金交叉區域）</span>' : ''}
                    ${chartData.deathCross ? '<span style="color:#10b981;">❄️ 均線呈現空頭排列（死亡交叉區域）</span>' : ''}
                </div>
            </div>

            <!-- 8. 股利與分配 -->
            <div class="analysis-card">
                <div class="analysis-card-title">🍎 股利政策與趨勢</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:10px;">📅 近 8 次除權息紀錄:</div>
                <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:12px; background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    ${(chipsData?.divHistory || []).map(d => `
                        <div style="display:flex; justify-content:space-between; font-size:11px; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
                            <span style="color:#64748b; font-family:monospace; width:75px;">${d.date}</span>
                            <div style="flex:1; display:flex; justify-content:flex-end; gap:8px;">
                                <span style="color:#4ade80; font-weight:700;">現 ${d.cash}</span>
                                ${d.stock > 0 ? `<span style="color:#fbbf24; font-weight:700;">股 ${d.stock}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="background:rgba(59, 130, 246, 0.08); border-left:3px solid #3b82f6; padding:10px; border-radius:6px; font-size:12px; color:#cbd5e1; line-height:1.6; margin-bottom:12px;">
                    <div style="font-size:10px; color:#94a3b8; margin-bottom:4px; font-weight:700;">分析結論:</div>
                    ${divTrendAnalysis}
                </div>
                ${renderStatRow('最近現金股利', chipsData?.exDivAmt ? chipsData.exDivAmt + ' 元' : 'N/A')}
                ${renderStatRow('連續配息年數', (chipsData?.divConsecutiveYears !== undefined) ? chipsData.divConsecutiveYears + ' 年' : 'N/A', (chipsData?.divConsecutiveYears / 15 * 100))}
                ${renderPercentRow('三年股利成長', chipsData?.divGrowth3y)}
                <div style="font-size:11px; color:#94a3b8; margin:10px 0 6px; border-bottom:1px dashed rgba(255,255,255,0.05); padding-bottom:6px;">📈 獲利分配與永續性</div>
                ${(() => {
                    const payout = (totalDiv12m && finData?.epsLTM) ? (totalDiv12m / finData.epsLTM * 100) : null;
                    return renderPercentRow('盈餘分配率 (Payout Ratio)', payout, false);
                })()}
                ${renderStatRow('近四季 EPS (LTM)', finData?.epsLTM ? safeFix(finData.epsLTM, 2) + ' 元' : 'N/A')}
                ${renderStatRow('近一年總配息', safeFix(totalDiv12m, 2) + ' 元')}
                ${renderDiagnostic(
                    (() => {
                        const payout = (totalDiv12m && finData?.epsLTM) ? (totalDiv12m / finData.epsLTM * 100) : null;
                        if (payout > 100) return "⚠️ 警告：發放率超過 100%，公司正在「吃老本」發讓股利，長期恐不具永續性。";
                        if (payout > 80) return "配息率偏高，雖然殖利率誘人，但需留意公司是否缺乏未來投資成長的資金。";
                        if (payout < 30 && payout > 0) return "配息率較低，公司可能保留較多資金用於擴張，屬成長型特徵。";
                        if (payout > 0) return "配息政策穩健，獲利與發放比例均衡。";
                        return "";
                    })() +
                    ((chipsData?.divConsecutiveYears || 0) >= 10 ? " 長期連續配息紀錄佳，收息極其穩定。" : "")
                )}
            </div>

            <!-- 9. 杜邦分析 (ROE 拆解) -->
            <div class="analysis-card">
                <div class="analysis-card-title">🔍 杜邦分析 (ROE 拆解)</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:10px;">ROE = 淨利率 × 資產週轉 × 權益乘數</div>
                <div style="display:flex; flex-direction:column; gap:8px; background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    <div style="display:flex; justify-content:space-between;">
                        <span style="font-size:12px; color:#94a3b8;">1. 淨利率 (獲利)</span>
                        <span style="font-size:12px; font-weight:700;">${finData?.netMargin !== undefined ? safeFix(finData.netMargin, 2) + '%' : 'N/A'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="font-size:12px; color:#94a3b8;">2. 資產週轉 (效率)</span>
                        <span style="font-size:12px; font-weight:700;">${finData?.assetTurnover !== undefined ? safeFix(finData.assetTurnover, 2) + ' 次' : 'N/A'}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span style="font-size:12px; color:#94a3b8;">3. 權益乘數 (槓桿)</span>
                        <span style="font-size:12px; font-weight:700;">${finData?.equityMultiplier !== undefined ? safeFix(finData.equityMultiplier, 2) + ' 倍' : 'N/A'}</span>
                    </div>
                    <div style="height:1px; background:rgba(255,255,255,0.1); margin:4px 0;"></div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px; font-weight:800; color:#fff;">最終 ROE</span>
                        <span style="font-size:15px; font-weight:800; color:#ef4444;">${finData?.roe !== undefined ? safeFix(finData.roe, 2) + '%' : 'N/A'}</span>
                    </div>
                </div>
                ${renderDiagnostic(
                    (finData?.netMargin > 20 ? "高淨利率驅動 ROE，顯示產業地位高。" : (finData?.assetTurnover > 1 ? "高週轉率驅動 ROE，薄利多銷經營。" : "綜合驅動模式。")) +
                    (finData?.equityMultiplier > 3 ? " 槓桿比例較高，需留意利息負擔。" : "")
                )}
            </div>
            
            <!-- 10. 現金流量趨勢 (FCF Analysis) -->
            <div class="analysis-card">
                <div class="analysis-card-title">🌊 自由現金流 (FCF) 8季趨勢</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:12px;">單位: 億元 (OCF - CapEx = FCF)</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${(finData?.fcfTrend || []).map(d => {
                        const ocfB = d.ocf / 100000000;
                        const capB = Math.abs(d.capex / 100000000);
                        const fcfB = d.fcf / 100000000;
                        const maxVal = Math.max(...finData.fcfTrend.map(x => Math.abs(x.ocf/100000000) + Math.abs(x.capex/100000000))) || 1;
                        
                        return `
                        <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
                            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                                <span style="color:#f1f5f9; font-weight:700;">${d.date}</span>
                                <span style="color:${fcfB >= 0 ? '#4ade80' : '#f87171'}; font-weight:800;">FCF: ${fcfB.toFixed(1)} 億</span>
                            </div>
                            <div style="position:relative; height:12px; background:rgba(255,255,255,0.05); border-radius:6px; overflow:hidden; display:flex;">
                                <div style="width:${Math.max(0, (ocfB / maxVal * 100))}%; background:#3b82f6; height:100%;" title="OCF"></div>
                                <div style="width:${Math.max(0, (capB / maxVal * 100))}%; background:rgba(248,113,113,0.4); height:100%; border-left:1px solid rgba(0,0,0,0.2);" title="CapEx"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:9px; color:#64748b; margin-top:3px;">
                                <span>OCF: ${ocfB.toFixed(1)}</span>
                                <span>CapEx: -${capB.toFixed(1)}</span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                ${renderDiagnostic(
                    (() => {
                        if (!finData?.fcfTrend || finData.fcfTrend.length === 0) return "數據不足。";
                        const positiveFcfCount = finData.fcfTrend.filter(x => x.fcf > 0).length;
                        if (positiveFcfCount >= 7) return "🔥 極其優異：近 8 季幾乎全數維持正向現金流，獲利含金量極高。";
                        if (positiveFcfCount >= 4) return "現金流尚屬穩定，多數季度能產生盈餘現金。";
                        return "⚠️ 警告：自由現金流長期處於負值或不穩定，需注意公司是否有入不敷出或過度擴張風險。";
                    })()
                )}
            </div>

            <!-- 11. 獲利品質分析 (Cash Flow Fidelity) -->
            <div class="analysis-card">
                <div class="analysis-card-title">💎 現金流健康度 (Cash Flow Fidelity)</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:12px;">藍色: OCF (營業現金流) / 灰色: 淨利</div>
                
                <!-- 累積 8 季含金量 -->
                <div style="background:linear-gradient(145deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05)); padding:12px; border-radius:12px; margin-bottom:15px; border:1px solid rgba(59, 130, 246, 0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:11px; color:#94a3b8;" class="has-info" onclick="showTermExplainer('累積 8 季總含金量', '${safeFix(finData?.cashFlowFidelity?.totalRatio, 1)}%')">累積 8 季總含金量</span>
                        <span style="font-size:11px; padding:2px 8px; border-radius:10px; background:${finData?.cashFlowFidelity?.score === '卓越' ? '#4ade80' : (finData?.cashFlowFidelity?.score === '穩健' ? '#3b82f6' : '#ef4444')}; color:#fff; font-weight:800;">
                            ${finData?.cashFlowFidelity?.score || 'N/A'}
                        </span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                        <span style="font-size:24px; font-weight:800; color:#fff;">${safeFix(finData?.cashFlowFidelity?.totalRatio, 1)}%</span>
                        <span style="font-size:11px; color:#94a3b8;">OCF > 淨利次數: ${finData?.cashFlowFidelity?.stableCount || 0} / 8</span>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${(finData?.netIncomeTrend || []).map((d, idx) => {
                        const niB = d.ni / 100000000;
                        const ocfObj = finData.fcfTrend.find(x => x.date === d.date);
                        const ocfB = (ocfObj ? ocfObj.ocf : 0) / 100000000;
                        
                        const maxVal = Math.max(...finData.netIncomeTrend.map(x => Math.abs(x.ni/100000000)), ...finData.fcfTrend.map(x => Math.abs(x.ocf/100000000))) || 1;
                        const ratio = niB !== 0 ? (ocfB / niB * 100) : 0;
                        
                        return `
                        <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:8px; border:1px solid rgba(255,255,255,0.03);">
                            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:6px;">
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <span style="color:#64748b;">${d.date}</span>
                                    ${ocfB > niB ? '<span style="font-size:8px; background:#4ade80; color:#064e3b; padding:0 4px; border-radius:4px; font-weight:800;">CASH+</span>' : ''}
                                </div>
                                <span style="color:${ratio >= 100 ? '#4ade80' : (ratio < 50 ? '#f87171' : '#fbbf24')}; font-weight:700;">
                                    ${ratio.toFixed(0)}%
                                </span>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:3px;">
                                <div style="width:${Math.max(0, (ocfB / maxVal * 100))}%; background:#3b82f6; height:6px; border-radius:3px;"></div>
                                <div style="width:${Math.max(0, (niB / maxVal * 100))}%; background:#94a3b8; height:6px; border-radius:3px; opacity:0.5;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:9px; color:#475569; margin-top:4px;">
                                <span>OCF: ${ocfB.toFixed(1)} 億</span>
                                <span>淨利: ${niB.toFixed(1)} 億</span>
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
            <div class="analysis-card">
                <div class="analysis-card-title">⚙️ 營運效率與獲利品質</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:10px;">營運天數與現金循環 (CCC)</div>
                ${renderStatRow('存貨週轉天數', finData?.inventoryDays !== undefined ? safeFix(finData.inventoryDays, 1) + ' 天' : 'N/A')}
                ${renderStatRow('應收帳款天數', finData?.receivableDays !== undefined ? safeFix(finData.receivableDays, 1) + ' 天' : 'N/A')}
                ${renderStatRow('應付帳款天數', finData?.payableDays !== undefined ? safeFix(finData.payableDays, 1) + ' 天' : 'N/A')}
                <div style="background:rgba(59, 130, 246, 0.1); padding:10px; border-radius:8px; margin:8px 0; border:1px solid rgba(59, 130, 246, 0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:12px; color:#94a3b8;">現金週期 (CCC)</span>
                        <span style="font-size:18px; font-weight:800; color:#fff;">${finData?.ccc !== undefined ? safeFix(finData.ccc, 1) + ' 天' : 'N/A'}</span>
                    </div>
                </div>

                <!-- 新增：同業 CCC 對比 -->
                <div style="font-size:11px; color:#94a3b8; margin:12px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:8px;" class="has-info" onclick="showTermExplainer('現金週期 (CCC)', '${finData?.ccc} 天')">📊 產業龍頭 CCC 對比 (越短越強)</div>
                <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">
                    <!-- 本身 -->
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:60px; font-size:10px; color:#fff; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
                        <div style="flex:1; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                            <div style="width:${Math.min(100, (finData?.ccc || 0) / 150 * 100)}%; height:100%; background:#3b82f6; border-radius:4px;"></div>
                        </div>
                        <div style="width:35px; font-size:10px; color:#fff; text-align:right;">${Math.round(finData?.ccc || 0)}</div>
                    </div>
                    ${(peerCCCData || []).map(peer => `
                        <div style="display:flex; align-items:center; gap:8px;">
                            <div style="width:60px; font-size:10px; color:#94a3b8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${peer.name}</div>
                            <div style="flex:1; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                                <div style="width:${Math.min(100, (peer.ccc || 0) / 150 * 100)}%; height:100%; background:rgba(255,255,255,0.2); border-radius:4px;"></div>
                            </div>
                            <div style="width:35px; font-size:10px; color:#94a3b8; text-align:right;">${Math.round(peer.ccc)}</div>
                        </div>
                    `).join('')}
                </div>

                <!-- 新增：營收 vs 存貨成長趨勢 -->
                <div style="font-size:11px; color:#94a3b8; margin:15px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:8px;" class="has-info" onclick="showTermExplainer('營收 vs 存貨成長趨勢 (YoY)', '${safeFix(finData?.revInvGrowthTrend?.[finData.revInvGrowthTrend.length-1]?.invYoY, 1)}%')">📈 營收 vs 存貨成長趨勢 (YoY)</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${(finData?.revInvGrowthTrend || []).map(t => {
                        const maxVal = Math.max(Math.abs(t.revYoY || 0), Math.abs(t.invYoY || 0), 20);
                        return `
                        <div style="background:rgba(255,255,255,0.02); padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.03);">
                            <div style="display:flex; justify-content:space-between; font-size:9px; color:#64748b; margin-bottom:4px;">
                                <span>${t.date}</span>
                                <span>營收: ${safeFix(t.revYoY, 1)}% / 存貨: ${safeFix(t.invYoY, 1)}%</span>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:2px;">
                                <!-- Revenue Growth -->
                                <div style="width:${Math.min(100, Math.max(0, (t.revYoY || 0) / maxVal * 100))}%; background:#3b82f6; height:4px; border-radius:2px;"></div>
                                <!-- Inventory Growth -->
                                <div style="width:${Math.min(100, Math.max(0, (t.invYoY || 0) / maxVal * 100))}%; background:${(t.invYoY > t.revYoY + 15) ? '#ef4444' : '#94a3b8'}; height:4px; border-radius:2px; opacity:0.6;"></div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>

                <div style="font-size:11px; color:#94a3b8; margin:15px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:8px;">📊 獲利與週轉率</div>
                ${renderStatRow('存貨週轉率', finData?.inventoryTurnover !== undefined ? safeFix(finData?.inventoryTurnover, 2) + ' 次' : 'N/A')}
                ${renderPercentRow('EPS 年增率 (YoY)', finData?.epsYoY)}
                
                ${renderDiagnostic(
                    (() => {
                        let diag = (finData?.inventoryDays < 60 ? "存貨週轉迅速，商品去化良好。" : (finData?.inventoryDays > 120 ? "存貨積壓風險較大，需留意去化速度。" : "存貨管理尚屬穩健。"));
                        diag += (finData?.ccc < 90 ? " 資金回收速度快，營運週轉效率高。" : "");
                        
                        // 存貨成長警告
                        const lastTrend = finData?.revInvGrowthTrend?.[finData.revInvGrowthTrend.length - 1];
                        if (lastTrend && lastTrend.invYoY > lastTrend.revYoY + 20) {
                            diag += " ⚠️ 注意：近期存貨成長顯著高於營收成長，需防範通路塞貨或需求放緩風險。";
                        }
                        
                        // 同業對比
                        if (peerCCCData && peerCCCData.length > 0) {
                            const minPeerCCC = Math.min(...peerCCCData.map(p => p.ccc));
                            if (finData?.ccc < minPeerCCC) {
                                diag += " 🚀 公司 CCC 優於產業龍頭，顯示強大的議價能力與營運效率。";
                            }
                        }
                        return diag;
                    })()
                )}
            </div>

            <!-- 11. 近 8 季 EPS 走勢 -->
            <div class="analysis-card">
                <div class="analysis-card-title">📈 近 8 季 EPS 走勢</div>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:5px;">
                    ${(() => {
                        const trend = finData?.epsTrend || [];
                        if (trend.length === 0) return '<div style="color:#64748b; font-size:12px;">無歷史 EPS 數據</div>';
                        const maxAbsEps = Math.max(...trend.map(t => Math.abs(t.eps)), 0.1);
                        return [...trend].reverse().map(t => {
                            const percent = (Math.abs(t.eps) / maxAbsEps) * 100;
                            const color = t.eps >= 0 ? '#3b82f6' : '#ef4444'; 
                            return `
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <div style="width:65px; font-size:11px; color:#94a3b8; font-family:monospace;">${t.label}</div>
                                    <div style="flex:1; height:10px; background:rgba(255,255,255,0.05); border-radius:5px; overflow:hidden; position:relative; border:1px solid rgba(255,255,255,0.03);">
                                        <div style="width:${percent}%; height:100%; background:${color}; border-radius:5px; transition:width 0.8s cubic-bezier(0.4, 0, 0.2, 1);"></div>
                                    </div>
                                    <div style="width:45px; font-size:12px; font-weight:700; text-align:right; color:${color};">${safeFix(t.eps, 2)}</div>
                                </div>
                            `;
                        }).join('');
                    })()}
                </div>
                ${renderDiagnostic(
                    (finData?.epsTrend?.length >= 4 && finData.epsTrend[finData.epsTrend.length-1].eps > finData.epsTrend[finData.epsTrend.length-2].eps) ? "近期獲利呈現回溫或成長態勢。" : "獲利表現波動中，需觀察核心動能是否持續。"
                )}
            </div>

            <!-- 12. Piotroski F-Score -->
            <div class="analysis-card">
                <div class="analysis-card-title">🏆 Piotroski F-Score (九項指標)</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; background:rgba(234, 179, 8, 0.1); padding:10px; border-radius:8px; border:1px solid rgba(234, 179, 8, 0.2);">
                    <span style="font-size:12px; color:#94a3b8;">總分 (0-9)</span>
                    <span style="font-size:20px; font-weight:800; color:#eab308;">${finData?.fScore || 0} / 9</span>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:10px;">
                    ${(finData?.fDetails || []).map(f => `
                        <div style="color: ${f.ok ? '#4ade80' : '#64748b'};">
                            ${f.ok ? '✅' : '⚪'} ${f.msg}
                        </div>
                    `).join('')}
                </div>
                ${renderDiagnostic(
                    (finData?.fScore >= 7 ? "F-Score 評分優異，具備機構級財務健全度。" : (finData?.fScore <= 3 ? "F-Score 評分較低，需嚴防財務結構惡化。" : "財務健全度尚可。"))
                )}
            </div>

            <!-- 13. 獲利三率趨勢 -->
            <div class="analysis-card">
                <div class="analysis-card-title">🏆 獲利三率趨勢</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:10px;">近 4 季毛利率、營業利益率、稅後淨利率</div>
                ${(() => {
                    const marginTrend = finData?.marginTrend || [];
                    if (marginTrend.length === 0) return '<div style="color:#64748b; font-size:12px; text-align:center; padding:10px;">無獲利比率數據</div>';
                    return `
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${marginTrend.map(m => `
                                <div style="background:rgba(255,255,255,0.02); padding:8px; border-radius:6px; border:1px solid rgba(255,255,255,0.03);">
                                    <div style="display:flex; justify-content:space-between; font-size:11px; color:#cbd5e1; margin-bottom:4px;">
                                        <span style="font-family:monospace;">${m.date || 'N/A'}</span>
                                        <span style="font-weight:700;">ROE: ${m.roe ? safeFix(m.roe, 2)+'%' : 'N/A'}</span>
                                    </div>
                                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:4px; text-align:center; font-size:10px;">
                                        <div><div style="color:#94a3b8;">毛利</div><div style="color:#f8fafc; font-weight:700;">${safeFix(m.grossMargin, 1)}%</div></div>
                                        <div><div style="color:#94a3b8;">營業</div><div style="color:#f8fafc; font-weight:700;">${safeFix(m.operatingMargin, 1)}%</div></div>
                                        <div><div style="color:#94a3b8;">淨利</div><div style="color:#f8fafc; font-weight:700;">${safeFix(m.netMargin, 1)}%</div></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                })()}
                ${renderDiagnostic(
                    (finData?.marginTrend?.length >= 2 && finData.marginTrend[finData.marginTrend.length-1].grossMargin > finData.marginTrend[finData.marginTrend.length-2].grossMargin ? "毛利率呈現回升，產品競爭力或成本控制轉佳。" : "獲利能力尚屬穩定，需觀察淨利是否受業外影響。")
                )}
            </div>

            <!-- 14. 技術面動能訊號 -->
            <div class="analysis-card">
                <div class="analysis-card-title">📉 技術面動能訊號</div>
                ${(() => {
                    const prices = chartData?.prices || [];
                    if (prices.length < 20) return '<div style="color:#64748b; font-size:12px;">數據不足</div>';
                    
                    const latest = prices[prices.length-1];
                    const p = latest.close;
                    
                    // 1. 計算 RSI (14)
                    let gains = 0, losses = 0;
                    for (let i = prices.length - 14; i < prices.length; i++) {
                        const change = prices[i].close - prices[i-1].close;
                        if (change > 0) gains += change; else losses -= change;
                    }
                    const rsi = (gains === 0) ? 0 : (100 - (100 / (1 + (gains / 14) / (Math.max(losses, 0.01) / 14))));
                    
                    // 2. 乖離率 (20MA)
                    const ma20 = prices.slice(-20).reduce((s, x) => s + x.close, 0) / 20;
                    const bias = ((p - ma20) / ma20) * 100;
                    
                    const rsiColor = rsi > 70 ? '#ef4444' : (rsi < 30 ? '#4ade80' : '#cbd5e1');
                    const biasColor = bias > 0 ? '#ef4444' : '#10b981';

                    return `
                        ${renderStatRow('RSI (14)', safeFix(rsi, 1), rsi)}
                        <div style="font-size:11px; margin-bottom:8px; color:${rsiColor}; text-align:right;">${rsi > 70 ? '⚠️ 超買過熱' : (rsi < 30 ? '🔥 超跌機會' : '中性狀態')}</div>
                        ${renderStatRow('20日 乖離率', (bias > 0 ? '+' : '') + safeFix(bias, 2) + '%')}
                        <div style="font-size:11px; margin-top:12px; color:#94a3b8; border-top:1px dashed rgba(255,255,255,0.05); padding-top:8px;">
                            <span>目前收盤價: ${p}</span><br>
                            <span>20日 均線: ${safeFix(ma20, 2)}</span>
                        </div>
                    `;
                })()}
                ${renderDiagnostic("RSI 提供短線超買/超跌參考，乖離率則反映股價與均線的拉扯力道。")}
            </div>

            <!-- 15. 風險與波動分析 -->
            <div class="analysis-card">
                <div class="analysis-card-title">⚖️ 風險與波動分析</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:12px;">基準指數: 台股加權指數 (TAIEX)</div>
                
                <div style="display:flex; gap:10px; margin-bottom:15px;">
                    <div style="flex:1; background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:10px; color:#94a3b8; margin-bottom:4px;">Beta 係數 (β)</div>
                        <div style="font-size:22px; font-weight:800; color:${riskMetrics?.beta > 1.2 ? '#ef4444' : (riskMetrics?.beta < 0.8 ? '#4ade80' : '#fff')}">
                            ${riskMetrics ? riskMetrics.beta : 'N/A'}
                        </div>
                        <div style="font-size:10px; color:#64748b; margin-top:4px;">
                            ${riskMetrics?.beta > 1.2 ? '積極型' : (riskMetrics?.beta < 0.8 ? '防禦型' : '中型/與大盤同步')}
                        </div>
                    </div>
                    <div style="flex:1; background:rgba(255,255,255,0.03); padding:12px; border-radius:10px; text-align:center; border:1px solid rgba(255,255,255,0.05);">
                        <div style="font-size:10px; color:#94a3b8; margin-bottom:4px;">年化波動率</div>
                        <div style="font-size:22px; font-weight:800; color:${riskMetrics?.volatility > 35 ? '#ef4444' : (riskMetrics?.volatility < 20 ? '#4ade80' : '#fff')}">
                            ${riskMetrics ? riskMetrics.volatility + '%' : 'N/A'}
                        </div>
                        <div style="font-size:10px; color:#64748b; margin-top:4px;">
                            ${riskMetrics?.volatility > 35 ? '波動劇烈' : (riskMetrics?.volatility < 20 ? '走勢平穩' : '中度波動')}
                        </div>
                    </div>
                </div>

                <div style="font-size:11px; color:#94a3b8; margin:8px 0 6px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:8px;">📌 指標含義說明:</div>
                <div style="display:flex; flex-direction:column; gap:6px; font-size:10px; color:#64748b; line-height:1.4;">
                    <div>• <b>Beta (β)</b>: 反映個股對大盤變動的敏感度。β > 1 表示漲跌幅通常大於大盤；β < 1 則較小。</div>
                    <div>• <b>波動率</b>: 數值愈高，代表股價在短期內上下震盪的幅度愈大。</div>
                    <div>• <b>計算基準</b>: 基於過去一年 (${riskMetrics?.sampleSize || 252} 個交易日) 的日回報率。</div>
                </div>

                ${renderDiagnostic(
                    riskMetrics ? (
                        (riskMetrics.beta > 1.5 ? "標的具備極高攻擊性，大盤回溫時漲勢凌厲，但下殺時風險亦大。" : 
                         (riskMetrics.beta < 0.5 ? "標的極具防禦性，幾乎不隨大盤起舞，適合避險持股。" : "標的風險偏好與大盤基本同步。")) +
                        (riskMetrics.volatility > 50 ? " 警告：目前波動率極高，屬於投機或劇烈震盪期。" : "")
                    ) : "數據不足，無法計算風險指標。"
                )}
            </div>

            <!-- 16. 內部人持股變動 -->
            <div class="analysis-card">
                <div class="analysis-card-title">👥 ${insiderActivity?.type === 'fallback_chips' ? '內部人大戶籌碼趨勢' : '內部人申報轉讓紀錄'}</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:12px;">
                    ${insiderActivity?.type === 'fallback_chips' ? '數據來源：籌碼結構百分比變動 (備援)' : '數據來源：MoneyDJ 申報轉讓明細'}
                </div>
                
                <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">
                    ${insiderActivity && insiderActivity.history.length > 0 ? insiderActivity.history.map(h => `
                        <div style="background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:11px; color:#94a3b8; font-family:monospace;">${h.date}</span>
                                <span style="font-size:13px; font-weight:800; color:${h.totalChange > 0 ? '#ef4444' : (h.totalChange < 0 ? '#10b981' : '#fff')}">
                                    ${h.totalChange > 0 ? '+' : ''}${h.isPercent ? h.totalChange.toFixed(2) + '%' : Math.round(h.totalChange) + ' 張'}
                                    ${h.method ? `(${h.method})` : ''}
                                </span>
                            </div>
                            ${h.name ? `<div style="margin-top:4px; font-size:10px; color:#64748b;">申報人: ${h.name} (${h.position})</div>` : ''}
                        </div>
                    `).join('') : '<div style="color:#64748b; font-size:12px; text-align:center; padding:20px;">近期暫無重大異動紀錄</div>'}
                </div>

                ${renderDiagnostic(
                    insiderActivity ? (
                        (insiderActivity.trend < -100 || (insiderActivity.isPercent && insiderActivity.trend < -1)) ? 
                        "注意：近期大戶或內部人有減持跡象，需留意賣壓。" : "內部籌碼動態相對穩定。"
                    ) : "數據不足，無法分析內部人動向。"
                )}
            </div>

            <!-- 17. 籌碼集中度深度分析 (Advanced Chip Analysis) -->
            <div class="analysis-card">
                <div class="analysis-card-title">🎯 籌碼集中度深度分析</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:15px;">主力成本與集保分佈趨勢</div>
                
                <!-- 主力成本線 -->
                <div style="background:rgba(59, 130, 246, 0.05); padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid rgba(59, 130, 246, 0.1);">
                    <div style="font-size:12px; color:#60a5fa; font-weight:700; margin-bottom:10px;">📊 關鍵分點 (主力) 成本線</div>
                    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px;">
                        ${['d1', 'd5', 'd20'].map(key => {
                            const d = brokerData?.[key];
                            const label = key === 'd1' ? '1日' : (key === 'd5' ? '5日' : '20日');
                            const cost = d?.avgBuyCost || 0;
                            const diff = cost > 0 ? ((currentPrice - cost) / cost * 100) : 0;
                            return `
                            <div style="text-align:center;">
                                <div style="font-size:10px; color:#94a3b8;">${label}成本</div>
                                <div style="font-size:14px; font-weight:800; color:#fff; margin:2px 0;">${cost > 0 ? safeFix(cost, 1) : 'N/A'}</div>
                                <div style="font-size:9px; color:${diff >= 0 ? '#ef4444' : '#10b981'};">
                                    ${cost > 0 ? (diff >= 0 ? '獲利 ' : '套牢 ') + Math.abs(diff).toFixed(1) + '%' : '-'}
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- 大戶/散戶持股趨勢 -->
                <div style="margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <span style="font-size:12px; color:#94a3b8;">大戶 vs 散戶持股趨勢</span>
                        <div style="display:flex; gap:8px; font-size:10px;">
                            <span style="color:#ef4444;">● 大戶(400+)</span>
                            <span style="color:#10b981;">● 散戶(<20張)</span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        ${(chipsData?.holderTrend || []).slice(-12).reverse().map(t => {
                            return `
                            <div style="display:flex; align-items:center; gap:8px; padding:2px 0;">
                                <div style="width:38px; font-size:10px; color:#64748b; font-family:monospace;">${t.date.substring(5)}</div>
                                <div style="flex:1; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; display:flex;">
                                    <div style="width:${t.large}%; background:#ef4444; height:100%;"></div>
                                    <div style="width:${t.retail}%; background:#10b981; height:100%;"></div>
                                </div>
                                <div style="width:105px; font-size:10px; color:#cbd5e1; text-align:right; font-family:monospace;">
                                    <span style="color:#f87171;">${t.large.toFixed(2)}</span><span style="color:#64748b;font-size:8px;">%</span> 
                                    <span style="color:#64748b;">/</span> 
                                    <span style="color:#4ade80;">${t.retail.toFixed(2)}</span><span style="color:#64748b;font-size:8px;">%</span>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- 關鍵買超分點明細 -->
                <div style="font-size:11px; color:#94a3b8; margin-bottom:8px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:12px;">🏆 近 20 日關鍵買超分點</div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${(brokerData?.d20?.topBrokers || []).map(b => `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:6px 10px; border-radius:6px;">
                            <span style="font-size:11px; color:#cbd5e1;">${b.name}</span>
                            <span style="font-size:11px; font-weight:700; color:#ef4444;">+${b.buyNet.toLocaleString()} 張</span>
                        </div>
                    `).join('') || '<div style="color:#64748b; font-size:11px; text-align:center;">無顯著買超分點資料</div>'}
                </div>

                ${renderDiagnostic(
                    (() => {
                        const d20 = brokerData?.d20;
                        const lastHolder = chipsData?.holderTrend?.[chipsData.holderTrend.length - 1];
                        const prevHolder = chipsData?.holderTrend?.[chipsData.holderTrend.length - 5]; // 約一個月前
                        
                        let diag = "";
                        if (d20?.avgBuyCost > 0) {
                            const dist = ((currentPrice - d20.avgBuyCost) / d20.avgBuyCost * 100);
                            if (Math.abs(dist) < 2) diag += "目前股價極度接近 20 日主力成本，具備強大技術面支撐力道。";
                            else if (dist < -5) diag += "股價已跌破主力成本區，需留意主力是否認賠停損或持續攤平。";
                            else diag += "主力目前處於獲利狀態，籌碼架構相對健康。";
                        }
                        
                        if (lastHolder && prevHolder) {
                            if (lastHolder.large > prevHolder.large + 1) diag += " 近一月大戶持股顯著增加，籌碼正向大戶集中。";
                            else if (lastHolder.retail > prevHolder.retail + 1) diag += " 警告：籌碼正流向散戶，主力有退場跡象。";
                        }
                        return diag;
                    })()
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
            <div style="color:${chartData ? '#10b981' : '#ef4444'}">● 股價歷史 (Price): ${chartData ? 'OK' : 'FAIL'}</div>
            <div style="color:${twseBasic ? '#10b981' : '#ef4444'}">● 估值指標 (Basic): ${twseBasic ? 'OK' : 'FAIL'}</div>
            <div style="color:${chipsData ? '#10b981' : '#ef4444'}">● 籌碼結構 (Shareholding): ${chipsData ? 'OK' : 'FAIL'}</div>
            <div style="color:${revData ? '#10b981' : '#ef4444'}">● 營收數據 (Revenue): ${revData ? 'OK' : 'FAIL'}</div>
            <div style="color:${finData && finData.equity > 1 ? '#10b981' : '#ef4444'}">● 財報數據 (Financial): ${finData ? (finData.equity > 1 ? 'OK' : 'EMPTY DATA') : 'FAIL'}</div>
            <div style="color:${institutionalData ? '#10b981' : '#ef4444'}">● 法人動態 (Inst.): ${institutionalData ? 'OK' : 'FAIL'}</div>
            <div style="color:${riskMetrics ? '#10b981' : '#ef4444'}">● 風險指標 (Risk): ${riskMetrics ? 'OK' : 'FAIL'}</div>
            <div style="color:${(insiderActivity && insiderActivity.type !== 'none') ? '#10b981' : '#ef4444'}">● 內部人持股 (Insider): ${(insiderActivity && insiderActivity.type !== 'none') ? 'OK' : 'FAIL'}</div>
            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1); color:#fbbf24; font-size:10px; word-break:break-all;">
                [INTEGRITY] Equity:${finData?.equity ? 'YES' : 'NO'}, Shares:${shares ? 'YES' : 'NO'}, Holders:${chipsData?.holderTrend?.length || 0}, Norway:${chipsData?.norwayStatus || 'N/A'}
            </div>
            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1); color:#fbbf24; font-size:10px; word-break:break-all;">
                [INSIDER SAMPLE] ${insiderActivity ? insiderActivity.sample : `FAIL (DJ:${debugInfo?.dj}, DIR:${debugInfo?.dir}, CHIPS:${debugInfo?.holders || 0})`}
            </div>
            <div style="margin-top:8px; color:#64748b;">* 如果顯示 FAIL，請嘗試點擊下方按鈕或視窗邊緣重新開啟。</div>
            <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.1); display:flex; justify-content:center;">
                <button onclick="openAnalysisModal('${symbol}', '${name}', '${avgCost || ''}', true)" 
                        style="background:rgba(59, 130, 246, 0.2); color:#60a5fa; border:1px solid rgba(59, 130, 246, 0.3); padding:6px 15px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:700; transition:all 0.2s;">
                    🔄 強制重新載入數據
                </button>
            </div>
        </div>
    `;
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
            <span style="color:#60a5fa; font-weight:700; margin-right:4px;">💡 診斷：</span>${text}
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
    if (absNum >= 1000000000000) return sign + (absNum / 1000000000000).toFixed(2) + ' 兆';
    if (absNum >= 100000000) return sign + (absNum / 100000000).toFixed(2) + ' 億';
    if (absNum >= 10000) return sign + (absNum / 10000).toFixed(2) + ' 萬';
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
            <span class="analysis-val" style="color:${color}; font-size:13px;">${sign}${rounded.toLocaleString()} 張</span>
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
    if (value === null || value === undefined || isNaN(value)) return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">N/A</span></div>`;
    
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const valStr = `${safeFix(value, 2)} 元`;
    // 傳入額外上下文給 showTermExplainer
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';

    let colorClass = 'reasonable';
    if (label.includes('便宜')) colorClass = 'cheap';
    if (label.includes('昂貴')) colorClass = 'expensive';
    
    return `
        <div class="analysis-stat-row">
            <span class="${labelClass}" ${clickAttr}>${label}</span>
            <span class="analysis-val ${colorClass}">${safeFix(value, 2)} 元</span>
        </div>
    `;
}

function renderValuationRiverMap(label, current, percentile, bands) {
    if (current == null || percentile == null || !bands) {
        return `<div class="analysis-stat-row"><span class="analysis-label">${label}</span><span class="analysis-val">數據不足</span></div>`;
    }

    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    const valStr = `${safeFix(current, 2)} (位階 ${safeFix(percentile, 1)}%)`;
    const clickAttr = hasDef ? `onclick="showTermExplainer('${label}', '${valStr}')"` : '';

    const color = percentile < 30 ? '#4ade80' : (percentile > 70 ? '#f87171' : '#fbbf24');
    const pos = Math.max(0, Math.min(100, percentile));
    
    return `
        <div class="analysis-stat-row" style="flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px 0;">
            <div style="display:flex; justify-content:space-between; width:100%; font-size:12px;">
                <span class="${labelClass}" ${clickAttr}>${label}: <b style="color:#fff;">${safeFix(current, 2)}</b></span>
                <span style="color:${color}; font-weight:800;">${safeFix(percentile, 1)}% (位階)</span>
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
                <div style="position:absolute; left:${pos}%; top:-18px; transform:translateX(-50%); font-size:9px; font-weight:700; color:${color};">▼</div>
                
                <!-- Background Gradient (Green to Red) -->
                <div style="position:absolute; left:0; top:0; bottom:0; width:100%; background:linear-gradient(90deg, rgba(74,222,128,0.2) 0%, rgba(251,191,36,0.2) 50%, rgba(248,113,113,0.2) 100%); border-radius:7px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; width:100%; font-size:8px; color:#475569; padding:0 2px;">
                <span>低估</span>
                <span>合理</span>
                <span>昂貴</span>
            </div>
        </div>
    `;
}

/** 
 * === Indicators Encyclopedia: Definition Dictionary ===
 * 包含所有指標的白話文解釋、優劣判斷準則及投資建議。
 */
const termDefinitions = {
    '本益比 (PE)': {
        type: '估值',
        desc: '本益比代表投資人為了賺取公司 1 元的淨利，願意付出的價格（倍數）。',
        rule: '一般以 15 倍為基準。低於 12 倍通常被視為便宜，高於 20 倍則需留意是否過熱。',
        advice: '需配合公司成長性看待。高成長股通常享有較高本益比；景氣循環股則不適用此指標判斷。',
        analyze: (v) => {
            if (v <= 0) return "目前處於虧損狀態，不適用本益比估值。";
            if (v < 12) return "目前位階相當便宜，具備高度安全邊際。";
            if (v > 20) return "位階偏高（過熱），市場已給予高度期待，需注意追高風險。";
            return "目前處於合理區間。";
        }
    },
    '殖利率': {
        type: '股利',
        desc: '每股股利除以目前股價，反映投資這檔股票每年的現金回報率。',
        rule: '> 5% 為優異，4-5% 屬正常，< 3% 則偏低。',
        advice: '別陷入高利陷阱，需確認公司是否有穩定的獲利能力，以免賺了股息卻賠了價差。',
        analyze: (v) => {
            if (v > 5) return "殖利率極具吸引力，非常適合收息型投資人。";
            if (v > 3.5) return "殖利率表現穩健，符合一般投資水準。";
            return "殖利率偏低，投資重點應放在股價價差而非股息。";
        }
    },
    'ROE (股東權益報酬)': {
        type: '獲利品質',
        desc: '公司利用股東資金創造獲利的能力，是衡量公司經營效率最核心的指標。',
        rule: '年化 > 15% 為優秀，8-15% 屬穩健，< 5% 代表效率不彰。',
        advice: '巴菲特最看重的指標。若 ROE 持續增長，代表公司具有競爭護城河。',
        analyze: (v) => {
            if (v > 15) return "表現卓越！公司具備極強的獲利能力與股東回報率。";
            if (v >= 8) return "表現穩健，公司能穩定利用股東權益創造合理利潤。";
            if (v < 5) return "賺錢效率不佳，需留意公司是否面臨產業衰退或經營困境。";
            return "獲利表現普通，處於產業平穩期。";
        }
    },
    '毛利率': {
        type: '獲利能力',
        desc: '營業收入扣除營業成本後的比率，反映產品競爭力與定價能力。',
        rule: '越高越好。與同業相比，毛利越高通常代表技術領先或規模優勢。',
        advice: '需關注趨勢。若毛利率下滑，可能代表市場競爭加劇或原料成本上升。',
        analyze: (v) => {
            if (v > 40) return "高毛利代表產品具備強大競爭力，可能是技術領先者。";
            if (v > 15) return "獲利能力尚屬正常，屬一般製造或服務業水準。";
            return "毛利偏低（保五保六），屬勞力密集或代工行業，抗風險能力較弱。";
        }
    },
    '葛拉漢內在價值': {
        type: '估值',
        desc: '價值投資之父葛拉漢提出的核心公式：√(22.5 × EPS × 每股淨值)。這是衡量股價是否大幅低於企業真實價值的保守基準。',
        rule: '通常認為 22.5 是「合理本益比 15 倍 × 合理股淨比 1.5 倍」的乘積。',
        advice: '當股價低於此數值的 70% 時，稱為具備「安全邊際」。適用於穩定獲利的公司，不適用於高成長科技股。',
        analyze: (v, currentVal) => {
            const priceMatch = window._lastCurrentPrice;
            if (!priceMatch) return "這反映了基於資產與獲利的保守估值指標。";
            if (priceMatch < v * 0.7) return "🔥 強力推薦！目前股價顯著低於葛拉漢內在價值，具備極高的安全邊際。";
            if (priceMatch < v) return "目前股價低於內在價值，估值相對安全。";
            return "目前股價已高於葛拉漢內在價值，估值已充分反應資產與獲利潛力。";
        }
    },
    '主力成本': {
        type: '籌碼',
        desc: '前 15 大買超券商分點的平均成交價格。代表這段時間內「大資金」的進貨價位。',
        rule: '股價在主力成本之上表示主力獲利中；若在成本之下，則主力處於套牢狀態。',
        advice: '主力成本線常被視為強力的「心理支撐」或「壓力位」。當股價回落至 20 日主力成本附近且止跌時，是極佳的介入點。',
        analyze: (v) => {
            const p = window._lastCurrentPrice;
            if (!p) return "觀察主力成本可判斷大戶的盈虧狀態。";
            const diff = (p - v) / v * 100;
            if (Math.abs(diff) < 2) return "🎯 股價目前正處於主力成本區，具備極強支撐力。";
            if (diff < -5) return "⚠️ 主力目前深陷套牢，需觀察是否有認賠賣壓或低位攤平。";
            return "目前股價高於主力成本，多頭架構穩健。";
        }
    },
    '大戶持股比': {
        type: '籌碼',
        desc: '持有 400 張（或更多）以上股份的股東所佔比例。反映機構法人與大股東的動態。',
        rule: '比例上升代表籌碼集中，有利漲勢；比例下降代表籌碼分散。',
        advice: '應觀察「趨勢」而非絕對值。若大戶持股連週上升，通常代表有波段行情。',
    },
    '散戶持股比': {
        type: '籌碼',
        desc: '持有 50 張（或以下）小額股份的股東比例。',
        rule: '與大戶持股成反比。散戶比例過高通常代表籌碼凌亂，股價易跌難漲。',
        advice: '若股價上漲但散戶持股增加，需提防主力正在「拉高出貨」。',
    },
    '營業利益率': {
        type: '獲利能力',
        desc: '反映公司核心業務的獲利狀況，排除業外損益後的真實能力。',
        rule: '維持穩定或向上為佳。',
        advice: '若營業利益率成長速度快於毛利率，代表公司成本控制（管理效率）正在提升。',
        analyze: (v) => {
            if (v > 15) return "核心業務獲利強勁，經營管理效率極高。";
            if (v > 5) return "本業維持獲利，屬平穩經營狀態。";
            return "本業獲利微薄甚至虧損，需高度警覺營運風險。";
        }
    },
    '存貨週轉天數': {
        type: '營運效率',
        desc: '公司將庫存商品賣出去平均需要的天數。',
        rule: '天數愈短代表存貨管理愈好，資金積壓愈少。',
        advice: '需與同業比較。若天數突然激增，需警惕庫存跌價損失或產品滯銷風險。',
        analyze: (v) => {
            if (v < 45) return "存貨去化非常迅速，資金週轉極具效率。";
            if (v < 90) return "存貨管理尚屬穩健。";
            return "存貨積壓天數偏長，需留意是否有滯銷或砍單風險。";
        }
    },
    '累積 8 季總含金量': {
        type: '獲利品質',
        desc: '過去 8 季營業現金流總和除以淨利總和，反映長期獲利的「真錢」比例。',
        rule: '> 100% 為優異，代表帳面收益都有轉換成現金收進口袋。',
        advice: '這是判斷虛假獲利最強大的過濾器。長期低於 80% 需嚴防財報作假。',
        analyze: (v) => {
            if (v > 100) return "獲利含金量極高！公司賺進的現金甚至超過帳面利潤。";
            if (v >= 80) return "獲利品質穩定，現金回收能力正常。";
            return "⚠️ 注意：含金量偏低，公司可能面臨應收帳款過高或存貨積壓，獲利僅存在於帳面上。";
        }
    },
    '營收 vs 存貨成長趨勢 (YoY)': {
        type: '營運風險',
        desc: '比較營收成長率與存貨成長率。若存貨成長過快，通常是業績衰退的先行指標。',
        rule: '存貨成長不應顯著高於營收成長（> 15% 需注意）。',
        advice: '若存貨成長遠快於營收，可能代表公司正在「塞貨」給通路，或產品銷售受阻。',
        analyze: (v) => {
            if (v > 20) return "警訊！存貨成長過快，需留意後續是否有庫存去化壓力。";
            if (v > 0) return "存貨雖有增長，但仍在可控範圍內。";
            return "存貨管理良好，去化速度快於成長速度。";
        }
    },
    '現金週期 (CCC)': {
        type: '營運效率',
        desc: '從付錢買原料到賣出商品拿到現金，這筆資金被卡住的天數。',
        rule: '越短越好，甚至負值代表公司對供應商有極強的議價能力。',
        advice: '優秀的龍頭企業（如台積電、聯發科）通常能維持極短的現金週期。',
        analyze: (v) => {
            if (v < 30) return "資金回收極快，對上下游具備極強的議價與主導權。";
            if (v < 100) return "資金調度尚屬正常。";
            return "現金被卡在營運流程中的時間較長，需注意資金流動性風險。";
        }
    },
    'RSI (14)': {
        type: '技術面',
        desc: '相對強弱指標。衡量一段時間內股價漲勢與跌勢的力道。',
        rule: '> 70 為超買（過熱），< 30 為超跌（可能反彈）。',
        advice: '適合尋找短線買賣點，但強勢股可能在高檔鈍化，需配合均線使用。',
        analyze: (v) => {
            if (v > 80) return "目前處於極度超買區，過熱風險極高，不宜再盲目追多。";
            if (v > 70) return "目前進入超買區（過熱），股價短線可能回檔，不宜過度追高。";
            if (v < 20) return "目前進入極度超跌區，隨時可能發動強力反彈。";
            if (v < 30) return "目前進入超跌區，短線隨時可能發動跌深反彈。";
            return "目前處於中性區間，多空力道平衡。";
        }
    },
    'Beta (β)': {
        type: '風險',
        desc: '反映個股對大盤波動的敏感度。',
        rule: '1.0 為基準。> 1.2 屬於積極型（波動大），< 0.8 屬於防禦型（波動小）。',
        advice: '牛市時選高 Beta 增加勝率，熊市時選低 Beta 避險。',
        analyze: (v) => {
            if (v > 1.2) return "標的極具攻擊性，大盤上漲時會噴發得更兇，但回檔時也跌得更快。";
            if (v < 0.8) return "標的屬防禦型，適合追求穩健或避險的配置。";
            return "波動幅度與大盤大致同步。";
        }
    },
    'Piotroski F-Score': {
        type: '綜合診斷',
        desc: '用 9 個財務面向評分（獲利、財務槓桿、營運效率）。',
        rule: '8-9 分為極佳，0-3 分代表財務體質堪憂。',
        advice: '這是一個極具公信力的財務過濾器，能有效剔除基本面轉差的地雷股。',
        analyze: (v) => {
            if (v >= 7) return "體質極佳！九項財務指標中多數過關，具備機構級的安全性。";
            if (v >= 4) return "體質中等，尚無立即性的財務風險。";
            return "警告！財務評分極低，公司各項體質都在惡化中，務必小心。";
        }
    },
    'PE 位階': {
        type: '估值',
        desc: '目前本益比在過去 5 年歷史區間中的位置。',
        rule: '< 30% 處於相對便宜區，> 70% 處於相對高估區。',
        advice: '「便宜」不代表馬上會漲，「昂貴」不代表馬上會跌。',
        analyze: (v) => {
            if (v < 20) return "目前處於歷史低水位，估值極具吸引力，具備安全邊際。";
            if (v > 80) return "目前處於歷史高水位（昂貴），市場情緒亢奮，需慎防追高回檔風險。";
            return "目前處於歷史中間位階。";
        }
    },
    'PB 位階': {
        type: '估值',
        desc: '目前股價與淨值的比值在歷史區間的位置。',
        rule: '適用於獲利不穩定的景氣循環股。',
        advice: '當股淨比來到歷史低位（< 20%），通常是長線佈局的機會。',
        analyze: (v) => {
            if (v < 25) return "目前處於歷史性的大底部區，具備極高的價值投資吸引力。";
            if (v > 75) return "目前處於歷史高點區（昂貴），溢價幅度較大，建議避開或逢高獲利了結。";
            return "目前處於歷史中間水位。";
        }
    },
    '應收帳款天數': {
        type: '營運效率',
        desc: '公司產品賣出後，平均需要多少天才能收到現金。',
        rule: '通常與同業相比，天數愈短代表公司對下游收錢的能力愈強。',
        advice: '若天數顯著增加，需小心客戶可能付不出錢，導致壞帳風險。',
        analyze: (v) => {
            if (v < 40) return "收錢速度極快，對下游客戶具備強大的議價地位。";
            if (v > 100) return "收錢速度偏慢，需注意是否有呆帳風險或客戶延遲付款。";
            return "收錢速度處於正常區間。";
        }
    },
    '應付帳款天數': {
        type: '營運效率',
        desc: '公司向供應商買料後，平均可以「賒帳」多久才付錢。',
        rule: '天數愈長，代表公司對供應商的議價能力愈強，資金調度愈靈活。',
        advice: '這是一種「無息貸款」，對公司營運是有利的指標。',
        analyze: (v) => {
            if (v > 90) return "公司具備強大的議價能力，能有效運用供應商資金。";
            if (v < 30) return "付錢速度較快，資金積壓在供應鏈中的時間較短。";
            return "付錢速度處於正常範圍。";
        }
    },
    '存貨週轉率': {
        type: '營運效率',
        desc: '反映公司一年內把存貨賣掉再補貨的次數。',
        rule: '次數愈高，代表商品愈好賣，沒有滯銷問題。',
        advice: '需配合毛利率看。若週轉率高但毛利低，可能是公司在「削價競爭」。',
        analyze: (v) => {
            if (v > 8) return "商品非常好賣，幾乎沒有庫存積壓問題。";
            if (v < 2) return "商品銷售較慢，需警惕庫存跌價損失。";
            return "週轉速度屬穩健狀態。";
        }
    },
    'EPS 年增率 (YoY)': {
        type: '成長性',
        desc: '與去年同一時期相比，每股盈餘的成長百分比。',
        rule: '> 20% 為高速成長，10-20% 為穩健成長。',
        advice: '投資成長股的核心。若 YoY 連續三季成長，股價通常會有強勁表現。',
        analyze: (v) => {
            if (v > 25) return "盈餘成長動能爆發，是標準的高成長績優股。";
            if (v > 0) return "獲利維持正成長。";
            return "獲利出現衰退，需探究是短期因素還是競爭力下滑。";
        }
    },
    '年化波動率': {
        type: '風險',
        desc: '衡量股價波動劇烈程度的指標。',
        rule: '波動率 > 40% 代表是大起大落的飆股；< 20% 則是適合定存的穩健股時常伴隨低風險。',
        advice: '適合心臟大小的測試。保守型投資人應避開波動率過高的標的。',
        analyze: (v) => {
            if (v > 45) return "波動劇烈！這是一檔高風險、高報酬的飆股，務必控制部位。";
            if (v < 20) return "走勢非常平穩，適合追求長期領息的保守型投資人。";
            return "波動幅度在中性區間。";
        }
    },
    '每股淨值 (BPS)': {
        type: '估值',
        desc: '公司的總資產扣除負債後，除以發行股數。代表每一股包含的淨資產價值。',
        rule: '當股價低於每股淨值（P/B < 1）時，通常被認為是股價被低估。',
        advice: '適合用來評估重資產行業（如金融、鋼鐵、面板），但對於輕資產的軟體公司參考價值較低。',
        analyze: (v) => {
            if (v > 100) return "公司的淨資產底子非常厚實，具備極強的抗風險能力。";
            if (v > 20) return "淨資產表現正常，具備基本的價值支撐。";
            return "淨資產較低。";
        }
    },
    '市銷率 (P/S)': {
        type: '估值',
        desc: '市值除以年度營收。反映投資人願意為每 1 元營收付出多少價格。',
        rule: '越低越好。通常 P/S < 1 被視為非常便宜。',
        advice: '非常適合評估「高成長但尚未轉盈」的公司（如剛起步的生技或網路股）。',
        analyze: (v) => {
            if (v < 1.5) return "目前市銷率極低，代表市場可能嚴重低估其營收價值。";
            if (v > 5.0) return "估值偏高，需有極強的成長性支撐。";
            return "估值處於合理區。";
        }
    },
    '市淨率 (P/B)': {
        type: '估值',
        desc: '股價與每股淨值的比值（Price-to-Book Ratio）。',
        rule: '< 1 代表股價低於淨資產價值；> 3 通常代表溢價過高。',
        advice: '當景氣循環股（如航運）的 P/B 來到歷史低點時，往往是絕佳的撿便宜時機。',
        analyze: (v) => {
            if (v < 1.0) return "股價低於帳面價值，具備高度價值吸引力。";
            if (v > 3.0) return "溢價水準較高，需留意資產是否被過度炒作。";
            return "目前估值處於合理區間。";
        }
    },
    'PEG 比例': {
        type: '估值',
        desc: '本益比除以盈餘成長率。用來衡量成長股的估值是否合理。',
        rule: '< 1 代表成長速度快於估值（便宜）；> 1.5 則可能過度樂觀。',
        advice: '這是彼得·林區最愛的指標，能有效找出「物超所值」的高成長股。',
        analyze: (v) => {
            if (v <= 0) return "目前盈餘成長為負值，不適用 PEG 估值。";
            if (v < 1.0) return "成長動能強勁且估值便宜，是理想的高成長投資標底！";
            if (v > 1.8) return "目前的成長性已不足以支撐高估值，需慎防泡沫破裂。";
            return "估值與成長性匹配。";
        }
    },
    '營運槓桿度 (DOL)': {
        type: '營運效率',
        desc: '營收每變動 1%，營業利益會變動幾 %。反映固定成本對獲利的放大效應。',
        rule: '數值越高，代表營收成長時獲利會噴發，但衰退時也會跌得更慘。',
        advice: '高槓桿公司（如代工廠、半導體廠）在產業回升期最具爆發力。',
        analyze: (v) => {
            if (v > 3.0) return "高槓桿企業！營收的小幅成長會帶動獲利巨幅跳升，但也要小心衰退時的重傷風險。";
            return "槓桿度平穩，獲利變動與營收大致同步。";
        }
    },
    '自由現金流殖利率': {
        type: '現金流',
        desc: '公司每年產生的「自由現金流」除以市值。比股息殖利率更能反映公司的真實派錢能力。',
        rule: '> 5% 代表現金流極度充裕；< 0% 則要注意公司是否入不敷出。',
        advice: '這是我最看重的「避雷指標」，自由現金流為負的公司，其獲利往往只是帳面數字。',
        analyze: (v) => {
            if (v > 6.0) return "現金流含金量極高，公司有雄厚的本錢進行配息或再投資。";
            if (v < 0) return "警告！公司賺進來的現金不足以支撐資本支出，財務健康度欠佳。";
            return "現金流狀況尚屬穩健。";
        }
    },
    '稅後淨利率': {
        type: '獲利能力',
        desc: '最終淨利佔營收的百分比。代表每一塊錢營收扣除所有成本、稅金後留下的錢。',
        rule: '越高越好。通常 > 10% 屬於獲利能力優良。',
        advice: '若營收增加但淨利率下滑，可能代表競爭劇烈導致毛利縮水。',
        analyze: (v) => {
            if (v > 15) return "獲利能力強勁，公司具備良好的成本控制或品牌溢價能力。";
            if (v > 5) return "獲利能力尚屬平穩。";
            return "獲利極其微薄，抗風險能力較弱，需留意產業競爭是否過於激烈。";
        }
    },
    '業外損益佔比': {
        type: '獲利品質',
        desc: '業外收入與支出對稅前淨利的影響程度。',
        rule: '< 10% 代表獲利非常純粹；> 30% 則代表獲利大多來自賣地、投資或匯兌。',
        advice: '需警惕高業外佔比的公司，因為這種獲利通常不可持續。',
        analyze: (v) => {
            if (v < 10) return "獲利結構非常純粹，幾乎全部來自本業，品質極佳。";
            if (v > 40) return "警告！獲利高度依賴業外，需查明是業外投資大賺還是賣祖產度日。";
            return "業外影響程度尚在可接受範圍。";
        }
    },
    'ROA (資產報酬率)': {
        type: '獲利能力',
        desc: '公司利用「所有資產」（包含負債與股東資金）創造獲利的能力。',
        rule: '> 8% 算優秀；4-8% 屬正常；< 3% 代表資產利用效率過低。',
        advice: '對於負債比高的行業（如銀行、壽險），ROA 比 ROE 更能反映經營好壞。',
        analyze: (v) => {
            if (v > 10) return "資產運用效率極高，公司在運用整體資源上表現優異。";
            if (v > 4) return "資產報酬率處於產業平均水準。";
            return "資產運用效率偏低，需留意是否有過多閒置資產或經營效能不彰。";
        }
    },
    '營收年複合成長率 (CAGR)': {
        type: '成長性',
        desc: '衡量公司在一段特定時間內（通常是 3-5 年），營收平均每年的成長速度。',
        rule: '> 15% 為高成長公司；5-15% 為穩健成長。',
        advice: 'CAGR 能平滑掉單一年份的劇烈波動，是判斷長線趨勢最好的工具。',
        analyze: (v) => {
            if (v > 20) return "高成長明星股！營收呈現強勁的複合增長，具備極佳的產業地位。";
            if (v > 8) return "營收穩健成長，符合優質企業的長期表現。";
            return "營收成長緩慢或陷入停滯，需留意公司是否進入產業成熟期或衰退期。";
        }
    },
    '流動比率': {
        type: '償債能力',
        desc: '流動資產除以流動負債。反映公司在一年內償還短期債務的能力。',
        rule: '> 200% 為優良；< 100% 代表短期資金壓力極大。',
        advice: '財務穩健的第一道防線，低於 100% 的標的絕對要小心。',
        analyze: (v) => {
            if (v > 200) return "短期償債能力極佳，公司手頭流動資金充裕，財務非常穩健。";
            if (v > 120) return "償債能力尚可。";
            return "短期資金壓力沉重，若遇到景氣寒冬，可能面臨週轉困難。";
        }
    },
    '速動比率': {
        type: '償債能力',
        desc: '（流動資產 - 存貨）除以流動負債。比流動比率更嚴苛的指標。',
        rule: '> 100% 為安全。',
        advice: '排除掉變現慢的存貨，最能看出公司在緊急情況下「現拿錢」的能力。',
        analyze: (v) => {
            if (v > 150) return "變現能力強悍，即使不賣庫存也能輕鬆償還短期債務。";
            if (v > 100) return "速動能力符合安全標準。";
            return "高度依賴庫存變現來還債，若產品滯銷，將面臨巨大的資金風險。";
        }
    },
    '負債比率': {
        type: '償債能力',
        desc: '總負債除以總資產。反映公司資金來自借款的比例。',
        rule: '40-60% 為正常區間；> 70% 財務壓力較重。',
        advice: '不同產業標準不同（金融股通常很高），但一般製造業不應超過 50%。',
        analyze: (v) => {
            if (v > 70) return "警告！財務槓桿極高，利息支出可能侵蝕獲利，具備較大財務風險。";
            if (v < 30) return "財務結構極其穩健，但也可能代表公司經營過於保守。";
            return "財務槓桿處於健康且適中的範圍。";
        }
    },
    '淨負債比率': {
        type: '償債能力',
        desc: '（總負債 - 現金）除以股東權益。反映扣除現金後公司真實的財務負擔。',
        rule: '< 0% 代表公司「手頭現金比債多」，體質極佳。',
        advice: '這是衡量「倒閉風險」最精準的指標之一。',
        analyze: (v) => {
            if (v < 0) return "淨負債為負！這是一間手頭現金比債務還多的「現金富豪」公司，倒閉風險極低。";
            if (v > 80) return "財務槓桿較高，受利息波動影響較大，需謹慎評估其現金流狀況。";
            return "財務結構健全。";
        }
    },
    '利息保障倍數': {
        type: '償債能力',
        desc: '營業利益除以利息支出。反映公司賺來的錢足不足夠支付貸款利息。',
        rule: '> 5 倍為安全；< 1 倍代表賺來的錢連付利息都不夠（地雷股預警）。',
        advice: '倍數越高，代表公司越不容易受升息環境影響。',
        analyze: (v) => {
            if (v > 20) return "利息支付能力極強，債務負擔對公司經營毫無威脅。";
            if (v < 3) return "利息支出侵蝕獲利明顯，需警惕債務違約風險。";
            return "償還利息的能力正常。";
        }
    },
    '獲利品質 (OCF/NI)': {
        type: '獲利品質',
        desc: '營業現金流除以稅後淨利。反映公司的利潤中有多少比例是真金白銀。',
        rule: '> 100% 代表獲利品質極高；< 80% 需留意是否有應收帳款過高的問題。',
        advice: '盈餘含金量指標。高獲利、低現金流的公司往往是財報造假的重災區。',
        analyze: (v) => {
            if (v > 100) return "獲利品質極佳！公司賺的錢都有轉化為真實現金。";
            if (v < 70) return "警訊！獲利含金量偏低，需留意應收帳款是否過高或有虛增獲利的疑慮。";
            return "獲利品質尚屬正常。";
        }
    },
    '營業現金流 (OCF)': {
        type: '現金流',
        desc: '公司日常經營活動（賣東西、發薪水）所產生的實際現金流入與流出。',
        rule: '必須長期為正值。',
        advice: '這是公司的「生命線」，如果 OCF 長期為負，公司遲早會倒閉。',
        analyze: (v) => {
            if (v > 0) return "本業持續帶入現金，營運生命線健康。";
            return "嚴重警訊！本業營運現金為負流出，公司營運面臨嚴峻考驗。";
        }
    },
    '投資現金流 (ICF)': {
        type: '現金流',
        desc: '公司為了未來發展（買機器、併購）所花出去或收回的現金。',
        rule: '正常成長的公司此數值通常為負（代表持續投入研發與擴產）。',
        advice: '如果 ICF 長期為正，代表公司正在賣資產度日，並非好現象。',
        analyze: (v) => {
            if (v < 0) return "公司正積極投入資本支出或研發，通常代表對未來成長有信心。";
            return "公司目前正處於處分資產或收回投資的狀態。";
        }
    },
    '自由現金流 (FCF)': {
        type: '現金流',
        desc: '公司賺進來的現金（OCF）扣除掉維持成長所需的投資（CapEx）後，剩下的閒置資金。',
        rule: '越多越好。這是公司可以用來發股利、還債 or 買庫藏股的真正資金。',
        advice: '擁有充沛 FCF 的公司，就像擁有了強大的戰略後備庫。',
        analyze: (v) => {
            if (v > 0) return "公司擁有真正的獲利含金量，有能力配息或進行擴張。";
            return "警訊！公司現金流入不足以支撐投資支出，需留意是否入不敷出。";
        }
    },
    '布林位置': {
        type: '技術面',
        desc: '反映股價在布林通道（2 倍標準差軌道）中的相對位置。',
        rule: '> 90% 為強勢噴發；< 10% 為弱勢尋底。',
        advice: '適合捕捉趨勢發動點，但需配合成交量判斷是否為假突破。',
        analyze: (v) => {
            if (v > 90) return "股價正處於極端強勢區，可能正在發動「噴發」走勢。";
            if (v < 10) return "股價正處於極端弱勢區，短線可能出現跌深反彈。";
            return "股價在布林通道內正常波動，趨勢尚不明顯。";
        }
    },
    '20日 乖離率': {
        type: '技術面',
        desc: '股價與 20 日移動平均線（月線）的距離百分比。',
        rule: '> 10% 通常代表短線漲幅過大，容易回檔；< -10% 則有跌深反彈機會。',
        advice: '像是一條橡皮筋，拉得太遠終究會彈回均線。',
        analyze: (v) => {
            if (v > 10) return "正乖離過大！股價短線過熱，隨時可能回測月線尋求支撐。";
            if (v < -10) return "負乖離過大！股價短線過度殺低，隨時可能發動報復性反彈。";
            return "乖離率處於正常範圍，股價與均線距離適中。";
        }
    },
    'RSI(14)': {
        type: '技術面',
        desc: '相對強弱指標。衡量一段時間內股價漲勢與跌勢的力道。',
        rule: '> 70 為超買（過熱），< 30 為超跌（可能反彈）。',
        advice: '適合尋找短線買賣點，但強勢股可能在高檔鈍化，需配合均線使用。',
        analyze: (v) => {
            if (v > 80) return "目前處於極度超買區，過熱風險極高，不宜再盲目追多。";
            if (v > 70) return "目前進入超買區（過熱），股價短線可能回檔，不宜過度追高。";
            if (v < 20) return "目前進入極度超跌區，隨時可能發動強力反彈。";
            if (v < 30) return "目前進入超跌區，短線隨時可能發動跌深反彈。";
            return "目前處於中性區間，多空力道平衡。";
        }
    },
    'KD (K/D)': {
        type: '技術面',
        desc: '隨機指標 (Stochastic Oscillator)。反映股價在一段時間內高低價格區間的相對位置。',
        rule: 'K > 80 超買，K < 20 超跌。K 向上突破 D 為黃金交叉（買進訊號）。',
        advice: '適合在區間震盪行情中使用。若指標在高檔或低檔鈍化，則代表趨勢極強。',
        analyze: (cleanVal, rawVal) => {
            if (typeof rawVal === 'string' && rawVal.includes('/')) {
                const [k, d] = rawVal.split('/').map(v => parseFloat(v.replace(/[^\d.-]/g, '')));
                if (!isNaN(k) && !isNaN(d)) {
                    if (k > d && k < 30) return "KD 出現低檔黃金交叉，短線反彈動能醞釀中。";
                    if (k < d && k > 70) return "KD 出現高檔死亡交叉，需留意短線回檔風險。";
                    if (k > 80) return "K 值進入超買區，慎防追高風險。";
                    if (k < 20) return "K 值進入超跌區，不建議在此殺低。";
                    return k > d ? "K 值大於 D 值，短線趨勢偏多。" : "K 值小於 D 值，短線趨勢偏弱。";
                }
            }
            return "KD 指標目前處於中性區間。";
        }
    },
    'MACD OSC': {
        type: '技術面',
        desc: 'MACD 柱狀體 (Oscillator)。代表快線 (DIF) 與慢線 (MACD) 的差值。',
        rule: '> 0 為紅柱，代表多方動能增強；< 0 為綠柱，代表空方動能增強。',
        advice: '注意柱狀體長短變化。紅柱縮短通常是股價轉弱的先行訊號。',
        analyze: (v) => {
            if (v > 0) return "目前為紅柱（多方控盤），動能正向，可觀察紅柱是否持續增長。";
            if (v < 0) return "目前為綠柱（空方控盤），動能轉負，建議觀望或保守操作。";
            return "動能平衡中。";
        }
    },
    '盈餘分配率 (Payout Ratio)': {
        type: '股利',
        desc: '公司從當年度賺到的淨利中，拿多少比例出來發放給股東。',
        rule: '一般在 40-70% 之間較為穩健；長期 > 100% 屬不正常現象。',
        advice: '高配息率雖吸引人，但若超過 100% 代表在「吃老本」，需留意配息的永續性。',
        analyze: (v) => {
            if (v > 100) return "嚴重警訊！配息率超過 100%，公司正在動用公積或借錢發股利，極不具永續性。";
            if (v > 80) return "配息政策極為大方，適合收息族，但需留意公司是否缺乏未來投資成長的資金。";
            if (v < 30 && v > 0) return "配息率較低，顯示公司傾向保留現金進行再投資或擴張，具備成長股特徵。";
            if (v <= 0) return "目前未發放股利，資金可能全數留存於公司內部。";
            return "配息政策穩健，獲利與股東回饋比例均衡。";
        }
    },
    'Altman Z-Score': {
        type: '償債能力',
        desc: '由紐約大學教授 Edward Altman 開發，用於預測企業在兩年內破產概率的綜合指標。',
        rule: '> 2.99 為安全區；1.81 - 2.99 為灰色區；< 1.81 為危險區。',
        advice: '對於製造業非常準確，但對於金融業或服務業需謹慎參考。Z 值越低，代表財務體質越脆弱。',
        analyze: (v) => {
            if (v > 2.99) return "目前處於「安全區」，財務體質極其穩健，短期內無倒閉或違約風險。";
            if (v >= 1.8) return "目前處於「灰色區」，財務壓力尚可，但需留意現金流與負債比率的變動。";
            return "警訊！目前進入「危險區」，財務體質脆弱，需嚴防債務危機或營運週轉困難。";
        }
    },
    '分點集中度': {
        type: '籌碼',
        desc: '前 15 大買超分點與前 15 大賣超分點的合計張數，佔當日總成交量的比例。反映主力介入個股的力道。',
        rule: '> 20% 為高度集中；10% - 20% 為集中；< 10% 為分散。',
        advice: '若集中度高且股價上漲，代表籌碼正流向少數主力，後市爆發力強。',
        analyze: (v) => {
            if (v > 25) return "籌碼極度集中！前 15 大主力掌控了市場超過 1/4 的成交量，顯示大戶正在積極收貨。";
            if (v > 15) return "籌碼呈現集中態勢，主力介入程度深，對股價具備較強支撐力。";
            if (v < 8) return "籌碼目前較為分散，主要由散戶與小額交易者主導，短線較難有趨勢性行情。";
            return "籌碼集中度普通，主力與散戶力道相對平衡。";
        }
    },
    '估值位階 (PE River)': {
        type: '估值',
        desc: '衡量當前股價在過去 5 年本益比分布中的位置。透過歷史百分位數 (Percentile) 判斷目前價格是否便宜。',
        rule: '本益比百分位數 < 20% 為便宜區；40-60% 為合理區；> 80% 為昂貴區。',
        advice: '當股價跌至「便宜區」且基本面無虞時，通常是長線買點；反之在「昂貴區」需注意獲利回結。',
        analyze: (v) => {
            if (v < 20) return "目前處於「極低估值區」，本益比低於過去 5 年 80% 的時間，具備極高安全邊際，建議分批布局。";
            if (v < 40) return "目前處於「偏低估值區」，評價具有吸引力，長線配置價值浮現，屬相對安全位階。";
            if (v < 60) return "目前處於「合理估值區」，股價與過去 5 年平均水準持平，風險與報酬對等，適合持有。";
            if (v < 85) return "目前處於「偏高估值區」，市場已給予較多溢價，需留意漲多回檔的獲利了結賣壓。";
            return "⚠️ 嚴重警訊！目前處於「極高估值區」，評價已達歷史極端，追高風險極大，建議審慎評估風險。";
        }
    },
    'PEG 比例': {
        type: '估值',
        desc: '本益成長比。公式：本益比 / EPS 成長率 (TTM)。用來判斷高成長公司的股價是否貴得合理。',
        rule: '< 1 代表低估（便宜）；1 - 1.5 代表合理；> 1.5 代表高估（貴）。',
        advice: '如果公司處於「獲利衰退（成長率為負）」，PEG 會顯示為 N/A (獲利衰退)。因為此時本益比已無法反映成長價值，需改看資產或現金流。',
        analyze: (v) => {
            if (v === null || isNaN(v) || v <= 0) return "目前公司處於獲利衰退期（成長率為負），無法計算 PEG 比例。建議觀察營運何時止跌轉正。";
            if (v < 1.0) return "PEG 低於 1.0，顯示股價相對於目前強勁的成長動能來說非常便宜，具備投資價值。";
            if (v > 1.8) return "PEG 偏高，股價已透支未來成長動能，除非獲利能有爆發性驚喜，否則追高風險較大。";
            return "PEG 處於合理區間，股價與成長動能匹配，適合穩健持有。";
        }
    },
    'EPS 成長率 (TTM)': {
        type: '獲利能力',
        desc: '近四季累計 EPS 相較於前一年同期累計 EPS 的增長百分比。反映公司最真實的獲利動能趨勢。',
        rule: '> 0 代表成長；> 20% 為高成長；< 0 代表衰退。',
        advice: '相較於單季 YoY，TTM（滾動十二個月）能有效排除季節性影響，是判斷公司中長期成長趨勢的核心指標。',
        analyze: (v) => {
            if (v > 30) return "🚀 獲利爆發性成長！公司正處於極強的營運上升期，基本面動能強勁。";
            if (v > 10) return "✅ 獲利穩健成長，營運狀況良好，足以支撐股價長線向上發展。";
            if (v < -15) return "⚠️ 警訊！獲利顯著衰退，公司可能面臨產業逆風或競爭力下降，需嚴防評價修正賣壓。";
            if (v < 0) return "📊 獲利輕微衰退，目前處於營運調整期，建議觀察未來季度毛利率是否回升。";
            return "獲利動能處於盤整階段，多空趨勢尚不明確。";
        }
    },
    '毛利改善 (YoY)': {
        type: '獲利能力',
        desc: '本季毛利率與去年同期毛利率的差值（百分點）。這能反映公司產品定價權、原料成本控管以及生產效率的變化。',
        rule: '> 0 代表毛利率轉好；若能連續三季改善，通常代表公司進入營運向上拐點。',
        advice: '毛利率被稱為「指標之母」。若毛利率改善伴隨營收成長，就是所謂的「雙增」，是股價最強的推動力。',
        analyze: (v) => {
            if (v > 5) return "🚀 毛利率顯著噴發！顯示產品競爭力極強，或是規模經濟效益展現，獲利品質大幅躍升。";
            if (v > 1) return "✅ 毛利率穩步改善，經營效率提升，有利於營業利益的成長。";
            if (v < -5) return "⚠️ 警訊！毛利率大幅縮水，可能面臨嚴重的削價競爭或成本失控，需高度警戒。";
            if (v < 0) return "📉 毛利率較去年下滑，可能受到匯率、原料價格或產品組合調整影響，需觀察毛利率何時止穩。";
            return "毛利率維持平穩，營運體質穩定。";
        }
    }
};

/**
 * 顯示指標百科彈窗，並根據目前數值進行分析
 * @param {string} term 指標名稱
 * @param {string} currentVal 目前數值 (選填)
 */
function showTermExplainer(term, currentVal = null) {
    const def = termDefinitions[term];
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
        '技術面': '#ec4899',
        '風險': '#ef4444',
        '綜合診斷': '#10b981',
        '營運效率': '#8b5cf6',
        '償債能力': '#06b6d4'
    };
    const badgeColor = typeColors[def.type] || '#64748b';

    // 嘗試解析數值並進行診斷
    let analysisHtml = '';
    if (currentVal && def.analyze) {
        // 優先提取「位階」後面的百分比，若無則提取第一個出現的數字
        let cleanVal;
        const valStr = String(currentVal);
        if (valStr.includes('位階')) {
            const match = valStr.match(/位階\s*([-\d.]+)/);
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
                    <div class="term-explainer-subtitle" style="color:${badgeColor}; margin-bottom:8px;">🔍 即時診斷</div>
                    <div style="font-size:14px; font-weight:700; color:#fff; margin-bottom:4px;">
                        目前數值: <span style="font-size:18px; color:${badgeColor};">${currentVal}</span>
                    </div>
                    <div class="term-explainer-body" style="font-size:13px; line-height:1.5; color:#e2e8f0; opacity:1;">
                        ${diagnosis}
                    </div>
                </div>
            `;
        }
    }

    overlay.innerHTML = `
        <div class="term-explainer-content">
            <div class="term-explainer-close" onclick="closeTermExplainer()">✕</div>
            <div class="term-explainer-badge" style="background:${badgeColor}20; color:${badgeColor}; border:1px solid ${badgeColor}40;">
                ${def.type}
            </div>
            <div class="term-explainer-title">${term}</div>
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
