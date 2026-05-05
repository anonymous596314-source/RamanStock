
async function test() {
    const symbol = '2330';
    const d = new Date();
    d.setDate(d.getDate() - 200);
    const startDate = d.toISOString().split('T')[0];
    const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockFinancialStatements&data_id=${symbol}&start_date=${startDate}`;
    
    console.log(`Fetching: ${url}`);
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.data) {
        const latestDate = [...new Set(json.data.map(x => x.date))].sort().pop();
        console.log(`Latest Date: ${latestDate}`);
        const latestS = json.data.filter(x => x.date === latestDate);
        latestS.forEach(item => {
            console.log(`${item.type}: ${item.value}`);
        });
    } else {
        console.log("No data found");
    }
}

test();
