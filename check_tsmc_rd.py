import requests
import json

def check_tsmc_data():
    symbol = "2330"
    url = f"https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockFinancialStatements&data_id={symbol}&start_date=2024-01-01"
    
    try:
        response = requests.get(url)
        data = response.json()
        if data.get('msg') == 'success':
            latest_date = sorted(list(set([x['date'] for x in data['data']])))[-1]
            print(f"Latest Date: {latest_date}")
            latest_items = [x for x in data['data'] if x['date'] == latest_date]
            
            print("\nAvailable keys in Financial Statements:")
            for item in latest_items:
                print(f"- {item['type']}: {item['value']}")
                
            rd_items = [x for x in latest_items if 'Research' in x['type'] or '研究' in x['type'] or 'RD' in x['type']]
            print("\nPotential R&D items:")
            for item in rd_items:
                print(f"FOUND: {item['type']} = {item['value']}")
        else:
            print("API Error:", data)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    check_tsmc_data()
