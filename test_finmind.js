async function testFinMind(dataset, data_id) {
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}&data_id=${data_id}&start_date=2024-01-01`;
    console.log(`Testing ${dataset}...`);
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.data) {
            console.log(`  ${dataset}: OK (${data.data.length} records)`);
        } else {
            console.log(`  ${dataset}: FAIL (No data)`);
            console.log(JSON.stringify(data).substring(0, 200));
        }
    } catch (e) {
        console.log(`  ${dataset}: ERROR (${e.message})`);
    }
}

async function run() {
    const datasets = [
        'TaiwanStockPrice',
        'TaiwanStockPER',
        'TaiwanStockFinancialStatements',
        'TaiwanStockBalanceSheet',
        'TaiwanStockCashFlowsStatement',
        'TaiwanStockInstitutionalInvestorsBuySell',
        'TaiwanStockMonthRevenue'
    ];
    for (const ds of datasets) {
        await testFinMind(ds, '2330');
    }
}

run();
