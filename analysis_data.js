// analysis_data.js
// 存放大型數據集與 UI 渲染相關輔助函數，以減輕 analysis.js 負擔

// === UI 元素宣告 ===
let analysisModal, closeAnalysisBtn, analysisTitle, analysisBody;

// 初始化 UI 元素 (由 analysis.js 呼叫或在 DOM 載入後執行)
function initAnalysisUI() {
    analysisModal = document.getElementById('analysisModal');
    closeAnalysisBtn = document.getElementById('closeAnalysisBtn');
    analysisTitle = document.getElementById('analysisTitle');
    analysisBody = document.getElementById('analysisBody');
}

// 在腳本載入時嘗試初始化，如果 DOM 已就緒
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalysisUI);
} else {
    initAnalysisUI();
}

// === 產業標竿數據 (Sector Benchmarks) ===
const sectorBenchmarks = {
    '半導體業': { gm: 45, om: 25, roe: 20, rd: 12, pe: 22, pb: 4.5 },
    '電腦及週邊設備業': { gm: 12, om: 5, roe: 12, rd: 4, pe: 15, pb: 2.0 },
    '電子零組件業': { gm: 22, om: 10, roe: 14, rd: 6, pe: 16, pb: 2.5 },
    '光電業': { gm: 15, om: 5, roe: 8, rd: 5, pe: 18, pb: 1.5 },
    '通信網路業': { gm: 30, om: 12, roe: 15, rd: 8, pe: 20, pb: 3.0 },
    '其他電子業': { gm: 18, om: 8, roe: 13, rd: 5, pe: 16, pb: 2.2 },
    '電機機械業': { gm: 20, om: 10, roe: 12, rd: 3, pe: 14, pb: 1.8 },
    '鋼鐵工業': { gm: 10, om: 5, roe: 8, rd: 1, pe: 12, pb: 1.2 },
    '航運業': { gm: 15, om: 10, roe: 15, rd: 0.5, pe: 8, pb: 1.5 },
    '金融保險業': { gm: 0, om: 0, roe: 10, rd: 0, pe: 12, pb: 1.0 },
    '化學工業': { gm: 18, om: 8, roe: 11, rd: 2, pe: 15, pb: 1.6 },
    '塑膠工業': { gm: 12, om: 6, roe: 9, rd: 1.5, pe: 14, pb: 1.3 },
    '水泥工業': { gm: 15, om: 10, roe: 10, rd: 1, pe: 13, pb: 1.2 },
    '食品工業': { gm: 25, om: 8, roe: 15, rd: 1, pe: 18, pb: 2.5 },
    '橡膠工業': { gm: 18, om: 7, roe: 10, rd: 2, pe: 15, pb: 1.4 },
    '汽車工業': { gm: 15, om: 6, roe: 12, rd: 2.5, pe: 14, pb: 1.6 },
    '建材營造業': { gm: 25, om: 15, roe: 12, rd: 0.5, pe: 10, pb: 1.5 },
    '觀光事業': { gm: 35, om: 10, roe: 12, rd: 1, pe: 25, pb: 3.0 },
    '貿易百貨業': { gm: 25, om: 5, roe: 14, rd: 1, pe: 20, pb: 2.8 },
    '其他': { gm: 18, om: 8, roe: 12, rd: 3, pe: 16, pb: 1.8 }
};

