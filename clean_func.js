function renderSectorComparison(finData, revData, twseBasic) {
    const industry = finData.industry || '未知';
    const myPE = finData.ttmEps ? (twseBasic?.currentPrice / finData.ttmEps) : 0;
    const myYield = parseFloat(twseBasic?.yield) || 0;
    const myRev = parseFloat(revData?.yoy) || 0;
    const myROE = finData.roe || 0;
    const myGM = finData.grossMargin || 0;

    const avgPE = 18.5; const avgYield = 3.2; const avgRev = 12.0; const avgROE = 10.5; const avgGM = 25.0;

    const getCompare = (me, avg, type) => {
        const diff = (me - avg).toFixed(1);
        const isBetter = type === 'PE' ? me < avg : me > avg;
        const sign = diff > 0 ? '+' : '';
        return isBetter ? `<span style="color:#60a5fa">優於 ${Math.abs(diff)}</span>` : `<span style="color:#f97316">落後 ${Math.abs(diff)}</span>`;
    };

    return `
        <div class="analysis-card" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(30, 41, 59, 0.5) 100%); border: 1px solid rgba(59, 130, 246, 0.2); margin-bottom: 20px;">
            <h3 style="color:#60a5fa; margin-bottom:15px;">🏛️ 產業基準對比 (同業平均: ${industry})</h3>
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px;">
                <div style="text-align:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;">
                    <div style="font-size:12px; color:#94a3b8;">本益比</div>
                    <div style="font-size:18px; font-weight:bold; margin:4px 0;">${myPE.toFixed(1)}倍</div>
                    <div style="font-size:11px;">${getCompare(myPE, avgPE, 'PE')}</div>
                </div>
                <div style="text-align:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;">
                    <div style="font-size:12px; color:#94a3b8;">殖利率</div>
                    <div style="font-size:18px; font-weight:bold; margin:4px 0;">${myYield.toFixed(1)}%</div>
                    <div style="font-size:11px;">${getCompare(myYield, avgYield, 'Yield')}</div>
                </div>
                <div style="text-align:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;">
                    <div style="font-size:12px; color:#94a3b8;">營收成長</div>
                    <div style="font-size:18px; font-weight:bold; margin:4px 0;">${myRev.toFixed(1)}%</div>
                    <div style="font-size:11px;">${getCompare(myRev, avgRev, 'Rev')}</div>
                </div>
            </div>
        </div>
    `;
}
