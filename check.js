
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW error:', err));
        });
      }
    </script>
<script src="long_articles.js"></script>
</head>

<body>
    <div class="bg-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
    </div>

    <div class="layout-wrapper">
        <!-- 左側：試算器 -->
        <div class="glass-panel calculator-panel">
            <header>
                <h1>台股損益試算</h1>
                <p>即時計算交易成本與淨損益</p>
            </header>

            <main>
                <div class="input-section">
                    <div class="input-group">
                        <label for="stockCode">股票代號 / 名稱</label>
                        <div class="input-wrapper">
                            <input type="text" id="stockCode" placeholder="例如: 2330 或 2330 台積電">
                        </div>
                    </div>

                    <div class="input-group grid-half">
                        <label for="buyPrice">買進價格</label>
                        <div class="input-wrapper">
                            <span class="currency">NT$</span>
                            <input type="number" id="buyPrice" placeholder="0.00" step="0.01" min="0">
                        </div>
                    </div>

                    <div class="input-group grid-half">
                        <label for="sellPrice">賣出價格</label>
                        <div class="input-wrapper">
                            <span class="currency">NT$</span>
                            <input type="number" id="sellPrice" placeholder="0.00" step="0.01" min="0">
                        </div>
                    </div>

                    <div class="input-group highlight-group grid-half">
                        <label for="buyShares">買進股數</label>
                        <div class="input-wrapper">
                            <input type="number" id="buyShares" value="1000" step="1" min="0">
                            <span class="unit">股</span>
                        </div>
                    </div>

                    <div class="input-group highlight-group grid-half">
                        <label for="sellShares">賣出股數</label>
                        <div class="input-wrapper">
                            <input type="number" id="sellShares" value="1000" step="1" min="0">
                            <span class="unit">股</span>
                        </div>
                    </div>
                </div>

                <div class="divider"></div>

                <div class="settings-section">
                    <div class="input-group">
                        <label for="stockType">股票類別</label>
                        <select id="stockType">
                            <option value="0.003">一般股票 (0.3%)</option>
                            <option value="0.001">ETF (0.1%)</option>
                            <option value="0.0015">現股當沖 (0.15%)</option>
                        </select>
                    </div>

                    <div class="input-group grid-half">
                        <label for="discount">券商折扣</label>
                        <div class="input-wrapper">
                            <input type="number" id="discount" value="1.7" step="0.1" min="0" max="10">
                            <span class="unit">折</span>
                        </div>
                    </div>

                    <div class="input-group grid-half">
                        <label for="minFee">低消手續費</label>
                        <div class="input-wrapper">
                            <span class="currency">NT$</span>
                            <input type="number" id="minFee" value="1" step="1" min="0">
                        </div>
                    </div>
                </div>

                <div class="result-section">
                    <div class="result-card primary-result">
                        <div class="result-item net-profit">
                            <span class="label">預估已實現損益</span>
                            <span class="value" id="netProfit">0</span>
                        </div>
                        <div class="result-item return-rate">
                            <span class="label">報酬率</span>
                            <span class="value" id="returnRate">0.00%</span>
                        </div>
                    </div>

                    <div class="result-details">
                        <div class="detail-row">
                            <span>買進手續費</span>
                            <span id="buyFeeVal">0</span>
                        </div>
                        <div class="detail-row">
                            <span>賣出手續費</span>
                            <span id="sellFeeVal">0</span>
                        </div>
                        <div class="detail-row">
                            <span>證券交易稅</span>
                            <span id="taxVal">0</span>
                        </div>
                        <div class="detail-row highlight-row">
                            <span>買進總成本</span>
                            <span id="totalCostVal">0</span>
                        </div>
                        <div class="detail-row highlight-row">
                            <span>賣出總收入</span>
                            <span id="totalRevenueVal">0</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex; gap:10px;">
                    <button id="addInventoryBtn" class="btn primary-btn" style="flex:1; padding:12px;">加到長期庫存</button>
                    <button id="addShortTermBtn" class="btn primary-btn" style="flex:1; padding:12px; background:#8b5cf6;">加到短期操作</button>
                </div>
                <div style="display:flex; gap:10px; margin-top:12px;">
                    <button id="undoBtn" class="btn secondary-btn" style="flex:1;" disabled>↩ 復原</button>
                    <button id="redoBtn" class="btn secondary-btn" style="flex:1;" disabled>重做 ↪</button>
                </div>
            </main>
        </div>

        <!-- 右側：庫存看板 -->
        <div class="glass-panel inventory-panel">
            <header class="inventory-header">
                <div>
                    <h2>即時庫存</h2>
                    <p id="portfolioDate" style="margin-bottom:2px;">您的個人投資組合</p>
                    <p id="portfolioClock" style="font-size:14px; color:var(--text-secondary);">&nbsp;</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <button id="toggleViewBtn" class="btn secondary-btn" style="background:rgba(139, 92, 246, 0.2); border-color:rgba(139, 92, 246, 0.5); color:#c4b5fd;">⇄ 切換至短期操作</button>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                        <button id="openBPBtn" class="header-action-btn" style="background:rgba(239, 68, 68, 0.15); color:#fca5a5; border-color:rgba(239, 68, 68, 0.3);">🩸 血壓記錄</button>
                        <button id="openEnglishBtn" class="header-action-btn" style="background:rgba(59, 130, 246, 0.15); color:#93c5fd; border-color:rgba(59, 130, 246, 0.3);">📝 英文學習</button>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                        <button id="openCompoundBtn" class="header-action-btn" style="background:rgba(245, 158, 11, 0.15); color:#fcd34d; border-color:rgba(245, 158, 11, 0.3);">📈 複利試算</button>
                        <button id="refreshPricesBtn" class="header-action-btn" title="從外部網路抓取最新底價" style="background:rgba(14, 165, 233, 0.15); color:#7dd3fc; border-color:rgba(14, 165, 233, 0.3);">↻ 更新股價</button>
                        <button id="openAccountingBtn" class="header-action-btn" style="background:rgba(16, 185, 129, 0.15); color:#6ee7b7; border-color:rgba(16, 185, 129, 0.3);">📒 日常記帳</button>
                        <button id="openHistoryStatsBtn" class="header-action-btn" style="background:rgba(217, 70, 239, 0.15); color:#f0abfc; border-color:rgba(217, 70, 239, 0.3);">📊 歷史統計</button>
                    </div>
                </div>
            </header>

            <div id="longTermView" style="display:flex; flex-direction:column; flex-grow:1; flex-shrink:1; min-height:0;">
                <div class="inventory-dashboard" style="flex-wrap: wrap;">
                <div class="dashboard-card">
                    <span class="label">總庫存市值</span>
                    <span class="value" id="totalMarketValue">0</span>
                    <span id="marketValueAssetRate"
                        style="font-size:14px; font-weight:700; margin-top:2px; color:var(--text-secondary);">0.00%</span>
                </div>
                    <div class="dashboard-card">
                        <span class="label">現金水位</span>
                        <div style="display:flex; align-items:center;">
                        <span class="value-prefix" style="margin-right:4px;">$</span>
                        <input type="number" id="cashInput" value="0" min="0" step="1"
                            class="value-input">
                    </div>
                    <span id="cashAssetRate"
                        style="font-size:14px; font-weight:700; margin-top:2px; color:var(--text-secondary);">0.00%</span>
                </div>
                <div class="dashboard-card highlight-card">
                    <span class="label">淨總資產</span>
                    <span class="value" id="totalAssetValue" style="color:#60a5fa;">0</span>
                </div>
                <div style="display:flex; gap:16px; flex-basis:100%; margin-top:4px; flex-wrap:wrap;">
                    <div class="dashboard-card" style="flex:1; min-width:160px;">
                        <span class="label">總未實現損益</span>
                        <span class="value" id="totalInventoryProfit">0</span>
                        <span id="totalInventoryProfitRate"
                            style="font-size:14px; font-weight:700; margin-top:2px;">0.00%</span>
                    </div>
                    <div class="dashboard-card" style="flex:1; min-width:160px;">
                        <span class="label">總付出成本</span>
                        <span class="value" id="totalInventoryCost">0</span>
                    </div>
                    <div class="dashboard-card"
                        style="flex:1; min-width:180px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
                        <div>
                            <span class="label" style="display:block; margin-bottom:4px;">當年度已實現損益</span>
                            <div style="display:flex; align-items:center;">
                                <span class="value-prefix compact" style="margin-right:4px;">$</span>
                                <input type="number" id="yearlyRealizedInput" value="0" step="1"
                                    class="value-input compact">
                            </div>
                        </div>
                        <div style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:10px;">
                            <span class="label" style="display:block; margin-bottom:4px;">總投資已實現損益</span>
                            <div style="display:flex; align-items:center;">
                                <span class="value-prefix compact" style="margin-right:4px;">$</span>
                                <input type="number" id="totalRealizedInput" value="0" step="1"
                                    class="value-input compact">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="dashboard-card"
                    style="flex-basis: 100%; margin-top: 10px; background: rgba(16, 185, 129, 0.1); border: 1px dashed rgba(16, 185, 129, 0.3);">
                    <span class="label">年度領息總結</span>
                    <div style="display:flex; justify-content:space-between; margin-top: 8px;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:12px; color:var(--text-secondary);">年度總領配息</span>
                            <span class="value-unified" style="color:var(--text-primary);"
                                id="totalDividendVal">0</span>
                        </div>
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:12px; color:var(--text-secondary);">8.5%抵扣稅額</span>
                            <span class="value-unified" style="color:#fff;"
                                id="dividendTaxOffsetVal">0</span>
                        </div>
                        <div style="display:flex; flex-direction:column; text-align:right;">
                            <span style="font-size:12px; color:var(--text-secondary);">額外領息總額結算</span>
                            <span class="value-unified" style="color:#fff;"
                                id="dividendTotalBenefitVal">0</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="inventory-list" id="inventoryList">
                <!-- 庫存項目會經由 JS 動態生成 -->
            </div>

            <div id="emptyInventoryMsg" class="empty-msg">
                尚未加入任何庫存<br><span style="font-size:12px;opacity:0.6;">在左側計算完畢後，點擊「加到我的庫存」</span>
            </div>
            </div>

            <!-- 短期操作視圖 -->
            <div id="shortTermView" style="display:none; flex-direction:column; flex-grow:1; flex-shrink:1; min-height:0;">
                <div class="inventory-dashboard" style="flex-wrap: wrap;">
                    <div class="dashboard-card" style="flex-basis:100%;">
                        <span class="label">短期操作本金</span>
                        <div style="display:flex; align-items:center;">
                            <span class="value-prefix" style="margin-right:4px;">$</span>
                            <input type="number" id="shortTermCapitalInput" value="0" min="0" step="1"
                                class="value-input">
                        </div>
                    </div>
                    <div style="display:flex; gap:16px; flex-basis:100%; flex-wrap:wrap; margin-top:4px;">
                        <div class="dashboard-card" style="flex:1;">
                            <span class="label">總付出成本</span>
                            <span class="value" id="stTotalCost">0</span>
                        </div>
                        <div class="dashboard-card" style="flex:1;">
                            <span class="label">短期已實現損益</span>
                            <div style="display:flex; align-items:center;">
                                <span class="value-prefix" style="margin-right:4px;">$</span>
                                <input type="number" id="stRealizedInput" value="0" step="1"
                                    class="value-input">
                            </div>
                        </div>
                        <div class="dashboard-card" style="flex:1;">
                            <span class="label">剩餘可動用資金</span>
                            <span class="value" id="stRemainingFunds" style="color:#60a5fa;">0</span>
                        </div>
                    </div>
                    <div class="dashboard-card highlight-card" style="flex-basis:100%; margin-top:16px;">
                        <span class="label">短期總未實現損益</span>
                        <div style="display:flex; align-items:baseline; gap:12px;">
                            <span class="value" id="stTotalProfit">0</span>
                            <span id="stTotalProfitRate" style="font-size:16px; font-weight:700;">0.00%</span>
                        </div>
                    </div>
                </div>

                <div class="inventory-list" id="shortTermList">
                    <!-- 短期庫存項目動態生成 -->
                </div>

                <div id="stEmptyMsg" class="empty-msg">
                    您的短期操作區目前為空<br><span style="font-size:12px;opacity:0.6;">在左側計算完畢後，點擊「加到短期操作」</span>
                </div>
            </div>
        </div>
    </div>

    <!-- 複利計算機 Modal -->
    <div id="compoundModal" class="modal-overlay">
        <div class="modal-content" style="max-width:900px;">
            <div class="modal-header">
                <h2>📈 複利試算</h2>
                <button id="closeModalBtn" class="close-btn">&times;</button>
            </div>
            <div class="compound-layout">
                <!-- 左側輸入區 -->
                <div class="compound-inputs input-section">
                    <div class="input-group">
                        <label>初始本金</label>
                        <div class="input-wrapper">
                            <span class="currency">NT$</span>
                            <input type="number" id="cpPrincipal" value="0" min="0" step="1">
                        </div>
                    </div>
                    <div class="input-group">
                        <label>每年定期投入</label>
                        <div class="input-wrapper">
                            <span class="currency">NT$</span>
                            <input type="number" id="cpAnnualAdd" value="0" min="0" step="1">
                        </div>
                    </div>
                    <div class="input-group">
                        <label>預期年化報酬率</label>
                        <div class="input-wrapper">
                            <input type="number" id="cpRate" value="5" min="0" max="100" step="0.1">
                            <span class="unit">%</span>
                        </div>
                    </div>
                    <div class="input-group" style="margin-top: 10px;">
                        <label style="display:flex; justify-content:space-between;">
                            <span>複利年限</span>
                            <span id="cpYearsLabel"
                                style="color:var(--btn-primary); font-weight:800; font-size:16px;">10 年</span>
                        </label>
                        <input type="range" id="cpYears" min="1" max="50" value="10" class="slider">
                    </div>

                    <div class="divider"></div>

                    <div class="dashboard-card highlight-card" style="margin-bottom:10px;">
                        <span class="label">期末終值預估</span>
                        <span class="value is-profit" id="cpFinalValue">0</span>
                    </div>
                    <div class="compound-subresults">
                        <div class="detail-row">
                            <span>總投入本金</span>
                            <span id="cpTotalInvested">0</span>
                        </div>
                        <div class="detail-row">
                            <span>複利滾存純利息</span>
                            <span id="cpTotalInterest" class="is-profit">0</span>
                        </div>
                    </div>
                </div>

                <!-- 右側圖表區 -->
                <div class="compound-chart-wrapper">
                    <canvas id="compoundChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <!-- 記帳 Modal -->
    <div class="modal-overlay" id="accountingModal">
        <div class="modal-content" style="max-width: 800px; height: 85vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h2>📒 生活開銷記帳</h2>
                <button class="close-btn" id="closeAccountingBtn">&times;</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 0 24px 24px 24px;">
                <!-- 月份切換與結算儀表板 -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                    <button id="prevMonthBtn" class="btn secondary-btn" style="padding: 5px 15px;">◄</button>
                    <div style="text-align: center;">
                        <span id="currentMonthLabel" style="font-size: 20px; font-weight: bold; color: var(--text-primary);">2026 / 04</span>
                    </div>
                    <button id="nextMonthBtn" class="btn secondary-btn" style="padding: 5px 15px;">►</button>
                </div>
                
                <div class="inventory-dashboard" style="margin-bottom: 24px; gap:12px;">
                    <div class="dashboard-card" style="flex:1;">
                        <span class="label">當月總收入</span>
                        <span class="value" id="accTotalIncome" style="color: #4ade80;">0</span>
                    </div>
                    <div class="dashboard-card" style="flex:1;">
                        <span class="label">當月總支出</span>
                        <span class="value" id="accTotalExpense" style="color: #f87171;">0</span>
                    </div>
                    <div class="dashboard-card highlight-card" style="flex:1;">
                        <span class="label">當月結餘</span>
                        <span class="value" id="accBalance">0</span>
                    </div>
                </div>

                <div class="inventory-dashboard" style="margin-bottom: 24px; gap:12px;">
                    <div class="dashboard-card" style="flex:1; background:rgba(16, 185, 129, 0.05); border:1px dashed rgba(16, 185, 129, 0.2);">
                        <span class="label">年度總收入</span>
                        <span class="value" id="accYearlyIncome" style="color: #4ade80;">0</span>
                    </div>
                    <div class="dashboard-card" style="flex:1; background:rgba(239, 68, 68, 0.05); border:1px dashed rgba(239, 68, 68, 0.2);">
                        <span class="label">年度總支出</span>
                        <span class="value" id="accYearlyExpense" style="color: #f87171;">0</span>
                    </div>
                    <div class="dashboard-card highlight-card" style="flex:1; background:rgba(59, 130, 246, 0.1);">
                        <span class="label">年度結餘</span>
                        <span class="value" id="accYearlyBalance">0</span>
                    </div>
                </div>

                <!-- 新增紀錄表單 -->
                <div class="glass-panel" style="padding: 20px; margin-bottom: 24px; border-radius: 12px; background: rgba(0,0,0,0.2);">
                    <h3 style="margin-bottom: 12px; font-size: 16px; color:var(--text-secondary);">新增收支紀錄</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; align-items: end;">
                        <div class="input-group" style="margin-bottom: 0;">
                            <label>日期</label>
                            <div class="input-wrapper">
                                <input type="date" id="accDate">
                            </div>
                        </div>
                        <div class="input-group" style="margin-bottom: 0;">
                            <label>收支類型</label>
                            <select id="accType">
                                <option value="expense">支出 (-)</option>
                                <option value="income">收入 (+)</option>
                            </select>
                        </div>
                        <div class="input-group" style="margin-bottom: 0;">
                            <label>分類</label>
                            <select id="accCategory">
                                <option value="餐飲">餐飲</option>
                                <option value="交通">交通</option>
                                <option value="居住">居住</option>
                                <option value="娛樂">娛樂</option>
                                <option value="購物">購物</option>
                                <option value="生活">生活</option>
                                <option value="保險">保險</option>
                                <option value="衣物">衣物</option>
                                <option value="聚餐">聚餐</option>
                                <option value="其他">其他</option>
                            </select>
                        </div>
                        <div class="input-group" style="margin-bottom: 0;">
                            <label>金額</label>
                            <div class="input-wrapper">
                                <input type="number" id="accAmount" placeholder="0" min="0" step="1">
                            </div>
                        </div>
                        <div class="input-group" style="margin-bottom: 0; grid-column: span 2;">
                            <label>備註說明</label>
                            <div class="input-wrapper">
                                <input type="text" id="accNote" placeholder="例如：買菜、晚餐...">
                            </div>
                        </div>
                        <div style="grid-column: span 1;">
                            <button id="addAccBtn" class="btn primary-btn" style="width: 100%; padding: 12px 0;">+ 新增</button>
                        </div>
                    </div>
                </div>

                <!-- 明細列表 -->
                <h3 style="margin-bottom: 12px; font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">明細清單</h3>
                <div style="background: rgba(0,0,0,0.1); border-radius: 8px;">
                    <table class="history-table" style="width: 100%; text-align: left; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary);">
                                <th style="padding: 12px 10px;">日期</th>
                                <th style="padding: 12px 10px;">分類</th>
                                <th style="padding: 12px 10px;">備註</th>
                                <th style="padding: 12px 10px; text-align: right;">金額</th>
                                <th style="padding: 12px 10px; text-align: center; width: 60px;">操作</th>
                            </tr>
                        </thead>
                        <tbody id="accTableBody">
                            <!-- 動態生成 -->
                        </tbody>
                    </table>
                    <div id="accEmptyMsg" style="text-align:center; padding:30px; color:var(--text-secondary); display:none;">
                        這個月還沒有任何記帳紀錄喔！
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- 英文學習 Modal (Anki 系統) -->
    <div class="modal-overlay" id="englishModal">
        <div class="modal-content" style="max-width: 750px; text-align: center; display:flex; flex-direction:column; gap:16px;">
            <div class="modal-header">
                <h2>📝 每日英文學習卡</h2>
                <button class="close-btn" id="closeEnglishBtn">&times;</button>
            </div>
            
            <div style="display:flex; justify-content:center; gap:8px; margin-bottom: 8px; flex-wrap:wrap;">
                <button id="tabFlashcardBtn" class="btn primary-btn" style="width:auto; padding:8px 20px;">🗂️ 單字卡</button>
                <button id="tabArticleBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">📖 短文閱讀</button>
                <button id="tabDictionaryBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">🔍 查字典</button>
                <button id="tabLongArticleBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">📚 長篇小說</button>
                <button id="tabWritingBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">✍️ 寫作區</button>
                <button id="tabGamesBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px; background:rgba(139,92,246,0.2); border-color:rgba(139,92,246,0.5); color:#c4b5fd;">🎮 益智遊戲</button>
            </div>

            <!-- 單字卡模式區塊 -->
            <div id="flashcardSection" style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                <div style="flex:1; display:flex; gap:4px; min-width:200px;">
                    <input type="text" id="dictSearchInput" placeholder="輸入單字直接查字典..." class="input-field" style="background:rgba(0,0,0,0.3); border-color:rgba(59, 130, 246, 0.3);">
                    <button id="dictSearchBtn" class="btn primary-btn" style="padding:0 16px;">🔍 查詢</button>
                </div>
                <button id="addVocabGroupBtn" class="btn secondary-btn" style="background:rgba(16, 185, 129, 0.15); color:#6ee7b7; border-color:rgba(16, 185, 129, 0.3);">➕ 新增群組</button>
            </div>

            <!-- 字典搜尋結果面板 -->
            <div id="dictLoading" style="display:none; text-align:center; padding:16px; color:var(--text-secondary); font-size:14px;">
                📖 查字典中，請稍候...
            </div>
            <div id="dictResultCard" style="display:none; background:rgba(0,0,0,0.35); border:1px solid rgba(59,130,246,0.3); border-radius:14px; padding:18px; text-align:left; margin-bottom:4px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <span id="dictWordResult" style="font-size:26px; font-weight:800; color:#fff; letter-spacing:1px;"></span>
                        <span id="dictIpaResult" style="font-size:14px; color:#7dd3fc; font-family:monospace;"></span>
                        <button id="dictPlayBtn" style="background:rgba(59,130,246,0.2); border:1px solid rgba(59,130,246,0.4); color:#60a5fa; border-radius:8px; padding:4px 12px; cursor:pointer; font-size:18px;">🔊</button>
                    </div>
                    <div id="dictFreqResult" style="color:#fbbf24; font-size:16px; letter-spacing:2px;"></div>
                </div>
                <div id="dictDefsContainer" style="margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08);"></div>
                <div id="dictEgsContainer" style="display:flex; flex-direction:column; gap:10px; max-height:220px; overflow-y:auto;"></div>
            </div>

            <div id="englishLevelContainer" style="display:flex; justify-content:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
                <!-- Buttons injected by JS (A1~C2 + Custom Groups) -->
            </div>

            <!-- 單字卡片本體 -->
            <div class="flashcard glass-panel" style="background: rgba(255,255,255,0.05); padding: 40px 20px 20px; border-radius: 16px; position:relative;">
                
                <!-- 收藏至群組區塊 (絕對定位右上角) -->
                <div style="position:absolute; top:12px; right:12px; display:flex; gap:6px; align-items:center;">
                    <select id="saveGroupSelect" class="input-field" style="padding:4px 8px; font-size:12px; background:rgba(0,0,0,0.5); width:auto; border-radius:4px; border:1px solid rgba(255,255,255,0.2);">
                        <!-- Options injected by JS -->
                    </select>
                    <button id="saveWordBtn" class="btn secondary-btn" style="padding:4px 8px; font-size:12px; background:rgba(245, 158, 11, 0.1); border-color:rgba(245, 158, 11, 0.5); color:#fcd34d;">⭐ 收藏</button>
                </div>
                <div id="wordLoading" style="display:none; color:var(--text-secondary);">努力翻找字典中... 載入發音與例句中 ⏳</div>
                <div id="wordContent" style="flex:1; overflow-y:auto; padding-right:8px; margin-bottom:16px;">
                    <h1 id="flashcardWord" style="font-size: 48px; font-weight: 800; letter-spacing: 2px; color: #fff; margin-bottom: 8px;">Vocabulary</h1>
                    <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-bottom: 8px;">
                        <span id="flashcardIpa" style="color:#94a3b8; font-family:monospace; font-size:18px;">/voʊˈkæbjə.ler.i/</span>
                        <button id="playAudioBtn" class="btn primary-btn" style="padding: 4px 12px; font-size:16px;">🔊</button>
                    </div>
                    
                    <div id="wordFreqStars" style="color:#fbbf24; font-size:16px; margin-bottom: 16px; letter-spacing:2px; display:flex; justify-content:center; align-items:center; gap:8px;">
                        <!-- ★★★☆☆ -->
                    </div>

                    <p style="color:var(--text-secondary); margin-bottom:8px;">想一下意思，然後點擊下方按鈕翻面...</p>

                    <!-- 背面：解釋與例句 (預設隱藏) -->
                    <div id="flashcardBack" style="display:none; text-align:left; background:rgba(0,0,0,0.3); padding:24px; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                        <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid rgba(96, 165, 250, 0.3); padding-bottom:4px; margin-bottom:12px;">
                            <h3 style="color:#60a5fa; margin:0;">解釋</h3>
                            <button id="playChiDefBtn" style="background:transparent; border:none; cursor:pointer; color:var(--text-secondary); font-size:14px; opacity:0.7;">🗣️ 英文解析發音</button>
                        </div>
                        <p id="flashcardEngDef" style="font-size:15px; color:#e2e8f0; margin-bottom:4px;"></p>
                        <p id="flashcardChiDef" style="font-size:16px; color:#fca5a5; font-weight:bold; margin-bottom:20px;"></p>

                        <div style="display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid rgba(96, 165, 250, 0.3); padding-bottom:4px; margin-bottom:12px;">
                            <h3 style="color:#60a5fa; margin:0;">例句</h3>
                        </div>
                        <div id="flashcardEgsContainer" style="display:flex; flex-direction:column; gap:16px;">
                            <!-- Example instances injected by JS -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- 操作按鈕 -->
            <div id="actionFront" style="display:block;">
                <button id="flipCardBtn" class="btn primary-btn" style="width:100%; height:50px; font-size:18px; font-weight:bold; background:rgba(59, 130, 246, 0.4); border-color:#3b82f6;">👀 顯示答案</button>
            </div>
            <div id="actionBack" style="display:none; justify-content:center; gap:12px;">
                <button class="anki-btn" data-quality="0" style="background:rgba(239, 68, 68, 0.3); color:#fca5a5;">🤯 完全不認識<br><small>< 1天</small></button>
                <button class="anki-btn" data-quality="3" style="background:rgba(245, 158, 11, 0.3); color:#fcd34d;">🤔 模糊/想很久<br><small>2~3天</small></button>
                <button class="anki-btn" data-quality="5" style="background:rgba(16, 185, 129, 0.3); color:#6ee7b7;">😎 輕鬆秒答<br><small>更久</small></button>
            </div>
            </div> <!-- 結束 flashcardSection -->

            <!-- 短文閱讀模式區塊 -->
            <div id="articleSection" style="display:none; flex-direction:column; gap:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div style="display:flex; gap:8px; align-items:center;">
                        <label style="color:var(--text-secondary);">選擇難度：</label>
                        <select id="articleLevelSelect" class="input-field" style="width:100px; padding:6px; font-size:14px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.2); border-radius:6px; color:#fff;">
                            <option value="A1">A1 初級</option>
                            <option value="A2">A2 基礎</option>
                            <option value="B1">B1 中級</option>
                            <option value="B2">B2 中高級</option>
                            <option value="C1">C1 高級</option>
                        </select>
                    </div>
                    <button id="refreshArticleBtn" class="btn secondary-btn" style="padding:6px 16px;">↻ 隨機換一篇</button>
                </div>
                
                <div class="glass-panel" style="background: rgba(255,255,255,0.02); padding: 30px; border-radius: 16px; text-align:left;">
                    <h3 id="articleTitle" style="color:#60a5fa; margin-bottom:16px; font-size:24px; letter-spacing:1px;">Article Title</h3>
                    <div id="articleContent" style="font-size:16px; line-height:1.8; color:#e2e8f0; margin-bottom:24px;">
                        <!-- Article Content -->
                    </div>
                    
                    <div style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <span style="color:#fbbf24; font-size:14px;">🎤 全文跟讀與發音評分 (點擊單字可查單字卡)</span>
                            <span id="articleRecordStatus" style="font-size:12px; color:var(--text-secondary);">若跳出提示，請允許麥克風權限才能評分</span>
                        </div>
                        <button id="recordArticleBtn" class="btn primary-btn" style="background:rgba(239, 68, 68, 0.2); border-color:rgba(239, 68, 68, 0.5); color:#fca5a5; width:100%;">🔴 開始錄製全文發音</button>
                    </div>
                </div>

                <div id="articleScorePanel" class="glass-panel" style="display:none; background: rgba(0,0,0,0.3); padding: 20px; border:1px solid rgba(255,255,255,0.05); text-align:left;">
                    <h4 style="color:#34d399; margin-bottom:12px;">🎙️ 發音評分結果 (<span id="articleScoreVal">0</span>%)</h4>
                    <p id="articleRecordResult" style="font-size:15px; line-height:1.8; color:#94a3b8;"></p>
                </div>
            </div>

            <!-- 🎮 益智遊戲區塊 -->
            <div id="gamesSection" style="display:none; flex-direction:column; gap:16px;">
                <!-- 遊戲選單 -->
                <div id="gameMenuView">
                    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap:10px; max-height:65vh; overflow-y:auto; padding:4px;">
                    </div>
                </div>
                <!-- 遊戲畫面 -->
                <div id="gamePlayView" style="display:none; flex-direction:column; gap:12px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button id="backToGameMenuBtn" class="btn secondary-btn" style="padding:6px 14px; font-size:13px;">← 返回選單</button>
                        <span id="currentGameTitle" style="font-size:16px; font-weight:700; color:#c4b5fd;"></span>
                        <span id="gameScoreDisplay" style="margin-left:auto; font-size:14px; color:#fbbf24;"></span>
                    </div>
                    <div id="gameContainer" style="min-height:400px;"></div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- 🩸 血壓記錄 Modal -->
    <div class="modal-overlay" id="bpModal">
        <div class="modal-content" style="max-width: 900px; display:flex; flex-direction:row; gap:20px; flex-wrap:wrap;">
            <div style="flex:1; min-width:300px;">
                <div class="modal-header">
                    <h2>🩸 新增血壓與脈搏記錄</h2>
                    <button class="close-btn" id="closeBPModalBtn">&times;</button>
                </div>
                <div class="glass-panel" style="padding:20px;">
                    <div class="input-group">
                        <label>測量日期</label>
                        <input type="date" id="bpDate" class="input-field" style="background:rgba(0,0,0,0.3); color:inherit;">
                    </div>
                    <div class="input-group">
                        <label>測量時間</label>
                        <input type="time" id="bpTime" class="input-field" style="background:rgba(0,0,0,0.3); color:inherit;">
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div class="input-group" style="flex:1;">
                            <label>收縮壓 (SYS)</label>
                            <input type="number" id="bpSys" class="input-field" placeholder="120" style="background:rgba(0,0,0,0.3);">
                        </div>
                        <div class="input-group" style="flex:1;">
                            <label>舒張壓 (DIA)</label>
                            <input type="number" id="bpDia" class="input-field" placeholder="80" style="background:rgba(0,0,0,0.3);">
                        </div>
                        <div class="input-group" style="flex:1;">
                            <label>脈搏 (Pulse)</label>
                            <input type="number" id="bpPulse" class="input-field" placeholder="70" style="background:rgba(0,0,0,0.3);">
                        </div>
                    </div>
                    <button id="addBPBtn" class="btn primary-btn" style="width:100%; margin-top:10px; background:rgba(239, 68, 68, 0.2); border-color:rgba(239, 68, 68, 0.4); color:#fca5a5;">儲存紀錄</button>
                </div>
                
                <h3 style="margin-top:20px; color:#fca5a5;">智能統計範圍平均數</h3>
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                    <div class="dashboard-card" style="display:flex; justify-content:space-between;">
                        <span class="label">今日平均</span><span class="value" id="bpStatDaily" style="font-size:20px;">-- / --</span>
                    </div>
                    <div class="dashboard-card" style="display:flex; justify-content:space-between;">
                        <span class="label">近 7 日平均</span><span class="value" id="bpStatWeekly" style="font-size:20px;">-- / --</span>
                    </div>
                    <div class="dashboard-card" style="display:flex; justify-content:space-between;">
                        <span class="label">近 30 日平均</span><span class="value" id="bpStatMonthly" style="font-size:20px;">-- / --</span>
                    </div>
                    <div class="dashboard-card" style="display:flex; justify-content:space-between;">
                        <span class="label">全部歷史平均</span><span class="value" id="bpStatAll" style="font-size:20px;">-- / --</span>
                    </div>
                </div>
            </div>
            
            <div style="flex:1; min-width:300px; display:flex; flex-direction:column; margin-top:20px;">
                <h3 style="color:#6ee7b7; margin-bottom:10px;">歷史紀錄看版</h3>
                <div style="max-height: 500px; overflow-y: auto; background:rgba(0,0,0,0.2); border-radius:12px; padding:10px;">
                    <table class="history-table" style="width: 100%; text-align: left; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid rgba(255,255,255,0.1);">
                                <th style="padding: 10px; color: var(--text-secondary);">時間</th>
                                <th style="padding: 10px; color: var(--text-secondary);">血壓 (收/舒)</th>
                                <th style="padding: 10px; color: var(--text-secondary);">脈搏</th>
                                <th style="padding: 10px; color: var(--text-secondary);">操作</th>
                            </tr>
                        </thead>
                        <tbody id="bpTableBody">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <!-- 歷史統計 Modal -->
    <div class="modal-overlay" id="historyModal">
        <div class="modal-content" style="max-width: 960px;">
            <div class="modal-header">
                <h2>📈 每日歷史統計</h2>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button id="historySnapshotBtn" class="btn secondary-btn" style="padding:6px 14px; font-size:13px; background:rgba(52,211,153,0.15); border-color:rgba(52,211,153,0.4); color:#6ee7b7;" title="更新今日損益與市值統計">🔄 立即更新</button>
                    <button class="close-btn" id="closeHistoryModalBtn">&times;</button>
                </div>
            </div>
            <p style="font-size:12px; color:#94a3b8; margin:-8px 0 12px; padding:0 2px;">點擊任意數字欄位可直接修改，修改後自動儲存。</p>
            <div class="modal-body" style="overflow-x: auto; max-height: 60vh;">
                <table class="history-table" style="width: 100%; text-align: right; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid rgba(255,255,255,0.1);">
                            <th style="padding: 10px; text-align: left; color: var(--text-secondary); white-space:nowrap;">交易日期</th>
                            <th style="padding: 10px; color: var(--text-secondary); white-space:nowrap;">總付出成本</th>
                            <th style="padding: 10px; color: var(--text-secondary); white-space:nowrap;">總庫存市值</th>
                            <th style="padding: 10px; color: var(--text-secondary); white-space:nowrap;">總未實現損益</th>
                            <th style="padding: 10px; color: var(--text-secondary); white-space:nowrap;">與前日增減</th>
                            <th style="padding: 10px; color: var(--text-secondary); white-space:nowrap;">總淨資產</th>
                            <th style="padding: 10px; color: var(--text-secondary); white-space:nowrap;">2330收盤</th>
                            <th style="padding: 10px; color: var(--text-secondary); white-space:nowrap;">操作</th>
                        </tr>
                    </thead>
                    <tbody id="historyTableBody">
                        <!-- 資料由 JS 動態生成 -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>


    <!-- ── 即時浮動查字典 Popup ── -->
    <div id="floatDictPopup" style="display:none; position:fixed; z-index:9999; background:rgba(10,18,38,0.98); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px); border:1px solid rgba(59,130,246,0.45); border-radius:18px; padding:0; min-width:300px; max-width:380px; max-height:80vh; box-shadow:0 12px 48px rgba(0,0,0,0.7); font-family:'Outfit','Noto Sans TC',sans-serif; overflow:hidden; display:none; flex-direction:column;">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px 10px; border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0;">
            <div style="display:flex; align-items:baseline; gap:10px; flex-wrap:wrap;">
                <span id="floatDictWord" style="font-size:22px; font-weight:800; color:#fff; letter-spacing:0.5px;"></span>
                <span id="floatDictIpa" style="color:#7dd3fc; font-family:monospace; font-size:13px;"></span>
            </div>
            <div style="display:flex; gap:4px; align-items:center; flex-shrink:0; margin-left:8px;">
                <button id="floatDictAudio" title="播放發音" style="background:rgba(59,130,246,0.2); border:1px solid rgba(59,130,246,0.4); border-radius:8px; font-size:16px; cursor:pointer; padding:4px 8px; line-height:1; transition:background 0.15s;">🔊</button>
                <button id="floatDictClose" style="background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15); color:#94a3b8; font-size:18px; cursor:pointer; line-height:1; border-radius:8px; padding:2px 8px; transition:background 0.15s;">&times;</button>
            </div>
        </div>
        <!-- Loading -->
        <div id="floatDictLoading" style="padding:20px 16px; color:#94a3b8; font-size:13px; text-align:center; display:none;">查詢中... ⏳</div>
        <!-- Body (scrollable) -->
        <div id="floatDictBody" style="display:none; overflow-y:auto; padding:0 16px 14px; max-height:calc(80vh - 60px);">
        </div>
        <!-- Error -->
        <div id="floatDictError" style="display:none; padding:16px; color:#f87171; font-size:13px; text-align:center;"></div>
    </div>

    <!-- PWA Install Banner -->
    <div id="pwaInstallBanner" style="display:none;">
        <div class="banner-content">
            <div class="banner-icon">📲</div>
            <div class="banner-text">
                <div class="banner-title">安裝台股管理 App</div>
                <div class="banner-sub">加入主畫面，離線也能使用</div>
            </div>
        </div>
        <div class="banner-actions">
            <button id="pwaInstallBtn">📥 立即安裝</button>
            <button id="pwaDismissBtn">稍後再說</button>
        </div>
    </div>

    <!-- Mobile Bottom Navigation -->
    <nav class="mobile-nav" id="mobileNav">
        <div class="mobile-nav-inner">
            <button class="mobile-nav-btn active" id="navCalc" onclick="switchMobileTab('calc')">
                <span class="nav-icon">🧮</span>
                <span>試算</span>
            </button>
            <button class="mobile-nav-btn" id="navInventory" onclick="switchMobileTab('inventory')">
                <span class="nav-icon">📊</span>
                <span>庫存</span>
            </button>
            <button class="mobile-nav-btn" id="navBP" onclick="document.getElementById('openBPBtn').click()">
                <span class="nav-icon">🩸</span>
                <span>血壓</span>
            </button>
            <button class="mobile-nav-btn" id="navEnglish" onclick="document.getElementById('openEnglishBtn').click()">
                <span class="nav-icon">📝</span>
                <span>英文</span>
            </button>
            <button class="mobile-nav-btn" id="navMore" onclick="showMobileMore()">
                <span class="nav-icon">⋯</span>
                <span>更多</span>
            </button>
        </div>
    </nav>

    <!-- Mobile More Menu -->
    <div id="mobileMoreMenu" style="display:none; position:fixed; bottom:72px; left:0; right:0; z-index:490; background:rgba(15,23,42,0.97); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border-top:1px solid rgba(255,255,255,0.1); padding:16px; padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <button class="header-action-btn" onclick="document.getElementById('openCompoundBtn').click(); hideMobileMore();" style="background:rgba(245,158,11,0.15); color:#fcd34d; border-color:rgba(245,158,11,0.3); width:100%; font-size:14px; padding:12px;">📈 複利試算</button>
            <button class="header-action-btn" onclick="document.getElementById('refreshPricesBtn').click(); hideMobileMore();" style="background:rgba(14,165,233,0.15); color:#7dd3fc; border-color:rgba(14,165,233,0.3); width:100%; font-size:14px; padding:12px;">↻ 更新股價</button>
            <button class="header-action-btn" onclick="document.getElementById('openAccountingBtn').click(); hideMobileMore();" style="background:rgba(16,185,129,0.15); color:#6ee7b7; border-color:rgba(16,185,129,0.3); width:100%; font-size:14px; padding:12px;">📒 日常記帳</button>
            <button class="header-action-btn" onclick="document.getElementById('openHistoryStatsBtn').click(); hideMobileMore();" style="background:rgba(217,70,239,0.15); color:#f0abfc; border-color:rgba(217,70,239,0.3); width:100%; font-size:14px; padding:12px;">📊 歷史統計</button>
        </div>
        <button onclick="hideMobileMore()" style="width:100%; margin-top:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--text-secondary); border-radius:10px; padding:10px; font-size:14px; font-family:inherit; cursor:pointer;">關閉</button>
    </div>

    <script>