// === 指標百科定義 (Term Definitions) ===
const termDefinitions = {
    'DIO (存貨週轉天數)': {
        type: '營運效率',
        desc: '全名 Days Inventory Outstanding，指公司從取得存貨到售出產品平均所需的天數。',
        rule: '通常越短越好。如果 DIO 持續拉長，代表產品可能賣不掉，有庫存積壓或跌價風險。',
        advice: '需與同業相比。半導體業通常較長，零售業則極短。',
        analyze: (v) => "這是衡量公司「產品競爭力」與「供應鏈管理」的核心指標。"
    },
    'DSO (應收帳款天數)': {
        type: '營運效率',
        desc: '全名 Days Sales Outstanding，指公司產品賣出後，平均需要多少天才能收到錢。',
        rule: '越短越好。如果 DSO 突然暴增，代表客戶可能付不出錢，有呆帳風險。',
        advice: '這反映了公司對下游客戶的「議價能力」。',
        analyze: (v) => "這是衡量公司「收帳能力」與「客戶信用」的關鍵指標。"
    },
    'OCF (營業現金流)': {
        type: '現金流',
        desc: '企業透過本業經營實際收到的現金流入。',
        rule: '長期應大於淨利 (Net Income)。如果 OCF 長期低於淨利，代表公司可能只是帳面上賺錢，但錢卻卡在應收帳款或存貨中。',
        advice: '這是衡量「獲利含金量」的核心指標。穩健的公司應有穩定的 OCF 流入。',
        analyze: (v) => "OCF 反映了公司最真實的賺錢能力，是支撐股息與投資的源頭。"
    },
    'CapEx (資本支出)': {
        type: '投資',
        desc: '企業為了維持競爭力、購買設備或蓋廠房所投入的資金。',
        rule: '高成長科技股 (如半導體) 的 CapEx 通常很高。',
        advice: '需關注 CapEx 的投資效率。如果公司砸大錢擴產內營收沒跟上，可能導致產能過剩風險。',
        analyze: (v) => "資本支出代表公司對未來的投資，但也代表短期的現金流出。"
    },
    'FCF (自由現金流)': {
        type: '現金流',
        desc: '營業現金流扣除資本支出後的餘額 (OCF - CapEx)。',
        rule: '大於 0 代表公司入大於出。FCF 越充沛，公司發放股息或還債的能力就越強。',
        advice: '這是投資人「真正能拿到的錢」。如果 FCF 長期為負，公司可能需要增資或舉債來維持營運。',
        analyze: (v) => "自由現金流是評價企業價值的核心，代表公司在不影響營運下能自由分配的現金。"
    },
    '🏆 明星分點': {
        type: '籌碼',
        desc: '分點籌碼中的頂級指標。代表該分點在 60 日內「買得準」且「買得久」。',
        rule: '條件：1. 過去 60 日平均成本低於現價 5% 以上 (獲利中)；2. 近 5 日或 20 日持續出現在買超前五名 (具連續性)。',
        advice: '明星分點的持續加碼通常是強力的股價支撐，代表真正看好後市的資金正在護盤。',
        analyze: () => "這是具備高勝率與操作連續性的關鍵分點，值得高度追蹤。"
    },
    '💰 獲利大戶': {
        type: '籌碼',
        desc: '目前持倉處於大幅獲利狀態的大型分點。',
        rule: '條件：過去 60 日平均買入成本比目前市價低 5% 以上。',
        advice: '獲利大戶雖具備成本優勢，但若其開始反手出貨（出現在賣超名單），需提防獲利了結壓垮股價。',
        analyze: () => "該大戶目前處於贏家圈，需留意其後續是否反手轉賣。"
    },
    '🔥 積極佈局': {
        type: '籌碼',
        desc: '代表該分點近期正在密集收貨，持倉動作整齊劃一。',
        rule: '條件：在 60 日、20 日、5 日等多個週期內均穩定出現在買超名單中。',
        advice: '雖然目前可能尚未大幅獲利，但同步吸碼的動作顯示主力意圖明顯，是極佳的參考標的。',
        analyze: () => "主力正在密集進貨期，股價尚未拉開距離，具備跟進參考價值。"
    },
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
        desc: '營業收入扣除營業成本後的比率，反映產品競爭力與定價能力應。',
        rule: '越高越好。與同業相比，毛利越高通常代表技術領先或規模優勢。',
        advice: '需關注趨勢。若毛利率下滑，可能代表市場競爭加劇或原料成本上升。',
        analyze: (v) => {
            if (v > 40) return "高毛利代表產品具備強大競爭力，可能是技術領先者。";
            if (v > 15) return "獲利能力尚屬正常，屬一般製造或服務業水準。";
            return "毛利偏低（保五保六），屬勞力密集或代工行業，抗風險能力較弱。";
        }
    },
    '現金週期 (CCC)': {
        type: '營運效率',
        desc: '企業從投入現金採購原料，到銷售產品並回收現金所需的時間（天數）。公式：DIO + DSO - DPO。',
        rule: '天數愈短愈好，代表公司資金週轉效率愈高，被卡在供應鏈中的現金愈少。',
        advice: '如果 CCC 顯著增加，可能代表產品滯銷或客戶付款變慢，需留意現金流風險。',
        analyze: (v) => {
            if (v < 60) return "資金週轉極為神速，營運效率頂尖。";
            if (v < 120) return "營運效率尚屬穩健。";
            return "週轉天數偏長，需留意營運資金是否過度積壓。";
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
    'FCF 連貫性 (10年)': {
        type: '現金流',
        desc: '衡量公司在長達 5-10 年的期間內，是否能穩定產生正向的自由現金流。',
        rule: '專業分析師通常要求連續 5-10 年 FCF 為正。',
        advice: '這是區分「印鈔機」與「燒錢坑」的終極指標。即便 EPS 再好，若 FCF 長期為負且 5 年總和為負，代表公司一直在舉債燒錢，風險極大。',
        analyze: (v) => {
            if (!v) return "穩定且連貫的現金流是企業長期生存與發放股息的基石。";
            const matches = v.match(/(\d+)\s*\/\s*(\d+)/);
            if (matches) {
                const pos = parseInt(matches[1]);
                const total = parseInt(matches[2]);
                const ratio = pos / total;
                if (ratio >= 0.8) return "🔥 頂尖現金產生能力！長期穩定貢獻現金，是具備強大護城河的象徵。";
                if (ratio >= 0.5) return "現金產生能力尚屬穩定，多數年份能維持正向營運資金。";
                return "⚠️ 現金流連貫性欠佳，需留意公司是否頻繁需要外部融資或增資。";
            }
            return "分析長期的現金流規律，可有效過濾掉帳面獲利但實際入不敷出的企業。";
        }
    },
    '董監持股質押比例': {
        type: '財務風險',
        desc: '董事與監察人將手中的股票拿去向銀行質押借錢的比例。',
        rule: '通常 > 30% 為警戒線，> 50% 為高風險。',
        advice: '質押比例過高代表內部人資金吃緊，若股價大跌可能引發斷頭賣壓，形成連鎖反應。',
        analyze: (v) => {
            if (v > 50) return "⚠️ 警訊！董監質押比例極高，需慎防股價波動引發的質押品斷頭賣壓風險。";
            if (v > 30) return "董監質押比例偏高，顯示內部人財務槓桿較大。";
            return "董監質押比例處於安全範圍。";
        }
    },
    '5年累計自由現金流': {
        type: '現金流',
        desc: '公司過去 5 年（20 季）所產生的自由現金流總和。',
        rule: '應大於 0。數值越高代表公司產生的實質現金越多。',
        advice: '這是判斷公司是否在「假獲利、真賠錢」的最佳工具。若獲利很好但 5 年 FCF 為負，代表賺的錢都拿去填補營運缺口或資本支出了。',
        analyze: (v) => {
            if (v < 0) return "⚠️ 嚴重警訊！近 5 年累計現金流為負值，公司長期處於入不敷出的狀態。";
            return "公司具備長期產生剩餘現金的能力，財務結構相對健康。";
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
    '稅後淨利': {
        type: '獲利能力',
        desc: '公司在支付所有營運成本、利息及所得稅後的最終利潤。',
        rule: '越高越好；代表公司最終為股東賺到的錢。',
        advice: '需配合營收觀察。若營收成長但淨利沒成長，代表成本控制出了問題。',
        analyze: (v) => v > 0 ? "公司目前處於獲利狀態。" : "警告！公司目前處於虧損狀態。"
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
            return "嚴重警訊！本業營運現金為負流出，公司營運面臨嚴峻考願。";
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
    '綜合估值評估': {
        type: '估值',
        desc: '結合「現金股利回推」與「歷史本益比 (PE)」兩種經典模型計算出的參考價。',
        rule: '殖利率模型（5/4/3%）反映資產的現金回報安全性；PE 模型（12/15/20倍）反映市場對獲利的定價偏好。',
        advice: '當兩種模型的便宜價差距過大時，通常代表該公司正經歷「低毛利、高配息」或「高成長、低配息」的特徵轉換。兩者皆達成時，安全邊際最高。',
        analyze: (v) => "建議交叉比對。若股價同時低於兩者的便宜價，則為絕佳的價值投資買點。"
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
    },
    '淨利率 (獲利)': {
        type: '杜邦分析',
        desc: '反映公司每賣出 100 元產品後扣除所有成本、費用與稅金後的最終淨利。',
        rule: '通常與同業相比，越高代表產品競爭力與管理效率越好。',
        advice: '需留意是否受業外損益影響，若營業利益率穩定但淨利率劇震，通常與匯損或投資有關。',
        analyze: (v) => {
            const val = parseFloat(v);
            if (val > 15) return "獲利能力極佳，具備強大的利潤空間。";
            if (val > 5) return "獲利能力穩健，處於正常營運軌道。";
            return "淨利微薄，需留意成本控制 or 市場競爭壓力。";
        }
    },
    '資產週轉 (效率)': {
        type: '杜邦分析',
        desc: '每一元資產能創造多少營收，反映公司利用總資產創造營業收入的效率。',
        rule: '數值越高代表資產運用效率越好，是「薄利多銷」型企業的核心指標。',
        advice: '重工業通常週轉率低，而零售或代工業則應具備較高的週轉率。',
        analyze: (v) => {
            const val = parseFloat(v);
            if (val > 1.2) return "資產營運效率頂尖，展現極強的資源調度能力。";
            if (val > 0.6) return "營運效率尚屬穩健。";
            return "資產週轉偏慢，需注意是否有資產閒置或庫存去化緩慢問題。";
        }
    },
    '權益乘數 (槓桿)': {
        type: '杜邦分析',
        desc: '總資產除以股東權益的倍數，反映公司的財務槓桿運用程度。',
        rule: '乘數越高代表負債比例越高（槓桿越大）。',
        advice: '適度的槓桿可放大 ROE，但過高的槓桿（如 > 3-5 倍）會增加利息負擔與財務風險。',
        analyze: (v) => {
            const val = parseFloat(v);
            if (val > 3) return "財務槓桿較高，公司正積極運用資金放大獲利，但也需留意債務風險。";
            if (val < 1.5) return "財務結構極其保守，幾乎不使用槓桿，抗風險能力強但資金效率較低。";
            return "槓桿運用適中，財務結構與獲利效率平衡良好。";
        }
    }
};

// === UI 渲染核心函數 (Rendering Logic) ===

function renderAnalysis(symbol, name, chartData, twseBasic, chipsData, revData, finData, marginData, institutionalData, avgCost = null, riskMetrics = null, insiderActivity = null, debugInfo = null, brokerData = null, peerCCCData = [], chipCosts = null, winnerBrokers = [], topSellers60 = []) {
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
    
    // 計算均線排列與技術狀態
    let maStatus = "數據不足";
    let goldenCross = false;
    let deathCross = false;
    if (ma && ma.ma5 && ma.ma20 && ma.ma60 && ma.ma240) {
        if (ma.ma5 > ma.ma20 && ma.ma20 > ma.ma60 && ma.ma60 > ma.ma240) {
            maStatus = "多頭排列 (強勢)";
            goldenCross = true;
        } else if (ma.ma5 < ma.ma20 && ma.ma20 < ma.ma60 && ma.ma60 < ma.ma240) {
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
    
    const displayName = chipsData?.stockName || name || symbol;
    if (analysisTitle) {
        analysisTitle.textContent = `📊 ${displayName} (${symbol}) 分析報告 (v19穩定優化版)`;
    }
    
    window._lastCurrentPrice = currentPrice;

    const shares = chipsData?.sharesIssued || finData?.sharesIssued;
    const bps = (finData?.equity && shares) ? (finData.equity / shares) : null;
    const marketCap = shares ? (currentPrice * shares / 100000000) : null; 
    const psRatio = (marketCap && revData?.cum12m) ? (marketCap * 100000000 / revData.cum12m) : null;
    
    let divTrendAnalysis = "數據不足以進行趨勢分析";
    if (chipsData?.divHistory && chipsData.divHistory.length >= 2) {
        const latest = chipsData.divHistory[0].amount || chipsData.divHistory[0].cash || 0;
        const avg = chipsData.divHistory.reduce((s, x) => s + (x.amount || x.cash || 0), 0) / chipsData.divHistory.length;
        if (latest > avg * 1.1) divTrendAnalysis = "🚀 近期股利發放顯著優於平均，顯示獲利能力進入成長期。";
        else if (latest < avg * 0.9) divTrendAnalysis = "⚠️ 近期股利發放低於長期平均，需觀察營運是否進入衰退期或保留資金擴張。";
        else divTrendAnalysis = "📊 股利政策維持極高穩定性，具備定存股核心特質。";
    }
    
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

    let zScore = null;
    let zRiskLevel = 'N/A';
    let zColor = '#cbd5e1';
    if (finData?.zComponents && marketCap) {
        const marketCapValue = marketCap * 100000000;
        const zD = finData.liabilities > 0 ? marketCapValue / finData.liabilities : 0;
        const { zA, zB, zC, zE } = finData.zComponents;
        zScore = 1.2 * zA + 1.4 * zB + 3.3 * zC + 0.6 * zD + 1.0 * zE;
        
        if (zScore > 2.99) { zRiskLevel = '安全區'; zColor = '#10b981'; }
        else if (zScore > 1.8) { zRiskLevel = '警戒區'; zColor = '#fbbf24'; }
        else { zRiskLevel = '風險區'; zColor = '#ef4444'; }
    }

    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    const totalDiv12m = (chipsData.divHistory || []).reduce((sum, d) => {
        const divDate = new Date(d.date);
        return (divDate >= oneYearAgo) ? (sum + d.cash) : sum;
    }, 0);
    
    const calcYield = (totalDiv12m > 0 && currentPrice > 0) ? (totalDiv12m / currentPrice * 100) : null;
    const finalYield = twseBasic?.yield || calcYield;
    const currentDiv = (finalYield && currentPrice) ? (currentPrice * (finalYield / 100)) : (totalDiv12m || null);
    const costYield = (avgCost && avgCost > 0 && totalDiv12m > 0) ? (totalDiv12m / avgCost * 100) : null;
    
    const eps = twseBasic?.pe && currentPrice ? currentPrice / twseBasic.pe : (finData?.eps ? finData.eps * 4 : null);
    const divCheap = currentDiv ? currentDiv / 0.05 : null;
    const divReasonable = currentDiv ? currentDiv / 0.04 : null;
    const divExpensive = currentDiv ? currentDiv / 0.03 : null;
    const peCheap = eps ? eps * 12 : null;
    const peReasonable = eps ? eps * 15 : null;
    const peExpensive = eps ? eps * 20 : null;
    const grahamValue = (eps && bps && eps > 0 && bps > 0) ? Math.sqrt(22.5 * eps * bps) : null;

    let summaryText = `【${displayName}】目前股價 ${safeFix(currentPrice, 2)} 元。`;
    let profile = "穩健型";
    if (revData?.yoy > 20 && finData?.epsYoY > 20) profile = "強勢成長型";
    else if (twseBasic?.yield > 6 && chipsData.divConsecutiveYears > 10) profile = "高息定存型";
    else if (twseBasic?.pe < 10 && finData?.roe > 10) profile = "低估價值型";
    else if (price3m > 30) profile = "飆悍動能型";
    summaryText += `<br><span style="background:#3b82f6; color:#ffffff; padding:2px 6px; border-radius:4px; font-size:10px; margin-right:8px;">${profile}標的</span>`;

    if (currentPrice > ma.ma60) summaryText += `技術面位於季線 (${safeFix(ma.ma60, 2)}) 之上，均線架構偏多。`;
    else summaryText += `目前股價在季線 (${safeFix(ma.ma60, 2)}) 之下，屬弱勢格局。`;
    
    if (latestVol && avgVol5 && latestVol > avgVol5 * 1.5) summaryText += "今日成交量顯著放大（量比 > 1.5），顯示市場熱度升溫。";
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

    if (twseBasic && twseBasic.pePercentile != null) {
        const peP = twseBasic.pePercentile;
        if (peP < 20) summaryText += `目前本益比處於 5 年歷史極低位階 (${safeFix(peP, 1)}%)，具備極高投資價值。`;
        else if (peP > 80) summaryText += `目前本益比處於 5 年歷史高位階 (${safeFix(peP, 1)}%)，需留意估值過高風險。`;
        else summaryText += `目前本益比處於歷史中位區間 (${safeFix(peP, 1)}%)。`;
    }

    const fStreak = institutionalData?.streaks?.foreign || 0;
    const tStreak = institutionalData?.streaks?.trust || 0;
    if (fStreak > 2 && tStreak > 2) summaryText += "外資與投信近期同步連買，籌碼面出現「土洋大戰」偏多態勢。";
    else if (fStreak > 3) summaryText += `外資近期連買 ${fStreak} 日，外資資金持續湧入。`;
    else if (tStreak > 3) summaryText += `投信近期連買 ${tStreak} 日，內資護盤意圖明顯。`;

    if (winnerBrokers.length > 0) summaryText += `發現 ${winnerBrokers.length} 個高勝率明星分點 (贏家) 近 60 日積極佈局，有利於股價支撐。`;
    if (topSellers60.length > 0) summaryText += `注意：近 60 日賣超最重分點為「${topSellers60[0].name}」，需留意賣壓。`;

    if (finalYield && finalYield > 5) {
        summaryText += `目前殖利率 ${safeFix(finalYield, 2)}% 具備高息誘因。`;
        const payout = (totalDiv12m && finData?.epsLTM) ? (totalDiv12m / finData.epsLTM * 100) : null;
        if (payout > 100) summaryText += `⚠️ 注意：盈餘分配率高達 ${safeFix(payout, 1)}%，股利發放已超過獲利，需警惕配息的永續性。`;
    }

    if (finData) {
        if (finData.grossMargin > 40) summaryText += "毛利率表現極佳，顯示產品具備高度護城河。";
        if (finData.earningsQuality && finData.earningsQuality < 50) summaryText += "獲利品質偏低，需留意風險。";
        if (zScore && zScore < 1.8) summaryText += "⚠️ 注意：Z-Score 處於風險區，需特別留意公司財務體質。";
    }

    summaryText += "（註：以上建議由系統自動運算，僅供參考，不構成投資邀約。）";

    analysisBody.innerHTML = `
        <div class="analysis-grid">
            <div class="analysis-card">
                <div class="analysis-card-title">🏢 市值與股本規模</div>
                ${renderStatRow('產業分類', chipsData?.industry || 'N/A')}
                ${renderStatRow('市值', marketCap ? formatCurrency(marketCap * 100000000) : 'N/A')}
                ${renderStatRow('實收股本', chipsData?.sharesIssued ? formatCurrency(chipsData.sharesIssued * 10) : 'N/A')}
                ${renderStatRow('每股淨值 (BPS)', bps !== undefined ? safeFix(bps, 2) + ' 元' : 'N/A')}
                ${renderStatRow('52週位置', posIn52w !== null ? posIn52w + '%' : 'N/A')}
                <div style="font-size:11px; color:#cbd5e1; margin-top:8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">📊 籌碼概況</div>
                ${renderStatRow('外資持股比', chipsData?.foreign ? safeFix(chipsData.foreign, 2) + '%' : 'N/A')}
                ${renderStatRow('投信持股比', chipsData?.trust ? safeFix(chipsData.trust, 3) + '%' : 'N/A')}
                ${renderDiagnostic(marketCap > 1000 ? "大型權值股，流動性與防禦力強。" : "中小型規模，波動較大。")}
            </div>

            ${renderSectorComparison(chipsData?.industry, {
                rev: revData?.yoy, yield: finalYield, gm: finData?.grossMargin, om: finData?.opMargin, nm: finData?.netMargin, roe: finData?.roe,
                pe: (epsLTM > 0) ? (currentPrice / epsLTM) : (twseBasic?.pe || 0),
                pb: (bps > 0) ? (currentPrice / bps) : (twseBasic?.pb || 0)
            })}

            <div class="analysis-card">
                <div class="analysis-card-title">💰 合理價格評估</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; background:rgba(37, 99, 235, 0.1); padding:8px 12px; border-radius:8px; border:1px solid rgba(37, 99, 235, 0.2);">
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:10px; color:#cbd5e1;">當前本益比 (PE)</div>
                        <div style="font-size:15px; font-weight:700; color:#ffffff;">${twseBasic?.pe ? twseBasic.pe + ' 倍' : 'N/A'}</div>
                    </div>
                    <div style="width:1px; background:rgba(255,255,255,0.1); margin:0 10px;"></div>
                    <div style="text-align:center; flex:1;">
                        <div style="font-size:10px; color:#cbd5e1;">當前殖利率 (Yield)</div>
                        <div style="font-size:15px; font-weight:700; color:#ef4444;">${finalYield !== undefined ? safeFix(finalYield, 2) + '%' : 'N/A'}</div>
                    </div>
                </div>
                ${renderValuationRow('便宜價', `${safeFix(divCheap, 1)} / ${safeFix(peCheap, 1)} 元`)}
                ${renderValuationRow('合理價', `${safeFix(divReasonable, 1)} / ${safeFix(peReasonable, 1)} 元`)}
                ${renderValuationRow('昂貴價', `${safeFix(divExpensive, 1)} / ${safeFix(peExpensive, 1)} 元`)}
                <div style="font-size:11px; color:#cbd5e1; margin:12px 0 8px; border-top:1px dashed rgba(255,255,255,0.05); pt:8px;">📊 歷史估值區間</div>
                ${renderValuationRiverMap('PE 位階', twseBasic?.pe, twseBasic?.pePercentile, twseBasic?.peBands)}
                ${renderDiagnostic(finalYield > 5 ? "殖利率高於 5%，具備防禦屬性。" : "目前估值尚屬合理。")}
            </div>

            <div class="analysis-card">
                <div class="analysis-card-title">💵 財報獲利能力</div>
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px;">季度: ${finData?.quarter || 'N/A'}</div>
                ${renderPercentRow('毛利率', finData?.grossMargin, false, false)}
                ${renderPercentRow('營業利益率', finData?.opMargin, false, false)}
                ${renderPercentRow('稅後淨利率', finData?.netMargin, false, false)}
                ${renderPercentRow('ROE (股東權益報酬)', finData?.roe, true, false)}
                ${renderDiagnostic(finData?.roe > 15 ? " ROE 表現優異，資本運用效率高。" : "獲利能力穩定。")}
            </div>

            <div class="analysis-card">
                <div class="analysis-card-title">📊 月營收趨勢</div>
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px;">月份: ${revData?.month || 'N/A'}</div>
                ${renderStatRow('單月營收', revData?.revenue ? formatCurrency(revData.revenue) : 'N/A')}
                ${renderPercentRow('月增率 (MoM)', revData?.mom)}
                ${renderPercentRow('年增率 (YoY)', revData?.yoy)}
                ${renderDiagnostic(revData?.yoy > 15 ? "營收年增成長強勁。" : "營收持平波動。")}
            </div>

            <div class="analysis-card">
                <div class="analysis-card-title">🛡️ 財務安全診斷</div>
                <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; margin-bottom:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="analysis-label has-info" style="font-size:12px; color:#cbd5e1;" onclick="showTermExplainer('Altman Z-Score', '${safeFix(zScore, 2)}')">Altman Z-Score</span>
                        <span style="font-size:18px; font-weight:800; color:${zColor};">${safeFix(zScore, 2)}</span>
                    </div>
                </div>
                ${renderStatRow('流動比率', finData?.currentRatio !== undefined ? safeFix(finData?.currentRatio, 1) + '%' : 'N/A')}
                ${renderPercentRow('負債比率', finData?.debtRatio, false, false)}
                ${renderStatRow('獲利品質 (OCF/NI)', finData?.earningsQuality !== undefined ? safeFix(finData?.earningsQuality, 1) + '%' : 'N/A')}
                ${renderDiagnostic(zScore > 2.99 ? "財務體質極佳。" : "財務結構尚可。")}
            </div>

            <div class="analysis-card">
                <div class="analysis-card-title">👥 籌碼與信用</div>
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <div style="flex:1; background:rgba(255,255,255,0.03); padding:8px; border-radius:6px; text-align:center;">
                        <div style="font-size:10px; color:#cbd5e1;">外資連買/賣</div>
                        <div style="font-size:14px; font-weight:600;">${institutionalData?.streaks?.foreign > 0 ? `連買 ${institutionalData.streaks.foreign} 日` : '無'}</div>
                    </div>
                </div>
                ${renderNetBuyRow('外資單日', institutionalData?.latestDay?.foreign)}
                ${renderNetBuyRow('投信單日', institutionalData?.latestDay?.trust)}
                ${renderDiagnostic(institutionalData?.streaks?.foreign > 3 ? "外資持續吸籌。" : "籌碼面處於觀望。")}
            </div>

            <div class="analysis-card">
                <div class="analysis-card-title">📉 技術面分析</div>
                <div style="font-size:11px; color:#cbd5e1; margin-bottom:8px;">排列狀態: <span style="color:#ffffff; font-weight:700;">${chartData.maStatus}</span></div>
                ${renderMARow('20日線 (月線)', ma.ma20, currentPrice)}
                ${renderMARow('60日線 (季線)', ma.ma60, currentPrice)}
                ${renderDiagnostic(currentPrice > ma.ma60 ? "趨勢偏多。" : "趨勢偏弱。")}
            </div>
        </div>
        
        <div class="analysis-card" style="margin-top:16px;">
            <div class="analysis-card-title">🤖 AI 綜合診斷</div>
            <div class="analysis-summary">${summaryText}</div>
        </div>

        <div id="analysisDiagnostic" style="margin-top:20px; padding:15px; background:rgba(0,0,0,0.3); border-radius:10px; border:1px solid rgba(255,255,255,0.1); font-family:monospace; font-size:11px;">
            <div style="color:#fbbf24; margin-bottom:8px; font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">🔍 數據來源診斷 (Diagnostic Console)</div>
            <div style="color:${chartData ? '#10b981' : '#ef4444'}">● 股價歷史 (Price): ${chartData ? 'OK' : 'FAIL'}</div>
            <div style="color:${twseBasic ? '#10b981' : '#ef4444'}">● 估值指標 (Basic): ${twseBasic ? 'OK' : 'FAIL'}</div>
            <div style="color:${revData ? '#10b981' : '#ef4444'}">● 營收數據 (Revenue): ${revData ? 'OK' : 'FAIL'}</div>
            <div style="color:${finData ? '#10b981' : '#ef4444'}">● 財報數據 (Financial): ${finData ? 'OK' : 'FAIL'}</div>
            <div style="color:${(insiderActivity && insiderActivity.type !== 'none') ? '#10b981' : '#ef4444'}">● 內部人持股 (Insider): ${(insiderActivity && insiderActivity.type !== 'none') ? 'OK' : 'FAIL'}</div>
        </div>
    `;
}

// === 輔助渲染函數 (Helpers) ===

function renderStatRow(label, value, percentVal = null) {
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    return `
        <div class="analysis-stat-row">
            <span class="${labelClass}" ${hasDef ? `onclick="showTermExplainer('${label}', '${value}')"` : ''}>${label}</span>
            <span class="analysis-value">${value}</span>
        </div>
    `;
}

function renderDiagnostic(text) {
    if (!text) return '';
    return `<div class="analysis-diagnostic">💡 ${text}</div>`;
}

function renderPercentRow(label, value, isROE = false, showColor = true) {
    if (value === null || value === undefined) return renderStatRow(label, 'N/A');
    const color = showColor ? (value > 0 ? '#f87171' : (value < 0 ? '#4ade80' : '#fff')) : '#fff';
    const hasDef = termDefinitions && termDefinitions[label];
    const labelClass = hasDef ? 'analysis-label has-info' : 'analysis-label';
    return `
        <div class="analysis-stat-row">
            <span class="${labelClass}" ${hasDef ? `onclick="showTermExplainer('${label}', '${value}%')"` : ''}>${label}</span>
            <span class="analysis-value" style="color:${color}">${value > 0 ? '+' : ''}${value.toFixed(2)}%</span>
        </div>
    `;
}

function safeFix(val, d) {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return Number(val).toFixed(d);
}

function formatCurrency(val) {
    if (val === null || val === undefined) return 'N/A';
    if (val >= 100000000) return (val / 100000000).toFixed(2) + ' 億';
    if (val >= 10000) return (val / 10000).toFixed(2) + ' 萬';
    return val.toLocaleString();
}

function renderNetBuyRow(label, value) {
    if (value === null || value === undefined) return renderStatRow(label, 'N/A');
    const color = value > 0 ? '#f87171' : (value < 0 ? '#4ade80' : '#fff');
    return `
        <div class="analysis-stat-row">
            <span class="analysis-label">${label}</span>
            <span class="analysis-value" style="color:${color}">${value > 0 ? '+' : ''}${Math.round(value).toLocaleString()} 張</span>
        </div>
    `;
}

function renderMARow(label, maVal, currentPrice) {
    if (!maVal) return renderStatRow(label, 'N/A');
    const diff = ((currentPrice - maVal) / maVal * 100).toFixed(1);
    const color = currentPrice > maVal ? '#f87171' : '#4ade80';
    return `
        <div class="analysis-stat-row">
            <span class="analysis-label">${label}</span>
            <span class="analysis-value">
                ${maVal.toFixed(2)} 
                <span style="font-size:10px; color:${color}">(${currentPrice > maVal ? '+' : ''}${diff}%)</span>
            </span>
        </div>
    `;
}

function renderValuationRow(label, value) {
    return `
        <div class="analysis-stat-row">
            <span class="analysis-label">${label}</span>
            <span class="analysis-value" style="color:#ffffff; font-weight:700;">${value}</span>
        </div>
    `;
}

function renderValuationRiverMap(label, current, percentile, bands) {
    if (percentile === null || percentile === undefined) return '';
    const color = percentile > 80 ? '#f87171' : (percentile < 20 ? '#4ade80' : '#fbbf24');
    return `
        <div class="valuation-river-container">
            <div style="display:flex; justify-content:space-between; font-size:10px; margin-bottom:4px;">
                <span style="color:#cbd5e1;">${label}</span>
                <span style="color:${color}; font-weight:800;">${percentile.toFixed(1)}%</span>
            </div>
            <div class="valuation-river-bar">
                <div class="valuation-river-pointer" style="left: ${percentile}%"></div>
            </div>
        </div>
    `;
}

function renderSectorComparison(sector, data) {
    const bench = sectorBenchmarks[sector] || sectorBenchmarks['其他'];
    const compare = (val, benchVal, isLowerBetter = false) => {
        if (val === null || val === undefined || !benchVal) return '';
        const diff = val - benchVal;
        const isGood = isLowerBetter ? diff < 0 : diff > 0;
        return `<span style="color:${isGood ? '#4ade80' : '#f87171'}; font-size:10px; margin-left:4px;">(${diff > 0 ? '+' : ''}${diff.toFixed(1)})</span>`;
    };

    return `
        <div class="analysis-card sector-card">
            <div class="analysis-card-title">🏁 產業標竿對比 (${sector || '未知'})</div>
            ${renderStatRow('產業本益比', `${bench.pe} 倍`)}
            <div class="analysis-stat-row">
                <span class="analysis-label">本股本益比</span>
                <span class="analysis-value">${data.pe ? data.pe.toFixed(1) : 'N/A'} ${compare(data.pe, bench.pe, true)}</span>
            </div>
            <div class="analysis-stat-row">
                <span class="analysis-label">本股毛利率</span>
                <span class="analysis-value">${data.gm ? data.gm.toFixed(1) : 'N/A'}% ${compare(data.gm, bench.gm)}</span>
            </div>
            ${renderDiagnostic(`與同業平均相比，該股在${data.pe < bench.pe ? '估值上較具優勢' : '評價相對較高'}。`)}
        </div>
    `;
}

// === 百科彈窗邏輯 ===

function showTermExplainer(term, currentVal = null, avgVal = null) {
    let def = termDefinitions[term];
    if (!def) {
        const bestKey = Object.keys(termDefinitions).find(k => k.includes(term));
        if (bestKey) def = termDefinitions[bestKey];
    }
    if (!def) return;

    let overlay = document.getElementById('termExplainerOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'termExplainerOverlay';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeTermExplainer(); });
    }

    const typeColors = { '估值': '#f59e0b', '獲利能力': '#3b82f6', '成長動能': '#10b981', '技術面': '#ec4899', '風險': '#ef4444' };
    const badgeColor = typeColors[def.type] || '#94a3b8';

    overlay.innerHTML = `
        <div class="term-explainer-content">
            <div class="term-explainer-close" onclick="closeTermExplainer()">✕</div>
            <div class="term-explainer-badge" style="background:${badgeColor}20; color:${badgeColor}; border:1px solid ${badgeColor}40;">${def.type}</div>
            <div class="term-explainer-title">${term}</div>
            <div class="term-explainer-body">${def.desc}</div>
            <div class="term-explainer-section">
                <div class="term-explainer-subtitle">💡 判斷準則</div>
                <div class="term-explainer-body">${def.rule}</div>
            </div>
        </div>
    `;
    setTimeout(() => overlay.classList.add('active'), 10);
}

function closeTermExplainer() {
    const overlay = document.getElementById('termExplainerOverlay');
    if (overlay) overlay.classList.remove('active');
}

// === 籌碼助手 ===

function calculateInstitutionalCosts(dailyData, prices) {
    if (!dailyData || !prices) return null;
    const priceMap = new Map(prices.map(p => [p.date, p.close]));
    const calcVWAP = (type, days) => {
        const sub = dailyData.slice(-days);
        let totalNet = 0, weightedSum = 0;
        sub.forEach(d => {
            const p = priceMap.get(d.date);
            const net = d[type] || 0;
            if (p && net > 0) { totalNet += net; weightedSum += net * p; }
        });
        return totalNet > 0 ? (weightedSum / totalNet) : 0;
    };
    return {
        foreign: { cost20: calcVWAP('foreign', 20), cost60: calcVWAP('foreign', 60), cost240: calcVWAP('foreign', 240) },
        trust: { cost20: calcVWAP('trust', 20), cost60: calcVWAP('trust', 60), cost240: calcVWAP('trust', 240) }
    };
}

function identifyWinnerBrokers(brokerData, currentPrice) {
    const winners = [];
    const sellers = brokerData?.d60?.topSellers || [];
    if (!brokerData?.d60?.topBrokers) return { winners, sellers };
    brokerData.d60.topBrokers.forEach(b => {
        winners.push({ name: b.name, buyNet: b.buyNet });
    });
    return { winners: winners.slice(0, 5), sellers: sellers.slice(0, 5) };
}
