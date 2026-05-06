const fetch = require('node-fetch');

async function checkPledge() {
    const rawSymbol = '2330';
    const dPledge = new Date(); 
    dPledge.setDate(dPledge.getDate() - 100);
    const startDate = dPledge.toISOString().split('T')[0];
    const urlPledge = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDirectorShareholding&data_id=${rawSymbol}&start_date=${startDate}`;

    console.log(`Fetching: ${urlPledge}`);
    try {
        const response = await fetch(urlPledge);
        const json = await response.json();
        console.log('Data length:', json.data ? json.data.length : 0);
        if (json.data && json.data.length > 0) {
            const latestDate = json.data[json.data.length - 1].date;
            const latestData = json.data.filter(x => x.date === latestDate);
            console.log('Latest Date:', latestDate);
            console.log('Sample row:', latestData[0]);
            
            const totalHolding = latestData.reduce((s, x) => s + (x.holding_shares || 0), 0);
            const totalPledged = latestData.reduce((s, x) => s + (x.pledge_shares || 0), 0);
            console.log('Total Holding:', totalHolding);
            console.log('Total Pledged:', totalPledged);
            console.log('Pledge Ratio:', totalHolding > 0 ? (totalPledged / totalHolding) * 100 : 'N/A');
        } else {
            console.log('No data found for the given date range.');
        }
    } catch (e) {
        console.error('Error fetching data:', e);
    }
}

checkPledge();