document.addEventListener('DOMContentLoaded', () => {
    // --- Global Override for Commas ---
    const _parseFloat = window.parseFloat;
    window.parseFloat = function(val) {
        if (typeof val === 'string') return _parseFloat(val.replace(/,/g, ''));
        return _parseFloat(val);
    };
    const _parseInt = window.parseInt;
    window.parseInt = function(val, radix) {
        if (typeof val === 'string') return _parseInt(val.replace(/,/g, ''), radix);
        return _parseInt(val, radix);
    };

    function attachFormatter(input) {
        if (input.type === 'number' && !['discount', 'cpRate', 'cpYears'].includes(input.id)) {
            input.type = 'text';
            input.inputMode = 'decimal';
            input.addEventListener('blur', (e) => {
                let v = e.target.value ? e.target.value.toString() : '';
                if(v.trim() !== '') {
                    let n = parseFloat(v);
                    if(!isNaN(n)) e.target.value = n.toLocaleString('en-US', v.includes('.') ? {minimumFractionDigits: 2, maximumFractionDigits: 4} : undefined);
                }
            });
            input.addEventListener('focus', (e) => {
                if (e.target.value) e.target.value = e.target.value.toString().replace(/,/g, '');
            });
            if (input.value) {
                let n = parseFloat(input.value);
                if (!isNaN(n)) input.value = n.toLocaleString('en-US', input.value.toString().includes('.') ? {minimumFractionDigits: 2, maximumFractionDigits: 4} : undefined);
            }
        }
    }

    document.querySelectorAll('input[type="number"]').forEach(attachFormatter);
    const observer = new MutationObserver(mutations => {
        mutations.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.tagName === 'INPUT') attachFormatter(node);
                else node.querySelectorAll('input[type="number"]').forEach(attachFormatter);
            }
        }));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // --- Calculator Elements ---
    const stockCodeInput = document.getElementById('stockCode');
    const buyPriceInput = document.getElementById('buyPrice');
    const sellPriceInput = document.getElementById('sellPrice');
    const buySharesInput = document.getElementById('buyShares');
    const sellSharesInput = document.getElementById('sellShares');
    const stockTypeSelect = document.getElementById('stockType');
    const discountInput = document.getElementById('discount');
    const minFeeInput = document.getElementById('minFee');

    const netProfitEl = document.getElementById('netProfit');
    const returnRateEl = document.getElementById('returnRate');
    const buyFeeValEl = document.getElementById('buyFeeVal');
    const sellFeeValEl = document.getElementById('sellFeeVal');
    const taxValEl = document.getElementById('taxVal');
    const totalCostValEl = document.getElementById('totalCostVal');
    const totalRevenueValEl = document.getElementById('totalRevenueVal');

    // --- Inventory Elements ---
    const addInventoryBtn = document.getElementById('addInventoryBtn');
    const addShortTermBtn = document.getElementById('addShortTermBtn');
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const longTermView = document.getElementById('longTermView');
    const shortTermView = document.getElementById('shortTermView');
    const dashboardTitleEl = document.querySelector('.inventory-header h2');
    const refreshPricesBtn = document.getElementById('refreshPricesBtn');
    const inventoryListEl = document.getElementById('inventoryList');
    const emptyMsgEl = document.getElementById('emptyInventoryMsg');
    const dashboardTotalValueEl = document.getElementById('totalMarketValue');
    const dashboardTotalProfitEl = document.getElementById('totalInventoryProfit');
    const cashInputEl = document.getElementById('cashInput');
    const yearlyRealizedInputEl = document.getElementById('yearlyRealizedInput');
    const totalRealizedInputEl = document.getElementById('totalRealizedInput');

    const shortTermCapitalInput = document.getElementById('shortTermCapitalInput');
    const stRealizedInput = document.getElementById('stRealizedInput');
    const stTotalCostEl = document.getElementById('stTotalCost');
    const stRemainingFundsEl = document.getElementById('stRemainingFunds');
    const stTotalProfitEl = document.getElementById('stTotalProfit');
    const stTotalProfitRateEl = document.getElementById('stTotalProfitRate');
    const shortTermListEl = document.getElementById('shortTermList');
    const stEmptyMsgEl = document.getElementById('stEmptyMsg');
    const historyModal = document.getElementById('historyModal');
    const openHistoryStatsBtn = document.getElementById('openHistoryStatsBtn');
    const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
    const historyTableBody = document.getElementById('historyTableBody');
    let dailyStats = [];
    try {
        const savedStats = localStorage.getItem('twStockDailyStats');
        if (savedStats) dailyStats = JSON.parse(savedStats);
    } catch(e) {}

    const accountingModal = document.getElementById('accountingModal');
    const openAccountingBtn = document.getElementById('openAccountingBtn');
    const closeAccountingBtn = document.getElementById('closeAccountingBtn');
    const prevMonthBtn = document.getElementById('prevMonthBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');
    const currentMonthLabel = document.getElementById('currentMonthLabel');
    const accTotalIncomeEl = document.getElementById('accTotalIncome');
    const accTotalExpenseEl = document.getElementById('accTotalExpense');
    const accBalanceEl = document.getElementById('accBalance');
    const accTypeInput = document.getElementById('accType');
    const accDateInput = document.getElementById('accDate');
    const accCategoryInput = document.getElementById('accCategory');
    const accAmountInput = document.getElementById('accAmount');
    const accNoteInput = document.getElementById('accNote');
    const addAccBtn = document.getElementById('addAccBtn');
    const accTableBody = document.getElementById('accTableBody');
    const accEmptyMsg = document.getElementById('accEmptyMsg');

    let accountingData = [];
    try {
        const savedAcc = localStorage.getItem('twStockAccounting');
        if (savedAcc) accountingData = JSON.parse(savedAcc);
    } catch(e) {}
    
    let currentAccDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Taipei"}));

    const FEE_RATE = 0.001425; // 0.1425%
    let inventory = [];
    let shortTermInventory = [];
    let currentView = 'longTerm';

    // --- History / Undo / Redo ---
    let historyStack = [];
    let redoStack = [];
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    function getCurrentState() {
        return {
            inventory: JSON.parse(JSON.stringify(inventory)),
            shortTermInventory: JSON.parse(JSON.stringify(shortTermInventory)),
            cash: localStorage.getItem('twStockCash') || '0',
            yearly: localStorage.getItem('twStockYearlyRealized') || '0',
            total: localStorage.getItem('twStockTotalRealized') || '0',
            stCapital: localStorage.getItem('twStockShortTermCapital') || '0',
            stRealized: localStorage.getItem('twStockShortTermRealized') || '0'
        };
    }

    function recordState() {
        historyStack.push(getCurrentState());
        if (historyStack.length > 50) historyStack.shift();
        redoStack = [];
        updateHistoryButtons();
    }

    function applyState(state) {
        inventory = JSON.parse(JSON.stringify(state.inventory));
        shortTermInventory = JSON.parse(JSON.stringify(state.shortTermInventory));
        
        if (cashInputEl) { cashInputEl.value = state.cash; cashInputEl.dispatchEvent(new Event('blur')); }
        if (yearlyRealizedInputEl) {
            yearlyRealizedInputEl.value = state.yearly;
            yearlyRealizedInputEl.dispatchEvent(new Event('blur'));
            updateInputColor(yearlyRealizedInputEl);
        }
        if (totalRealizedInputEl) {
            totalRealizedInputEl.value = state.total;
            totalRealizedInputEl.dispatchEvent(new Event('blur'));
            updateInputColor(totalRealizedInputEl);
        }
        if (shortTermCapitalInput) { shortTermCapitalInput.value = state.stCapital; shortTermCapitalInput.dispatchEvent(new Event('blur')); }
        if (stRealizedInput) {
             stRealizedInput.value = state.stRealized;
             stRealizedInput.dispatchEvent(new Event('blur'));
             updateInputColor(stRealizedInput);
        }
        
        saveInventory();
        saveShortTermInventory();
        
        if (cashInputEl) localStorage.setItem('twStockCash', state.cash);
        if (yearlyRealizedInputEl) localStorage.setItem('twStockYearlyRealized', state.yearly);
        if (totalRealizedInputEl) localStorage.setItem('twStockTotalRealized', state.total);
        if (shortTermCapitalInput) localStorage.setItem('twStockShortTermCapital', state.stCapital);
        if (stRealizedInput) localStorage.setItem('twStockShortTermRealized', state.stRealized);
        
        renderInventory();
        renderShortTermInventory();
    }

    function triggerUndo() {
        if (historyStack.length === 0) return;
        redoStack.push(getCurrentState());
        const previousState = historyStack.pop();
        applyState(previousState);
        updateHistoryButtons();
    }

    function triggerRedo() {
        if (redoStack.length === 0) return;
        historyStack.push(getCurrentState());
        const nextState = redoStack.pop();
        applyState(nextState);
        updateHistoryButtons();
    }

    function updateHistoryButtons() {
        if (undoBtn) undoBtn.disabled = historyStack.length === 0;
        if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    }

    if (undoBtn) undoBtn.addEventListener('click', triggerUndo);
    if (redoBtn) redoBtn.addEventListener('click', triggerRedo);
    // --- Utility Functions ---
    function formatCurrency(num, keepDecimals = false) {
        if (keepDecimals) {
            return Number(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
        }
        return Math.round(num).toLocaleString('en-US');
    }

    function updateColorClass(element, value) {
        element.classList.remove('is-profit', 'is-loss', 'is-neutral');
        if (value > 0) {
            element.classList.add('is-profit');
        } else if (value < 0) {
            element.classList.add('is-loss');
        } else {
            element.classList.add('is-neutral');
        }
    }

    function updateInputColor(inputEl) {
        if (!inputEl) return;
        const val = parseFloat(inputEl.value) || 0;
        inputEl.style.color = val > 0 ? '#ef4444' : (val < 0 ? '#10b981' : '#f8fafc');
        inputEl.style.textShadow = val !== 0 ? (val > 0 ? '0 0 10px rgba(239, 68, 68, 0.3)' : '0 0 10px rgba(16, 185, 129, 0.3)') : 'none';
    }

    // --- 1. Calculator Logic ---
    function calculate() {
        const buyPrice = parseFloat(buyPriceInput.value) || 0;
        const sellPrice = parseFloat(sellPriceInput.value) || 0;
        const buyShares = parseInt(buySharesInput.value) || 0;
        const sellShares = parseInt(sellSharesInput.value) || 0;
        const taxRate = parseFloat(stockTypeSelect.value) || 0.003;
        const discountMultiplier = (parseFloat(discountInput.value) || 0) / 10;
        const minFee = parseInt(minFeeInput.value) || 0;

        if (buyPrice <= 0 && sellPrice <= 0) {
            resetDisplay();
            return null; // Return null so we know not to add to inventory
        }

        let buyFee = 0;
        let totalCost = 0;
        if (buyPrice > 0 && buyShares > 0) {
            buyFee = Math.max(Math.floor(buyPrice * buyShares * FEE_RATE * discountMultiplier), minFee);
            totalCost = Math.floor(buyPrice * buyShares) + buyFee;
        }

        let sellFee = 0;
        let tax = 0;
        let totalRevenue = 0;
        if (sellPrice > 0 && sellShares > 0) {
            sellFee = Math.max(Math.floor(sellPrice * sellShares * FEE_RATE * discountMultiplier), minFee);
            tax = Math.floor(sellPrice * sellShares * taxRate);
            totalRevenue = Math.floor(sellPrice * sellShares) - sellFee - tax;
        }

        let netProfit = 0;
        let returnRate = 0;
        let realizedCost = 0;
        
        if (buyPrice > 0 && sellPrice > 0 && buyShares > 0 && sellShares > 0) {
            let averageUnitCost = totalCost / buyShares;
            realizedCost = averageUnitCost * sellShares;
            netProfit = totalRevenue - realizedCost;
            returnRate = (netProfit / realizedCost) * 100;
        } else if (buyPrice > 0 && buyShares > 0 && sellShares === 0) {
            totalRevenue = 0;
            netProfit = 0 - buyFee;
            returnRate = 0;
        } else if (sellPrice > 0 && sellShares > 0 && buyShares === 0) {
            totalCost = 0;
            netProfit = totalRevenue;
            returnRate = 0;
        }

        buyFeeValEl.textContent = formatCurrency(buyFee);
        sellFeeValEl.textContent = formatCurrency(sellFee);
        taxValEl.textContent = formatCurrency(tax);
        totalCostValEl.textContent = formatCurrency(totalCost);
        totalRevenueValEl.textContent = formatCurrency(totalRevenue);

        const profitPrefix = netProfit > 0 ? '+' : '';
        netProfitEl.textContent = profitPrefix + formatCurrency(netProfit);
        updateColorClass(netProfitEl, netProfit);

        const ratePrefix = returnRate > 0 ? '+' : '';
        returnRateEl.textContent = ratePrefix + returnRate.toFixed(2) + '%';
        updateColorClass(returnRateEl, returnRate);

        // Return a snapshot for inventory adding
        return {
            buyPrice, buyShares, totalCost, 
            unitCost: buyShares > 0 ? totalCost / buyShares : 0,
            taxRate, discountMultiplier, minFee
        };
    }

    function resetDisplay() {
        buyFeeValEl.textContent = '0';
        sellFeeValEl.textContent = '0';
        taxValEl.textContent = '0';
        totalCostValEl.textContent = '0';
        totalRevenueValEl.textContent = '0';
        netProfitEl.textContent = '0';
        returnRateEl.textContent = '0.00%';
        updateColorClass(netProfitEl, 0);
        updateColorClass(returnRateEl, 0);
    }

    const calcInputs = [buyPriceInput, sellPriceInput, buySharesInput, sellSharesInput, stockTypeSelect, discountInput, minFeeInput];
    calcInputs.forEach(input => input.addEventListener('input', calculate));

    // --- 2. Inventory Logic ---

    function loadInventory() {
        const saved = localStorage.getItem('twStockInventory');
        if (saved) inventory = JSON.parse(saved);
        
        const savedShort = localStorage.getItem('twStockShortTermInventory');
        if (savedShort) shortTermInventory = JSON.parse(savedShort);

        // Retroactively enforce correct tax rates based on type
        [inventory, shortTermInventory].forEach(list => {
            list.forEach(item => {
                if (item.type === 'etf') {
                    item.taxRate = 0.001;
                } else {
                    item.taxRate = 0.003;
                }
            });
        });

        const savedCash = localStorage.getItem('twStockCash');
        if (savedCash && cashInputEl) { cashInputEl.value = savedCash; cashInputEl.dispatchEvent(new Event('blur')); }

        const savedYearly = localStorage.getItem('twStockYearlyRealized');
        if (savedYearly && yearlyRealizedInputEl) {
            yearlyRealizedInputEl.value = savedYearly;
            yearlyRealizedInputEl.dispatchEvent(new Event('blur'));
            updateInputColor(yearlyRealizedInputEl);
        }

        const savedTotal = localStorage.getItem('twStockTotalRealized');
        if (savedTotal && totalRealizedInputEl) {
            totalRealizedInputEl.value = savedTotal;
            totalRealizedInputEl.dispatchEvent(new Event('blur'));
            updateInputColor(totalRealizedInputEl);
        }

        const savedCapital = localStorage.getItem('twStockShortTermCapital');
        if (savedCapital && shortTermCapitalInput) {
            shortTermCapitalInput.value = savedCapital;
            shortTermCapitalInput.dispatchEvent(new Event('blur'));
        }

        const savedStReal = localStorage.getItem('twStockShortTermRealized');
        if (savedStReal && stRealizedInput) {
            stRealizedInput.value = savedStReal;
            stRealizedInput.dispatchEvent(new Event('blur'));
        }

        renderInventory();
        renderShortTermInventory();
    }

    function saveInventory() {
        localStorage.setItem('twStockInventory', JSON.stringify(inventory));
    }

    function saveShortTermInventory() {
        localStorage.setItem('twStockShortTermInventory', JSON.stringify(shortTermInventory));
    }

    function addToInventory() {
        const snapshot = calculate();
        if (!snapshot || snapshot.buyShares <= 0) {
            alert('請先填寫有效的「買進價格」與「買進股數」！');
            return;
        }

        const rawInput = stockCodeInput.value.trim() || '未命名股票';
        let code = rawInput;
        let name = '';
        
        if (rawInput !== '未命名股票') {
            const match = rawInput.match(/^([a-zA-Z0-9]+)([\s_-]*)(.*)$/);
            if (match) {
                code = match[1];
                name = match[3];
            }
        }

        const existingItem = inventory.find(i => i.code === code && code !== '未命名股票');

        recordState();

        if (existingItem) {
            existingItem.shares += snapshot.buyShares;
            existingItem.totalCost += snapshot.totalCost;
            if (existingItem.shares > 0) {
                existingItem.unitCost = existingItem.totalCost / existingItem.shares;
            }
            if (name && !existingItem.name) {
                existingItem.name = name;
            }
        } else {
            const newItem = {
                id: Date.now().toString(),
                code: code,
                name: name,
                shares: snapshot.buyShares,
                buyPrice: snapshot.buyPrice,
                totalCost: snapshot.totalCost,
                unitCost: snapshot.unitCost,
                taxRate: snapshot.taxRate,
                discountMultiplier: snapshot.discountMultiplier,
                minFee: snapshot.minFee,
                currentPrice: snapshot.buyPrice, // Default to buy price initially
                dividend: 0 // New field for yearly dividend
            };
            inventory.push(newItem);
        }

        saveInventory();
        renderInventory();
        
        // Clear stock code after adding (optional UX)
        stockCodeInput.value = '';
    }

    function addToShortTermInventory() {
        const snapshot = calculate();
        if (!snapshot || snapshot.buyShares <= 0) {
            alert('請先填寫有效的「買進價格」與「買進股數」！');
            return;
        }

        const rawInput = stockCodeInput.value.trim() || '未命名股票';
        let code = rawInput;
        let name = '';
        
        if (rawInput !== '未命名股票') {
            const match = rawInput.match(/^([a-zA-Z0-9]+)([\s_-]*)(.*)$/);
            if (match) {
                code = match[1];
                name = match[3];
            }
        }

        const existingItem = shortTermInventory.find(i => i.code === code && code !== '未命名股票');

        recordState();

        if (existingItem) {
            existingItem.shares += snapshot.buyShares;
            existingItem.totalCost += snapshot.totalCost;
            if (existingItem.shares > 0) {
                existingItem.unitCost = existingItem.totalCost / existingItem.shares;
            }
            if (name && !existingItem.name) {
                existingItem.name = name;
            }
        } else {
            const newItem = {
                id: Date.now().toString() + '_st',
                code: code,
                name: name,
                shares: snapshot.buyShares,
                buyPrice: snapshot.buyPrice,
                totalCost: snapshot.totalCost,
                unitCost: snapshot.unitCost,
                taxRate: snapshot.taxRate,
                discountMultiplier: snapshot.discountMultiplier,
                minFee: snapshot.minFee,
                currentPrice: snapshot.buyPrice,
                dividend: 0
            };
            shortTermInventory.push(newItem);
        }

        saveShortTermInventory();
        renderShortTermInventory();
        
        stockCodeInput.value = '';
    }

    function deleteInventory(id, isShortTerm = false) {
        recordState();
        if (isShortTerm) {
            shortTermInventory = shortTermInventory.filter(item => item.id !== id);
            saveShortTermInventory();
            renderShortTermInventory();
        } else {
            inventory = inventory.filter(item => item.id !== id);
            saveInventory();
            renderInventory();
        }
    }

    function updateItemPrice(id, newPrice, isShortTerm = false) {
        const targetList = isShortTerm ? shortTermInventory : inventory;
        const item = targetList.find(i => i.id === id);
        if (item && item.currentPrice !== parseFloat(newPrice)) {
            recordState();
            item.currentPrice = parseFloat(newPrice) || 0;
            if (isShortTerm) {
                saveShortTermInventory();
                renderShortTermInventory();
            } else {
                saveInventory();
                renderInventory();
            }
        }
    }

    function updateItemCost(id, newCost, isShortTerm = false) {
        const targetList = isShortTerm ? shortTermInventory : inventory;
        const item = targetList.find(i => i.id === id);
        if (item && item.totalCost !== parseFloat(newCost)) {
            recordState();
            item.totalCost = parseFloat(newCost) || 0;
            if (item.shares > 0) item.unitCost = item.totalCost / item.shares;
            if (isShortTerm) {
                saveShortTermInventory();
                renderShortTermInventory();
            } else {
                saveInventory();
                renderInventory();
            }
        }
    }

    // --- Network helper for CORS Proxies ---
    async function fetchWithProxy(targetUrl, isJson = false) {
        const proxies = [
            (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
            (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
            (url) => `https://corsproxy.io/?${encodeURIComponent(url)}` // or ?url=
        ];

        for (let getProxyUrl of proxies) {
            const proxyUrl = getProxyUrl(targetUrl);
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(proxyUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (res.ok) {
                    if (proxyUrl.includes('allorigins.win/get')) {
                        const data = await res.json();
                        if (data && data.contents) {
                            return isJson ? JSON.parse(data.contents) : data.contents;
                        }
                    } else {
                        return isJson ? await res.json() : await res.text();
                    }
                }
            } catch (e) {
                console.warn(`Proxy failed: ${proxyUrl}`, e.message);
            }
        }
        throw new Error('All CORS proxies failed for: ' + targetUrl);
    }

    // --- Real-time Stock Price via Reliable Fallbacks ---
    async function refreshPrices() {
        refreshPricesBtn.textContent = '抓取中...';
        refreshPricesBtn.disabled = true;

        let anySuccess = false;
        let allItems = [...inventory, ...shortTermInventory];

        // 0. Primary official TWSE data (No proxy needed, works for all listed Taiwan stocks)
        let twseMap = {};
        try {
            const twseRes = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
            if (twseRes.ok) {
                const twseData = await twseRes.json();
                twseData.forEach(dt => {
                    if(dt.ClosingPrice) {
                        twseMap[dt.Code] = parseFloat(String(dt.ClosingPrice).replace(/,/g, ''));
                    }
                });
            }
        } catch(e) {
            console.warn("TWSE API failed:", e);
        }

        for (let item of allItems) {
            let rawSymbol = item.code.trim().replace(/\.TW$/i, '').replace(/\.TWO$/i, '');
            
            // Fast track TWSE map lookup
            if (twseMap[rawSymbol] && !isNaN(twseMap[rawSymbol])) {
                let price = twseMap[rawSymbol];
                if (price !== item.currentPrice) {
                    if (!anySuccess) recordState();
                    item.currentPrice = price;
                    anySuccess = true;
                }
                continue; // Found it in TWSE, move to next!
            }

            let symbol = item.code.trim();
            if (/^[a-zA-Z0-9]+$/.test(symbol)) {
                symbol = `${symbol}.TW`;
            } else if (!symbol.includes('.')) {
                symbol = `${symbol}.TW`;
            }

            let fallbackSuccess = false;

            // 1. Yahoo Finance API
            try {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
                const rawData = await fetchWithProxy(url, true);
                
                const price = rawData.chart.result[0].meta.regularMarketPrice;
                if (price) {
                    if (price !== item.currentPrice) {
                        if (!anySuccess) recordState();
                        item.currentPrice = price;
                        anySuccess = true;
                    }
                    fallbackSuccess = true;
                } else {
                    throw new Error('Yahoo proxy returned no price');
                }
            } catch (err) {
                console.warn('Yahoo API error for', symbol, '- Trying Yahoo TW HTML...');
            }

            // 2. Yahoo TW HTML (very reliable for TW stocks)
            if (!fallbackSuccess) {
                try {
                    const rawSymbol = item.code.trim();
                    const twUrl = `https://tw.stock.yahoo.com/quote/${rawSymbol}`;
                    const html = await fetchWithProxy(twUrl, false);
                    
                    let priceValue = null;
                    if (html) {
                        const m = html.match(/"currentPrice":([\d\.,]+)/) || html.match(/"regularMarketPrice":\{"raw":([\d\.,]+)/) || html.match(/<span[^>]*Fz\(32px\)[^>]*>([\d\.,]+)<\/span>/);
                        if (m && m[1]) {
                            priceValue = window.parseFloat(String(m[1]).replace(/,/g, ''));
                        }
                    }
                    if (priceValue !== null && !isNaN(priceValue)) {
                        if (priceValue !== item.currentPrice) {
                            if (!anySuccess) recordState();
                            item.currentPrice = priceValue;
                            anySuccess = true;
                        }
                        fallbackSuccess = true;
                    } else {
                        throw new Error('Yahoo TW HTML parsed no price');
                    }
                } catch(yhErr) {
                    console.warn('Yahoo TW HTML error for', item.code, '- Trying CMoney...');
                }
            }

            // 3. CMoney HTML
            if (!fallbackSuccess) {
                try {
                    const rawSymbol = item.code.trim();
                    const cmUrl = `https://www.cmoney.tw/finance/twstock/${rawSymbol}`;
                    const html = await fetchWithProxy(cmUrl, false);
                    
                    let priceValue = null;
                    if (html) {
                        let mDesc = html.match(/成交價[^\d]*([\d\.,]+)/);
                        let mProps = html.match(/itemprop="price"[^>]*>([\d\.,]+)/i);
                        let mJson = html.match(/"price"\s*:\s*([\d\.,]+)/i);
                        
                        if (mDesc && mDesc[1]) priceValue = window.parseFloat(String(mDesc[1]).replace(/,/g, ''));
                        else if (mProps && mProps[1]) priceValue = window.parseFloat(String(mProps[1]).replace(/,/g, ''));
                        else if (mJson && mJson[1]) priceValue = window.parseFloat(String(mJson[1]).replace(/,/g, ''));
                    }
                    
                    if (priceValue !== null && !isNaN(priceValue)) {
                        if (priceValue !== item.currentPrice) {
                            if (!anySuccess) recordState();
                            item.currentPrice = priceValue;
                            anySuccess = true;
                        }
                        fallbackSuccess = true;
                    } else {
                        throw new Error('CMoney HTML parsed no price');
                    }
                } catch(cmErr) {
                    console.error('All fallbacks failed for', item.code, cmErr.message);
                }
            }
        }

        if (anySuccess) {
            saveInventory();
            saveShortTermInventory();
            renderInventory();
            renderShortTermInventory();
            await logDailyStats();
        }

        refreshPricesBtn.textContent = '↻ 更新股價';
        refreshPricesBtn.disabled = false;
        
        if (!anySuccess && allItems.length > 0) {
            alert('抓取完成：目前可能因為網路或代號問題無法取得最新現價。如有需要請手動更新。');
        }
    }

    // --- Render Inventory (Long Term) ---
    function renderInventory() {
        if (inventory.length === 0) {
            inventoryListEl.innerHTML = '';
            emptyMsgEl.style.display = 'block';
            dashboardTotalValueEl.textContent = '0';
            dashboardTotalProfitEl.textContent = '0';
            updateColorClass(dashboardTotalProfitEl, 0);
            const rateEl = document.getElementById('totalInventoryProfitRate');
            if(rateEl) { rateEl.textContent = '0.00%'; updateColorClass(rateEl, 0); }
            return;
        }

        emptyMsgEl.style.display = 'none';
        inventoryListEl.innerHTML = '';

        let totalMarketVal = 0;
        let totalCostAll = 0;
        let totalDividendAll = 0;

        // First pass: accumulate totals
        inventory.forEach(item => {
            item.dividend = parseFloat(item.dividend) || 0;
            totalDividendAll += item.dividend;
            
            let sellFee = 0;
            let tax = 0;
            let totalRevenue = 0; // expected revenue
            
            if (item.currentPrice > 0) {
                sellFee = Math.max(Math.floor(item.currentPrice * item.shares * FEE_RATE * item.discountMultiplier), item.minFee);
                tax = Math.floor(item.currentPrice * item.shares * item.taxRate);
                totalRevenue = Math.floor(item.currentPrice * item.shares) - sellFee - tax;
            }
            
            item._tempRevenue = totalRevenue;
            totalMarketVal += totalRevenue;
            totalCostAll += item.totalCost;
        });

        // Sort inventory by market value (descending) before rendering
        inventory.sort((a, b) => b._tempRevenue - a._tempRevenue);

        const cashBalance = parseFloat(cashInputEl.value) || 0;
        const totalAsset = totalMarketVal + cashBalance;

        // Second pass: Render each card
        inventory.forEach(item => {
            let totalRevenue = item._tempRevenue;

            // Let's refine profit if currentPrice is valid
            const currentProfit = (item.currentPrice > 0) ? (totalRevenue - item.totalCost) : 0;
            const currentReturnRate = (item.totalCost > 0) ? (currentProfit / item.totalCost * 100) : 0;
            
            const stockRatio = totalMarketVal > 0 ? (totalRevenue / totalMarketVal * 100) : 0;
            const assetRatio = totalAsset > 0 ? (totalRevenue / totalAsset * 100) : 0;

            const card = document.createElement('div');
            card.className = 'inventory-item';
            
            const profitStr = (currentProfit > 0 ? '+' : '') + formatCurrency(currentProfit);
            const rateStr = (currentReturnRate > 0 ? '+' : '') + currentReturnRate.toFixed(2) + '%';
            
            const profitClass = currentProfit > 0 ? 'is-profit' : (currentProfit < 0 ? 'is-loss' : 'is-neutral');

            card.innerHTML = `
                <div class="inv-header">
                    <span class="inv-title" style="display:flex; align-items:center;">
                        ${item.code}
                        <input type="text" data-id="${item.id}" class="live-name-input" value="${item.name || ''}" placeholder="點此輸入名稱" style="font-size:18px; font-weight:500; opacity:0.9; margin-left:8px; background:transparent; border:none; color:var(--text-primary); width:130px; outline:none; padding:2px 0;">
                    </span>
                    <span class="inv-shares" style="display:flex; align-items:center; gap:4px;">
                        <input type="number" step="1" min="0" data-id="${item.id}" class="live-shares-input" value="${item.shares}" style="font-size:20px; font-family:inherit; font-weight:600; color:var(--text-primary); text-align:right; width:90px; background:transparent; border:none; outline:none;">
                        股
                    </span>
                </div>
                <div class="inv-body" style="grid-template-columns: 1fr 1fr 1.2fr;">
                    <div class="inv-stat">
                        <span style="font-size:12px; color:var(--text-secondary);">現在價格</span>
                        <div style="display:flex; align-items:center;">
                            <span style="color:#60a5fa; font-weight:600; font-size:18px;">$</span>
                            <input type="number" step="0.01" min="0" value="${item.currentPrice}" data-id="${item.id}" class="live-price-input" style="font-size:20px; font-weight:600; width:100%; background:transparent; border:none; color:#60a5fa; outline:none; padding:0;" title="即時股價">
                        </div>
                    </div>
                    <div class="inv-stat">
                        <span style="font-size:12px; color:var(--text-secondary);">股票市值</span>
                        <span style="font-size:20px; font-weight:600; color:#f8fafc;">$${formatCurrency(totalRevenue)}</span>
                    </div>
                    <div class="inv-stat input-stat">
                        <label>已領配息總額</label>
                        <div style="display:flex; align-items:center;">
                            <span style="margin-right:2px; font-size:16px; color:var(--text-primary);">$</span>
                            <input type="number" step="1" min="0" value="${item.dividend}" data-id="${item.id}" class="live-dividend-input" style="color:var(--text-primary); background:transparent; padding-left:0; outline:none;">
                        </div>
                    </div>
                    <div class="inv-stat">
                        <span style="font-size:12px; color:var(--text-secondary);">平均成本</span>
                        <span style="font-size:18px; font-weight:500; color:var(--text-primary); margin-top:2px;">$ ${formatCurrency(item.unitCost, true)}</span>
                    </div>
                    <div class="inv-stat input-stat">
                        <label>買進總金額</label>
                        <div style="display:flex; align-items:center;">
                            <span style="margin-right:2px; font-size:16px; color:var(--text-primary);">$</span>
                            <input type="number" step="1" min="0" value="${item.totalCost}" data-id="${item.id}" class="live-cost-input" style="color:var(--text-primary); background:transparent; padding-left:0; outline:none;">
                        </div>
                    </div>
                </div>
                <div class="inv-footer">
                    <div class="inv-result">
                        <span class="inv-result-val ${profitClass}">${profitStr}</span>
                        <span class="inv-result-rate ${profitClass}">${rateStr}</span>
                        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 6px; display:flex; gap:12px;">
                            <span>股票 ${stockRatio.toFixed(1)}%</span>
                            <span>總資產 ${assetRatio.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center;">
                        <button class="btn-delete" data-id="${item.id}" style="padding:4px 12px; font-size:12px;">刪除</button>
                    </div>
                </div>
            `;
            inventoryListEl.appendChild(card);
        });

        // Update Dashboard Defaults
        const grossProfit = totalMarketVal - totalCostAll;
        const totalProfitRate = totalCostAll > 0 ? (grossProfit / totalCostAll * 100) : 0;
        
        dashboardTotalValueEl.textContent = formatCurrency(totalMarketVal);
        
        dashboardTotalProfitEl.textContent = (grossProfit > 0 ? '+' : '') + formatCurrency(grossProfit);
        updateColorClass(dashboardTotalProfitEl, grossProfit);

        const totalInventoryProfitRateEl = document.getElementById('totalInventoryProfitRate');
        if (totalInventoryProfitRateEl) {
            totalInventoryProfitRateEl.textContent = (totalProfitRate > 0 ? '+' : '') + totalProfitRate.toFixed(2) + '%';
            updateColorClass(totalInventoryProfitRateEl, grossProfit);
        }

        const totalAssetValueEl = document.getElementById('totalAssetValue');
        if (totalAssetValueEl) {
            totalAssetValueEl.textContent = formatCurrency(totalAsset);
        }

        const marketValueAssetRateEl = document.getElementById('marketValueAssetRate');
        if (marketValueAssetRateEl) {
            const marketValueRate = totalAsset > 0 ? (totalMarketVal / totalAsset * 100) : 0;
            marketValueAssetRateEl.textContent = marketValueRate.toFixed(2) + '%';
        }

        const cashAssetRateEl = document.getElementById('cashAssetRate');
        if (cashAssetRateEl) {
            const cashRate = totalAsset > 0 ? (cashBalance / totalAsset * 100) : 0;
            cashAssetRateEl.textContent = cashRate.toFixed(2) + '%';
        }

        const totalInventoryCostEl = document.getElementById('totalInventoryCost');
        if (totalInventoryCostEl) {
            totalInventoryCostEl.textContent = formatCurrency(totalCostAll);
        }

        const totalDividendValEl = document.getElementById('totalDividendVal');
        const dividendTaxOffsetValEl = document.getElementById('dividendTaxOffsetVal');
        const dividendTotalBenefitValEl = document.getElementById('dividendTotalBenefitVal');

        if (totalDividendValEl) {
            let taxOffset = Math.floor(totalDividendAll * 0.085);
            let dividendTotalBenefit = totalDividendAll + taxOffset;
            
            totalDividendValEl.textContent = formatCurrency(totalDividendAll);
            dividendTaxOffsetValEl.textContent = formatCurrency(taxOffset);
            dividendTotalBenefitValEl.textContent = formatCurrency(dividendTotalBenefit);
        }

        // Bind events to new elements
        document.querySelectorAll('.live-price-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const id = e.target.getAttribute('data-id');
                updateItemPrice(id, e.target.value);
                // 手動改股價後也記錄今日快照
                await logDailyStats();
            });
        });

        document.querySelectorAll('.live-cost-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                updateItemCost(id, e.target.value);
            });
        });

        document.querySelectorAll('.live-shares-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const item = inventory.find(i => i.id === id);
                if (item && item.shares !== parseInt(e.target.value)) {
                    recordState();
                    item.shares = parseInt(e.target.value) || 0;
                    if (item.shares > 0) {
                        item.unitCost = item.totalCost / item.shares;
                    } else {
                        item.unitCost = 0;
                    }
                    saveInventory();
                    renderInventory();
                }
            });
        });

        document.querySelectorAll('.live-dividend-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const item = inventory.find(i => i.id === id);
                if (item && item.dividend !== parseFloat(e.target.value)) {
                    recordState();
                    item.dividend = parseFloat(e.target.value) || 0;
                    saveInventory();
                    renderInventory();
                }
            });
        });

        document.querySelectorAll('.live-name-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const item = inventory.find(i => i.id === id);
                const newVal = e.target.value.trim();
                if (item && item.name !== newVal) {
                    recordState();
                    item.name = newVal;
                    saveInventory();
                    // optional: we don't even need to re-render, it's just a name
                }
            });
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                if (confirm('確定要刪除這筆庫存嗎？')) {
                    deleteInventory(id);
                }
            });
        });
    }

    // --- Render Inventory (Short Term) ---
    function renderShortTermInventory() {
        if (shortTermInventory.length === 0) {
            shortTermListEl.innerHTML = '';
            stEmptyMsgEl.style.display = 'block';
            stTotalCostEl.textContent = '0';
            stTotalProfitEl.textContent = '0';
            updateColorClass(stTotalProfitEl, 0);
            stTotalProfitRateEl.textContent = '0.00%';
            updateColorClass(stTotalProfitRateEl, 0);
            const capital = parseFloat(shortTermCapitalInput.value) || 0;
            const stRealized = parseFloat(stRealizedInput.value) || 0;
            const currentRemaining = capital + stRealized;
            stRemainingFundsEl.textContent = formatCurrency(currentRemaining);
            stRemainingFundsEl.style.color = currentRemaining < 0 ? '#ef4444' : '#60a5fa';
            return;
        }

        stEmptyMsgEl.style.display = 'none';
        shortTermListEl.innerHTML = '';

        let totalCostAll = 0;
        let totalMarketVal = 0;

        shortTermInventory.forEach(item => {
            let sellFee = 0;
            let tax = 0;
            let totalRevenue = 0; 
            if (item.currentPrice > 0) {
                sellFee = Math.max(Math.floor(item.currentPrice * item.shares * FEE_RATE * item.discountMultiplier), item.minFee);
                tax = Math.floor(item.currentPrice * item.shares * item.taxRate);
                totalRevenue = Math.floor(item.currentPrice * item.shares) - sellFee - tax;
            }
            item._tempRevenue = totalRevenue;
            totalMarketVal += totalRevenue;
            totalCostAll += item.totalCost;
        });

        shortTermInventory.sort((a, b) => b._tempRevenue - a._tempRevenue);

        const capital = parseFloat(shortTermCapitalInput.value) || 0;
        const stRealized = parseFloat(stRealizedInput.value) || 0;
        const remainingFunds = capital - totalCostAll + stRealized;

        shortTermInventory.forEach(item => {
            let totalRevenue = item._tempRevenue;
            const currentProfit = (item.currentPrice > 0) ? (totalRevenue - item.totalCost) : 0;
            const currentReturnRate = (item.totalCost > 0) ? (currentProfit / item.totalCost * 100) : 0;
            
            const card = document.createElement('div');
            card.className = 'inventory-item';
            
            const profitStr = (currentProfit > 0 ? '+' : '') + formatCurrency(currentProfit);
            const rateStr = (currentReturnRate > 0 ? '+' : '') + currentReturnRate.toFixed(2) + '%';
            const profitClass = currentProfit > 0 ? 'is-profit' : (currentProfit < 0 ? 'is-loss' : 'is-neutral');

            card.innerHTML = `
                <div class="inv-header">
                    <span class="inv-title" style="display:flex; align-items:center;">
                        ${item.code}
                        <input type="text" data-id="${item.id}" class="live-name-input-st" value="${item.name || ''}" placeholder="點此輸入名稱" style="font-size:18px; font-weight:500; opacity:0.9; margin-left:8px; background:transparent; border:none; color:var(--text-primary); width:130px; outline:none; padding:2px 0;">
                    </span>
                    <span class="inv-shares" style="display:flex; align-items:center; gap:4px;">
                        <input type="number" step="1" min="0" data-id="${item.id}" class="live-shares-input-st" value="${item.shares}" style="font-size:20px; font-family:inherit; font-weight:600; color:var(--text-primary); text-align:right; width:90px; background:transparent; border:none; outline:none;">
                        股
                    </span>
                </div>
                <div class="inv-body" style="grid-template-columns: 1fr 1fr 1.2fr;">
                    <div class="inv-stat">
                        <span style="font-size:12px; color:var(--text-secondary);">現在價格</span>
                        <div style="display:flex; align-items:center;">
                            <span style="color:#60a5fa; font-weight:600; font-size:18px;">$</span>
                            <input type="number" step="0.01" min="0" value="${item.currentPrice}" data-id="${item.id}" class="live-price-input-st" style="font-size:20px; font-weight:600; width:100%; background:transparent; border:none; color:#60a5fa; outline:none; padding:0;" title="即時股價">
                        </div>
                    </div>
                    <div class="inv-stat">
                        <span style="font-size:12px; color:var(--text-secondary);">股票市值</span>
                        <span style="font-size:20px; font-weight:600; color:#f8fafc;">$${formatCurrency(totalRevenue)}</span>
                    </div>
                    <div class="inv-stat"></div>
                    <div class="inv-stat">
                        <span style="font-size:12px; color:var(--text-secondary);">平均成本</span>
                        <span style="font-size:18px; font-weight:500; color:var(--text-primary); margin-top:2px;">$ ${formatCurrency(item.unitCost, true)}</span>
                    </div>
                    <div class="inv-stat input-stat">
                        <label>買進總金額</label>
                        <div style="display:flex; align-items:center;">
                            <span style="margin-right:2px; font-size:16px; color:var(--text-primary);">$</span>
                            <input type="number" step="1" min="0" value="${item.totalCost}" data-id="${item.id}" class="live-cost-input-st" style="color:var(--text-primary); background:transparent; padding-left:0; outline:none;">
                        </div>
                    </div>
                </div>
                <div class="inv-footer">
                    <div class="inv-result">
                        <span class="inv-result-val ${profitClass}">${profitStr}</span>
                        <span class="inv-result-rate ${profitClass}">${rateStr}</span>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center;">
                        <button class="btn-delete-st" data-id="${item.id}" style="padding:4px 12px; font-size:12px;">刪除</button>
                    </div>
                </div>
            `;
            shortTermListEl.appendChild(card);
        });

        const grossProfit = totalMarketVal - totalCostAll;
        const totalProfitRate = totalCostAll > 0 ? (grossProfit / totalCostAll * 100) : 0;
        
        stTotalCostEl.textContent = formatCurrency(totalCostAll);
        
        stTotalProfitEl.textContent = (grossProfit > 0 ? '+' : '') + formatCurrency(grossProfit);
        updateColorClass(stTotalProfitEl, grossProfit);

        stTotalProfitRateEl.textContent = (totalProfitRate > 0 ? '+' : '') + totalProfitRate.toFixed(2) + '%';
        updateColorClass(stTotalProfitRateEl, grossProfit);

        stRemainingFundsEl.textContent = formatCurrency(remainingFunds);
        stRemainingFundsEl.style.color = remainingFunds < 0 ? '#ef4444' : '#60a5fa';

        // Bind events
        document.querySelectorAll('.live-price-input-st').forEach(input => {
            input.addEventListener('change', (e) => {
                updateItemPrice(e.target.getAttribute('data-id'), e.target.value, true);
            });
        });

        document.querySelectorAll('.live-cost-input-st').forEach(input => {
            input.addEventListener('change', (e) => {
                updateItemCost(e.target.getAttribute('data-id'), e.target.value, true);
            });
        });

        document.querySelectorAll('.live-shares-input-st').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const item = shortTermInventory.find(i => i.id === id);
                if (item && item.shares !== parseInt(e.target.value)) {
                    recordState();
                    item.shares = parseInt(e.target.value) || 0;
                    if (item.shares > 0) item.unitCost = item.totalCost / item.shares;
                    saveShortTermInventory();
                    renderShortTermInventory();
                }
            });
        });

        document.querySelectorAll('.live-name-input-st').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                const item = shortTermInventory.find(i => i.id === id);
                const newVal = e.target.value.trim();
                if (item && item.name !== newVal) {
                    recordState();
                    item.name = newVal;
                    saveShortTermInventory();
                }
            });
        });

        document.querySelectorAll('.btn-delete-st').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (confirm('確定要刪除這筆短線庫存嗎？')) {
                    deleteInventory(e.target.getAttribute('data-id'), true);
                }
            });
        });
    }

    // --- 3. Compound Interest Calculator ---
    const compoundModal = document.getElementById('compoundModal');
    const openCompoundBtn = document.getElementById('openCompoundBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    const cpPrincipal = document.getElementById('cpPrincipal');
    const cpAnnualAdd = document.getElementById('cpAnnualAdd');
    const cpRate = document.getElementById('cpRate');
    const cpYears = document.getElementById('cpYears');
    const cpYearsLabel = document.getElementById('cpYearsLabel');
    
    const cpFinalValue = document.getElementById('cpFinalValue');
    const cpTotalInvested = document.getElementById('cpTotalInvested');
    const cpTotalInterest = document.getElementById('cpTotalInterest');
    
    let compoundChartInstance = null;

    function initChart() {
        if (compoundChartInstance) return;
        const ctx = document.getElementById('compoundChart').getContext('2d');
        compoundChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '總投入本金',
                        data: [],
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    },
                    {
                        label: '複利孳息',
                        data: [],
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#94a3b8' },
                        grid: { display: false }
                    },
                    y: {
                        stacked: true,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#f8fafc', font: { family: 'Outfit, Noto Sans TC' } } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': NT$ ' + context.parsed.y.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    function calculateCompound() {
        let principal = parseFloat(cpPrincipal.value) || 0;
        let annualAdd = parseFloat(cpAnnualAdd.value) || 0;
        let rate = (parseFloat(cpRate.value) || 0) / 100;
        let years = parseInt(cpYears.value) || 10;
        
        cpYearsLabel.textContent = `${years} 年`;

        let chartLabels = [];
        let chartDataPrincipal = [];
        let chartDataInterest = [];
        
        let currentPrincipal = principal;
        let totalInvested = principal;
        let totalInterest = 0;

        for (let i = 1; i <= years; i++) {
            chartLabels.push(`第 ${i} 年`);
            
            let interestThisYear = currentPrincipal * rate;
            totalInterest += interestThisYear;
            currentPrincipal += interestThisYear;
            
            currentPrincipal += annualAdd;
            totalInvested += annualAdd;

            chartDataPrincipal.push(totalInvested);
            chartDataInterest.push(totalInterest);
        }

        cpFinalValue.textContent = formatCurrency(currentPrincipal);
        cpTotalInvested.textContent = formatCurrency(totalInvested);
        cpTotalInterest.textContent = formatCurrency(totalInterest);

        if (compoundChartInstance) {
            compoundChartInstance.data.labels = chartLabels;
            compoundChartInstance.data.datasets[0].data = chartDataPrincipal;
            compoundChartInstance.data.datasets[1].data = chartDataInterest;
            compoundChartInstance.update();
        }
    }

    openCompoundBtn.addEventListener('click', () => {
        // Fetch strictly stock market value from inventory
        let totalMarketVal = 0;
        inventory.forEach(item => {
            if (item.currentPrice > 0) {
                let fee = Math.max(Math.floor(item.currentPrice * item.shares * FEE_RATE * item.discountMultiplier), item.minFee);
                let tax = Math.floor(item.currentPrice * item.shares * item.taxRate);
                totalMarketVal += Math.floor(item.currentPrice * item.shares) - fee - tax;
            } else {
                totalMarketVal += item.totalCost; // Fallback to cost if no price
            }
        });
        
        cpPrincipal.value = Math.floor(totalMarketVal);
        compoundModal.classList.add('active');
        initChart();
        calculateCompound();
    });

    closeModalBtn.addEventListener('click', () => {
        compoundModal.classList.remove('active');
    });

    [cpPrincipal, cpAnnualAdd, cpRate, cpYears].forEach(input => {
        input.addEventListener('input', calculateCompound);
    });

    // Initialize Setup
    addInventoryBtn.addEventListener('click', addToInventory);
    addShortTermBtn.addEventListener('click', addToShortTermInventory);
    refreshPricesBtn.addEventListener('click', refreshPrices);
    
    let isShortTermView = false;
    toggleViewBtn.addEventListener('click', () => {
        isShortTermView = !isShortTermView;
        if (isShortTermView) {
            longTermView.style.display = 'none';
            shortTermView.style.display = 'flex';
            toggleViewBtn.textContent = '⇄ 切換至長期庫存';
            toggleViewBtn.style.color = '#93c5fd';
            toggleViewBtn.style.background = 'rgba(59, 130, 246, 0.2)';
            toggleViewBtn.style.borderColor = 'rgba(59, 130, 246, 0.5)';
        } else {
            longTermView.style.display = 'flex';
            shortTermView.style.display = 'none';
            toggleViewBtn.textContent = '⇄ 切換至短期操作';
            toggleViewBtn.style.color = '#c4b5fd';
            toggleViewBtn.style.background = 'rgba(139, 92, 246, 0.2)';
            toggleViewBtn.style.borderColor = 'rgba(139, 92, 246, 0.5)';
        }
    });

    if (shortTermCapitalInput) {
        shortTermCapitalInput.addEventListener('change', (e) => {
            recordState();
            localStorage.setItem('twStockShortTermCapital', e.target.value);
            renderShortTermInventory();
        });
    }

    if (stRealizedInput) {
        stRealizedInput.addEventListener('change', (e) => {
            recordState();
            localStorage.setItem('twStockShortTermRealized', e.target.value);
            updateInputColor(stRealizedInput);
            renderShortTermInventory();
        });
    }

    if (cashInputEl) {
        cashInputEl.addEventListener('change', (e) => {
            recordState();
            localStorage.setItem('twStockCash', e.target.value);
            renderInventory();
        });
    }

    if (yearlyRealizedInputEl) {
        yearlyRealizedInputEl.addEventListener('change', (e) => {
            recordState();
            localStorage.setItem('twStockYearlyRealized', e.target.value);
            updateInputColor(yearlyRealizedInputEl);
        });
    }

    if (totalRealizedInputEl) {
        totalRealizedInputEl.addEventListener('change', (e) => {
            recordState();
            localStorage.setItem('twStockTotalRealized', e.target.value);
            updateInputColor(totalRealizedInputEl);
        });
    }
    
    // --- Daily Stats Logic ---
    async function logDailyStats() {
        const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const dateStr = `${y}.${m}.${d}`;

        // ── 1. 取得台積電現價（優先用庫存已更新的值）──────────────────
        let tsmcPrice = 0;
        const tsmcItem = inventory.find(i => i.code.trim().startsWith('2330'))
                      || shortTermInventory.find(i => i.code.trim().startsWith('2330'));
        if (tsmcItem && tsmcItem.currentPrice) {
            tsmcPrice = tsmcItem.currentPrice;
        } else {
            try {
                const twseRes = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');
                if (twseRes.ok) {
                    const twseData = await twseRes.json();
                    const target = twseData.find(x => x.Code === '2330');
                    if (target && target.ClosingPrice) {
                        tsmcPrice = window.parseFloat(String(target.ClosingPrice).replace(/,/g, ''));
                    }
                }
            } catch(e) {}
        }

        // ── 2. 直接從庫存物件重新計算（不依賴 DOM 文字）────────────────
        //      這樣即使股價更新後 DOM 尚未刷新，也能拿到最新數字
        let totalCostV = 0;
        let totalMarketV = 0;
        inventory.forEach(item => {
            totalCostV += item.totalCost || 0;
            if (item.currentPrice > 0) {
                const fee  = Math.max(Math.floor(item.currentPrice * item.shares * FEE_RATE * item.discountMultiplier), item.minFee);
                const tax  = Math.floor(item.currentPrice * item.shares * item.taxRate);
                const rev  = Math.floor(item.currentPrice * item.shares) - fee - tax;
                totalMarketV += rev;
            } else {
                totalMarketV += item.totalCost || 0;   // 無現價時以成本代替
            }
        });
        const cashBalance  = window.parseFloat(document.getElementById('cashInput')?.value || '0') || 0;
        const totalProfitV = totalMarketV - totalCostV;
        const totalAssetV  = totalMarketV + cashBalance;

        // ── 3. 組成當日快照 ──────────────────────────────────────────────
        const currentStat = {
            date:        dateStr,
            tsmcPrice:   tsmcPrice,
            totalCost:   totalCostV,
            totalMarket: totalMarketV,
            totalProfit: totalProfitV,
            totalAsset:  totalAssetV,
            profitDiff:  0
        };

        // ── 4. 計算與前一筆的損益增減 ────────────────────────────────────
        const exIdx = dailyStats.findIndex(s => s.date === dateStr);
        let prevProfit = 0;
        if (exIdx > 0) {
            prevProfit = dailyStats[exIdx - 1].totalProfit || 0;
        } else if (exIdx === -1 && dailyStats.length > 0) {
            prevProfit = dailyStats[dailyStats.length - 1].totalProfit || 0;
        }
        currentStat.profitDiff = currentStat.totalProfit - prevProfit;

        // ── 5. 寫入（同一天覆蓋舊紀錄，不同天新增）──────────────────────
        if (exIdx >= 0) {
            dailyStats[exIdx] = currentStat;
        } else {
            dailyStats.push(currentStat);
        }

        localStorage.setItem('twStockDailyStats', JSON.stringify(dailyStats));
        if (historyModal && historyModal.classList.contains('active')) renderHistoryTable();
    }

    function renderHistoryTable() {
        if (!historyTableBody) return;
        historyTableBody.innerHTML = '';

        // Helper: recalculate profitDiff for all rows after edit
        function recalcDiffs() {
            for (let i = 0; i < dailyStats.length; i++) {
                const prev = i > 0 ? (dailyStats[i-1].totalProfit || 0) : 0;
                dailyStats[i].profitDiff = (dailyStats[i].totalProfit || 0) - prev;
            }
            localStorage.setItem('twStockDailyStats', JSON.stringify(dailyStats));
        }

        // Helper: make an editable number cell
        function makeEditCell(statIdx, field, value, colorFn, isMoney, decimals) {
            const td = document.createElement('td');
            td.style.cssText = 'padding:4px 6px; text-align:right;';

            const display = document.createElement('span');
            const numVal = window.parseFloat(value) || 0;
            display.textContent = isMoney ? formatCurrency(numVal, decimals) : String(numVal);
            if (colorFn) display.style.color = colorFn(numVal);
            display.style.cssText += 'cursor:pointer; border-bottom:1px dashed rgba(255,255,255,0.2); padding:6px 8px; display:inline-block; min-width:70px; border-radius:4px; transition:background 0.15s;';
            display.title = '點擊編輯';
            display.onmouseover = () => { display.style.background = 'rgba(255,255,255,0.07)'; };
            display.onmouseleave = () => { display.style.background = ''; };

            const input = document.createElement('input');
            input.type = 'text';
            input.inputMode = 'decimal';
            input.value = String(numVal);
            input.style.cssText = 'display:none; background:rgba(59,130,246,0.2); border:1px solid #3b82f6; border-radius:6px; color:#f8fafc; font-size:13px; font-weight:600; font-family:inherit; padding:5px 8px; width:90px; text-align:right; outline:none;';

            function startEdit() {
                display.style.display = 'none';
                input.style.display = 'inline-block';
                input.value = String(window.parseFloat(value) || 0);
                input.select();
                input.focus();
            }
            function commitEdit() {
                const newVal = window.parseFloat(input.value) || 0;
                dailyStats[statIdx][field] = newVal;
                // Auto-recalculate derived fields
                if (field === 'totalMarket' || field === 'totalCost') {
                    dailyStats[statIdx].totalProfit = (dailyStats[statIdx].totalMarket || 0) - (dailyStats[statIdx].totalCost || 0);
                }
                recalcDiffs();
                input.style.display = 'none';
                display.style.display = 'inline-block';
                renderHistoryTable(); // re-render to reflect all changes
            }

            display.onclick = startEdit;
            input.onblur = commitEdit;
            input.onkeydown = (e) => { if (e.key === 'Enter') { input.blur(); } if (e.key === 'Escape') { input.style.display='none'; display.style.display='inline-block'; } };

            td.appendChild(display);
            td.appendChild(input);
            return td;
        }

        const reversed = [...dailyStats].map((s,i) => ({...s, _origIdx: i})).reverse();

        reversed.forEach(stat => {
            const origIdx = stat._origIdx;
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
            tr.onmouseover  = () => { tr.style.background = 'rgba(255,255,255,0.03)'; };
            tr.onmouseleave = () => { tr.style.background = ''; };

            // 日期欄（可編輯）
            const dateTd = document.createElement('td');
            dateTd.style.cssText = 'padding:4px 6px; text-align:left;';
            const dateSpan = document.createElement('span');
            dateSpan.textContent = stat.date;
            dateSpan.style.cssText = 'cursor:pointer; border-bottom:1px dashed rgba(255,255,255,0.2); padding:6px 8px; display:inline-block; color:#f8fafc; border-radius:4px; font-size:13px; white-space:nowrap;';
            dateSpan.title = '點擊編輯日期';
            const dateInp = document.createElement('input');
            dateInp.type = 'text'; dateInp.value = stat.date;
            dateInp.style.cssText = 'display:none; background:rgba(59,130,246,0.2); border:1px solid #3b82f6; border-radius:6px; color:#f8fafc; font-size:13px; font-family:inherit; padding:5px 8px; width:100px; outline:none;';
            dateSpan.onclick = () => { dateSpan.style.display='none'; dateInp.style.display='inline-block'; dateInp.select(); dateInp.focus(); };
            dateInp.onblur  = () => { dailyStats[origIdx].date = dateInp.value; localStorage.setItem('twStockDailyStats', JSON.stringify(dailyStats)); dateInp.style.display='none'; dateSpan.style.display='inline-block'; renderHistoryTable(); };
            dateInp.onkeydown = (e) => { if(e.key==='Enter') dateInp.blur(); if(e.key==='Escape'){dateInp.style.display='none';dateSpan.style.display='inline-block';} };
            dateTd.appendChild(dateSpan); dateTd.appendChild(dateInp);
            tr.appendChild(dateTd);

            // 數字欄
            const profitColor = v => v > 0 ? '#f87171' : (v < 0 ? '#4ade80' : 'var(--text-primary)');
            const diffColor   = v => v > 0 ? '#f87171' : (v < 0 ? '#4ade80' : 'var(--text-primary)');
            const blueColor   = () => '#60a5fa';

            tr.appendChild(makeEditCell(origIdx, 'totalCost',   stat.totalCost,   null,        true,  false));
            tr.appendChild(makeEditCell(origIdx, 'totalMarket', stat.totalMarket, null,        true,  false));
            tr.appendChild(makeEditCell(origIdx, 'totalProfit', stat.totalProfit, profitColor, true,  false));
            tr.appendChild(makeEditCell(origIdx, 'profitDiff',  stat.profitDiff,  diffColor,   true,  false));
            tr.appendChild(makeEditCell(origIdx, 'totalAsset',  stat.totalAsset,  blueColor,   true,  false));
            tr.appendChild(makeEditCell(origIdx, 'tsmcPrice',   stat.tsmcPrice,   null,        true,  true));

            // 刪除按鈕欄
            const delTd = document.createElement('td');
            delTd.style.cssText = 'padding:4px 8px; text-align:center;';
            const delBtn = document.createElement('button');
            delBtn.textContent = '✕';
            delBtn.title = '刪除此筆記錄';
            delBtn.style.cssText = 'background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#f87171; border-radius:6px; padding:3px 8px; cursor:pointer; font-size:12px; transition:background 0.15s;';
            delBtn.onmouseover  = () => { delBtn.style.background='rgba(239,68,68,0.3)'; };
            delBtn.onmouseleave = () => { delBtn.style.background='rgba(239,68,68,0.15)'; };
            delBtn.onclick = () => {
                if (confirm(`確定刪除 ${stat.date} 的記錄嗎？`)) {
                    dailyStats.splice(origIdx, 1);
                    recalcDiffs();
                    renderHistoryTable();
                }
            };
            delTd.appendChild(delBtn);
            tr.appendChild(delTd);

            historyTableBody.appendChild(tr);
        });

        if (dailyStats.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="8" style="padding:30px; text-align:center; color:#94a3b8;">尚無歷史統計資料。按「更新股價」或「立即更新」按鈕來記錄今日數據。</td>';
            historyTableBody.appendChild(tr);
        }
    }

    if (openHistoryStatsBtn) {
        openHistoryStatsBtn.addEventListener('click', async () => {
            // 每次開啟都先執行一次快照，確保今日資料是最新的
            await logDailyStats();
            renderHistoryTable();
            historyModal.classList.add('active');
        });
    }

    // 立即快照按鈕
    document.addEventListener('click', async (e) => {
        if (e.target && e.target.id === 'historySnapshotBtn') {
            const btn = e.target;
            btn.textContent = '⏳ 更新中...';
            btn.disabled = true;
            await logDailyStats();
            renderHistoryTable();
            btn.textContent = '✅ 已更新';
            setTimeout(() => { btn.textContent = '🔄 立即更新'; btn.disabled = false; }, 1500);
        }
    });
    if (closeHistoryModalBtn) {
        closeHistoryModalBtn.addEventListener('click', () => {
            historyModal.classList.remove('active');
        });
    }

    function updateDateDisplay() {
        const dateEl = document.getElementById('portfolioDate');
        const clockEl = document.getElementById('portfolioClock');
        
        const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
        
        if (dateEl) {
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const w = weekdays[now.getDay()];
            dateEl.textContent = `${y}.${m}.${d}.${w}`;
        }
        
        if (clockEl) {
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            clockEl.textContent = `${hh}:${mm}:${ss}`;
        }
    }
    setInterval(updateDateDisplay, 1000);

    // --- Accounting Logic ---
    function formatAccDateLabel(d) {
        return `${d.getFullYear()} / ${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function renderAccounting() {
        if (!accTableBody) return;
        
        currentMonthLabel.textContent = formatAccDateLabel(currentAccDate);
        
        const y = currentAccDate.getFullYear();
        const m = currentAccDate.getMonth() + 1; // 1-12
        
        const currentMonthData = accountingData.filter(item => {
            const dateObj = new Date(item.date);
            return dateObj.getFullYear() === y && (dateObj.getMonth() + 1) === m;
        }).sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

        let totalIncome = 0;
        let totalExpense = 0;
        
        let yearlyIncome = 0;
        let yearlyExpense = 0;
        
        accountingData.forEach(item => {
            if (new Date(item.date).getFullYear() === y) {
                if(item.type === 'income') yearlyIncome += item.amount;
                else yearlyExpense += item.amount;
            }
        });

        accTableBody.innerHTML = '';
        if (currentMonthData.length === 0) {
            accEmptyMsg.style.display = 'block';
        } else {
            accEmptyMsg.style.display = 'none';
            currentMonthData.forEach(item => {
                if (item.type === 'income') totalIncome += item.amount;
                else totalExpense += item.amount;
                
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                
                const isIncome = item.type === 'income';
                const amountColor = isIncome ? '#4ade80' : '#f87171'; // Green for Income, Red for Expense
                const amountPrefix = isIncome ? '+' : '-';
                
                tr.innerHTML = `
                    <td style="padding: 12px 10px; color: #f8fafc;">${item.date}</td>
                    <td style="padding: 12px 10px;"><span style="background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px; font-size:12px;">${item.category}</span></td>
                    <td style="padding: 12px 10px; color: var(--text-secondary); max-width:150px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.note}">${item.note}</td>
                    <td style="padding: 12px 10px; text-align: right; color: ${amountColor}; font-weight:bold;">${amountPrefix} ${formatCurrency(item.amount, true)}</td>
                    <td style="padding: 12px 10px; text-align: center;">
                        <button class="delete-btn" data-id="${item.id}" style="background:rgba(239,68,68,0.2); color:#f87171; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" title="刪除">✖</button>
                    </td>
                `;
                accTableBody.appendChild(tr);
            });
        }
        
        accTotalIncomeEl.textContent = formatCurrency(totalIncome);
        accTotalExpenseEl.textContent = formatCurrency(totalExpense);
        
        const balance = totalIncome - totalExpense;
        accBalanceEl.textContent = formatCurrency(balance);
        accBalanceEl.style.color = balance > 0 ? '#4ade80' : (balance < 0 ? '#f87171' : 'var(--text-primary)');

        const accYearlyIncomeEl = document.getElementById('accYearlyIncome');
        const accYearlyExpenseEl = document.getElementById('accYearlyExpense');
        const accYearlyBalanceEl = document.getElementById('accYearlyBalance');
        
        if (accYearlyIncomeEl) accYearlyIncomeEl.textContent = formatCurrency(yearlyIncome);
        if (accYearlyExpenseEl) accYearlyExpenseEl.textContent = formatCurrency(yearlyExpense);
        if (accYearlyBalanceEl) {
            const yBalance = yearlyIncome - yearlyExpense;
            accYearlyBalanceEl.textContent = formatCurrency(yBalance);
            accYearlyBalanceEl.style.color = yBalance > 0 ? '#4ade80' : (yBalance < 0 ? '#f87171' : 'var(--text-primary)');
        }
        
        // Add delete listeners
        accTableBody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = window.parseInt(e.currentTarget.getAttribute('data-id'), 10);
                if (confirm('確定要刪除這筆紀錄嗎？')) {
                    accountingData = accountingData.filter(i => i.id !== id);
                    localStorage.setItem('twStockAccounting', JSON.stringify(accountingData));
                    renderAccounting();
                }
            });
        });
    }

    if (openAccountingBtn) {
        openAccountingBtn.addEventListener('click', () => {
            if (!accDateInput.value) {
                const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                accDateInput.value = `${y}-${m}-${d}`;
            }
            accountingModal.classList.add('active');
            renderAccounting();
        });
    }

    if (accTypeInput && accCategoryInput) {
        accTypeInput.addEventListener('change', (e) => {
            const isInc = e.target.value === 'income';
            const arr = isInc ? ['利息','薪資','投資','其他'] : ['餐飲','交通','居住','娛樂','購物','生活','保險','衣物','聚餐','其他'];
            accCategoryInput.innerHTML = arr.map(c => `<option value="${c}">${c}</option>`).join('');
        });
    }

    if (closeAccountingBtn) {
        closeAccountingBtn.addEventListener('click', () => {
            accountingModal.classList.remove('active');
        });
    }

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => {
            currentAccDate.setMonth(currentAccDate.getMonth() - 1);
            renderAccounting();
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => {
            currentAccDate.setMonth(currentAccDate.getMonth() + 1);
            renderAccounting();
        });
    }

    if (addAccBtn) {
        addAccBtn.addEventListener('click', () => {
            const type = accTypeInput.value;
            const date = accDateInput.value;
            const category = accCategoryInput.value;
            const amountStr = accAmountInput.value || '0';
            const amount = window.parseFloat(amountStr);
            const note = accNoteInput.value.trim();

            if (!date) {
                alert('請選擇日期');
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                alert('請輸入大於零的有效金額');
                return;
            }

            const newRecord = {
                id: Date.now(),
                type,
                date,
                category,
                amount,
                note
            };

            accountingData.push(newRecord);
            localStorage.setItem('twStockAccounting', JSON.stringify(accountingData));
            
            // Adjust current month to newly added record's month visually
            currentAccDate = new Date(date);
            
            accAmountInput.value = '';
            accAmountInput.dispatchEvent(new Event('blur')); 
            accNoteInput.value = '';
            
            renderAccounting();
        });
    }

    // --- Blood Pressure Module ---
    const bpModal = document.getElementById('bpModal');
    const openBPBtn = document.getElementById('openBPBtn');
    const closeBPModalBtn = document.getElementById('closeBPModalBtn');
    const addBPBtn = document.getElementById('addBPBtn');
    const bpDate = document.getElementById('bpDate');
    const bpTime = document.getElementById('bpTime');
    const bpSys = document.getElementById('bpSys');
    const bpDia = document.getElementById('bpDia');
    const bpPulse = document.getElementById('bpPulse');
    const bpTableBody = document.getElementById('bpTableBody');
    
    let bpData = [];
    const savedBP = localStorage.getItem('twStockBP');
    if (savedBP) bpData = JSON.parse(savedBP);

    if (openBPBtn) {
        openBPBtn.addEventListener('click', () => {
            try {
                if(bpModal) bpModal.classList.add('active');
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                
                if(bpDate) bpDate.value = `${year}-${month}-${day}`;
                if(bpTime) bpTime.value = `${hours}:${minutes}`;
                if(bpSys) bpSys.value = '';
                if(bpDia) bpDia.value = '';
                if(bpPulse) bpPulse.value = '';
                
                renderBP();
            } catch (e) {
                console.error("BP Modal Error", e);
            }
        });
    }

    if (closeBPModalBtn) {
        closeBPModalBtn.addEventListener('click', () => {
            try {
                if(bpModal) bpModal.classList.remove('active');
            } catch(e){}
        });
    }

    if (bpTableBody) {
        bpTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-bp-btn')) {
                const id = e.target.getAttribute('data-id');
                bpData = bpData.filter(item => item.id !== parseInt(id));
                localStorage.setItem('twStockBP', JSON.stringify(bpData));
                renderBP();
            }
        });
    }

    if (addBPBtn) {
        addBPBtn.addEventListener('click', () => {
            try {
                const date = bpDate.value;
                const time = bpTime.value;
                const sys = parseInt(bpSys.value);
                const dia = parseInt(bpDia.value);
                const pulse = parseInt(bpPulse.value);

                if (!date || !time || isNaN(sys) || isNaN(dia) || isNaN(pulse)) {
                    alert('請完整填寫日期、時間、收縮壓、舒張壓與脈搏');
                    return;
                }

                const record = { id: Date.now(), date, time, sys, dia, pulse };
                bpData.push(record);
                bpData.sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));
                localStorage.setItem('twStockBP', JSON.stringify(bpData));
                
                bpSys.value = '';
                bpDia.value = '';
                bpPulse.value = '';
                renderBP();
            } catch(e) { console.error('Add BP Error', e); }
        });
    }

    function renderBP() {
        try {
            if (!bpTableBody) return;
            bpTableBody.innerHTML = '';
            
            bpData.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                const bpColor = item.sys >= 130 || item.dia >= 85 ? '#fca5a5' : '#86efac';
                tr.innerHTML = `
                    <td style="padding:8px;">${item.date} ${item.time}</td>
                    <td style="padding:8px; color:${bpColor}; font-weight:bold;">${item.sys} / ${item.dia}</td>
                    <td style="padding:8px;">${item.pulse}</td>
                    <td style="padding:8px;">
                        <button class="delete-bp-btn" data-id="${item.id}" style="background:rgba(239, 68, 68, 0.2); color:#fca5a5; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">刪除</button>
                    </td>
                `;
                bpTableBody.appendChild(tr);
            });

            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            
            let daily = { sys:0, dia:0, count:0 };
            let weekly = { sys:0, dia:0, count:0 };
            let monthly = { sys:0, dia:0, count:0 };
            let total = { sys:0, dia:0, count:0 };

            bpData.forEach(item => {
                const itemDate = new Date(`${item.date}T00:00:00`);
                const todayDate = new Date(`${todayStr}T00:00:00`);
                let diffDays = (todayDate - itemDate) / (24 * 60 * 60 * 1000);
                if (isNaN(diffDays)) return;
                
                total.sys += item.sys;
                total.dia += item.dia;
                total.count++;

                if (item.date === todayStr) {
                    daily.sys += item.sys;
                    daily.dia += item.dia;
                    daily.count++;
                }
                if (diffDays <= 7 && diffDays >= 0) {
                    weekly.sys += item.sys;
                    weekly.dia += item.dia;
                    weekly.count++;
                }
                if (diffDays <= 30 && diffDays >= 0) {
                    monthly.sys += item.sys;
                    monthly.dia += item.dia;
                    monthly.count++;
                }
            });

            const fmt = (stat) => stat.count > 0 ? `${Math.round(stat.sys/stat.count)} / ${Math.round(stat.dia/stat.count)}` : '-- / --';
            
            const sd = document.getElementById('bpStatDaily');
            const sw = document.getElementById('bpStatWeekly');
            const sm = document.getElementById('bpStatMonthly');
            const sa = document.getElementById('bpStatAll');
            
            if (sd) sd.textContent = fmt(daily);
            if (sw) sw.textContent = fmt(weekly);
            if (sm) sm.textContent = fmt(monthly);
            if (sa) sa.textContent = fmt(total);
        } catch(e) {
            console.error('Render BP Error', e);
        }
    }

    // --- English Reading Articles Database ---
    const ARTICLES_DB = {
        'A1': [
            { title: "My Daily Routine", text: "I wake up at seven o'clock every day. I eat breakfast with my family. First, I drink some milk and eat toast. Then, I brush my teeth and wash my face. I go to school by bus. My first class is English. I like English because my teacher is nice. At noon, I eat lunch with my friends in the cafeteria. We talk and laugh. After school, I do my homework. In the evening, I watch TV with my parents. Finally, I go to bed at ten o'clock." },
            { title: "My Favorite Pet", text: "I have a small dog named Max. Max is brown and white. He loves to run and play in the park. Every afternoon, we go for a walk together. Max is very friendly and likes everyone. He plays with a red ball. When he is tired, he sleeps on his blue bed. I give him food and fresh water every day. Taking care of a pet is fun but also hard work. I love my dog very much." },
            { title: "A Trip to the Supermarket", text: "Today is Saturday. I go to the supermarket with my mother. We need to buy food for the week. First, we buy some fruits: apples, bananas, and oranges. Then, we go to the bakery section to buy fresh bread. Next, we find milk and cheese. My mother asks me to get some eggs. Finally, we buy some chocolate for dessert. We pay for our items at the cashier. The cashier says 'Thank you.' We carry the heavy bags home." }
        ],
        'A2': [
            { title: "A Weekend in the City", text: "Last weekend, my family and I decided to visit the city. We took the train early in the morning because driving takes too long. When we arrived, the streets were already busy with people. We visited a famous museum first. There were many beautiful paintings and old statues to see. After the museum, we felt hungry, so we ate lunch at a popular Italian restaurant. The pizza was delicious! In the afternoon, we walked around the park and took many photos. It was a tiring but fantastic day." },
            { title: "Learning to Cook", text: "During the summer holiday, I decided to learn how to cook. My grandmother is a great cook, so I asked her to teach me. Our first recipe was a simple vegetable soup. She showed me how to wash and cut the carrots, potatoes, and onions carefully. Then we put everything in a big pot with some water and salt. While the soup was cooking, we baked some bread. The kitchen smelled wonderful. When we finally ate dinner, I felt very proud. Cooking is not as difficult as I thought." },
            { title: "My Dream Holiday", text: "If I could travel anywhere in the world, I would go to Japan. I have always wanted to see the beautiful cherry blossoms in spring. I would love to visit Tokyo because it is a famous, modern city with tall buildings and clean streets. I also want to try authentic Japanese food like sushi and ramen. Another place I want to see is Mount Fuji. I heard it looks beautiful when covered in snow. I hope I can save enough money to make this dream trip happen next year." }
        ],
        'B1': [
            { title: "The Importance of Recycling", text: "Protecting our environment has become one of the most important issues today. One simple way everyone can help is by recycling. When we throw away plastic bottles, glass jars, and paper, they end up in large landfills where they harm the earth. By putting these materials into recycling bins, they can be processed and turned into new products. This saves valuable natural resources and reduces the amount of energy needed for manufacturing. Furthermore, recycling helps to decrease pollution in our oceans. Many cities now have programs that make recycling easy for residents. If every individual makes a small effort to recycle daily, we can significantly reduce the negative impact on our planet. It is not just a choice; it is our responsibility to take care of the environment for future generations." },
            { title: "Working from Home", text: "In recent years, working from home has become incredibly common for many employees around the world. Thanks to modern technology like fast internet and video conferencing software, people can communicate with their teams just as effectively from their living rooms as they can from a traditional office. There are several clear advantages to this setup. Commuting time is eliminated, which saves money and reduces stress. Additionally, workers often find they have a better work-life balance since their schedules can be more flexible. However, remote work also presents certain challenges. For instance, some people struggle to separate their professional and personal lives when their home becomes their workplace. It can also be difficult to stay motivated without the physical presence of colleagues. Despite these drawbacks, many companies are permanently adopting hybrid models, allowing staff to enjoy the best of both worlds." },
            { title: "A Memorable Journey", text: "Traveling allows us to discover new cultures and step out of our comfort zones. A few years ago, my friends and I went on a backpacking trip across Southeast Asia, which turned out to be the most memorable journey of my life. During the trip, we explored ancient temples nestled in lush green jungles and relaxed on breathtaking white-sand beaches. One of the highlights was visiting local markets, where we tasted exotic street food that was both spicy and delicious. We also met fellow travelers from all over the globe, exchanging stories and travel tips late into the night. While we faced some challenges, such as getting lost in unfamiliar cities and dealing with language barriers, these moments eventually became hilarious memories. The trip taught me how to be adaptable and appreciative of the diverse ways people live around the world." }
        ],
        'B2': [
            { title: "The Impact of Artificial Intelligence", text: "Artificial Intelligence (AI) is rapidly transforming various aspects of modern society, fundamentally altering how we live and work. From autonomous vehicles to intelligent virtual assistants, AI technologies are becoming ubiquitous. In the healthcare sector, machine learning algorithms can analyze vast amounts of medical data to assist doctors in diagnosing diseases more accurately and at earlier stages. Furthermore, AI-driven automation is streamlining manufacturing processes, increasing efficiency and significantly reducing human error. \n\nDespite its undeniable benefits, the widespread adoption of AI also raises profound concerns. One major issue is the potential displacement of workers as automated systems begin to perform tasks traditionally done by humans. There are also ethical dilemmas regarding data privacy and the inherent biases present in some algorithms. Consequently, it is imperative for governments and technology companies to collaborate on establishing robust regulations. We must ensure that AI development is guided by ethical principles so that its integration into society brings sustainable and equitable progress for everyone." },
            { title: "Sustainable Urban Development", text: "As the global population continues to surge, the trend of urbanization is accelerating at an unprecedented rate. Millions of people are migrating to cities in search of better employment opportunities and an improved standard of living. However, this rapid expansion puts immense pressure on urban infrastructure, leading to severe issues such as traffic congestion, inadequate housing, and alarming levels of air pollution. To combat these challenges, city planners and environmentalists are advocating for sustainable urban development.\n\nThis approach emphasizes the creation of eco-friendly cities where public transportation systems are efficient and heavily prioritized over private vehicles. Planners are also focusing on increasing green spaces, implementing energy-efficient building designs, and utilizing renewable energy sources like solar and wind power. Additionally, developing smart grids and waste management systems is crucial for minimizing a city's carbon footprint. By embracing sustainable practices, metropolitan areas can evolve into healthier, more resilient environments that cater to the needs of their inhabitants without compromising the ecological balance." },
            { title: "The Psychology of Procrastination", text: "Procrastination is a universal phenomenon that plagues almost everyone at some point in their lives. Contrary to popular belief, psychologists assert that procrastination is not merely a consequence of poor time management or sheer laziness; rather, it is a complex issue predominantly related to emotional regulation. When faced with a task that evokes negative feelings such as anxiety, boredom, or self-doubt, individuals often resort to avoidance behaviors to seek temporary emotional relief. \n\nUnfortunately, this short-term coping mechanism typically exacerbates the problem, leading to elevated stress levels as deadlines inevitably approach. The guilt and panic associated with last-minute rushes can severely hinder overall performance and well-being. Overcoming procrastination requires a shift in mindset. Techniques such as breaking formidable projects into manageable, bite-sized tasks can make the workload feel less intimidating. Moreover, cultivating self-compassion instead of harsh self-criticism when one falters can diminish the emotional friction that triggers avoidance in the first place." }
        ],
        'C1': [
            { title: "Navigating the Complexities of Globalization", text: "Globalization, characterized by the unprecedented integration of international markets and the seamless flow of information, has profoundly reshaped the contemporary socioeconomic landscape. On one hand, it has facilitated rapid economic growth by opening up new avenues for trade, fostering technological diffusion, and driving down the costs of consumer goods through optimized global supply chains. Multinational corporations have capitalized on these interconnected networks to achieve unprecedented scales of efficiency. Furthermore, globalization has nurtured cross-cultural dialogue, allowing individuals to appreciate diverse perspectives and fostering a more cosmopolitan worldview.\n\nConversely, the phenomenon has engendered significant structural disparities that cannot be overlooked. Critics argue that globalization disproportionately benefits advanced economies and elite demographics, exacerbating income inequality both within and between nations. The outsourcing of manufacturing jobs to regions with cheaper labor has left many traditional industries in developed countries decimated, leading to widespread socioeconomic disenfranchisement. Additionally, there are mounting concerns regarding the homogenization of culture and the erosion of indigenous traditions. Moving forward, policymakers face the formidable challenge of implementing inclusive frameworks that mitigate the adverse impacts of globalization while harnessing its undeniable potential for collective prosperity." },
            { title: "The Ethical Dilemmas of Gene Editing", text: "The advent of CRISPR-Cas9 and other sophisticated gene-editing technologies has ushered in a revolution in molecular biology, offering unprecedented capabilities to intentionally modify the DNA of living organisms. These advancements hold immense promise for human health; researchers are optimistic about their potential to eradicate debilitating genetic disorders, engineer disease-resistant crops to secure global food supplies, and even combat aggressive forms of cancer through targeted therapies. The precision and relative accessibility of these tools represent a monumental leap toward personalized medicine.\n\nHowever, this extraordinary power is accompanied by profound ethical and philosophical quandaries. The prospect of editing the human germline—modifications that would be inherited by subsequent generations—ignites fierce debates regarding the potential for unforeseen, irreversible ecological and biological consequences. Furthermore, the concept of 'designer babies,' where genetic enhancements could be selected for traits such as intelligence or physical prowess, raises the specter of a new paradigm of societal inequality based on genetic privilege. Consequently, there is an urgent international consensus on the necessity of comprehensive ethical guidelines and rigorous regulatory oversight to navigate this precarious frontier responsibly." },
            { title: "The Evolution of Remote Work Paradigms", text: "The abrupt shift to remote work, initially catalyzed by unprecedented global exigencies, has catalyzed a paradigm shift in the fundamental structure of the modern workplace. Organizations that once rigidly adhered to orthodox, office-centric operations have been compelled to embrace distributed operational models. This transition has undeniably yielded considerable dividends: employees frequently report enhanced autonomy, diminished commuting-induced fatigue, and a recalibrated equilibrium between professional obligations and personal pursuits. Concurrently, enterprises have serendipitously realized substantial reductions in overhead expenditures by downsizing physical real estate portfolios.\n\nNevertheless, this structural evolution is not devoid of substantial detriments. The dissolution of geographical boundaries often blur the demarcation between work and leisure, precipitating insidious phenomena such as digital burnout and chronic hyper-connectivity. The serendipitous, spontaneous interactions that historically catalyzed innovation and fortified corporate culture are difficult to replicate in purely virtual environments. Moreover, managers grapple with the complexities of assessing productivity and ensuring equitable career progression for remote personnel. As corporations navigate the post-pandemic milieu, synthesizing hybrid architectures that seamlessly integrate the flexibility of remote work with the indispensable collaborative synergy of in-person interactions remains an elusive, yet critical, objective." }
        ]
    };

    // --- Web Speech API (Pronunciation Analysis) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let fallbackRecognition = null;
    let globalActiveMicBtn = null;

    if (SpeechRecognition) {
        fallbackRecognition = new SpeechRecognition();
        fallbackRecognition.lang = 'en-US';
        fallbackRecognition.interimResults = true;
        fallbackRecognition.continuous = true;
    }

    function comparePronunciation(targetText, recognizedText) {
        // Normalize: lowercase, remove punctuation except spaces
        const normalize = (str) => str.toLowerCase().replace(/[.,!?;:'"()]/g, '');
        const targetWords = normalize(targetText).split(/\s+/).filter(w => w);
        const recognizedWords = normalize(recognizedText).split(/\s+/).filter(w => w);
        
        let htmlResult = [];
        let correctCount = 0;
        
        // Advanced simple diff
        for (let i = 0; i < targetWords.length; i++) {
            const tw = targetWords[i];
            const originalTw = targetText.split(/[\s.,!?;:'"()]+/).find(orig => normalize(orig) === tw) || tw;
            if (recognizedWords.includes(tw)) {
                htmlResult.push(`<span class="pronounce-correct">${originalTw}</span>`);
                correctCount++;
            } else {
                htmlResult.push(`<span class="pronounce-wrong">${originalTw}</span>`);
            }
        }
        
        const score = targetWords.length === 0 ? 0 : Math.round((correctCount / targetWords.length) * 100);
        return {
            html: htmlResult.join(' '),
            score: score
        };
    }

    function makeTextClickable(text) {
        return text.split(/(\s+)/).map(segment => {
            if (!segment.trim()) return segment; // preserve spaces
            const cleanWord = segment.replace(/[.,!?;:'"()]/g, '');
            return `<span class="clickable-word" data-word="${cleanWord}">${segment}</span>`;
        }).join('');
    }

    // --- English Learning Module (Anki mode) ---
    const englishModal = document.getElementById('englishModal');
    const openEnglishBtn = document.getElementById('openEnglishBtn');
    const closeEnglishBtn = document.getElementById('closeEnglishBtn');
    
    const levelBtns = document.querySelectorAll('.level-btn');
    const wordLoading = document.getElementById('wordLoading');
    const wordContent = document.getElementById('wordContent');
    const flashcardWord = document.getElementById('flashcardWord');
    const flashcardIpa = document.getElementById('flashcardIpa');
    const playAudioBtn = document.getElementById('playAudioBtn');
    const flashcardBack = document.getElementById('flashcardBack');
    const flashcardEngDef = document.getElementById('flashcardEngDef');
    const flashcardChiDef = document.getElementById('flashcardChiDef');
    const flashcardEngEg = document.getElementById('flashcardEngEg');
    const flashcardChiEg = document.getElementById('flashcardChiEg');
    const playEgAudioBtn = document.getElementById('playEgAudioBtn');
    
    const actionFront = document.getElementById('actionFront');
    const actionBack = document.getElementById('actionBack');
    const flipCardBtn = document.getElementById('flipCardBtn');
    const ankiBtns = document.querySelectorAll('.anki-btn');

    const wordFreqStars = document.getElementById('wordFreqStars');
    const flashcardEgsContainer = document.getElementById('flashcardEgsContainer');
    const playChiDefBtn = document.getElementById('playChiDefBtn');

    const englishLevelContainer = document.getElementById('englishLevelContainer');
    const addVocabGroupBtn = document.getElementById('addVocabGroupBtn');
    const dictSearchInput = document.getElementById('dictSearchInput');
    const dictSearchBtn = document.getElementById('dictSearchBtn');
    const dictLoading = document.getElementById('dictLoading');
    const dictResultCard = document.getElementById('dictResultCard');
    const dictWordResult = document.getElementById('dictWordResult');
    const dictIpaResult = document.getElementById('dictIpaResult');
    const dictPlayBtn = document.getElementById('dictPlayBtn');
    const dictFreqResult = document.getElementById('dictFreqResult');
    const dictDefsContainer = document.getElementById('dictDefsContainer');
    const dictEgsContainer = document.getElementById('dictEgsContainer');
    const saveGroupSelect = document.getElementById('saveGroupSelect');
    const saveWordBtn = document.getElementById('saveWordBtn');

    const tabFlashcardBtn = document.getElementById('tabFlashcardBtn');
    const tabArticleBtn = document.getElementById('tabArticleBtn');
    const flashcardSection = document.getElementById('flashcardSection');
    const articleSection = document.getElementById('articleSection');
    const articleLevelSelect = document.getElementById('articleLevelSelect');
    const refreshArticleBtn = document.getElementById('refreshArticleBtn');
    const articleTitle = document.getElementById('articleTitle');
    const articleContent = document.getElementById('articleContent');
    const recordArticleBtn = document.getElementById('recordArticleBtn');
    const articleScorePanel = document.getElementById('articleScorePanel');
    const articleScoreVal = document.getElementById('articleScoreVal');
    const articleRecordResult = document.getElementById('articleRecordResult');
    const articleRecordStatus = document.getElementById('articleRecordStatus');

    // Setup Shadowing Function
    function setupShadowing(btnElement, targetText, resultContainer, onStart, onEnd) {
        if (!fallbackRecognition) {
            alert("您的瀏覽器不支援 Web Speech API。請使用最新版 Chrome 或 Edge。");
            return;
        }

        btnElement.addEventListener('click', (e) => {
            e.stopPropagation();
            if (globalActiveMicBtn === btnElement) {
                fallbackRecognition.stop();
                return;
            } else if (globalActiveMicBtn) {
                fallbackRecognition.stop();
            }

            globalActiveMicBtn = btnElement;
            const originalHTML = btnElement.innerHTML;
            btnElement.dataset.originalHtml = originalHTML;
            btnElement.innerHTML = '🛑 點擊停止..';
            resultContainer.innerHTML = '<span style="color:#fbbf24">聽取中...</span>';
            resultContainer.style.display = 'block';
            if(onStart) onStart();

            let finalTranscript = '';
            
            fallbackRecognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                const currentText = finalTranscript + ' ' + interimTranscript;
                const { html, score } = comparePronunciation(targetText, currentText);
                resultContainer.innerHTML = html;
                if(articleScorePanel && resultContainer === articleRecordResult) {
                    articleScoreVal.textContent = score;
                }
            };

            fallbackRecognition.onerror = (event) => {
                console.error("Speech recognition error", event.error);
                if (event.error === 'not-allowed') {
                    alert("發音分析需要麥克風權限，請於瀏覽器設定開啟。");
                    resultContainer.innerHTML = '<span style="color:#f87171">麥克風權限未開</span>';
                }
            };

            fallbackRecognition.onend = () => {
                globalActiveMicBtn = null;
                btnElement.innerHTML = btnElement.dataset.originalHtml || '🎤';
                const { html, score } = comparePronunciation(targetText, finalTranscript);
                if(finalTranscript.trim() === '') {
                    resultContainer.innerHTML = '<span style="color:#94a3b8">無語音輸入</span>';
                } else {
                    resultContainer.innerHTML = html;
                    if(onEnd) onEnd(score);
                }
            };

            try {
                fallbackRecognition.start();
            } catch(err) {
                fallbackRecognition.stop();
            }
        });
    }

    // --- Tab Switching & Article Logic ---
    if(tabFlashcardBtn) {
        tabFlashcardBtn.addEventListener('click', () => {
            tabFlashcardBtn.classList.replace('secondary-btn', 'primary-btn');
            tabArticleBtn.classList.replace('primary-btn', 'secondary-btn');
            flashcardSection.style.display = 'flex';
            articleSection.style.display = 'none';
        });

        tabArticleBtn.addEventListener('click', () => {
            tabArticleBtn.classList.replace('secondary-btn', 'primary-btn');
            tabFlashcardBtn.classList.replace('primary-btn', 'secondary-btn');
            flashcardSection.style.display = 'none';
            articleSection.style.display = 'flex';
            if (!articleTitle.dataset.loaded) {
                renderRandomArticle(articleLevelSelect.value);
                articleTitle.dataset.loaded = 'true';
            }
        });

        articleLevelSelect.addEventListener('change', () => {
            renderRandomArticle(articleLevelSelect.value);
        });

        refreshArticleBtn.addEventListener('click', () => {
            renderRandomArticle(articleLevelSelect.value);
        });
    }

    function renderRandomArticle(level) {
        if(globalActiveMicBtn) fallbackRecognition.stop();
        
        const list = ARTICLES_DB[level] || ARTICLES_DB['A1'];
        const randomItem = list[Math.floor(Math.random() * list.length)];
        articleTitle.textContent = `[${level}] ${randomItem.title}`;
        articleContent.innerHTML = makeTextClickable(randomItem.text);
        
        articleScorePanel.style.display = 'none';
        articleRecordResult.innerHTML = '';
        articleScoreVal.textContent = '0';

        articleContent.querySelectorAll('.clickable-word').forEach(span => {
            span.addEventListener('click', (e) => {
                const word = e.currentTarget.getAttribute('data-word');
                dictSearchInput.value = word;
                dictSearchBtn.click();
                if(tabFlashcardBtn) tabFlashcardBtn.click();
            });
        });

        // Rebind record btn
        const oldBtn = recordArticleBtn.cloneNode(true);
        recordArticleBtn.parentNode.replaceChild(oldBtn, recordArticleBtn);
        // Note: recordArticleBtn reference needs to be updated but since we cloned we use oldBtn
        setupShadowing(oldBtn, randomItem.text, articleRecordResult, () => {
            articleScorePanel.style.display = 'block';
        }, (score) => {
            articleScoreVal.textContent = score;
        });
    }


    // Dynamic Seed Vocabulary (will self-expand via Datamuse when exhausted)
    let vocabDb = {
        A1: ['apple', 'book', 'cat', 'dog', 'eat', 'family', 'good', 'happy', 'idea', 'job', 'kind', 'love', 'money', 'name', 'open', 'person', 'question', 'read', 'school', 'time', 'water', 'year', 'friend', 'home', 'work', 'child', 'word', 'life', 'start', 'play'],
        A2: ['accept', 'budget', 'camera', 'danger', 'effort', 'factor', 'garden', 'health', 'incident', 'jacket', 'kidney', 'leader', 'market', 'nature', 'office', 'parent', 'quality', 'reason', 'season', 'target', 'useful', 'victim', 'weight', 'yellow', 'animal', 'behind', 'chance', 'detail', 'energy', 'future'],
        B1: ['achieve', 'advantage', 'brain', 'character', 'damage', 'effect', 'factory', 'gather', 'habit', 'ignore', 'journey', 'knowledge', 'language', 'machine', 'narrow', 'object', 'package', 'quality', 'rapid', 'salary', 'balance', 'comfort', 'deliver', 'educate', 'feature', 'general', 'history', 'improve'],
        B2: ['adequate', 'beneficial', 'campaign', 'decade', 'eliminate', 'foster', 'genuine', 'hypothesis', 'implement', 'justify', 'keen', 'legislation', 'maintain', 'negotiate', 'obligation', 'perspective', 'quote', 'relevant', 'subsequent', 'tackle', 'absolute', 'barrier', 'category', 'demonstrate', 'evaluate'],
        C1: ['ambiguous', 'bureaucracy', 'coherent', 'deteriorate', 'eloquent', 'fluctuate', 'hierarchy', 'inevitable', 'jeopardize', 'lucrative', 'meticulous', 'notorious', 'obsolete', 'paradigm', 'quirk', 'resilient', 'scrutiny', 'tangible', 'ubiquitous', 'vulnerable', 'abstract', 'bias', 'consensus', 'dilemma', 'explicit'],
        C2: ['anomaly', 'belligerent', 'capricious', 'dichotomy', 'ephemeral', 'fastidious', 'gregarious', 'harangue', 'iconoclast', 'juxtapose', 'kudos', 'lethargic', 'mellifluous', 'nefarious', 'obfuscate', 'panacea', 'quixotic', 'recalcitrant', 'sycophant', 'trepidation', 'alleviate', 'cacophony', 'didactic', 'esoteric', 'facetious']
    };

    const savedVocab = localStorage.getItem('twStockVocab');
    if (savedVocab) { 
        try { vocabDb = JSON.parse(savedVocab); } catch(e){}
    }

    let ankiDb = {};
    const savedAnki = localStorage.getItem('twStockAnki');
    if (savedAnki) {
        try { ankiDb = JSON.parse(savedAnki); } catch(e){}
    }

    let customGroups = { '⭐ 我的最愛': [] };
    const savedCustomGroups = localStorage.getItem('twStockCustomGroups');
    if (savedCustomGroups) {
        try { customGroups = JSON.parse(savedCustomGroups); } catch(e){}
    }

    let currentLevel = 'B1';
    let currentWord = '';
    let currentAudioUrl = null;
    let currentEngDefText = null;
    let currentEgTexts = [];

    function renderLevelButtons() {
        if (!englishLevelContainer) return;
        englishLevelContainer.innerHTML = '';
        
        const standardLevels = [
            { id: 'A1', name: 'A1 初級' },
            { id: 'A2', name: 'A2 初中級' },
            { id: 'B1', name: 'B1 中級' },
            { id: 'B2', name: 'B2 中高級' },
            { id: 'C1', name: 'C1 高級' },
            { id: 'C2', name: 'C2 雙語' }
        ];

        standardLevels.forEach(lvl => {
            const btn = document.createElement('button');
            btn.className = `level-btn ${currentLevel === lvl.id ? 'active' : ''}`;
            btn.textContent = lvl.name;
            btn.setAttribute('data-level', lvl.id);
            englishLevelContainer.appendChild(btn);
        });

        // 綁定自訂群組到 vocabDb，同時產生按鈕
        Object.keys(customGroups).forEach(groupName => {
            const btn = document.createElement('button');
            btn.className = `level-btn custom-group ${currentLevel === groupName ? 'active' : ''}`;
            
            if (groupName !== '⭐ 我的最愛') {
                btn.innerHTML = `${groupName} (${customGroups[groupName].length}) <span class="delete-grp-btn" style="color:#ef4444; margin-left:4px; font-weight:bold;">×</span>`;
            } else {
                btn.textContent = `${groupName} (${customGroups[groupName].length})`;
            }

            btn.setAttribute('data-level', groupName);
            btn.style.borderColor = currentLevel === groupName ? '#3b82f6' : 'rgba(245, 158, 11, 0.4)';
            btn.style.color = currentLevel === groupName ? '#fff' : '#fcd34d';
            englishLevelContainer.appendChild(btn);

            vocabDb[groupName] = customGroups[groupName];
        });

        // 重新綁定事件
        englishLevelContainer.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(e.target.classList.contains('delete-grp-btn')) return;
                currentLevel = e.currentTarget.getAttribute('data-level');
                renderLevelButtons();
                
                if (customGroups[currentLevel] && customGroups[currentLevel].length === 0) {
                    alert('此群組目前沒有單字，請先透過搜尋查單字並點擊「收藏」加入！');
                    wordLoading.style.display = 'none';
                    wordContent.style.display = 'none';
                    return;
                }
                loadNextWord();
            });
        });

        englishLevelContainer.querySelectorAll('.delete-grp-btn').forEach(delBtn => {
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const btnOwner = e.target.closest('button');
                const btnGroupName = btnOwner.getAttribute('data-level');
                if (confirm(`確定要刪除自訂群組 [${btnGroupName}] 嗎？`)) {
                    delete customGroups[btnGroupName];
                    localStorage.setItem('twStockCustomGroups', JSON.stringify(customGroups));
                    if (currentLevel === btnGroupName) currentLevel = 'B1';
                    renderLevelButtons();
                    loadNextWord();
                }
            });
        });

        if (saveGroupSelect) {
            const currentVal = saveGroupSelect.value;
            saveGroupSelect.innerHTML = '';
            Object.keys(customGroups).forEach(groupName => {
                const opt = document.createElement('option');
                opt.value = groupName;
                opt.textContent = groupName;
                saveGroupSelect.appendChild(opt);
            });
            if (currentVal && customGroups[currentVal]) saveGroupSelect.value = currentVal;
        }
    }

    if (openEnglishBtn) {
        openEnglishBtn.addEventListener('click', () => {
            if(englishModal) englishModal.classList.add('active');
            renderLevelButtons();
            loadNextWord();
        });
    }

    if (closeEnglishBtn) {
        closeEnglishBtn.addEventListener('click', () => {
            if(englishModal) englishModal.classList.remove('active');
        });
    }

    if (addVocabGroupBtn) {
        addVocabGroupBtn.addEventListener('click', () => {
            const groupName = prompt('請輸入新單字群組的名稱 (例如: 商用字彙)');
            if (!groupName || groupName.trim() === '') return;
            const gn = groupName.trim();
            if (customGroups[gn]) {
                alert('該群組名稱已經存在了！'); return;
            }
            customGroups[gn] = [];
            localStorage.setItem('twStockCustomGroups', JSON.stringify(customGroups));
            renderLevelButtons();
        });
    }

    if (saveWordBtn) {
        saveWordBtn.addEventListener('click', () => {
            const targetGroup = saveGroupSelect.value;
            if (!targetGroup) return;
            if (!customGroups[targetGroup]) customGroups[targetGroup] = [];
            
            if (customGroups[targetGroup].includes(currentWord)) {
                customGroups[targetGroup] = customGroups[targetGroup].filter(w => w !== currentWord);
                localStorage.setItem('twStockCustomGroups', JSON.stringify(customGroups));
                saveWordBtn.innerHTML = '已取消收藏 ❌';
                setTimeout(() => { saveWordBtn.innerHTML = '⭐ 收藏'; }, 2000);
            } else {
                customGroups[targetGroup].push(currentWord);
                localStorage.setItem('twStockCustomGroups', JSON.stringify(customGroups));
                saveWordBtn.innerHTML = '已收藏 ✔️';
                setTimeout(() => { saveWordBtn.innerHTML = '⭐ 收藏'; }, 2000);
            }
            
            renderLevelButtons();
            
            // Force reload vocabDb binding to make sure the loadNextWord gets the updated custom array
            vocabDb[targetGroup] = customGroups[targetGroup];
        });
    }

    if (dictSearchBtn) {
        dictSearchBtn.addEventListener('click', () => {
            const word = dictSearchInput.value.trim().toLowerCase();
            if(!word) return;
            
            // Show dictionary loading view
            currentWord = word;
            dictResultCard.style.display = 'none';
            dictLoading.style.display = 'block';
            dictDefsContainer.innerHTML = '';
            dictEgsContainer.innerHTML = '';
            dictFreqResult.innerHTML = '';

            fetchWordData(word).then(data => {
                dictWordResult.textContent = data.word;
                dictIpaResult.textContent = data.ipa;
                currentAudioUrl = data.audioUrl;
                
                let starHtml = '';
                let freqInt = Math.round(data.freqScore);
                if (freqInt > 5) freqInt = 5;
                if (freqInt < 1) freqInt = 1;
                for(let i=1; i<=5; i++) {
                    if(i <= freqInt) starHtml += '★'; else starHtml += '☆';
                }
                dictFreqResult.innerHTML = `<span title="Datamuse Frequency: ${data.frequencyRaw || 0}/M" style="cursor:help;">${starHtml}</span>`;

                dictDefsContainer.innerHTML = `
                    <div style="margin-bottom:8px;">
                        <p style="font-size:16px; color:#e2e8f0; margin:0 0 4px 0;">${data.engDef}</p>
                        <p style="font-size:15px; color:#94a3b8; margin:0;">${data.chiDef}</p>
                    </div>
                `;
                
                currentEgTexts = [];
                data.examples.forEach((exObj, idx) => {
                    currentEgTexts.push(exObj.eng);
                    const egDiv = document.createElement('div');
                    egDiv.className = 'eg-item';
                    egDiv.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
                            <div style="flex:1;">
                                <p style="font-size:15px; color:#e2e8f0; margin-bottom:4px; font-style:italic;">${idx+1}. ${exObj.eng}</p>
                                <p style="font-size:14px; color:#cbd5e1; margin:0;">${exObj.chi}</p>
                            </div>
                            <div style="display:flex;">
                                <button class="play-single-eg-btn" data-eg="${exObj.eng.replace(/"/g, '&quot;')}" style="background:transparent; border:none; cursor:pointer; font-size:20px; padding:4px;">🔊</button>
                                <button class="record-single-eg-btn" data-eg="${exObj.eng.replace(/"/g, '&quot;')}" style="background:transparent; border:none; cursor:pointer; font-size:20px; padding:4px;">🎤</button>
                            </div>
                        </div>
                        <div class="shadow-result-container" style="display:none; font-size:14px; margin-top:4px; margin-bottom:8px; padding:8px; background:rgba(0,0,0,0.3); border-radius:6px;"></div>`;
                    dictEgsContainer.appendChild(egDiv);
                });

                dictEgsContainer.querySelectorAll('.play-single-eg-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const txt = e.currentTarget.getAttribute('data-eg');
                        speakTTS(txt, 'en-US');
                    });
                });
                
                dictEgsContainer.querySelectorAll('.record-single-eg-btn').forEach(btn => {
                    const txt = btn.getAttribute('data-eg');
                    const resultContainer = btn.closest('.eg-item').querySelector('.shadow-result-container');
                    setupShadowing(btn, txt, resultContainer);
                });

                if (data.examples.length === 0) {
                    dictEgsContainer.innerHTML = `<p style="font-size:14px; color:#cbd5e1; opacity:0.5;">No examples available.</p>`;
                }

                dictLoading.style.display = 'none';
                dictResultCard.style.display = 'block';
            });
        });
    }

    if (dictSearchInput) {
        dictSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && dictSearchBtn) dictSearchBtn.click();
        });
    }

    if (dictPlayBtn) {
        dictPlayBtn.addEventListener('click', () => {
            if (currentAudioUrl && currentAudioUrl.startsWith('http')) {
                new Audio(currentAudioUrl).play().catch(() => speakTTS(currentWord, 'en-US'));
            } else {
                speakTTS(currentWord, 'en-US');
            }
        });
    }

    if (flipCardBtn) {
        flipCardBtn.addEventListener('click', () => {
            flashcardBack.style.display = 'block';
            actionFront.style.display = 'none';
            actionBack.style.display = 'flex';
        });
    }

    if (playAudioBtn) {
        playAudioBtn.addEventListener('click', () => {
            if (currentAudioUrl && currentAudioUrl.startsWith('http')) {
                new Audio(currentAudioUrl).play().catch(() => speakTTS(currentWord, 'en-US'));
            } else {
                speakTTS(currentWord, 'en-US');
            }
        });
    }

    if (playEgAudioBtn) {
        playEgAudioBtn.addEventListener('click', () => {
            if (currentEgTexts.length > 0) speakTTS(currentEgTexts.join('. '));
        });
    }

    if (playChiDefBtn) {
        playChiDefBtn.addEventListener('click', () => {
            if (currentEngDefText) speakTTS(currentEngDefText, 'en-US');
        });
    }

    function speakTTS(text, lang = 'en-US') {
        if (!text) return;
        window.speechSynthesis.cancel();
        const ut = new SpeechSynthesisUtterance(text);
        ut.lang = lang;
        window.speechSynthesis.speak(ut);
    }

    ankiBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const quality = parseInt(e.currentTarget.getAttribute('data-quality'));
            processAnkiResponse(quality);
        });
    });

    function processAnkiResponse(quality) {
        let stats = ankiDb[currentWord] || { interval: 0, ease: 2.5, repetitions: 0, nextReview: 0 };
        
        if (quality === 0) {
            stats.repetitions = 0;
            stats.interval = 1;
            stats.ease = Math.max(1.3, stats.ease - 0.2);
        } else {
            stats.repetitions++;
            if (stats.repetitions === 1) stats.interval = 1;
            else if (stats.repetitions === 2) stats.interval = quality === 3 ? 2 : 4;
            else {
                stats.interval = Math.round(stats.interval * stats.ease * (quality === 5 ? 1.3 : 1));
            }
        }
        
        const now = new Date();
        now.setDate(now.getDate() + stats.interval);
        stats.nextReview = now.getTime();
        
        ankiDb[currentWord] = stats;
        localStorage.setItem('twStockAnki', JSON.stringify(ankiDb));
        
        loadNextWord();
    }

    async function infiniteExpandVocab(sourceWord, level) {
        try {
            const res = await fetch(`https://api.datamuse.com/words?rel_trg=${sourceWord}&md=f&max=30`);
            const words = await res.json();
            let addedCount = 0;
            words.forEach(w => {
                if (!vocabDb[level].includes(w.word) && !ankiDb[w.word]) {
                    vocabDb[level].push(w.word);
                    addedCount++;
                }
            });
            if (addedCount > 0) {
                localStorage.setItem('twStockVocab', JSON.stringify(vocabDb));
            }
        } catch(e) { }
    }

    async function loadNextWord() {
        if(!wordLoading || !wordContent) return;
        
        const nowMs = Date.now();
        const list = vocabDb[currentLevel] || [];
        
        // Find due words
        let candidates = list.filter(w => !ankiDb[w] || ankiDb[w].nextReview <= nowMs);
        
        if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(currentLevel)) {
            if (candidates.length <= 3 && list.length > 0) {
                // Self-expanding heuristic tracking Datamuse closely matching current word vibe
                infiniteExpandVocab(list[Math.floor(Math.random()*list.length)], currentLevel);
            }
        }
        
        if (candidates.length === 0) {
            candidates = list; // fallback review any
        }
        
        const targetWord = candidates[Math.floor(Math.random() * candidates.length)] || 'apple';
        currentWord = targetWord;

        // Reset UI
        wordContent.style.display = 'none';
        wordLoading.style.display = 'block';
        actionFront.style.display = 'none';
        actionBack.style.display = 'none';
        flashcardBack.style.display = 'none';
        
        // Setup Examples
        currentEgTexts = [];
        flashcardEgsContainer.innerHTML = '';
        const data = await fetchWordData(targetWord);
        
        flashcardWord.textContent = data.word;
        flashcardIpa.textContent = data.ipa;
        currentAudioUrl = data.audioUrl;
        
        // Render Frequency Stars
        let starHtml = '';
        let freqInt = Math.round(data.freqScore);
        if (freqInt > 5) freqInt = 5;
        if (freqInt < 1) freqInt = 1;
        for(let i=1; i<=5; i++) {
            if(i <= freqInt) starHtml += '★'; else starHtml += '☆';
        }
        wordFreqStars.innerHTML = `<span title="Datamuse Frequency: ${data.frequencyRaw || 0}/M" style="cursor:help;">${starHtml}</span>`;

        flashcardEngDef.textContent = data.engDef;
        flashcardChiDef.textContent = data.chiDef;
        currentEngDefText = data.engDef;
        
        // Setup Examples
        currentEgTexts = [];
        data.examples.forEach((exObj, idx) => {
            currentEgTexts.push(exObj.eng);
            const egDiv = document.createElement('div');
            egDiv.className = 'eg-item';
            egDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
                    <div style="flex:1;">
                        <p style="font-size:15px; color:#e2e8f0; margin-bottom:4px; font-style:italic;">${idx+1}. ${exObj.eng}</p>
                        <p style="font-size:14px; color:#cbd5e1; margin:0;">${exObj.chi}</p>
                    </div>
                    <div style="display:flex;">
                        <button class="play-single-eg-btn" data-eg="${exObj.eng.replace(/"/g, '&quot;')}" style="background:transparent; border:none; cursor:pointer; font-size:20px; padding:4px;">🔊</button>
                        <button class="record-single-eg-btn" data-eg="${exObj.eng.replace(/"/g, '&quot;')}" style="background:transparent; border:none; cursor:pointer; font-size:20px; padding:4px;">🎤</button>
                    </div>
                </div>
                <div class="shadow-result-container" style="display:none; font-size:14px; margin-top:4px; margin-bottom:8px; padding:8px; background:rgba(0,0,0,0.3); border-radius:6px;"></div>`;
            flashcardEgsContainer.appendChild(egDiv);
        });

        flashcardEgsContainer.querySelectorAll('.play-single-eg-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const txt = e.currentTarget.getAttribute('data-eg');
                speakTTS(txt, 'en-US');
            });
        });

        flashcardEgsContainer.querySelectorAll('.record-single-eg-btn').forEach(btn => {
            const txt = btn.getAttribute('data-eg');
            const resultContainer = btn.closest('.eg-item').querySelector('.shadow-result-container');
            setupShadowing(btn, txt, resultContainer);
        });

        if (data.examples.length === 0) {
            flashcardEgsContainer.innerHTML = `<p style="font-size:14px; color:#cbd5e1; opacity:0.5;">No examples available.</p>`;
        }

        wordLoading.style.display = 'none';
        wordContent.style.display = 'block';
        actionFront.style.display = 'block';
    }

    async function fetchWordData(word) {
        try {
            // 1. Fetch Dictionary API for Definitions & Examples
            const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
            const dictRes = await fetch(dictUrl);
            const dictJson = dictRes.ok ? await dictRes.json() : null;
            
            // 2. Fetch Datamuse for Frequency mapping
            let frequencyRaw = 0;
            let freqScore = 1; 
            try {
                const dmRes = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=f&max=1`);
                if (dmRes.ok) {
                    const dmJson = await dmRes.json();
                    if (dmJson.length > 0 && dmJson[0].tags) {
                        const fTag = dmJson[0].tags.find(t => t.startsWith('f:'));
                        if (fTag) frequencyRaw = parseFloat(fTag.split(':')[1]);
                    }
                }
            } catch(e){}

            // Map standard frequencies to 1-5 Collins-like stars
            if (frequencyRaw > 100) freqScore = 5;
            else if (frequencyRaw > 40) freqScore = 4;
            else if (frequencyRaw > 10) freqScore = 3;
            else if (frequencyRaw > 1) freqScore = 2;
            else freqScore = 1;
            
            let ipa = `/${word}/`;
            let audioUrl = '';
            let engDef = 'No specific explanation found.';
            let examplesRaw = [];

            if (dictJson && dictJson[0]) {
                const entry = dictJson[0];
                const ph = entry.phonetics.find(p => p.text);
                if (ph) ipa = ph.text;
                
                // 優先選有效的美式發音，再選任何有 https 的音訊
                const usAu  = entry.phonetics.find(p => p.audio && p.audio.includes('-us'));
                const anyAu = entry.phonetics.find(p => p.audio && p.audio.trim() !== '');
                const rawUrl = (usAu || anyAu)?.audio || '';
                // 補齊 protocol（有些 API 回傳 //ssl.gstatic... 沒有 https:）
                if (rawUrl.startsWith('//')) audioUrl = 'https:' + rawUrl;
                else if (rawUrl.startsWith('http')) audioUrl = rawUrl;
                else audioUrl = '';  // 不確定的 URL 一律清空，改用 TTS
                
                let foundDef = false;
                for (let m of entry.meanings) {
                    for (let d of m.definitions) {
                        if (d.definition && !foundDef) {
                            engDef = d.definition;
                            foundDef = true;
                        }
                        if (d.example && examplesRaw.length < 3) {
                            examplesRaw.push(d.example);
                        }
                    }
                }
            }
            // 若字典 API 沒有例句，嘗試從 Datamuse 抓例句
            if (examplesRaw.length === 0) {
                try {
                    const dmEgRes = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&md=d&max=5`);
                    if (dmEgRes.ok) {
                        const dmEgJson = await dmEgRes.json();
                        for (const item of dmEgJson) {
                            if (item.defs) {
                                for (const def of item.defs) {
                                    const parts2 = def.split('\t');
                                    if (parts2[1] && parts2[1].length > 20 && !parts2[1].includes(word + '.')) {
                                        examplesRaw.push(parts2[1]);
                                        if (examplesRaw.length >= 2) break;
                                    }
                                }
                            }
                            if (examplesRaw.length >= 2) break;
                        }
                    }
                } catch(e) {}
            }
            // 最終 fallback：用真實句型範本，不只是 "I am learning the word X"
            if (examplesRaw.length === 0) {
                const templates = [
                    `She showed great ${word} during the difficult times.`,
                    `The concept of ${word} is essential in this field.`,
                    `He described the situation as ${word}.`,
                    `Understanding ${word} can help you communicate more effectively.`,
                    `The teacher explained what ${word} means with a real-life example.`,
                ];
                examplesRaw.push(templates[Math.floor(Math.random() * templates.length)]);
            }

            // Translate definition and all examples at once via Google Translate undocumented
            let combinedString = `${word} ||| ${engDef}`;
            examplesRaw.forEach(ex => combinedString += ` ||| ${ex}`);

            const tlUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=${encodeURIComponent(combinedString)}`;
            const tlRes = await fetch(tlUrl);
            const tlJson = await tlRes.json();
            
            let translated = "";
            if (tlJson && tlJson[0]) {
                tlJson[0].forEach(t => translated += t[0]);
            }
            
            const parts = translated.split('|||').map(s => s.trim());
            
            let chiDefBase = parts[0] || '';
            let chiDefExpl = parts[1] || '';
            
            let processedExamples = [];
            for (let i = 0; i < examplesRaw.length; i++) {
                processedExamples.push({
                    eng: examplesRaw[i],
                    chi: parts[2 + i] || '翻譯遺失'
                });
            }

            return {
                word, ipa, audioUrl, 
                freqScore, frequencyRaw,
                engDef, chiDef: `[${chiDefBase}] ${chiDefExpl}`,
                examples: processedExamples
            };
        } catch (e) {
            console.error('Words API Error:', e);
            return {
                word, ipa:'', audioUrl:'', freqScore: 1, frequencyRaw: 0,
                engDef: 'Network Error', chiDef: '連線錯誤，請檢查網路連線。',
                examples: []
            };
        }
    }

    calculate();
    loadInventory();
    updateDateDisplay();
});

    </script>
    <script>

    // ============================================================
    //  🎮 英文益智遊戲系統  (20 Games)
    // ============================================================
    (function() {
        const tabGamesBtn      = document.getElementById('tabGamesBtn');
        const tabFlashcardBtn2 = document.getElementById('tabFlashcardBtn');
        const tabArticleBtn2   = document.getElementById('tabArticleBtn');
        const flashcardSection2 = document.getElementById('flashcardSection');
        const articleSection2   = document.getElementById('articleSection');
        const gamesSection      = document.getElementById('gamesSection');
        const gameMenuView      = document.getElementById('gameMenuView');
        const gamePlayView      = document.getElementById('gamePlayView');
        const gameContainer     = document.getElementById('gameContainer');
        const currentGameTitle  = document.getElementById('currentGameTitle');
        const gameScoreDisplay  = document.getElementById('gameScoreDisplay');
        const backToGameMenuBtn = document.getElementById('backToGameMenuBtn');

        if (!tabGamesBtn) return;

        // ── Tab switching ────────────────────────────────────────
        tabGamesBtn.addEventListener('click', () => {
            tabGamesBtn.classList.add('active-tab');
            tabFlashcardBtn2.classList.replace('primary-btn','secondary-btn');
            tabArticleBtn2.classList.replace('primary-btn','secondary-btn');
            tabFlashcardBtn2.classList.remove('active-tab');
            tabArticleBtn2.classList.remove('active-tab');
            flashcardSection2.style.display = 'none';
            articleSection2.style.display   = 'none';
            gamesSection.style.display      = 'flex';
            renderGameMenu();
        });

        tabFlashcardBtn2.addEventListener('click', () => { tabGamesBtn.classList.remove('active-tab'); gamesSection.style.display='none'; });
        tabArticleBtn2.addEventListener('click',   () => { tabGamesBtn.classList.remove('active-tab'); gamesSection.style.display='none'; });

        backToGameMenuBtn.addEventListener('click', () => {
            cleanupCurrentGame();              // 清除計時器等殘留
            gamePlayView.style.display = 'none';
            gameMenuView.style.display = 'block';
            gameScoreDisplay.textContent = '';
            currentGameTitle.textContent = '';
        });

        // ── Game definitions ─────────────────────────────────────
        const GAMES = [
            { id:'wordscramble', emoji:'🔀', name:'字母重組', desc:'重組打亂的字母，拼出正確單字', color:'rgba(59,130,246,0.3)', border:'#3b82f6' },
            { id:'hangman',      emoji:'🪢', name:'猜單字',   desc:'一個字母一個字母猜出隱藏單字', color:'rgba(239,68,68,0.3)',   border:'#ef4444' },
            { id:'wordmatch',    emoji:'🔗', name:'配對連連看',desc:'把英文單字和中文意思連起來',    color:'rgba(16,185,129,0.3)',  border:'#10b981' },
            { id:'spellingbee',  emoji:'🐝', name:'拼字蜂',   desc:'聽發音，打出正確拼法',           color:'rgba(245,158,11,0.3)', border:'#f59e0b' },
            { id:'wordchain',    emoji:'⛓️', name:'單字接龍', desc:'用前一個字的最後字母開始新單字',  color:'rgba(139,92,246,0.3)', border:'#8b5cf6' },
            { id:'fillblank',    emoji:'📝', name:'填空測驗', desc:'根據中文提示填入正確英文單字',    color:'rgba(236,72,153,0.3)', border:'#ec4899' },
            { id:'wordtyper',    emoji:'⌨️', name:'打字競速', desc:'限時內正確打出螢幕上的單字',      color:'rgba(20,184,166,0.3)', border:'#14b8a6' },
            { id:'antonym',      emoji:'↔️', name:'反義詞挑戰',desc:'從選項中找出反義詞',            color:'rgba(251,146,60,0.3)', border:'#fb923c' },
            { id:'synonym',      emoji:'🔄', name:'同義詞配對',desc:'從選項中找出同義詞',            color:'rgba(34,211,238,0.3)', border:'#22d3ee' },
            { id:'wordsearch',   emoji:'🔍', name:'字母方陣', desc:'在字母格中找出隱藏的英文單字',   color:'rgba(163,230,53,0.3)', border:'#a3e635' },
            { id:'categorize',   emoji:'🗂️', name:'單字分類', desc:'把單字拖進正確的分類欄位',       color:'rgba(192,132,252,0.3)',border:'#c084fc' },
            { id:'memorygrid',   emoji:'🧠', name:'記憶翻牌', desc:'翻開配對英文和中文的卡片',       color:'rgba(251,191,36,0.3)', border:'#fbbf24' },
            { id:'idiomguess',   emoji:'💬', name:'諺語猜謎', desc:'根據提示猜出英文諺語',           color:'rgba(52,211,153,0.3)', border:'#34d399' },
            { id:'letterfall',   emoji:'🌧️', name:'字母雨',   desc:'接住掉落的字母組成單字',         color:'rgba(96,165,250,0.3)', border:'#60a5fa' },
            { id:'wordwheel',    emoji:'🎡', name:'轉盤拼字', desc:'用轉盤中的字母組出最多單字',     color:'rgba(248,113,113,0.3)',border:'#f87171' },
            { id:'crossword',    emoji:'✏️', name:'迷你填字', desc:'按線索填入交叉單字',            color:'rgba(167,139,250,0.3)',border:'#a78bfa' },
            { id:'prefixsuffix', emoji:'🧩', name:'字根配對', desc:'拼出正確的字首 + 字根組合',     color:'rgba(110,231,183,0.3)',border:'#6ee7b7' },
            { id:'truefalse',    emoji:'✅', name:'對錯判斷', desc:'判斷單字解釋是否正確',           color:'rgba(253,186,116,0.3)',border:'#fba164' },
            { id:'sentencebuild',emoji:'🏗️', name:'句子重組', desc:'把打亂的字排列成正確句子',       color:'rgba(147,197,253,0.3)',border:'#93c5fd' },
            { id:'wordladder',   emoji:'🪜', name:'單字梯',   desc:'每次改一個字母，從A單字爬到B單字', color:'rgba(240,171,252,0.3)',border:'#f0abfc' },
        ];

        function renderGameMenu() {
            gameMenuView.style.display = 'block';
            gamePlayView.style.display = 'none';
            const grid = gameMenuView.querySelector('div');
            grid.innerHTML = '';
            GAMES.forEach(g => {
                const btn = document.createElement('button');
                btn.style.cssText = `background:${g.color}; border:1px solid ${g.border}; border-radius:14px; padding:14px 10px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:6px; transition:all 0.2s; font-family:inherit; color:#f8fafc; text-align:center;`;
                btn.innerHTML = `<span style="font-size:28px;">${g.emoji}</span><span style="font-size:13px; font-weight:700;">${g.name}</span><span style="font-size:10px; color:rgba(255,255,255,0.6); line-height:1.3;">${g.desc}</span>`;
                btn.onmouseover = () => { btn.style.transform='translateY(-3px)'; btn.style.boxShadow=`0 6px 20px ${g.color}`; };
                btn.onmouseleave = () => { btn.style.transform=''; btn.style.boxShadow=''; };
                btn.onclick = () => launchGame(g);
                grid.appendChild(btn);
            });
        }

        // ── 全域遊戲清除 ──────────────────────────────────────────
        let _gameCleanup = null;  // 目前遊戲的清理函數
        let currentLoadedGame = null; // 紀錄當前載入的遊戲物件

        function cleanupCurrentGame() {
            if (_gameCleanup) {
                try { _gameCleanup(); } catch(e) {}
                _gameCleanup = null;
            }
            // 清除所有可能遺留的全域事件
            document.onkeydown = null;
        }

        function launchGame(g) {
            currentLoadedGame = g;             // 紀錄遊戲物件以便「再玩一次」使用
            cleanupCurrentGame();              // 先清除舊遊戲
            gameMenuView.style.display = 'none';
            gamePlayView.style.display = 'flex';
            currentGameTitle.textContent = `${g.emoji} ${g.name}`;
            gameScoreDisplay.textContent = '';
            gameContainer.innerHTML = '';
            GAME_RUNNERS[g.id]();
        }

        function setScore(txt) { gameScoreDisplay.textContent = txt; }

        // ── Word banks ───────────────────────────────────────────
        const VOCAB = [
            // A
            {en:'abandon',zh:'放棄'},{en:'abundant',zh:'豐富的'},{en:'achieve',zh:'達成'},{en:'acquire',zh:'獲得'},
            {en:'adapt',zh:'適應'},{en:'adequate',zh:'足夠的'},{en:'advocate',zh:'倡導'},{en:'affect',zh:'影響'},
            {en:'affirm',zh:'肯定'},{en:'afford',zh:'負擔得起'},{en:'aggravate',zh:'加重'},{en:'alert',zh:'警覺'},
            {en:'alter',zh:'改變'},{en:'ambiguous',zh:'模糊的'},{en:'analyze',zh:'分析'},{en:'ancient',zh:'古老的'},
            {en:'anxious',zh:'焦慮的'},{en:'apparent',zh:'明顯的'},{en:'approach',zh:'方法/接近'},{en:'approve',zh:'批准'},
            {en:'assert',zh:'聲稱'},{en:'assist',zh:'協助'},{en:'assume',zh:'假設'},{en:'attach',zh:'附加'},
            {en:'attain',zh:'達到'},{en:'attempt',zh:'嘗試'},{en:'aware',zh:'意識到的'},
            // B
            {en:'barrier',zh:'障礙'},{en:'benefit',zh:'利益'},{en:'blunt',zh:'直率的'},{en:'boost',zh:'提升'},
            {en:'brief',zh:'簡短的'},{en:'brilliant',zh:'傑出的'},{en:'burden',zh:'負擔'},
            // C
            {en:'capture',zh:'捕獲'},{en:'certain',zh:'確定的'},{en:'challenge',zh:'挑戰'},{en:'chronic',zh:'慢性的'},
            {en:'clarify',zh:'澄清'},{en:'collapse',zh:'崩潰'},{en:'commit',zh:'承諾'},{en:'complex',zh:'複雜的'},
            {en:'conceal',zh:'隱藏'},{en:'concept',zh:'概念'},{en:'concern',zh:'擔憂'},{en:'confirm',zh:'確認'},
            {en:'conflict',zh:'衝突'},{en:'consider',zh:'考慮'},{en:'constant',zh:'持續的'},{en:'construct',zh:'建造'},
            {en:'contrary',zh:'相反的'},{en:'convince',zh:'說服'},{en:'cooperate',zh:'合作'},{en:'courage',zh:'勇氣'},
            {en:'creative',zh:'創意的'},{en:'critical',zh:'批判的'},{en:'crucial',zh:'關鍵的'},
            // D
            {en:'decline',zh:'下降'},{en:'dedicate',zh:'致力於'},{en:'define',zh:'定義'},{en:'delay',zh:'延誤'},
            {en:'deliver',zh:'傳遞'},{en:'depend',zh:'依賴'},{en:'describe',zh:'描述'},{en:'desire',zh:'渴望'},
            {en:'despite',zh:'儘管'},{en:'detect',zh:'偵測'},{en:'determine',zh:'決定'},{en:'devote',zh:'奉獻'},
            {en:'diminish',zh:'減少'},{en:'discover',zh:'發現'},{en:'display',zh:'展示'},{en:'distinct',zh:'明顯的'},
            {en:'dominate',zh:'支配'},{en:'durable',zh:'耐用的'},
            // E
            {en:'effective',zh:'有效的'},{en:'efficient',zh:'有效率的'},{en:'emerge',zh:'出現'},{en:'enhance',zh:'增強'},
            {en:'enormous',zh:'巨大的'},{en:'ensure',zh:'確保'},{en:'essential',zh:'必要的'},{en:'establish',zh:'建立'},
            {en:'evaluate',zh:'評估'},{en:'evolve',zh:'進化'},{en:'exceed',zh:'超越'},{en:'exclude',zh:'排除'},
            {en:'exhaust',zh:'耗盡'},{en:'expand',zh:'擴展'},{en:'expose',zh:'暴露'},{en:'express',zh:'表達'},
            // F
            {en:'facilitate',zh:'促進'},{en:'flexible',zh:'靈活的'},{en:'flourish',zh:'繁盛'},{en:'focus',zh:'專注'},
            {en:'fragile',zh:'脆弱的'},{en:'frequent',zh:'頻繁的'},{en:'fulfill',zh:'履行'},
            // G
            {en:'generate',zh:'產生'},{en:'genuine',zh:'真實的'},{en:'govern',zh:'管治'},{en:'grateful',zh:'感激的'},
            {en:'guarantee',zh:'保證'},
            // H
            {en:'hesitate',zh:'猶豫'},{en:'highlight',zh:'突出'},{en:'humble',zh:'謙遜的'},
            // I
            {en:'identify',zh:'識別'},{en:'ignore',zh:'忽視'},{en:'illustrate',zh:'說明'},{en:'impact',zh:'影響'},
            {en:'imply',zh:'暗示'},{en:'improve',zh:'改善'},{en:'indicate',zh:'表示'},{en:'influence',zh:'影響'},
            {en:'intense',zh:'強烈的'},{en:'interpret',zh:'解釋'},{en:'involve',zh:'涉及'},
            // J-K
            {en:'justify',zh:'辯護'},{en:'keen',zh:'渴望的'},{en:'knowledge',zh:'知識'},
            // L
            {en:'liberal',zh:'自由的'},{en:'limited',zh:'有限的'},{en:'linger',zh:'徘徊'},{en:'logical',zh:'合理的'},
            // M
            {en:'maintain',zh:'維持'},{en:'manage',zh:'管理'},{en:'manifest',zh:'表明'},{en:'migrate',zh:'遷移'},
            {en:'moderate',zh:'適度的'},{en:'monitor',zh:'監控'},{en:'motivate',zh:'激勵'},
            // N
            {en:'neutral',zh:'中立的'},{en:'notion',zh:'概念'},{en:'numerous',zh:'眾多的'},
            // O
            {en:'obstacle',zh:'障礙物'},{en:'obvious',zh:'明顯的'},{en:'obtain',zh:'獲得'},{en:'occur',zh:'發生'},
            {en:'oppose',zh:'反對'},{en:'overcome',zh:'克服'},
            // P
            {en:'perceive',zh:'感知'},{en:'persist',zh:'堅持'},{en:'precise',zh:'精確的'},{en:'predict',zh:'預測'},
            {en:'prevent',zh:'防止'},{en:'primary',zh:'主要的'},{en:'promote',zh:'促進'},{en:'propose',zh:'提議'},
            {en:'protect',zh:'保護'},{en:'provide',zh:'提供'},
            // Q-R
            {en:'quest',zh:'追求'},{en:'rational',zh:'理性的'},{en:'recognize',zh:'認識'},{en:'reduce',zh:'減少'},
            {en:'reflect',zh:'反映'},{en:'resolve',zh:'解決'},{en:'restore',zh:'恢復'},{en:'reveal',zh:'揭示'},
            // S
            {en:'scarce',zh:'稀缺的'},{en:'sensitive',zh:'敏感的'},{en:'significant',zh:'重要的'},{en:'similar',zh:'相似的'},
            {en:'specific',zh:'特定的'},{en:'stable',zh:'穩定的'},{en:'strengthen',zh:'加強'},{en:'sufficient',zh:'足夠的'},
            {en:'suggest',zh:'建議'},{en:'support',zh:'支持'},{en:'sustain',zh:'維持'},
            // T
            {en:'tendency',zh:'趨勢'},{en:'thrive',zh:'茁壯'},{en:'transform',zh:'轉化'},{en:'typical',zh:'典型的'},
            // U-V
            {en:'unique',zh:'獨特的'},{en:'utilize',zh:'利用'},{en:'vague',zh:'模糊的'},{en:'vital',zh:'至關重要的'},
            // W-Y
            {en:'wander',zh:'漫遊'},{en:'widespread',zh:'廣泛的'},{en:'yearn',zh:'渴望'},
            // Extra common words
            {en:'able',zh:'能夠的'},{en:'accept',zh:'接受'},{en:'action',zh:'行動'},{en:'active',zh:'積極的'},
            {en:'actual',zh:'實際的'},{en:'add',zh:'增加'},{en:'admit',zh:'承認'},{en:'agree',zh:'同意'},
            {en:'allow',zh:'允許'},{en:'answer',zh:'回答'},{en:'argue',zh:'爭論'},{en:'avoid',zh:'避免'},
            {en:'beautiful',zh:'美麗的'},{en:'believe',zh:'相信'},{en:'belong',zh:'屬於'},{en:'brave',zh:'勇敢的'},
            {en:'break',zh:'打破'},{en:'build',zh:'建立'},{en:'calm',zh:'冷靜的'},{en:'capable',zh:'有能力的'},
            {en:'careful',zh:'小心的'},{en:'cause',zh:'原因'},{en:'change',zh:'改變'},{en:'choose',zh:'選擇'},
            {en:'clear',zh:'清楚的'},{en:'collect',zh:'收集'},{en:'common',zh:'普通的'},{en:'complete',zh:'完成'},
            {en:'connect',zh:'連接'},{en:'continue',zh:'繼續'},{en:'control',zh:'控制'},{en:'create',zh:'創造'},
            {en:'curious',zh:'好奇的'},{en:'decide',zh:'決定'},{en:'different',zh:'不同的'},{en:'difficult',zh:'困難的'},
            {en:'discuss',zh:'討論'},{en:'divide',zh:'分割'},{en:'doubt',zh:'懷疑'},{en:'dream',zh:'夢想'},
            {en:'eager',zh:'熱切的'},{en:'early',zh:'早期的'},{en:'earn',zh:'賺取'},{en:'easy',zh:'容易的'},
            {en:'enjoy',zh:'享受'},{en:'equal',zh:'相等的'},{en:'expect',zh:'期待'},{en:'experience',zh:'經驗'},
            {en:'explain',zh:'解釋'},{en:'explore',zh:'探索'},{en:'fail',zh:'失敗'},{en:'fair',zh:'公平的'},
            {en:'faith',zh:'信念'},{en:'famous',zh:'著名的'},{en:'fear',zh:'恐懼'},{en:'feel',zh:'感覺'},
            {en:'follow',zh:'跟隨'},{en:'force',zh:'力量'},{en:'forget',zh:'忘記'},{en:'forgive',zh:'原諒'},
            {en:'free',zh:'自由的'},{en:'friend',zh:'朋友'},{en:'gain',zh:'獲得'},{en:'goal',zh:'目標'},
            {en:'happy',zh:'快樂的'},{en:'help',zh:'幫助'},{en:'honest',zh:'誠實的'},{en:'honor',zh:'榮耀'},
            {en:'hope',zh:'希望'},{en:'imagine',zh:'想像'},{en:'important',zh:'重要的'},{en:'increase',zh:'增加'},
            {en:'inspire',zh:'激勵'},{en:'interest',zh:'興趣'},{en:'join',zh:'加入'},{en:'judge',zh:'判斷'},
            {en:'kind',zh:'善良的'},{en:'large',zh:'大的'},{en:'learn',zh:'學習'},{en:'leave',zh:'離開'},
            {en:'listen',zh:'聆聽'},{en:'live',zh:'生活'},{en:'long',zh:'長的'},{en:'lose',zh:'失去'},
            {en:'love',zh:'愛'},{en:'loyal',zh:'忠誠的'},{en:'lucky',zh:'幸運的'},{en:'make',zh:'製作'},
            {en:'mean',zh:'意思'},{en:'meet',zh:'遇見'},{en:'mind',zh:'心智'},{en:'move',zh:'移動'},
            {en:'need',zh:'需要'},{en:'open',zh:'開放的'},{en:'order',zh:'順序'},{en:'patient',zh:'有耐心的'},
            {en:'peace',zh:'和平'},{en:'plan',zh:'計劃'},{en:'practice',zh:'練習'},{en:'prepare',zh:'準備'},
            {en:'prove',zh:'證明'},{en:'pure',zh:'純粹的'},{en:'reach',zh:'到達'},{en:'ready',zh:'準備好的'},
            {en:'real',zh:'真實的'},{en:'reason',zh:'理由'},{en:'remember',zh:'記得'},{en:'respect',zh:'尊重'},
            {en:'responsible',zh:'負責任的'},{en:'right',zh:'正確的'},{en:'rise',zh:'上升'},{en:'safe',zh:'安全的'},
            {en:'save',zh:'拯救'},{en:'search',zh:'搜索'},{en:'serious',zh:'嚴肅的'},{en:'share',zh:'分享'},
            {en:'simple',zh:'簡單的'},{en:'smart',zh:'聰明的'},{en:'solve',zh:'解決'},{en:'speak',zh:'說話'},
            {en:'strong',zh:'強壯的'},{en:'study',zh:'學習'},{en:'success',zh:'成功'},{en:'surprise',zh:'驚喜'},
            {en:'teach',zh:'教導'},{en:'think',zh:'思考'},{en:'trust',zh:'信任'},{en:'truth',zh:'真相'},
            {en:'understand',zh:'理解'},{en:'unite',zh:'團結'},{en:'value',zh:'價值'},{en:'victory',zh:'勝利'},
            {en:'wise',zh:'明智的'},{en:'wonder',zh:'驚奇'},{en:'work',zh:'工作'},{en:'worry',zh:'擔心'},
        ];
        const ANTONYMS = [
            {word:'hot',ant:'cold'},{word:'fast',ant:'slow'},{word:'bright',ant:'dark'},{word:'rich',ant:'poor'},
            {word:'happy',ant:'sad'},{word:'strong',ant:'weak'},{word:'ancient',ant:'modern'},{word:'brave',ant:'cowardly'},
            {word:'expand',ant:'shrink'},{word:'absorb',ant:'emit'},{word:'genuine',ant:'fake'},{word:'generous',ant:'stingy'},
            {word:'success',ant:'failure'},{word:'increase',ant:'decrease'},{word:'accept',ant:'reject'},{word:'love',ant:'hate'},
            {word:'begin',ant:'end'},{word:'create',ant:'destroy'},{word:'rise',ant:'fall'},{word:'early',ant:'late'},
            {word:'easy',ant:'difficult'},{word:'clean',ant:'dirty'},{word:'safe',ant:'dangerous'},{word:'true',ant:'false'},
            {word:'open',ant:'closed'},{word:'simple',ant:'complex'},{word:'loud',ant:'quiet'},{word:'shallow',ant:'deep'},
            {word:'smooth',ant:'rough'},{word:'sharp',ant:'blunt'},{word:'major',ant:'minor'},{word:'push',ant:'pull'},
            {word:'victory',ant:'defeat'},{word:'peace',ant:'war'},{word:'trust',ant:'doubt'},{word:'found',ant:'lost'},
            {word:'add',ant:'subtract'},{word:'remember',ant:'forget'},{word:'lead',ant:'follow'},{word:'give',ant:'take'},
            {word:'curious',ant:'indifferent'},{word:'flexible',ant:'rigid'},{word:'obvious',ant:'hidden'},{word:'agree',ant:'disagree'},
            {word:'include',ant:'exclude'},{word:'encourage',ant:'discourage'},{word:'stable',ant:'unstable'},{word:'logical',ant:'irrational'},
            {word:'specific',ant:'vague'},{word:'natural',ant:'artificial'},
        ];
        const SYNONYMS = [
            {word:'happy',syn:'joyful'},{word:'fast',syn:'swift'},{word:'begin',syn:'start'},{word:'angry',syn:'furious'},
            {word:'big',syn:'large'},{word:'smart',syn:'clever'},{word:'tired',syn:'weary'},{word:'old',syn:'ancient'},
            {word:'strange',syn:'bizarre'},{word:'brave',syn:'courageous'},{word:'quiet',syn:'silent'},{word:'shout',syn:'yell'},
            {word:'beautiful',syn:'gorgeous'},{word:'tiny',syn:'miniature'},{word:'rich',syn:'wealthy'},{word:'afraid',syn:'terrified'},
            {word:'laugh',syn:'chuckle'},{word:'talk',syn:'speak'},{word:'walk',syn:'stroll'},{word:'hurt',syn:'injure'},
            {word:'find',syn:'discover'},{word:'help',syn:'assist'},{word:'show',syn:'display'},{word:'use',syn:'utilize'},
            {word:'make',syn:'create'},{word:'need',syn:'require'},{word:'think',syn:'ponder'},{word:'want',syn:'desire'},
            {word:'give',syn:'provide'},{word:'change',syn:'alter'},{word:'keep',syn:'maintain'},{word:'stop',syn:'cease'},
            {word:'allow',syn:'permit'},{word:'try',syn:'attempt'},{word:'choose',syn:'select'},{word:'answer',syn:'respond'},
            {word:'explain',syn:'clarify'},{word:'grow',syn:'expand'},{word:'break',syn:'shatter'},{word:'gather',syn:'collect'},
            {word:'suggest',syn:'propose'},{word:'improve',syn:'enhance'},{word:'protect',syn:'defend'},{word:'support',syn:'back'},
            {word:'believe',syn:'trust'},{word:'seem',syn:'appear'},{word:'look',syn:'observe'},{word:'build',syn:'construct'},
            {word:'solve',syn:'resolve'},{word:'achieve',syn:'accomplish'},
        ];
        const SENTENCES = [
            {words:['The','cat','sat','on','the','mat'], answer:'The cat sat on the mat'},
            {words:['She','loves','to','read','books'], answer:'She loves to read books'},
            {words:['He','runs','every','morning'], answer:'He runs every morning'},
            {words:['They','went','to','the','park'], answer:'They went to the park'},
            {words:['I','enjoy','learning','new','words'], answer:'I enjoy learning new words'},
            {words:['The','sun','rises','in','the','east'], answer:'The sun rises in the east'},
            {words:['We','should','always','tell','the','truth'], answer:'We should always tell the truth'},
            {words:['Practice','makes','perfect'], answer:'Practice makes perfect'},
            {words:['She','is','very','kind','and','helpful'], answer:'She is very kind and helpful'},
            {words:['Hard','work','leads','to','success'], answer:'Hard work leads to success'},
            {words:['The','children','played','in','the','garden'], answer:'The children played in the garden'},
            {words:['Music','can','make','people','happy'], answer:'Music can make people happy'},
            {words:['He','forgot','to','bring','his','umbrella'], answer:'He forgot to bring his umbrella'},
            {words:['Learning','a','new','language','takes','time'], answer:'Learning a new language takes time'},
            {words:['The','dog','chased','the','ball'], answer:'The dog chased the ball'},
            {words:['She','smiled','and','waved','goodbye'], answer:'She smiled and waved goodbye'},
            {words:['They','worked','together','as','a','team'], answer:'They worked together as a team'},
            {words:['The','sky','turned','orange','at','sunset'], answer:'The sky turned orange at sunset'},
            {words:['He','studied','hard','and','passed','the','exam'], answer:'He studied hard and passed the exam'},
            {words:['Kindness','is','the','best','gift'], answer:'Kindness is the best gift'},
        ];
        const IDIOMS = [
            {hint:'行動勝於言語', idiom:'Actions speak louder than words'},
            {hint:'種瓜得瓜，種豆得豆', idiom:'You reap what you sow'},
            {hint:'不要以貌取人', idiom:'Never judge a book by its cover'},
            {hint:'一石二鳥', idiom:'Kill two birds with one stone'},
            {hint:'每朵烏雲都有銀邊', idiom:'Every cloud has a silver lining'},
            {hint:'熟能生巧', idiom:'Practice makes perfect'},
        ];
        const PREFIXES = [
            {prefix:'un', root:'happy', meaning:'不快樂的'},
            {prefix:'re', root:'write', meaning:'重新寫'},
            {prefix:'pre', root:'view', meaning:'預覽'},
            {prefix:'dis', root:'agree', meaning:'不同意'},
            {prefix:'mis', root:'understand', meaning:'誤解'},
            {prefix:'over', root:'sleep', meaning:'睡過頭'},
        ];
        const CATEGORIES_DATA = [
            {
                cats: ['Animals 動物','Food 食物','Colors 顏色'],
                words: [
                    {w:'elephant',c:'Animals 動物'},{w:'pizza',c:'Food 食物'},{w:'blue',c:'Colors 顏色'},
                    {w:'tiger',c:'Animals 動物'},{w:'sushi',c:'Food 食物'},{w:'crimson',c:'Colors 顏色'},
                    {w:'dolphin',c:'Animals 動物'},{w:'pasta',c:'Food 食物'},{w:'violet',c:'Colors 顏色'},
                ]
            }
        ];
        const TRUEFALSE = [
            {word:'benevolent', def:'kind and generous', correct:true},
            {word:'melancholy', def:'extremely happy and joyful', correct:false},
            {word:'verbose',    def:'using more words than necessary', correct:true},
            {word:'nocturnal',  def:'active during the day', correct:false},
            {word:'diligent',   def:'hard-working and careful', correct:true},
            {word:'pessimist',  def:'someone who always expects the best', correct:false},
            {word:'transparent',def:'easy to see through; obvious', correct:true},
            {word:'ambiguous',  def:'having only one clear meaning', correct:false},
        ];

        function shuffle(arr) { return [...arr].sort(()=>Math.random()-0.5); }
        function pick(arr, n=1) { const s=shuffle(arr); return n===1?s[0]:s.slice(0,n); }
        function mkBtn(txt, style='', cls='') {
            const b=document.createElement('button');
            b.innerHTML=txt; b.style.cssText=style; b.className=cls; return b;
        }
        function gc(style='') { // game card wrapper
            const d=document.createElement('div');
            d.style.cssText=`background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px; ${style}`;
            return d;
        }
        function feedback(msg, ok) {
            const d=document.createElement('div');
            d.style.cssText=`text-align:center; font-size:16px; font-weight:700; color:${ok?'#34d399':'#f87171'}; margin:10px 0; animation:fadeIn 0.3s;`;
            d.textContent=msg; return d;
        }

        // ============================================================
        //  GAME 1 – Word Scramble
        // ============================================================
        function game_wordscramble() {
            let score=0, item, scrambled;
            function next() {
                item = pick(VOCAB);
                scrambled = shuffle(item.en.split('')).join('');
                while(scrambled===item.en && item.en.length>1) scrambled=shuffle(item.en.split('')).join('');
                render();
            }
            function render() {
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:16px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">重新排列字母，組成正確的英文單字</p>
                    <div style="font-size:42px;font-weight:800;letter-spacing:8px;color:#c4b5fd;">${scrambled.toUpperCase()}</div>
                    <div style="font-size:18px;color:#fbbf24;">中文：${item.zh}</div>
                    <div style="display:flex;gap:8px;width:100%;max-width:300px;">
                        <input id="scrambleInput" type="text" placeholder="輸入答案..." style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px;color:#fff;font-size:16px;font-family:inherit;outline:none;">
                        <button id="scrambleSubmit" style="background:rgba(139,92,246,0.4);border:1px solid #8b5cf6;color:#fff;padding:10px 16px;border-radius:10px;cursor:pointer;font-weight:700;">確認</button>
                    </div>
                    <div id="scrambleFeedback"></div>
                    <button id="scrambleSkip" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;padding:6px 16px;border-radius:8px;cursor:pointer;font-size:13px;">跳過</button>`;
                gameContainer.appendChild(card);
                const inp=card.querySelector('#scrambleInput');
                const sub=card.querySelector('#scrambleSubmit');
                const fb=card.querySelector('#scrambleFeedback');
                function check() {
                    if(inp.value.trim().toLowerCase()===item.en.toLowerCase()){
                        score++; setScore(`✅ 分數：${score}`);
                        fb.appendChild(feedback('🎉 正確！答案是 '+item.en, true));
                        setTimeout(next,1200);
                    } else {
                        fb.appendChild(feedback('❌ 再試一次！', false));
                        inp.value=''; inp.focus();
                    }
                }
                sub.onclick=check;
                inp.onkeydown=e=>{ if(e.key==='Enter') check(); };
                card.querySelector('#scrambleSkip').onclick=()=>{ fb.appendChild(feedback('答案是：'+item.en, false)); setTimeout(next,1500); };
                inp.focus();
            }
            next();
        }

        // ============================================================
        //  GAME 2 – Hangman
        // ============================================================
        function game_hangman() {
            let item, guessed, wrong, maxWrong=6, score=0;
            const GALLOWS = ['','','','','','','😵'];
            function next() {
                item=pick(VOCAB); guessed=new Set(); wrong=0; render();
            }
            function render() {
                const word=item.en.toLowerCase();
                const display=word.split('').map(c=>guessed.has(c)?c:'_').join(' ');
                const wrongLetters=[...guessed].filter(c=>!word.includes(c));
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:14px;align-items:center;');
                const hangPct=Math.round((wrong/maxWrong)*100);
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">提示：${item.zh}</p>
                    <div style="width:80px;height:8px;background:rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;">
                        <div style="width:${hangPct}%;height:100%;background:${hangPct<50?'#34d399':'#f87171'};transition:width 0.3s;"></div>
                    </div>
                    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#f8fafc;">${display}</div>
                    <div style="color:#f87171;font-size:13px;">錯誤字母：${wrongLetters.join(' ') || '—'} (${wrong}/${maxWrong})</div>
                    <div id="hangAlpha" style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;max-width:340px;"></div>
                    <div id="hangFeedback"></div>`;
                gameContainer.appendChild(card);
                const alpha=card.querySelector('#hangAlpha');
                'abcdefghijklmnopqrstuvwxyz'.split('').forEach(c=>{
                    const b=mkBtn(c.toUpperCase());
                    b.style.cssText=`width:32px;height:32px;border-radius:6px;cursor:pointer;font-weight:700;font-size:13px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.07);color:#f8fafc;transition:all 0.15s;`;
                    if(guessed.has(c)){ b.style.opacity='0.3'; b.disabled=true; b.style.background=word.includes(c)?'rgba(52,211,153,0.2)':'rgba(248,113,113,0.2)'; }
                    b.onclick=()=>{
                        guessed.add(c);
                        if(!word.includes(c)) wrong++;
                        const won=word.split('').every(l=>guessed.has(l));
                        if(won){ score++; setScore(`✅ 分數：${score}`); card.querySelector('#hangFeedback').appendChild(feedback('🎉 答對了！',true)); setTimeout(next,1500); }
                        else if(wrong>=maxWrong){ card.querySelector('#hangFeedback').appendChild(feedback('💀 答案是：'+item.en,false)); setTimeout(next,2000); }
                        else render();
                    };
                    alpha.appendChild(b);
                });
            }
            next();
        }

        // ============================================================
        //  GAME 3 – Word Match (英中配對)
        // ============================================================
        function game_wordmatch() {
            let score=0;
            function next() {
                const pairs=pick(VOCAB,6);
                const enBtns=shuffle(pairs.map(p=>p.en));
                const zhBtns=shuffle(pairs.map(p=>p.zh));
                let selEn=null, selZh=null, matched=new Set();
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:12px;');
                card.innerHTML=`<p style="color:#94a3b8;font-size:13px;text-align:center;">先點英文，再點對應的中文意思</p><div id="matchGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div><div id="matchFeedback"></div>`;
                gameContainer.appendChild(card);
                const grid=card.querySelector('#matchGrid');
                function mkMatchBtn(txt, side) {
                    const b=document.createElement('button');
                    b.textContent=txt; b.dataset.val=txt; b.dataset.side=side;
                    b.style.cssText=`padding:10px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;font-family:inherit;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#f8fafc;transition:all 0.2s;`;
                    b.onclick=()=>{
                        if(matched.has(txt)) return;
                        if(side==='en'){ if(selEn){ selEn.style.background='rgba(255,255,255,0.06)'; } selEn=b; b.style.background='rgba(139,92,246,0.4)'; }
                        else { if(selZh){ selZh.style.background='rgba(255,255,255,0.06)'; } selZh=b; b.style.background='rgba(59,130,246,0.4)'; }
                        if(selEn && selZh) {
                            const pair=pairs.find(p=>p.en===selEn.dataset.val);
                            if(pair && pair.zh===selZh.dataset.val){
                                [selEn,selZh].forEach(x=>{ x.style.background='rgba(52,211,153,0.3)'; x.style.borderColor='#34d399'; x.disabled=true; matched.add(x.dataset.val); });
                                score++;
                                if(matched.size===pairs.length*2){ setScore(`✅ 分數：${score}`); card.querySelector('#matchFeedback').appendChild(feedback('🎉 全部配對成功！',true)); setTimeout(next,1500); }
                            } else {
                                [selEn,selZh].forEach(x=>{ x.style.background='rgba(248,113,113,0.3)'; });
                                setTimeout(()=>{ if(selEn){selEn.style.background='rgba(255,255,255,0.06)';} if(selZh){selZh.style.background='rgba(255,255,255,0.06)';} selEn=null; selZh=null; },600);
                                return;
                            }
                            selEn=null; selZh=null;
                        }
                    };
                    return b;
                }
                enBtns.forEach(e=>grid.appendChild(mkMatchBtn(e,'en')));
                zhBtns.forEach(z=>grid.appendChild(mkMatchBtn(z,'zh')));
            }
            next();
        }

        // ============================================================
        //  GAME 4 – Spelling Bee (打出聽到的單字)
        // ============================================================
        function game_spellingbee() {
            let score=0, item;
            function speak(txt) {
                const u=new SpeechSynthesisUtterance(txt);
                u.lang='en-US'; u.rate=0.85; speechSynthesis.speak(u);
            }
            function next() { item=pick(VOCAB); render(); speak(item.en); }
            function render() {
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:16px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">聽發音，打出正確的英文拼字</p>
                    <p style="font-size:18px;color:#fbbf24;">中文提示：${item.zh}</p>
                    <button id="beePlay" style="font-size:28px;background:rgba(245,158,11,0.2);border:1px solid #f59e0b;border-radius:50%;width:60px;height:60px;cursor:pointer;">🔊</button>
                    <div style="display:flex;gap:8px;width:100%;max-width:300px;">
                        <input id="beeInput" type="text" placeholder="打出你聽到的單字..." style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px;color:#fff;font-size:16px;font-family:inherit;outline:none;">
                        <button id="beeSubmit" style="background:rgba(245,158,11,0.4);border:1px solid #f59e0b;color:#fff;padding:10px 16px;border-radius:10px;cursor:pointer;font-weight:700;">確認</button>
                    </div>
                    <div id="beeFeedback"></div>`;
                gameContainer.appendChild(card);
                card.querySelector('#beePlay').onclick=()=>speak(item.en);
                const inp=card.querySelector('#beeInput');
                function check() {
                    const fb=card.querySelector('#beeFeedback');
                    if(inp.value.trim().toLowerCase()===item.en.toLowerCase()){
                        score++; setScore(`✅ 分數：${score}`);
                        fb.appendChild(feedback('🎉 正確！',true)); setTimeout(next,1200);
                    } else {
                        fb.appendChild(feedback(`❌ 答案是：${item.en}`,false)); setTimeout(next,2000);
                    }
                }
                card.querySelector('#beeSubmit').onclick=check;
                inp.onkeydown=e=>{ if(e.key==='Enter') check(); };
                inp.focus();
            }
            next();
        }

        // ============================================================
        //  GAME 5 – Fill in the Blank
        // ============================================================
        function game_fillblank() {
            let score=0, wrong=0;
            const pool=shuffle(VOCAB);
            let idx=0;
            function next() {
                if(idx>=pool.length){ gameContainer.innerHTML=''; gameContainer.appendChild(gc('text-align:center;')).innerHTML=`<p style="color:#34d399;font-size:24px;font-weight:800;">🏆 完成！${score}/${pool.length}</p>`; return; }
                const item=pool[idx++];
                const opts=shuffle([item, ...pick(VOCAB.filter(v=>v.en!==item.en),3)]).map(v=>v.en);
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:14px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">選出符合中文意思的英文單字</p>
                    <div style="font-size:26px;font-weight:800;color:#fbbf24;">${item.zh}</div>
                    <div id="fillOpts" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:360px;"></div>
                    <div id="fillFeedback"></div>`;
                gameContainer.appendChild(card);
                const optsDiv=card.querySelector('#fillOpts');
                opts.forEach(o=>{
                    const b=mkBtn(o);
                    b.style.cssText=`padding:12px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:700;font-family:inherit;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#f8fafc;transition:all 0.2s;`;
                    b.onclick=()=>{
                        optsDiv.querySelectorAll('button').forEach(x=>x.disabled=true);
                        if(o===item.en){ score++; setScore(`✅ ${score}/${pool.length}`); b.style.background='rgba(52,211,153,0.3)'; b.style.borderColor='#34d399'; setTimeout(next,900); }
                        else { wrong++; b.style.background='rgba(248,113,113,0.3)'; b.style.borderColor='#f87171'; optsDiv.querySelectorAll('button').forEach(x=>{ if(x.textContent===item.en){x.style.background='rgba(52,211,153,0.2)';} }); setTimeout(next,1500); }
                    };
                    optsDiv.appendChild(b);
                });
            }
            next();
        }

        // ============================================================
        //  GAME 6 – Word Typer (計時打字)
        // ============================================================
        function game_wordtyper() {
            let score=0, timeLeft=30, timer=null, items=shuffle(VOCAB), idx=0, active=false;
            function start() {
                if(timer) clearInterval(timer);
                active=true; score=0; idx=0; timeLeft=30; items=shuffle(VOCAB);
                timer=setInterval(()=>{ timeLeft--; update(); if(timeLeft<=0){ clearInterval(timer); timer=null; end(); } },1000);
                // 登記清除函數，離開遊戲時自動停止
                _gameCleanup = () => { if(timer){ clearInterval(timer); timer=null; } active=false; };
                render();
            }
            function end() {
                active=false;
                gameContainer.innerHTML='';
                const card=gc('text-align:center;display:flex;flex-direction:column;gap:16px;align-items:center;');
                card.innerHTML=`<div style="font-size:48px;">⏱️</div><div style="font-size:24px;font-weight:800;color:#fbbf24;">時間到！得分：${score}</div><p style="color:#94a3b8;">30秒內打出 ${score} 個單字</p>`;
                const rb=mkBtn('再玩一次','background:rgba(59,130,246,0.3);border:1px solid #3b82f6;color:#fff;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:700;');
                rb.onclick=start; card.appendChild(rb); gameContainer.appendChild(card);
            }
            function update() {
                const tEl=document.getElementById('typerTime');
                if(tEl) tEl.textContent=`⏱️ ${timeLeft}s`;
            }
            function render() {
                const item=items[idx % items.length];
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:16px;align-items:center;');
                card.innerHTML=`
                    <div style="display:flex;justify-content:space-between;width:100%;font-size:14px;color:#94a3b8;">
                        <span id="typerTime">⏱️ ${timeLeft}s</span><span>✅ ${score} 個</span>
                    </div>
                    <p style="color:#94a3b8;font-size:13px;">快速打出以下單字！</p>
                    <div style="font-size:38px;font-weight:800;color:#c4b5fd;">${item.en}</div>
                    <div style="font-size:16px;color:#fbbf24;">${item.zh}</div>
                    <input id="typerInput" type="text" autocomplete="off" autocorrect="off" spellcheck="false" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px;color:#fff;font-size:18px;font-family:inherit;outline:none;text-align:center;width:100%;max-width:280px;">`;
                gameContainer.appendChild(card);
                const inp=card.querySelector('#typerInput');
                inp.focus();
                inp.oninput=()=>{
                    if(inp.value.toLowerCase()===item.en.toLowerCase()){
                        score++; idx++; inp.value=''; render(); update();
                    }
                };
            }
            // Start screen
            gameContainer.innerHTML='';
            const card=gc('text-align:center;display:flex;flex-direction:column;gap:16px;align-items:center;');
            card.innerHTML=`<div style="font-size:48px;">⌨️</div><p style="color:#f8fafc;font-size:18px;font-weight:700;">30秒打字競速</p><p style="color:#94a3b8;">快速正確打出螢幕上的英文單字</p>`;
            const sb=mkBtn('開始！','background:rgba(139,92,246,0.4);border:1px solid #8b5cf6;color:#fff;padding:12px 32px;border-radius:12px;cursor:pointer;font-size:18px;font-weight:800;');
            sb.onclick=start; card.appendChild(sb); gameContainer.appendChild(card);
        }

        // ============================================================
        //  GAME 7 – Antonym Challenge
        // ============================================================
        function game_antonym() {
            let score=0, q=0;
            const pool=shuffle(ANTONYMS);
            function next() {
                if(q>=pool.length){ done(score,pool.length); return; }
                const item=pool[q++];
                const wrongs=ANTONYMS.filter(x=>x.ant!==item.ant).map(x=>x.ant);
                const opts=shuffle([item.ant, ...pick(wrongs,3)]);
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:14px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">找出反義詞</p>
                    <div style="font-size:36px;font-weight:800;color:#60a5fa;">${item.word}</div>
                    <div id="antOpts" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:320px;"></div>
                    <div id="antFeedback"></div>`;
                gameContainer.appendChild(card);
                const optsDiv=card.querySelector('#antOpts');
                opts.forEach(o=>{
                    const b=mkBtn(o);
                    b.style.cssText=`padding:12px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:700;font-family:inherit;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#f8fafc;transition:all 0.2s;`;
                    b.onclick=()=>{
                        optsDiv.querySelectorAll('button').forEach(x=>x.disabled=true);
                        const fb=card.querySelector('#antFeedback');
                        if(o===item.ant){ score++; setScore(`✅ ${score}/${pool.length}`); b.style.background='rgba(52,211,153,0.3)'; b.style.borderColor='#34d399'; fb.appendChild(feedback('🎉 正確！',true)); setTimeout(next,900); }
                        else { b.style.background='rgba(248,113,113,0.3)'; optsDiv.querySelectorAll('button').forEach(x=>{ if(x.textContent===item.ant) x.style.background='rgba(52,211,153,0.2)'; }); fb.appendChild(feedback(`正確答案：${item.ant}`,false)); setTimeout(next,1600); }
                    };
                    optsDiv.appendChild(b);
                });
            }
            next();
        }

        // ============================================================
        //  GAME 8 – Synonym Quiz
        // ============================================================
        function game_synonym() {
            let score=0, q=0;
            const pool=shuffle(SYNONYMS);
            function next() {
                if(q>=pool.length){ done(score,pool.length); return; }
                const item=pool[q++];
                const wrongs=SYNONYMS.filter(x=>x.syn!==item.syn).map(x=>x.syn);
                const opts=shuffle([item.syn, ...pick(wrongs,3)]);
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:14px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">找出同義詞</p>
                    <div style="font-size:36px;font-weight:800;color:#34d399;">${item.word}</div>
                    <div id="synOpts" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:320px;"></div>
                    <div id="synFeedback"></div>`;
                gameContainer.appendChild(card);
                const optsDiv=card.querySelector('#synOpts');
                opts.forEach(o=>{
                    const b=mkBtn(o);
                    b.style.cssText=`padding:12px;border-radius:10px;cursor:pointer;font-size:16px;font-weight:700;font-family:inherit;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#f8fafc;transition:all 0.2s;`;
                    b.onclick=()=>{
                        optsDiv.querySelectorAll('button').forEach(x=>x.disabled=true);
                        const fb=card.querySelector('#synFeedback');
                        if(o===item.syn){ score++; setScore(`✅ ${score}/${pool.length}`); b.style.background='rgba(52,211,153,0.3)'; b.style.borderColor='#34d399'; fb.appendChild(feedback('🎉 正確！',true)); setTimeout(next,900); }
                        else { b.style.background='rgba(248,113,113,0.3)'; optsDiv.querySelectorAll('button').forEach(x=>{ if(x.textContent===item.syn) x.style.background='rgba(52,211,153,0.2)'; }); fb.appendChild(feedback(`正確答案：${item.syn}`,false)); setTimeout(next,1600); }
                    };
                    optsDiv.appendChild(b);
                });
            }
            next();
        }

        // ============================================================
        //  GAME 9 – Word Search (字母方陣)
        // ============================================================
        function game_wordsearch() {
            const SIZE=10;
            const wordsToFind=['cat','dog','run','jump','play','read','book','blue','fast','kind'];
            let grid=[], placed=[], found=new Set(), selecting=false, selStart=null, selCells=[];
            function buildGrid() {
                grid=Array.from({length:SIZE},()=>Array(SIZE).fill(''));
                placed=[];
                const dirs=[[0,1],[1,0],[1,1],[-1,1]];
                wordsToFind.forEach(word=>{
                    let ok=false;
                    for(let t=0;t<200&&!ok;t++){
                        const dir=dirs[Math.floor(Math.random()*dirs.length)];
                        const r=Math.floor(Math.random()*SIZE);
                        const c=Math.floor(Math.random()*SIZE);
                        let cells=[];
                        let valid=true;
                        for(let i=0;i<word.length;i++){
                            const nr=r+dir[0]*i, nc=c+dir[1]*i;
                            if(nr<0||nr>=SIZE||nc<0||nc>=SIZE){ valid=false; break; }
                            if(grid[nr][nc]!==''&&grid[nr][nc]!==word[i]){ valid=false; break; }
                            cells.push([nr,nc]);
                        }
                        if(valid){ cells.forEach(([nr,nc],i)=>grid[nr][nc]=word[i]); placed.push({word,cells}); ok=true; }
                    }
                });
                for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!grid[r][c]) grid[r][c]='abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random()*26)];
            }
            function render() {
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:12px;');
                const wordsDiv=document.createElement('div');
                wordsDiv.style.cssText='display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';
                wordsToFind.forEach(w=>{ const s=document.createElement('span'); s.style.cssText=`padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600;${found.has(w)?'background:rgba(52,211,153,0.3);color:#34d399;text-decoration:line-through;':'background:rgba(255,255,255,0.08);color:#f8fafc;'}`; s.textContent=w; wordsDiv.appendChild(s); });
                card.appendChild(wordsDiv);
                const table=document.createElement('div');
                table.style.cssText='display:grid;gap:2px;user-select:none;justify-content:center;';
                table.style.gridTemplateColumns=`repeat(${SIZE},30px)`;
                const cells=[];
                for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
                    const cell=document.createElement('div');
                    cell.style.cssText='width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border-radius:4px;cursor:pointer;background:rgba(255,255,255,0.05);color:#f8fafc;transition:background 0.1s;';
                    cell.textContent=grid[r][c].toUpperCase();
                    cell.dataset.r=r; cell.dataset.c=c;
                    // Check if already found
                    const inFound=placed.filter(p=>found.has(p.word)).flatMap(p=>p.cells);
                    if(inFound.some(([fr,fc])=>fr===r&&fc===c)) cell.style.background='rgba(52,211,153,0.3)';
                    cell.onmousedown=()=>{ selecting=true; selStart=[r,c]; selCells=[[r,c]]; cell.style.background='rgba(139,92,246,0.5)'; };
                    cell.onmouseover=()=>{ if(!selecting) return; cells.forEach(cl=>{ if(!placed.filter(p=>found.has(p.word)).flatMap(p=>p.cells).some(([fr,fc])=>fr===+cl.dataset.r&&fc===+cl.dataset.c)) cl.style.background='rgba(255,255,255,0.05)'; }); const pr=+selStart[0],pc=+selStart[1]; let dr=r-pr,dc=c-pc; const len=Math.max(Math.abs(dr),Math.abs(dc)); if(len>0){dr=Math.sign(dr);dc=Math.sign(dc);} selCells=[]; for(let i=0;i<=len;i++){ const nr=pr+dr*i,nc=pc+dc*i; if(nr>=0&&nr<SIZE&&nc>=0&&nc<SIZE){ selCells.push([nr,nc]); cells[nr*SIZE+nc].style.background='rgba(139,92,246,0.5)'; } } };
                    cell.onmouseup=()=>{ if(!selecting) return; selecting=false; const selStr=selCells.map(([r,c])=>grid[r][c]).join(''); const selStrRev=selStr.split('').reverse().join(''); const match=placed.find(p=>p.word===selStr||p.word===selStrRev); if(match&&!found.has(match.word)){ found.add(match.word); if(found.size===wordsToFind.length){ setTimeout(()=>{ gameContainer.innerHTML=''; gameContainer.appendChild(gc('text-align:center;')).innerHTML='<p style="color:#34d399;font-size:24px;font-weight:800;">🎉 全部找到了！</p>'; },500); } } render(); };
                    cells.push(cell);
                    table.appendChild(cell);
                }
                document.onmouseup=()=>{ selecting=false; };
                card.appendChild(table);
                setScore(`🔍 找到 ${found.size}/${wordsToFind.length}`);
                gameContainer.appendChild(card);
            }
            buildGrid(); render();
        }

        // ============================================================
        //  GAME 10 – Categorize
        // ============================================================
        function game_categorize() {
            let score=0;
            const data=CATEGORIES_DATA[0];
            let remaining=[...shuffle(data.words)], placed={};
            data.cats.forEach(c=>placed[c]=[]);
            function render() {
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:14px;');
                const catsDiv=document.createElement('div');
                catsDiv.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:10px;';
                data.cats.forEach(cat=>{
                    const col=document.createElement('div');
                    col.style.cssText='background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px;min-height:100px;';
                    col.innerHTML=`<div style="font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:8px;text-align:center;">${cat}</div>`;
                    placed[cat].forEach(w=>{ const s=document.createElement('div'); s.textContent=w; s.style.cssText='background:rgba(52,211,153,0.2);border-radius:6px;padding:4px 8px;font-size:13px;color:#34d399;margin:3px 0;text-align:center;'; col.appendChild(s); });
                    catsDiv.appendChild(col);
                });
                card.appendChild(catsDiv);
                if(remaining.length>0){
                    const curr=remaining[0];
                    const wordDiv=document.createElement('div');
                    wordDiv.style.cssText='text-align:center;padding:16px;';
                    wordDiv.innerHTML=`<p style="color:#94a3b8;font-size:13px;margin-bottom:8px;">把這個單字放入正確的類別</p><div style="font-size:28px;font-weight:800;color:#f8fafc;">${curr.w}</div>`;
                    card.appendChild(wordDiv);
                    const btns=document.createElement('div');
                    btns.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:center;';
                    data.cats.forEach(cat=>{
                        const b=mkBtn(cat,'','');
                        b.style.cssText='padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.07);color:#f8fafc;';
                        b.onclick=()=>{
                            remaining.shift();
                            if(cat===curr.c){ placed[cat].push(curr.w); score++; setScore(`✅ ${score}`); }
                            else { setScore(`❌ 正確分類：${curr.c}`); }
                            if(remaining.length===0){ setTimeout(()=>{ done(score,data.words.length); },500); }
                            else render();
                        };
                        btns.appendChild(b);
                    });
                    card.appendChild(btns);
                } else { done(score,data.words.length); return; }
                gameContainer.appendChild(card);
            }
            render();
        }

        // ============================================================
        //  GAME 11 – Memory Grid (翻牌配對)
        // ============================================================
        function game_memorygrid() {
            const pairs=pick(VOCAB,6);
            const cards=shuffle([...pairs.map(p=>({id:p.en,txt:p.en,type:'en'})),...pairs.map(p=>({id:p.en,txt:p.zh,type:'zh'}))]);
            let flipped=[], matched=new Set(), moves=0;
            function render() {
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:12px;');
                card.innerHTML=`<p style="color:#94a3b8;font-size:13px;text-align:center;">翻開英文和對應中文的配對 (${moves} 步)</p>`;
                const grid=document.createElement('div');
                grid.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:8px;';
                cards.forEach((c,i)=>{
                    const cell=document.createElement('div');
                    const isFlipped=flipped.includes(i)||matched.has(c.id);
                    cell.style.cssText=`height:60px;border-radius:10px;cursor:${matched.has(c.id)||flipped.includes(i)?'default':'pointer'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;text-align:center;padding:4px;transition:all 0.3s;${matched.has(c.id)?'background:rgba(52,211,153,0.3);border:1px solid #34d399;color:#34d399;':isFlipped?'background:rgba(139,92,246,0.3);border:1px solid #8b5cf6;color:#f8fafc;':'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);color:transparent;'}`;
                    cell.textContent=isFlipped?c.txt:'?';
                    if(!matched.has(c.id)&&!flipped.includes(i)){
                        cell.onclick=()=>{
                            if(flipped.length>=2) return;
                            flipped.push(i); moves++;
                            if(flipped.length===2){
                                const [a,b]=flipped;
                                if(cards[a].id===cards[b].id&&a!==b){ matched.add(cards[a].id); flipped=[]; if(matched.size===pairs.length){ setTimeout(()=>done(pairs.length,pairs.length),500); } }
                                else { setTimeout(()=>{ flipped=[]; render(); },900); }
                            }
                            render();
                        };
                    }
                    grid.appendChild(cell);
                });
                card.appendChild(grid);
                setScore(`🧠 配對 ${matched.size}/${pairs.length}`);
                gameContainer.appendChild(card);
            }
            render();
        }

        // ============================================================
        //  GAME 12 – Idiom Guess
        // ============================================================
        function game_idiomguess() {
            let score=0, q=0;
            const pool=shuffle(IDIOMS);
            function next() {
                if(q>=pool.length){ done(score,pool.length); return; }
                const item=pool[q++];
                // Blank out one word
                const words=item.idiom.split(' ');
                const blankIdx=Math.floor(Math.random()*words.length);
                const answer=words[blankIdx].replace(/[^a-zA-Z]/g,'');
                const displayed=words.map((w,i)=>i===blankIdx?'___':w).join(' ');
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:16px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">根據中文提示和語境，填入缺失的單字</p>
                    <div style="font-size:18px;color:#fbbf24;">💡 ${item.hint}</div>
                    <div style="font-size:18px;font-weight:600;color:#f8fafc;text-align:center;">${displayed}</div>
                    <div style="display:flex;gap:8px;width:100%;max-width:280px;">
                        <input id="idiomInput" type="text" placeholder="填入缺少的單字..." style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px;color:#fff;font-size:16px;font-family:inherit;outline:none;">
                        <button id="idiomSubmit" style="background:rgba(52,211,153,0.3);border:1px solid #34d399;color:#fff;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:700;">✓</button>
                    </div>
                    <div id="idiomFeedback"></div>`;
                gameContainer.appendChild(card);
                const inp=card.querySelector('#idiomInput');
                function check() {
                    const fb=card.querySelector('#idiomFeedback');
                    if(inp.value.trim().toLowerCase()===answer.toLowerCase()){ score++; setScore(`✅ ${score}/${pool.length}`); fb.appendChild(feedback('🎉 正確！完整句：'+item.idiom,true)); setTimeout(next,2000); }
                    else { fb.appendChild(feedback(`❌ 答案是：${answer}`,false)); setTimeout(next,2000); }
                }
                card.querySelector('#idiomSubmit').onclick=check;
                inp.onkeydown=e=>{ if(e.key==='Enter') check(); };
                inp.focus();
            }
            next();
        }

        // ============================================================
        //  GAME 13 – Letter Fall (字母雨)
        // ============================================================
        function game_letterfall() {
            let target, typed='', score=0, lives=3, speed=3000, interval=null, gameOver=false;
            // 登記清除函數
            _gameCleanup = () => {
                gameOver=true;
                if(interval){ clearTimeout(interval); interval=null; }
                document.onkeydown = null;
            };
            function next() {
                target=pick(VOCAB); typed='';
                render();
                if(interval) clearTimeout(interval);
                interval=setTimeout(()=>{ if(!gameOver){ lives--; if(lives<=0) end(); else next(); } },speed);
            }
            function end() {
                gameOver=true;
                if(interval){ clearTimeout(interval); interval=null; }
                document.onkeydown = null;
                gameContainer.innerHTML='';
                const card=gc('text-align:center;display:flex;flex-direction:column;gap:16px;align-items:center;');
                card.innerHTML=`<div style="font-size:48px;">💀</div><div style="font-size:24px;font-weight:800;color:#f87171;">遊戲結束！得分：${score}</div>`;
                const rb=mkBtn('再玩一次','background:rgba(59,130,246,0.3);border:1px solid #3b82f6;color:#fff;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:700;');
                rb.onclick=()=>{ gameOver=false; score=0; lives=3; speed=3000; if(interval){clearTimeout(interval);interval=null;} next(); };
                card.appendChild(rb); gameContainer.appendChild(card);
            }
            function render() {
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:14px;align-items:center;position:relative;min-height:280px;');
                const pct=Math.max(0,(speed-typed.length/target.en.length*speed)/speed*100);
                card.innerHTML=`
                    <div style="display:flex;justify-content:space-between;width:100%;font-size:14px;"><span>❤️ ${'♥'.repeat(lives)}</span><span>✅ ${score}</span></div>
                    <div style="width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;"><div id="fallBar" style="height:100%;background:#f87171;border-radius:3px;transition:width 0.1s;" ></div></div>
                    <p style="color:#94a3b8;font-size:13px;">快速打出這個單字！（${target.zh}）</p>
                    <div style="font-size:40px;font-weight:800;color:#c4b5fd;">${target.en}</div>
                    <div style="font-size:24px;letter-spacing:4px;color:#f8fafc;">${typed}<span style="opacity:0.3">${target.en.slice(typed.length)}</span></div>`;
                document.onkeydown=ev=>{ if(gameOver||document.activeElement.tagName==='INPUT') return; const k=ev.key; if(k.length===1&&k.match(/[a-z]/i)){ const next_char=target.en[typed.length]; if(k.toLowerCase()===next_char){ typed+=k; if(typed===target.en){ score++; speed=Math.max(1000,speed-100); clearTimeout(interval); next(); return; } render(); } } };
                gameContainer.appendChild(card);
            }
            next();
        }

        // ============================================================
        //  GAME 14 – Word Wheel
        // ============================================================
        function game_wordwheel() {
            const CENTER='s';
            const LETTERS='t,r,a,e,i,n,g,o'.split(',');
            const ALL_LETTERS=[CENTER,...LETTERS];
            // Pre-known valid words for these letters
        // Word wheel validation: check against WORD_BANK instead of fixed list
        const VALID_WHEEL_EXTRA=['star','rain','sing','ring','earn','grin','gain','train','groan','stair',
            'grains','reign','string','strain','strange','ingot','tore','store','snore','stone','noter','tenor',
            'ringo','siren','tiger','tiger','stern','stein','inert','inter','tinge','reign','nitro','oaring',
            'soaring','storing','stoning','staring','roasting','organist','groaning','girasol','negator','gainsort',
            'origin','ration','orator','griot','nadir','irone','noria','senor','snore','snort','toner','noter',
            'enroot','inrode','ornate','ration','nation','orates','oaters','iranes','stoner','toners','noters',
            'nestor','orison','onsite','Senior','stogie','goiters','goaners','otaries','notaries','signore',
            'agonist','transistor','ant','are','art','ate','ear','eat','era','ire','oar','ore','rat','ran',
            'roe','rot','rote','sane','sang','sari','sate','saga','saga','sage','ego','ego','ego','ogre',
            'age','ago','sir','sit','tie','toe','ton','too','tor','ore','one','ion','inn','gin','git',
            'tan','tin','ten','net','not','nor','nit','nag','nae','ire','ire','ors','ors','one',
            'ears','eats','eons','eros','etna','giro','gore','gores','goes','gone','goner','gain','gait',
            'gate','gorse','goers','groan','grains','groin','groins','grin','grins','grins','groin','gross',
            'stoic','sonic','sonic','scion','arose','arson','tonic','tonier','ironer','soring','rosin',
            'ostia','oaters','goiter','goiters','inters','inserting','oranges','soaring'];
            let found=new Set(), current='';
            function isValid(w) { 
                if(w.length<3||!w.toLowerCase().includes(CENTER)) return false; 
                const avail=[...ALL_LETTERS]; 
                for(const c of w.toLowerCase()){ const i=avail.indexOf(c); if(i<0) return false; avail.splice(i,1); } 
                return true; // letter combo valid; API will verify it's a real word
            }
            async function isRealEnglishWord(w) {
                if(VALID_WHEEL_EXTRA.includes(w.toLowerCase())) return true;
                if(WORD_BANK.includes(w.toLowerCase())) return true;
                try {
                    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`);
                    return r.ok;
                } catch(e) { return true; } // be lenient on network error
            }
            function render() {
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:14px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">用這些字母組出英文單字（必須包含中間字母 <b style="color:#fbbf24">${CENTER.toUpperCase()}</b>，最少3個字母）</p>
                    <div id="currentWord" style="font-size:28px;font-weight:800;letter-spacing:4px;color:#c4b5fd;min-height:40px;">${current.toUpperCase() || '...'}</div>
                    <div style="position:relative;width:180px;height:180px;">
                        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:48px;height:48px;background:rgba(245,158,11,0.4);border:2px solid #f59e0b;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;cursor:pointer;" onclick="wheelClick('${CENTER}')">${CENTER.toUpperCase()}</div>
                        ${LETTERS.map((l,i)=>{ const angle=(i/LETTERS.length)*2*Math.PI-Math.PI/2; const x=90+72*Math.cos(angle)-24; const y=90+72*Math.sin(angle)-24; return `<div style="position:absolute;left:${x}px;top:${y}px;width:48px;height:48px;background:rgba(139,92,246,0.3);border:1px solid #8b5cf6;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;cursor:pointer;" onclick="wheelClick('${l}')">${l.toUpperCase()}</div>`; }).join('')}
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button onclick="wheelSubmit()" style="background:rgba(52,211,153,0.3);border:1px solid #34d399;color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:700;">確認</button>
                        <button onclick="wheelClear()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;padding:8px 16px;border-radius:8px;cursor:pointer;">清除</button>
                    </div>
                    <div id="wheelFound" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:320px;"></div>
                    <div id="wheelFeedback"></div>`;
                const foundDiv=card.querySelector('#wheelFound');
                [...found].forEach(w=>{ const s=document.createElement('span'); s.textContent=w; s.style.cssText='background:rgba(52,211,153,0.2);color:#34d399;padding:3px 10px;border-radius:20px;font-size:13px;'; foundDiv.appendChild(s); });
                setScore(`✅ 找到 ${found.size} 個單字`);
                gameContainer.appendChild(card);
            }
            window.wheelClick=(l)=>{ current+=l; document.getElementById('currentWord').textContent=current.toUpperCase(); };
            window.wheelSubmit=async ()=>{
                const fb=document.getElementById('wheelFeedback');
                const w=current.toLowerCase();
                if(found.has(w)){ fb.innerHTML='<span style="color:#fbbf24">已找過這個！</span>'; return; }
                if(!isValid(w)){ fb.innerHTML='<span style="color:#f87171">字母組合不符，必須包含中間字母</span>'; setTimeout(()=>{ if(fb) fb.innerHTML=''; },1000); current=''; document.getElementById('currentWord').textContent='...'; return; }
                fb.innerHTML='<span style="color:#94a3b8">驗證中...</span>';
                const valid = await isRealEnglishWord(w);
                if(valid){ found.add(w); current=''; render(); }
                else { fb.innerHTML='<span style="color:#f87171">不是有效的英文單字！</span>'; setTimeout(()=>{ if(fb) fb.innerHTML=''; },1200); current=''; document.getElementById('currentWord').textContent='...'; }
            };
            window.wheelClear=()=>{ current=''; document.getElementById('currentWord').textContent='...'; };
            render();
        }

        // ============================================================
        //  GAME 15 – Mini Crossword (迷你填字)
        // ============================================================
        function game_crossword() {
            // Simple 5x5 crossword
            const puzzle = {
                grid: [
                    ['C','A','T','.','.'],
                    ['.','.','A','.','D'],
                    ['.','.','P','.','O'],
                    ['.','.','.','.','.'],
                    ['D','O','G','.','G'],
                ],
                clues: {
                    across: [{num:1,r:0,c:0,len:3,ans:'cat',clue:'家貓'},{num:5,r:4,c:0,len:3,ans:'dog',clue:'狗'}],
                    down:   [{num:1,r:0,c:2,len:3,ans:'tap',clue:'輕拍'},{num:2,r:1,c:4,len:3,ans:'dog',clue:'狗'}]
                }
            };
            const answers={};
            const SIZE=5;
            let solved=0, total=puzzle.clues.across.length+puzzle.clues.down.length;
            gameContainer.innerHTML='';
            const card=gc('display:flex;flex-direction:column;gap:14px;');
            const gridDiv=document.createElement('div');
            gridDiv.style.cssText=`display:grid;grid-template-columns:repeat(${SIZE},36px);gap:2px;justify-content:center;`;
            const cells=[];
            for(let r=0;r<SIZE;r++){
                cells[r]=[];
                for(let c=0;c<SIZE;c++){
                    const cell=document.createElement('div');
                    if(puzzle.grid[r][c]==='.'){
                        cell.style.cssText='width:36px;height:36px;background:rgba(0,0,0,0.4);border-radius:4px;';
                    } else {
                        const inp=document.createElement('input');
                        inp.maxLength=1; inp.style.cssText='width:36px;height:36px;text-align:center;font-size:16px;font-weight:800;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#f8fafc;outline:none;font-family:inherit;';
                        inp.oninput=()=>{ inp.value=inp.value.toUpperCase(); checkAll(); };
                        cell.appendChild(inp);
                    }
                    cells[r][c]=cell;
                    gridDiv.appendChild(cell);
                }
            }
            card.appendChild(gridDiv);
            const cluesDiv=document.createElement('div');
            cluesDiv.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;';
            cluesDiv.innerHTML=`<div><b style="color:#60a5fa">橫向</b><br>${puzzle.clues.across.map(cl=>`${cl.num}. ${cl.clue}`).join('<br>')}</div><div><b style="color:#34d399">直向</b><br>${puzzle.clues.down.map(cl=>`${cl.num}. ${cl.clue}`).join('<br>')}</div>`;
            card.appendChild(cluesDiv);
            const fb=document.createElement('div'); fb.style.cssText='text-align:center;font-size:14px;color:#fbbf24;';
            card.appendChild(fb);
            function checkAll() {
                let allCorrect=true;
                [...puzzle.clues.across,...puzzle.clues.down].forEach(cl=>{
                    for(let i=0;i<cl.len;i++){
                        const r=cl.r+(cl===puzzle.clues.across[0]||cl===puzzle.clues.across[1]?0:i);
                        const c=cl.c+(cl===puzzle.clues.across[0]||cl===puzzle.clues.across[1]?i:0);
                        const inp=cells[r]?.[c]?.querySelector('input');
                        if(!inp||inp.value.toUpperCase()!==cl.ans[i].toUpperCase()) allCorrect=false;
                    }
                });
                if(allCorrect){ fb.textContent='🎉 填字完成！'; setScore('🏆 完成！'); }
            }
            gameContainer.appendChild(card);
        }

        // ============================================================
        //  GAME 16 – Prefix / Suffix
        // ============================================================
        function game_prefixsuffix() {
            let score=0, q=0;
            const pool=shuffle(PREFIXES);
            function next() {
                if(q>=pool.length){ done(score,pool.length); return; }
                const item=pool[q++];
                const wrong=[pick(PREFIXES.filter(p=>p.prefix!==item.prefix&&p.root!==item.root)).prefix, pick(PREFIXES.filter(p=>p.root!==item.root)).root];
                const opts=shuffle([item.prefix, ...['re','un','dis','pre','mis','over'].filter(p=>p!==item.prefix).slice(0,3)]);
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:16px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">選出正確的字首（prefix），組成意思符合的單字</p>
                    <div style="display:flex;align-items:center;gap:0;font-size:32px;font-weight:800;">
                        <span id="pfxSelected" style="color:#fbbf24;min-width:80px;text-align:right;">???</span>
                        <span style="color:#f8fafc;margin:0 4px;">+</span>
                        <span style="color:#60a5fa;">${item.root}</span>
                        <span style="color:#94a3b8;font-size:16px;margin-left:10px;">= ${item.meaning}</span>
                    </div>
                    <div id="pfxOpts" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;"></div>
                    <div id="pfxFeedback"></div>`;
                gameContainer.appendChild(card);
                const optsDiv=card.querySelector('#pfxOpts');
                opts.forEach(o=>{
                    const b=mkBtn(o+'-');
                    b.style.cssText='padding:12px 20px;border-radius:10px;cursor:pointer;font-size:18px;font-weight:800;font-family:inherit;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.07);color:#f8fafc;';
                    b.onclick=()=>{
                        card.querySelector('#pfxSelected').textContent=o;
                        optsDiv.querySelectorAll('button').forEach(x=>x.disabled=true);
                        const fb=card.querySelector('#pfxFeedback');
                        if(o===item.prefix){ score++; setScore(`✅ ${score}/${pool.length}`); b.style.background='rgba(52,211,153,0.3)'; b.style.borderColor='#34d399'; fb.appendChild(feedback('🎉 正確！'+o+item.root+' = '+item.meaning,true)); setTimeout(next,1500); }
                        else { b.style.background='rgba(248,113,113,0.3)'; optsDiv.querySelectorAll('button').forEach(x=>{ if(x.textContent===item.prefix+'-') x.style.background='rgba(52,211,153,0.2)'; }); fb.appendChild(feedback('正確答案：'+item.prefix+item.root,false)); setTimeout(next,2000); }
                    };
                    optsDiv.appendChild(b);
                });
            }
            next();
        }

        // ============================================================
        //  GAME 17 – True or False
        // ============================================================
        function game_truefalse() {
            let score=0, q=0;
            const pool=shuffle(TRUEFALSE);
            function next() {
                if(q>=pool.length){ done(score,pool.length); return; }
                const item=pool[q++];
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:16px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">這個解釋是否正確？</p>
                    <div style="font-size:30px;font-weight:800;color:#c4b5fd;">${item.word}</div>
                    <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:14px 20px;font-size:16px;color:#f8fafc;text-align:center;">"${item.def}"</div>
                    <div style="display:flex;gap:16px;">
                        <button id="tfTrue" style="padding:14px 32px;border-radius:12px;cursor:pointer;font-size:18px;font-weight:800;font-family:inherit;border:1px solid #34d399;background:rgba(52,211,153,0.2);color:#34d399;">✅ 正確</button>
                        <button id="tfFalse" style="padding:14px 32px;border-radius:12px;cursor:pointer;font-size:18px;font-weight:800;font-family:inherit;border:1px solid #f87171;background:rgba(248,113,113,0.2);color:#f87171;">❌ 錯誤</button>
                    </div>
                    <div id="tfFeedback"></div>`;
                gameContainer.appendChild(card);
                function check(ans) {
                    card.querySelectorAll('button').forEach(b=>b.disabled=true);
                    const fb=card.querySelector('#tfFeedback');
                    if(ans===item.correct){ score++; setScore(`✅ ${score}/${pool.length}`); fb.appendChild(feedback('🎉 正確！',true)); }
                    else { fb.appendChild(feedback(`❌ 正確答案是：${item.correct?'正確':'錯誤'}`,false)); }
                    setTimeout(next,1200);
                }
                card.querySelector('#tfTrue').onclick=()=>check(true);
                card.querySelector('#tfFalse').onclick=()=>check(false);
            }
            next();
        }

        // ============================================================
        //  GAME 18 – Sentence Builder (句子重組)
        // ============================================================
        function game_sentencebuild() {
            let score=0, q=0;
            const pool=shuffle(SENTENCES);
            function next() {
                if(q>=pool.length){ done(score,pool.length); return; }
                const item=pool[q++];
                let chosen=[], remaining=shuffle(item.words);
                function render() {
                    gameContainer.innerHTML='';
                    const card=gc('display:flex;flex-direction:column;gap:14px;');
                    card.innerHTML=`<p style="color:#94a3b8;font-size:13px;text-align:center;">把單字依序排列成正確的句子</p>`;
                    const chosen_div=document.createElement('div');
                    chosen_div.style.cssText='min-height:48px;background:rgba(0,0,0,0.2);border-radius:10px;padding:10px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
                    if(chosen.length===0) { const ph=document.createElement('span'); ph.textContent='點擊下方單字來排列句子...'; ph.style.cssText='color:rgba(255,255,255,0.3);font-size:13px;'; chosen_div.appendChild(ph); }
                    chosen.forEach((w,i)=>{ const b=mkBtn(w); b.style.cssText='padding:6px 12px;border-radius:8px;background:rgba(59,130,246,0.3);border:1px solid #3b82f6;color:#f8fafc;cursor:pointer;font-weight:600;'; b.onclick=()=>{ remaining.push(chosen.splice(i,1)[0]); render(); }; chosen_div.appendChild(b); });
                    card.appendChild(chosen_div);
                    const rem_div=document.createElement('div');
                    rem_div.style.cssText='display:flex;flex-wrap:wrap;gap:8px;justify-content:center;';
                    remaining.forEach((w,i)=>{ const b=mkBtn(w); b.style.cssText='padding:8px 14px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.2);color:#f8fafc;cursor:pointer;font-weight:600;font-size:15px;'; b.onclick=()=>{ chosen.push(remaining.splice(i,1)[0]); render(); }; rem_div.appendChild(b); });
                    card.appendChild(rem_div);
                    const btns=document.createElement('div');
                    btns.style.cssText='display:flex;gap:8px;justify-content:center;';
                    const check=mkBtn('確認 ✓','padding:10px 24px;border-radius:10px;background:rgba(52,211,153,0.3);border:1px solid #34d399;color:#fff;cursor:pointer;font-weight:700;');
                    const reset=mkBtn('重置','padding:10px 16px;border-radius:10px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);color:#94a3b8;cursor:pointer;');
                    check.onclick=()=>{
                        const ans=chosen.join(' ');
                        const fb=document.createElement('div');
                        if(ans===item.answer){ score++; setScore(`✅ ${score}/${pool.length}`); fb.appendChild(feedback('🎉 正確！',true)); setTimeout(next,1200); }
                        else { fb.appendChild(feedback('❌ 順序不對，再試試！',false)); }
                        card.appendChild(fb);
                    };
                    reset.onclick=()=>{ remaining=[...shuffle(item.words)]; chosen=[]; render(); };
                    btns.appendChild(check); btns.appendChild(reset);
                    card.appendChild(btns);
                    gameContainer.appendChild(card);
                }
                render();
            }
            next();
        }

        // ============================================================
        //  GAME 19 – Word Chain (單字接龍)
        // ============================================================
        function game_wordchain() {
        const WORD_BANK=['a','abandon','able','about','above','accept','across','act','add','admit','after','again',
            'age','ago','agree','air','all','allow','almost','alone','along','already','also','always','am','among','an',
            'and','angry','animal','another','any','apart','apply','are','area','arm','around','as','ask','at','ate',
            'away','back','bad','ball','ban','band','base','be','bean','bear','beat','because','become','before','begin',
            'bend','best','big','bike','bird','black','blue','boat','body','bone','book','bore','both','box','boy','brain',
            'break','bright','bring','broad','but','by','cage','calm','came','can','cap','car','card','care','carry',
            'case','cat','cave','change','chest','child','chin','city','clean','clear','climb','clock','close','cloud',
            'coat','cold','come','cook','cool','copy','core','corn','could','count','cover','cross','cry','cup','cute',
            'dad','dark','date','day','deal','dear','deep','deny','did','die','dig','dim','dish','do','dog','done',
            'door','down','draw','dream','drink','drive','drop','dry','duck','dull','dumb','each','ear','earn','east',
            'easy','eat','edge','eight','else','end','enjoy','even','ever','evil','eye','face','fall','fan','far',
            'fast','fat','fear','feel','fell','felt','fill','find','fine','fish','fit','five','flat','fly','foam','fog',
            'fold','fond','food','foot','for','force','form','free','from','front','full','fun','gave','get','give',
            'glad','go','goal','good','got','great','green','grin','grip','grow','gulf','gun','hand','hang','happen',
            'hard','harm','hat','hate','have','head','hear','heat','help','hero','hide','high','hill','him','hit',
            'hold','hole','home','hope','hot','how','huge','hurt','idea','if','ill','into','joy','jump','just','keep',
            'kind','king','know','land','large','last','late','lead','lean','learn','left','less','let','life','light',
            'like','lip','list','live','long','look','loop','low','make','mark','mean','meet','mess','mind','miss',
            'mix','mode','moon','more','most','move','much','must','name','near','need','nest','next','nice','night',
            'nod','nor','nose','not','note','now','once','only','open','out','over','own','page','part','pass','past',
            'path','peak','pick','pile','pine','pink','play','plus','point','poor','post','pull','push','put','quit',
            'race','rain','read','red','rest','rice','ride','ring','rise','rock','role','roll','roof','root','rose',
            'rule','run','rush','safe','said','sand','sang','save','sea','seed','self','sell','send','set','shed',
            'ship','shoe','shop','shot','show','side','sign','sing','skin','sky','sleep','slim','slow','small','smell',
            'snap','snow','sock','soft','soil','sold','some','song','soon','soul','spin','star','stay','step','stir',
            'stop','store','such','suit','sure','swim','tail','take','tall','task','tear','tell','then','they','thin',
            'this','time','told','tone','too','took','top','town','tree','trim','trip','true','try','turn','type',
            'unit','until','upon','used','very','view','warm','wash','wave','way','wear','week','went','were','what',
            'when','wide','wild','will','wind','wine','wing','wish','with','wolf','wood','word','wore','world','wrap',
            'year','your','zero','zone','able','acid','aged','also','area','army','away','baby','back','ball','band',
            'bank','base','bath','bear','beat','been','bell','best','bite','blow','blue','boat','bomb','bond','bone',
            'book','boom','born','boss','both','bowl','bulk','burn','busy','cafe','calm','camp','card','care','case',
            'cash','cast','cell','chat','chef','chin','chip','clan','clay','clip','club','coal','code','coil','coin',
            'coke','cola','come','cork','cost','coup','crew','crop','cure','curl','damp','dare','dark','dart','dash',
            'data','debt','deck','deed','deny','desk','diet','dip','dirt','disk','dope','dose','duel','duke','dumb',
            'dump','dusk','dust','duty','each','earn','ease','edge','emit','exam','exit','expo','fade','fail','fake',
            'fame','farm','feat','feed','feel','feet','felt','fend','fest','file','fill','film','fir','firm','fist',
            'flag','flaw','flea','fled','flew','flip','foe','folk','fond','fool','form','fort','foul','four','fuel',
            'gain','gale','gaze','gear','gene','gift','girl','glow','glue','gone','gown','grab','grad','gram','gray',
            'grew','grid','grin','grip','grit','gulf','gust','hack','hail','half','hall','halt','hand','harm','haze',
            'heal','heap','helm','herd','hero','hike','hill','hint','hire','hive','hold','hood','hook','horn','host',
            'huge','hull','hump','hunt','idol','inch','item','jail','jest','join','joke','jolt','junk','jury','keen',
            'kick','kill','knot','lack','laid','lake','lamp','lark','lash','last','laud','lawn','leak','left','lens',
            'levy','lick','limp','lion','load','loan','lock','logo','lore','lure','lurk','mace','magic','main','mall',
            'malt','mare','mark','mash','mask','mast','mate','math','maze','meal','meat','melt','memo','menu','mesh',
            'mild','milk','mill','mist','mitt','moat','mob','mock','mold','monk','mood','moor','mope','mow','muck',
            'mug','mule','nab','nap','navy','need','neon','newt','nick','nil','nip','node','nook','norm','numb',
            'oaks','oath','obey','odds','omen','once','oral','orb','oval','pace','pact','paid','pail','pain','pair',
            'pale','palm','pane','park','pave','pawn','peak','peel','peer','pest','pier','pile','pill','pipe','pit',
            'plan','plea','plug','plum','plunge','poem','poll','pond','pool','pore','pose','pour','pray','prey','prim',
            'prob','probe','prod','prop','prow','prowl','puff','pulp','pump','pure','purr','quay','rack','rage','rail',
            'rake','ramp','rank','rant','rash','realm','reel','reef','rein','rely','rend','rent','reek','reply','rift',
            'riot','roam','roar','rob','robe','rod','rogue','ruin','ruse','rust','rut','sack','saga','sage','sake',
            'sash','scar','screw','seam','sect','seer','self','serf','sham','shin','shun','silk','sill','silt','siren',
            'skew','slab','slap','slay','slim','slip','slot','slug','slur','smash','smear','smelt','smug','sob','sod',
            'sole','solve','soot','sore','span','spar','spawn','spec','spell','spit','slab','spun','spy','squall',
            'stab','stale','stall','stark','start','stash','steal','steam','stem','sting','stink','stint','stir',
            'stock','stole','stomp','stout','straw','strip','strut','stub','stud','stun','stunt','sub','sung','sunk',
            'swam','swap','swear','swept','swift','swipe','swirl','swoon','tab','tack','tame','tank','taps','tare',
            'tart','taut','teat','tech','text','that','them','thick','thud','thug','tier','tint','tire','toad','toil',
            'toll','torch','tore','torn','toss','tour','tow','tram','trap','tread','trek','trend','trick','trim',
            'truce','truly','tuck','tuft','tug','tulip','tune','tung','turf','tusk','tutor','tweed','undo','urge',
            'vast','veal','veil','vein','vent','vest','vice','vine','void','volt','vow','wail','wait','wake','wane',
            'ward','wart','wasp','watt','wedge','weld','welt','wend','whim','whip','wick','wilt','wimp','wink','wipe',
            'wire','woe','woke','womb','woo','wore','wren','wring','writ','yell','yelp','yoga','yoke'];
            let chain=[], usedWords=new Set(), score=0;
            chain.push('START');
            function getLastChar() { return chain[chain.length-1].slice(-1).toLowerCase(); }
            function render() {
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:14px;');
                card.innerHTML=`<p style="color:#94a3b8;font-size:13px;text-align:center;">每個單字的開頭字母，必須是前一個單字的最後字母</p>`;
                const chainDiv=document.createElement('div');
                chainDiv.style.cssText='display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:rgba(0,0,0,0.15);border-radius:10px;min-height:40px;';
                chain.slice(-6).forEach((w,i,arr)=>{ const s=document.createElement('span'); s.style.cssText=`padding:4px 10px;border-radius:6px;font-size:14px;font-weight:600;${i===arr.length-1?'background:rgba(139,92,246,0.4);color:#c4b5fd;':'background:rgba(255,255,255,0.08);color:#f8fafc;'}`; s.textContent=w; chainDiv.appendChild(s); if(i<arr.length-1){ const a=document.createElement('span'); a.textContent='→'; a.style.cssText='color:#94a3b8;font-size:12px;display:flex;align-items:center;'; chainDiv.appendChild(a); } });
                card.appendChild(chainDiv);
                const hint=document.createElement('p');
                hint.style.cssText='text-align:center;font-size:16px;font-weight:700;color:#fbbf24;';
                hint.innerHTML=`輸入以 "<b>${getLastChar().toUpperCase()}</b>" 開頭的英文單字`;
                card.appendChild(hint);
                const inputRow=document.createElement('div');
                inputRow.style.cssText='display:flex;gap:8px;';
                const inp=document.createElement('input');
                inp.type='text'; inp.placeholder='輸入單字...'; inp.autocomplete='off';
                inp.style.cssText='flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px;color:#fff;font-size:16px;font-family:inherit;outline:none;';
                const sub=mkBtn('接！','padding:10px 16px;border-radius:10px;background:rgba(139,92,246,0.4);border:1px solid #8b5cf6;color:#fff;cursor:pointer;font-weight:700;');
                inputRow.appendChild(inp); inputRow.appendChild(sub); card.appendChild(inputRow);
                const fb=document.createElement('div'); card.appendChild(fb);
                setScore(`⛓️ 接龍長度：${chain.length-1}`);
                function check() {
                    const w=inp.value.trim().toLowerCase();
                    if(!w){ return; }
                    if(w[0]!==getLastChar()){ fb.appendChild(feedback(`❌ 必須以 "${getLastChar().toUpperCase()}" 開頭！`,false)); inp.value=''; return; }
                    if(usedWords.has(w)){ fb.appendChild(feedback('❌ 已使用過這個單字！',false)); inp.value=''; return; }
                    // Validate word: check WORD_BANK first, then free-dictionary API
                    const inBank = WORD_BANK.includes(w);
                    if(!inBank) {
                        // Try API validation asynchronously
                        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`)
                            .then(r => r.ok ? r.json() : null)
                            .then(data => {
                                if(data && data[0] && data[0].word) {
                                    // Valid word - proceed
                                    usedWords.add(w); chain.push(w); score=chain.length-1; inp.value=''; render();
                                } else {
                                    fb.appendChild(feedback('❌ 不是有效的英文單字！',false));
                                    inp.value=''; inp.focus();
                                }
                            })
                            .catch(()=>{ 
                                // Network error - be lenient, allow word
                                usedWords.add(w); chain.push(w); score=chain.length-1; inp.value=''; render();
                            });
                        return;
                    }
                    usedWords.add(w); chain.push(w); score=chain.length-1; inp.value=''; render();
                }
                sub.onclick=check; inp.onkeydown=e=>{ if(e.key==='Enter') check(); };
                inp.focus();
                gameContainer.appendChild(card);
            }
            render();
        }

        // ============================================================
        //  GAME 20 – Word Ladder (單字梯)
        // ============================================================
        function game_wordladder() {
        const LADDERS=[
            {start:'cat',end:'dog',valid:['cat','bat','bad','bag','big','bid','did','dig','dog','cot','got','god','fat','fan','can','cap','cab','lab','lap','map','mad','mid','mud','bud','bug','dug','dug','fog']},
            {start:'cold',end:'warm',valid:['cold','cord','word','ward','warm','bold','told','toll','tall','talk','walk','wall','well','bell','belt','melt','felt','fall','ball','call','hall','hold','gold','goad','road','load','lead','read','head','heal','real','meal','seal','deal','teal','tear','wear','year','hear','heat','seat','neat','meat','beat','bean','lean','mean','team','tram','trap','wrap','warp']},
            {start:'head',end:'tail',valid:['head','bead','beat','belt','bell','ball','tall','tail','heat','meat','meal','teal','tell','sell','seal','real','deal','lead','load','road','toad','told','bold','gold','hold','hole','mole','role','rule','rile','tile','time','lime','line','wine','mine','pine','pint','hint','mint','mist','fist','fish','dish','wish','wisp','wasp','last','mast','past','fast','cast','cost','lost','loft','left','lest','best','rest','rust','gust','dust']},
            {start:'hot',end:'cold',valid:['hot','cot','cat','bat','bad','bid','bud','cold','hog','log','lag','bag','ban','can','cap','cop','cob','cod','cog','con','cot','dot','fog','got','god','hot','lot','not','pod','pot','rod','rot','sob','sod','tog','top','tot']},
            {start:'more',end:'less',valid:['more','bore','core','care','dare','hare','bare','base','case','lace','face','pace','race','rase','rise','wise','wide','ride','side','tide','hide','hire','fire','fare','hare','hale','tale','male','pale','sale','sole','mole','hole','role','rose','nose','note','vote','vole','lore','lore','loss','toss','boss','moss','less','mess','best','rest','test','text','next','nest','rest','jest','vest','west']},
            {start:'love',end:'hate',valid:['love','live','line','lime','like','bike','bite','site','sate','late','mate','gate','rate','date','fate','hate','have','cave','gave','cove','dove','done','bone','bane','lane','lame','game','same','sale','tale','male','pale','sale','sole','mole','hole','role','rose','nose','note','vote','dote','dome','home','come','came','game','fame']},
            {start:'win',end:'lose',valid:['win','bin','bit','bat','cat','car','bar','far','fat','lot','log','lag','bag','ban','can','cap','cop','dot','fog','got','god','hot','lot','not','pod','pot','rod','rot','sob','sod','ton','top','rot','rose','nose','note','vote','lore','loss','toss','boss','moss','lose']},
            {start:'day',end:'night',valid:['day','say','sat','pat','pit','pig','big','bid','rid','rim','rip','tip','tin','tan','ran','run','rut','nut','gut','cut','cup','pup','pub','sub','sun','bun','nun','nun','gun','fun','fan','can','ban','bat','cat','cot','not','hot','hop','top','tip','dip','dim','him','hit','sit','six','mix','fix','fit','kit','knit','grit','grip','drip','drip','trip','trim','tram','gram','grab','crab','crabs','grabs']},
            {start:'fire',end:'ice',valid:['fire','hire','hike','bike','like','lime','time','tide','side','site','bite','kite','mite','mice','rice','rice','dice','nice','vice','vice','ice']},
            {start:'black',end:'white',valid:['black','slack','slick','click','clock','block','blink','brink','drink','drunk','trunk','trink','trick','track','crack','crick','price','priced','priced','grace','place','plate','plane','plant','slant','slang','clang','clank','blank','bland','blend','blond','blood','flood','floor','flour','fluor','flute','flute','flute','fluke','flume','plume','plumb','thumb','thump','stump','stamp','tramp','cramp','clamp','clamp','clam','claim','flail','frail','trail','train','grain','grail','grail']},
        ];
            const puzzle=pick(LADDERS);
            const maxSteps=puzzle.valid ? Math.floor(puzzle.valid.length/3) : 6;
            let current=puzzle.start, path=[puzzle.start], stepCount=0;
            function isOneLetterAway(a,b){ if(a.length!==b.length) return false; let diff=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) diff++; return diff===1; }
            function isRealWord(w){ return puzzle.valid ? puzzle.valid.includes(w) : WORD_BANK.includes(w); }
            function finishLadder() {
                setScore(`🏆 完成！共 ${stepCount} 步（最優：${maxSteps} 步）`);
                gameContainer.innerHTML=''; const c=gc('text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center;');
                c.innerHTML=`<div style="font-size:40px;">🏆</div><div style="font-size:22px;font-weight:800;color:#34d399;">${puzzle.start.toUpperCase()} → ${puzzle.end.toUpperCase()} 完成！</div><div style="font-size:16px;color:#fbbf24;">${stepCount} 步完成（最優解：${maxSteps} 步）</div>`;
                const rb=mkBtn('換一題','background:rgba(59,130,246,0.3);border:1px solid #3b82f6;color:#fff;padding:10px 24px;border-radius:10px;cursor:pointer;font-weight:700;');
                rb.onclick=game_wordladder; c.appendChild(rb); gameContainer.appendChild(c);
            }
                        function render() {
                gameContainer.innerHTML='';
                const card=gc('display:flex;flex-direction:column;gap:14px;align-items:center;');
                card.innerHTML=`
                    <p style="color:#94a3b8;font-size:13px;">每次只改變一個字母，從 <b style="color:#60a5fa">${puzzle.start.toUpperCase()}</b> 爬到 <b style="color:#34d399">${puzzle.end.toUpperCase()}</b></p>
                    <div style="display:flex;flex-direction:column;gap:4px;align-items:center;">
                        ${path.map((w,i)=>`<div style="padding:8px 24px;border-radius:8px;font-size:18px;font-weight:800;${i===0?'background:rgba(59,130,246,0.3);color:#60a5fa;':i===path.length-1?'background:rgba(139,92,246,0.3);color:#c4b5fd;':'background:rgba(255,255,255,0.06);color:#f8fafc;'}">${w.toUpperCase()}</div>${i<path.length-1?'<div style="color:#94a3b8;">↓</div>':''}`).join('')}
                    </div>
                    <div style="display:flex;gap:8px;width:100%;max-width:260px;">
                        <input id="ladderInput" type="text" maxlength="${puzzle.start.length}" placeholder="輸入下一個單字..." style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:10px;color:#fff;font-size:16px;font-family:inherit;outline:none;">
                        <button id="ladderSubmit" style="background:rgba(139,92,246,0.4);border:1px solid #8b5cf6;color:#fff;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:700;">↓</button>
                    </div>
                    <div id="ladderFeedback"></div>`;
                setScore(`🪜 步數：${stepCount} / 最優解：${maxSteps}`);
                gameContainer.appendChild(card);
                const inp=card.querySelector('#ladderInput');
                function check() {
                    const w=inp.value.trim().toLowerCase();
                    const fb=card.querySelector('#ladderFeedback');
                    if(w.length!==puzzle.start.length){ fb.appendChild(feedback(`❌ 必須是 ${puzzle.start.length} 個字母的單字`,false)); inp.value=''; return; }
                    if(!isOneLetterAway(current,w)){ fb.appendChild(feedback('❌ 只能改變一個字母！',false)); inp.value=''; return; }
                    if(!isRealWord(w)){
                        // Fallback to API
                        card.querySelector('#ladderSubmit').disabled=true;
                        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`)
                            .then(r=>r.ok?r.json():null)
                            .then(data=>{
                                card.querySelector('#ladderSubmit').disabled=false;
                                if(!data||!data[0]){ fb.appendChild(feedback('❌ 不是有效的英文單字！',false)); inp.value=''; return; }
                                stepCount++; current=w; path.push(w); inp.value='';
                                if(w===puzzle.end){ finishLadder(); } else render();
                            })
                            .catch(()=>{ card.querySelector('#ladderSubmit').disabled=false; stepCount++; current=w; path.push(w); inp.value=''; if(w===puzzle.end){ finishLadder(); } else render(); });
                        return;
                    }
                    stepCount++; current=w; path.push(w); inp.value='';
                    if(w===puzzle.end){ finishLadder(); return; }
                    render();
                }
                card.querySelector('#ladderSubmit').onclick=check;
                inp.onkeydown=e=>{ if(e.key==='Enter') check(); };
                inp.focus();
            }
            render();
        }

        // ── Helpers ───────────────────────────────────────────────
        function done(score, total) {
            gameContainer.innerHTML='';
            const card=gc('text-align:center;display:flex;flex-direction:column;gap:16px;align-items:center;');
            const pct=Math.round(score/total*100);
            const emoji=pct>=80?'🏆':pct>=50?'👍':'💪';
            card.innerHTML=`
                <div style="font-size:52px;">${emoji}</div>
                <div style="font-size:24px;font-weight:800;color:#fbbf24;">完成！${score}/${total} 題正確 (${pct}%)</div>
                <div style="width:100%;max-width:280px;height:10px;background:rgba(255,255,255,0.1);border-radius:5px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${pct>=80?'#34d399':pct>=50?'#fbbf24':'#f87171'};border-radius:5px;"></div>
                </div>`;
            const rb=mkBtn('再玩一次 ↺','background:rgba(139,92,246,0.3);border:1px solid #8b5cf6;color:#fff;padding:12px 28px;border-radius:12px;cursor:pointer;font-size:16px;font-weight:700;');
            rb.onclick=()=>{ 
                if (currentLoadedGame) {
                    launchGame(currentLoadedGame); 
                } else {
                    cleanupCurrentGame(); 
                    gameMenuView.style.display='block'; 
                    gamePlayView.style.display='none'; 
                    setScore(''); 
                    currentGameTitle.textContent='';
                }
            };
            card.appendChild(rb);
            gameContainer.appendChild(card);
        }

        // Map game IDs to runner functions
        const GAME_RUNNERS = {
            wordscramble: game_wordscramble,
            hangman:      game_hangman,
            wordmatch:    game_wordmatch,
            spellingbee:  game_spellingbee,
            fillblank:    game_fillblank,
            wordtyper:    game_wordtyper,
            antonym:      game_antonym,
            synonym:      game_synonym,
            wordsearch:   game_wordsearch,
            categorize:   game_categorize,
            memorygrid:   game_memorygrid,
            idiomguess:   game_idiomguess,
            letterfall:   game_letterfall,
            wordwheel:    game_wordwheel,
            crossword:    game_crossword,
            prefixsuffix: game_prefixsuffix,
            truefalse:    game_truefalse,
            sentencebuild:game_sentencebuild,
            wordchain:    game_wordchain,
            wordladder:   game_wordladder,
        };

    })(); // end IIFE


    // ===== Mobile Tab Switching =====
    function isMobile() {
        return window.innerWidth <= 640;
    }

    // ── History-based back-button management ────────────────────────
    // Tracks whether we pushed a state for an open modal/menu
    let _historyModalOpen = false;

    function _pushModalState() {
        if (!_historyModalOpen) {
            history.pushState({ modalOpen: true }, '');
            _historyModalOpen = true;
        }
    }

    function _clearModalState() {
        _historyModalOpen = false;
    }

    // Returns the currently active modal overlay (if any), or null
    function _getActiveModal() {
        return document.querySelector('.modal-overlay.active');
    }

    // Returns true if the mobile "more" menu is visible
    function _moreMenuVisible() {
        const m = document.getElementById('mobileMoreMenu');
        return m && m.style.display !== 'none';
    }

    // Central "close topmost layer" — called by popstate
    function _closeTopLayer() {
        if (_moreMenuVisible()) {
            hideMobileMore();
            return;
        }
        const modal = _getActiveModal();
        if (modal) {
            modal.classList.remove('active');
            return;
        }
    }

    // Intercept Android/browser back button
    window.addEventListener('popstate', (e) => {
        _clearModalState();
        if (_moreMenuVisible() || _getActiveModal()) {
            _closeTopLayer();
            // Re-push so another back press can work again if needed
        }
    });

    // ── Overlay click-to-close ───────────────────────────────────────
    document.addEventListener('click', (e) => {
        // If user clicked directly on the overlay (not on the modal-content inside)
        if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('active')) {
            e.target.classList.remove('active');
            _clearModalState();
        }
    });

    // ── Patch all modal open calls to push history state ─────────────
    // We monkey-patch classList.add('active') by wrapping the existing
    // open-button event listeners. Easiest: observe the overlays.
    const _modalOverlayObserver = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            if (m.type === 'attributes' && m.attributeName === 'class') {
                const el = m.target;
                if (el.classList.contains('modal-overlay')) {
                    if (el.classList.contains('active')) {
                        _pushModalState();
                    }
                }
            }
        });
    });
    document.querySelectorAll('.modal-overlay').forEach(el => {
        _modalOverlayObserver.observe(el, { attributes: true });
    });

    function switchMobileTab(tab) {
        if (!isMobile()) return;
        const calcPanel = document.querySelector('.calculator-panel');
        const invPanel = document.querySelector('.inventory-panel');
        const navCalc = document.getElementById('navCalc');
        const navInv = document.getElementById('navInventory');

        if (tab === 'calc') {
            calcPanel.classList.add('mobile-active');
            invPanel.classList.remove('mobile-active');
            navCalc.classList.add('active');
            navInv.classList.remove('active');
        } else {
            invPanel.classList.add('mobile-active');
            calcPanel.classList.remove('mobile-active');
            navInv.classList.add('active');
            navCalc.classList.remove('active');
        }
        hideMobileMore();
        window.scrollTo(0, 0);
    }

    function showMobileMore() {
        const menu = document.getElementById('mobileMoreMenu');
        const isVisible = menu.style.display !== 'none';
        if (!isVisible) {
            menu.style.display = 'block';
            document.getElementById('navMore').classList.add('active');
            _pushModalState();
        } else {
            hideMobileMore();
        }
    }

    function hideMobileMore() {
        document.getElementById('mobileMoreMenu').style.display = 'none';
        document.getElementById('navMore').classList.remove('active');
    }

    // Initialize mobile layout
    function initMobileLayout() {
        if (isMobile()) {
            const calcPanel = document.querySelector('.calculator-panel');
            const invPanel = document.querySelector('.inventory-panel');
            if (!calcPanel.classList.contains('mobile-active') && !invPanel.classList.contains('mobile-active')) {
                calcPanel.classList.add('mobile-active');
            }
        }
    }

    document.addEventListener('DOMContentLoaded', initMobileLayout);
    window.addEventListener('resize', () => {
        const calcPanel = document.querySelector('.calculator-panel');
        const invPanel = document.querySelector('.inventory-panel');
        if (!isMobile()) {
            calcPanel.classList.remove('mobile-active');
            invPanel.classList.remove('mobile-active');
        } else {
            if (!calcPanel.classList.contains('mobile-active') && !invPanel.classList.contains('mobile-active')) {
                calcPanel.classList.add('mobile-active');
            }
        }
    });

    // Close more menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('mobileMoreMenu');
        const navMore = document.getElementById('navMore');
        if (menu && menu.style.display !== 'none' && !menu.contains(e.target) && !navMore.contains(e.target)) {
            hideMobileMore();
        }
    });

    // ===== PWA Install Prompt =====
    let deferredPrompt = null;
    const installBanner = document.getElementById('pwaInstallBanner');
    const installBtn = document.getElementById('pwaInstallBtn');
    const dismissBtn = document.getElementById('pwaDismissBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        setTimeout(() => {
            if (isMobile() && !localStorage.getItem('pwa-dismissed')) {
                installBanner.style.display = 'block';
            }
        }, 3000);
    });

    installBtn && installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBanner.style.display = 'none';
    });

    dismissBtn && dismissBtn.addEventListener('click', () => {
        installBanner.style.display = 'none';
        localStorage.setItem('pwa-dismissed', '1');
    });

    window.addEventListener('appinstalled', () => {
        installBanner.style.display = 'none';
        deferredPrompt = null;
    });

    // ── 即時浮動查字典（完整版）────────────────────────────────────
    (function() {
        const popup   = document.getElementById('floatDictPopup');
        if (!popup) return;
        const popWord  = document.getElementById('floatDictWord');
        const popIpa   = document.getElementById('floatDictIpa');
        const popLoad  = document.getElementById('floatDictLoading');
        const popBody  = document.getElementById('floatDictBody');
        const popErr   = document.getElementById('floatDictError');
        const popAudio = document.getElementById('floatDictAudio');
        const popClose = document.getElementById('floatDictClose');
        let currentAudioUrl = null;

        // 內建常用字中文對照（補充 API 沒有中文的問題）
        const CHI_MAP = {
            abandon:'放棄',able:'能夠的',abundant:'豐富的',achieve:'達成',acquire:'獲得',
            adapt:'適應',add:'增加',admit:'承認',affect:'影響',affirm:'肯定',
            afford:'負擔得起',agree:'同意',alert:'警覺',allow:'允許',alter:'改變',
            ambiguous:'模糊的',analyze:'分析',ancient:'古老的',angry:'生氣的',anxious:'焦慮的',
            approach:'方法/接近',approve:'批准',argue:'爭論',assert:'聲稱',assist:'協助',
            assume:'假設',attempt:'嘗試',avoid:'避免',aware:'意識到的',
            barrier:'障礙',beautiful:'美麗的',believe:'相信',benefit:'利益',big:'大的',
            blunt:'直率的',boost:'提升',brave:'勇敢的',break:'打破',brief:'簡短的',
            brilliant:'傑出的',build:'建立',burden:'負擔',
            calm:'冷靜的',capable:'有能力的',capture:'捕獲',careful:'小心的',cause:'原因',
            challenge:'挑戰',change:'改變',choose:'選擇',chronic:'慢性的',clarify:'澄清',
            clear:'清楚的',collapse:'崩潰',commit:'承諾',common:'普通的',complete:'完成',
            complex:'複雜的',conceal:'隱藏',concept:'概念',concern:'擔憂',confirm:'確認',
            conflict:'衝突',consider:'考慮',constant:'持續的',construct:'建造',
            contrary:'相反的',convince:'說服',cooperate:'合作',courage:'勇氣',
            create:'創造',creative:'創意的',critical:'批判的',crucial:'關鍵的',curious:'好奇的',
            decide:'決定',decline:'下降',dedicate:'致力於',define:'定義',delay:'延誤',
            deliver:'傳遞',depend:'依賴',describe:'描述',desire:'渴望',despite:'儘管',
            detect:'偵測',determine:'決定',devote:'奉獻',different:'不同的',difficult:'困難的',
            diminish:'減少',discover:'發現',discuss:'討論',display:'展示',distinct:'明顯的',
            divide:'分割',dominate:'支配',doubt:'懷疑',dream:'夢想',durable:'耐用的',
            eager:'熱切的',earn:'賺取',easy:'容易的',effective:'有效的',efficient:'有效率的',
            emerge:'出現',enhance:'增強',enjoy:'享受',enormous:'巨大的',ensure:'確保',
            equal:'相等的',essential:'必要的',establish:'建立',evaluate:'評估',evolve:'進化',
            exceed:'超越',exclude:'排除',exhaust:'耗盡',expand:'擴展',expect:'期待',
            experience:'經驗',explain:'解釋',explore:'探索',expose:'暴露',express:'表達',
            facilitate:'促進',fail:'失敗',fair:'公平的',faith:'信念',famous:'著名的',
            fast:'快速的',fear:'恐懼',feel:'感覺',flexible:'靈活的',flourish:'繁盛',
            focus:'專注',follow:'跟隨',force:'力量',forget:'忘記',forgive:'原諒',
            fragile:'脆弱的',free:'自由的',frequent:'頻繁的',fulfill:'履行',
            gain:'獲得',generate:'產生',genuine:'真實的',goal:'目標',govern:'管治',
            grateful:'感激的',guarantee:'保證',happy:'快樂的',help:'幫助',
            hesitate:'猶豫',highlight:'突出',honest:'誠實的',honor:'榮耀',hope:'希望',
            humble:'謙遜的',identify:'識別',ignore:'忽視',illustrate:'說明',impact:'影響',
            imply:'暗示',important:'重要的',improve:'改善',indicate:'表示',influence:'影響',
            inspire:'激勵',intense:'強烈的',interpret:'解釋',involve:'涉及',
            join:'加入',judge:'判斷',justify:'辯護',keen:'渴望的',kind:'善良的',
            knowledge:'知識',large:'大的',learn:'學習',leave:'離開',liberal:'自由的',
            limited:'有限的',linger:'徘徊',listen:'聆聽',live:'生活',logical:'合理的',
            love:'愛',loyal:'忠誠的',lucky:'幸運的',maintain:'維持',manage:'管理',
            migrate:'遷移',mind:'心智',moderate:'適度的',monitor:'監控',motivate:'激勵',
            neutral:'中立的',notion:'概念',numerous:'眾多的',obstacle:'障礙物',
            obvious:'明顯的',obtain:'獲得',occur:'發生',open:'開放的',oppose:'反對',
            overcome:'克服',patient:'有耐心的',peace:'和平',perceive:'感知',persist:'堅持',
            plan:'計劃',practice:'練習',precise:'精確的',predict:'預測',prepare:'準備',
            prevent:'防止',promote:'促進',protect:'保護',proud:'驕傲的',prove:'證明',
            provide:'提供',pure:'純粹的',quest:'追求',rational:'理性的',reach:'到達',
            ready:'準備好的',reason:'理由',recognize:'認識',reduce:'減少',reflect:'反映',
            remember:'記得',resolve:'解決',respect:'尊重',responsible:'負責任的',
            restore:'恢復',reveal:'揭示',rise:'上升',safe:'安全的',save:'拯救',
            scarce:'稀缺的',search:'搜索',sensitive:'敏感的',serious:'嚴肅的',share:'分享',
            significant:'重要的',similar:'相似的',simple:'簡單的',smart:'聰明的',
            solve:'解決',speak:'說話',specific:'特定的',stable:'穩定的',strengthen:'加強',
            study:'學習',success:'成功',sufficient:'足夠的',suggest:'建議',support:'支持',
            surprise:'驚喜',sustain:'維持',teach:'教導',tendency:'趨勢',think:'思考',
            thrive:'茁壯',transform:'轉化',trust:'信任',truth:'真相',typical:'典型的',
            understand:'理解',unite:'團結',unique:'獨特的',utilize:'利用',vague:'模糊的',
            value:'價值',victory:'勝利',vital:'至關重要的',wander:'漫遊',widespread:'廣泛的',
            wise:'明智的',wonder:'驚奇',work:'工作',worry:'擔心',yearn:'渴望',
            // 基礎常用詞
            cat:'貓',dog:'狗',run:'跑',jump:'跳',play:'玩',read:'閱讀',book:'書',
            blue:'藍色',fast:'快速',kind:'善良',water:'水',fire:'火',earth:'土地',
            wind:'風',sky:'天空',sun:'太陽',moon:'月亮',star:'星星',tree:'樹',
            flower:'花',bird:'鳥',fish:'魚',cold:'寒冷',hot:'熱',big:'大',small:'小',
            happy:'快樂',sad:'悲傷',good:'好',bad:'壞',old:'老舊',new:'新',
            long:'長',short:'短',high:'高',low:'低',strong:'強壯',weak:'弱',
            light:'光/輕',dark:'黑暗',clean:'乾淨',dirty:'骯髒',rich:'富有',poor:'貧窮',
            true:'真實',false:'假的',open:'開放',close:'關閉',start:'開始',stop:'停止',
            give:'給予',take:'拿取',make:'製作',break:'打破',find:'找到',lose:'失去',
            win:'贏',fail:'失敗',live:'生活',die:'死亡',grow:'成長',fall:'落下',
            rise:'上升',stand:'站立',sit:'坐下',walk:'走路',talk:'說話',see:'看見',
            hear:'聽見',feel:'感覺',know:'知道',think:'思考',want:'想要',need:'需要',
            like:'喜歡',love:'愛',hate:'恨',fear:'恐懼',hope:'希望',dream:'夢想',
        };

        function getChiDef(word) {
            return CHI_MAP[word.toLowerCase()] || '';
        }

        function showPopup(word, x, y) {
            word = word.replace(/[^a-zA-Z'-]/g, '').toLowerCase().trim();
            if (!word || word.length < 2) return;

            // Show popup immediately with loading state
            popup.style.display = 'flex';
            popWord.textContent  = word;
            popIpa.textContent   = '';
            popLoad.style.display = 'block';
            popBody.style.display = 'none';
            popErr.style.display  = 'none';
            popBody.innerHTML     = '';
            currentAudioUrl       = null;

            // Position after display so we can measure
            requestAnimationFrame(() => {
                const pw = popup.offsetWidth  || 320;
                const ph = popup.offsetHeight || 80;
                const vw = window.innerWidth, vh = window.innerHeight;
                let px = x + 14, py = y + 14;
                if (px + pw > vw - 8) px = x - pw - 8;
                if (py + ph > vh - 8) py = Math.max(8, vh - ph - 8);
                if (px < 8) px = 8;
                if (py < 8) py = 8;
                popup.style.left = px + 'px';
                popup.style.top  = py + 'px';
            });

            // Fetch full dictionary data
            fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
                .then(r => r.ok ? r.json() : Promise.reject('not found'))
                .then(data => {
                    popLoad.style.display = 'none';
                    const entry = data[0];

                    // ── Phonetics ──
                    const phonetics = entry.phonetics || [];
                    const ipaObj    = phonetics.find(p => p.text) || {};
                    const audioObj  = phonetics.find(p => p.audio) || {};
                    const ipa       = ipaObj.text || '';
                    const audioUrl  = audioObj.audio || '';
                    currentAudioUrl = audioUrl;
                    popIpa.textContent = ipa;

                    // ── Chinese definition ──
                    const chiDef = getChiDef(word);

                    // ── Build full content ──
                    const meanings = entry.meanings || [];
                    let html = '';

                    // Chinese def banner (if available)
                    if (chiDef) {
                        html += `<div style="background:rgba(251,182,206,0.12); border-left:3px solid #fca5a5; border-radius:0 8px 8px 0; padding:8px 12px; margin:12px 0 10px; font-size:15px; font-weight:700; color:#fca5a5;">${chiDef}</div>`;
                    }

                    // Each part of speech
                    meanings.forEach((m, mi) => {
                        html += `<div style="margin-bottom:12px;">`;
                        html += `<span style="display:inline-block; background:rgba(139,92,246,0.25); border:1px solid rgba(139,92,246,0.5); color:#c4b5fd; font-size:11px; font-weight:700; padding:2px 8px; border-radius:20px; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">${m.partOfSpeech}</span>`;

                        // Show up to 3 definitions
                        const defs = (m.definitions || []).slice(0, 3);
                        defs.forEach((d, di) => {
                            html += `<div style="margin-bottom:8px;">`;
                            html += `<div style="font-size:13px; color:#e2e8f0; line-height:1.55;">${di + 1}. ${d.definition}</div>`;
                            if (d.example) {
                                html += `<div style="font-size:12px; color:#7dd3fc; font-style:italic; margin-top:4px; padding-left:10px; border-left:2px solid rgba(125,211,252,0.3);">"${d.example}"</div>`;
                            }
                            html += `</div>`;
                        });

                        // Synonyms for this POS
                        if (m.synonyms && m.synonyms.length > 0) {
                            const syns = m.synonyms.slice(0, 6).join(', ');
                            html += `<div style="font-size:11px; color:#94a3b8; margin-top:4px;">同義詞：<span style="color:#6ee7b7;">${syns}</span></div>`;
                        }
                        // Antonyms
                        if (m.antonyms && m.antonyms.length > 0) {
                            const ants = m.antonyms.slice(0, 4).join(', ');
                            html += `<div style="font-size:11px; color:#94a3b8; margin-top:2px;">反義詞：<span style="color:#f87171;">${ants}</span></div>`;
                        }

                        html += `</div>`;

                        // Divider between parts of speech
                        if (mi < meanings.length - 1) {
                            html += `<div style="height:1px; background:rgba(255,255,255,0.07); margin:4px 0 10px;"></div>`;
                        }
                    });

                    // Source link hint (subtle)
                    html += `<div style="font-size:10px; color:rgba(148,163,184,0.5); margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06);">📖 Free Dictionary API</div>`;

                    popBody.innerHTML     = html;
                    popBody.style.display = 'block';

                    // Auto-play pronunciation
                    if (audioUrl) {
                        const a = new Audio(audioUrl);
                        a.volume = 0.6;
                        a.play().catch(() => {});
                    } else {
                        const u = new SpeechSynthesisUtterance(word);
                        u.lang = 'en-US'; u.rate = 0.85;
                        speechSynthesis.speak(u);
                    }

                    // Reposition after content loaded
                    requestAnimationFrame(() => {
                        const pw = popup.offsetWidth  || 320;
                        const ph = popup.offsetHeight || 200;
                        const vw = window.innerWidth, vh = window.innerHeight;
                        let px = parseFloat(popup.style.left), py = parseFloat(popup.style.top);
                        if (py + ph > vh - 8) py = Math.max(8, vh - ph - 8);
                        if (px + pw > vw - 8) px = Math.max(8, vw - pw - 8);
                        popup.style.left = px + 'px';
                        popup.style.top  = py + 'px';
                    });
                })
                .catch(() => {
                    popLoad.style.display = 'none';
                    // Check if we at least have a Chinese def for basic words
                    const chiDef = getChiDef(word);
                    if (chiDef) {
                        popBody.innerHTML = `<div style="background:rgba(251,182,206,0.12); border-left:3px solid #fca5a5; border-radius:0 8px 8px 0; padding:8px 12px; margin:10px 0; font-size:15px; font-weight:700; color:#fca5a5;">${chiDef}</div><div style="font-size:12px; color:#94a3b8; margin-top:6px;">（網路連線問題，顯示基本定義）</div>`;
                        popBody.style.display = 'block';
                    } else {
                        popErr.style.display  = 'block';
                        popErr.innerHTML = `<div>查無「${word}」</div><div style="font-size:11px; margin-top:4px; color:#94a3b8;">請確認拼字，或檢查網路連線</div>`;
                    }
                    // TTS fallback
                    const u = new SpeechSynthesisUtterance(word);
                    u.lang = 'en-US'; u.rate = 0.85;
                    speechSynthesis.speak(u);
                });
        }

        // ── Buttons ───────────────────────────────────────────────
        popAudio.onclick = () => {
            if (currentAudioUrl) { new Audio(currentAudioUrl).play().catch(() => {}); }
            else { const u = new SpeechSynthesisUtterance(popWord.textContent); u.lang = 'en-US'; speechSynthesis.speak(u); }
        };
        popClose.onclick = () => { popup.style.display = 'none'; };

        // ── Close on outside click ────────────────────────────────
        document.addEventListener('click', (e) => {
            if (popup.style.display !== 'none' && !popup.contains(e.target)) {
                popup.style.display = 'none';
            }
        });

        // ── Double-click any text to look up ──────────────────────
        document.addEventListener('dblclick', (e) => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed) return;
            const word = sel.toString().trim().replace(/[^a-zA-Z'-]/g, '');
            if (word.length >= 2 && word.length <= 30) {
                e.preventDefault();
                showPopup(word, e.clientX, e.clientY);
            }
        });

        // ── Long-press on mobile ───────────────────────────────────
        let pressTimer = null;
        document.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                const sel = window.getSelection();
                const word = sel ? sel.toString().trim().replace(/[^a-zA-Z'-]/g, '') : '';
                if (word.length >= 2) {
                    const touch = e.touches[0];
                    showPopup(word, touch.clientX, touch.clientY);
                }
            }, 600);
        }, { passive: true });
        document.addEventListener('touchend',  () => clearTimeout(pressTimer), { passive: true });
        document.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });

        // ── Article clickable words ────────────────────────────────
        document.addEventListener('click', (e) => {
            const span = e.target.closest('.clickable-word');
            if (!span) return;
            const word = span.getAttribute('data-word') || span.textContent.trim();
            if (word) { e.stopPropagation(); showPopup(word, e.clientX, e.clientY); }
        }, true);

        // Expose globally
        window.showFloatDict = showPopup;
    })();

    