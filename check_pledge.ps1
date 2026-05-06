$rawSymbol = "2330"
$dPledge = (Get-Date).AddDays(-100)
$startDate = $dPledge.ToString("yyyy-MM-dd")
$urlPledge = "https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockDirectorShareholding&data_id=$rawSymbol&start_date=$startDate"

Write-Host "Fetching: $urlPledge"
try {
    $response = Invoke-RestMethod -Uri $urlPledge -Method Get
    if ($response.data -and $response.data.Count -gt 0) {
        $data = $response.data
        $latestDate = $data[$data.Count - 1].date
        $latestData = $data | Where-Object { $_.date -eq $latestDate }
        
        Write-Host "Latest Date: $latestDate"
        Write-Host "Sample row: $($latestData[0] | ConvertTo-Json)"
        
        $totalHolding = 0
        $totalPledged = 0
        foreach ($item in $latestData) {
            $totalHolding += [double]$item.holding_shares
            $totalPledged += [double]$item.pledge_shares
        }
        
        Write-Host "Total Holding: $totalHolding"
        Write-Host "Total Pledged: $totalPledged"
        if ($totalHolding -gt 0) {
            $ratio = ($totalPledged / $totalHolding) * 100
            Write-Host "Pledge Ratio: $ratio %"
        } else {
            Write-Host "Pledge Ratio: N/A (Total Holding is 0)"
        }
    } else {
        Write-Host "No data found for the given date range."
    }
} catch {
    Write-Host "Error fetching data: $_"
}
