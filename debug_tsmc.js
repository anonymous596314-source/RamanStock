const https = require('https');

const url = 'https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockFinancialStatements&data_id=2330&start_date=2024-01-01';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.data) {
                const latestDate = json.data.map(x => x.date).sort().pop();
                const latest = json.data.filter(x => x.date === latestDate);
                console.log('Latest Date:', latestDate);
                latest.forEach(item => {
                    console.log(`${item.type} | ${item.origin_name} | ${item.value}`);
                });
            }
        } catch (e) {
            console.error('JSON Parse Error:', e);
        }
    });
}).on('error', (err) => {
    console.error('Request Error:', err);
});
