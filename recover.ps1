$logPath = "C:\Users\PC\.gemini\antigravity\brain\914fb94b-99e2-418c-b3d9-670f2fa74500\.system_generated\logs\overview.txt"
$outPath = "c:\Users\PC\Desktop\APP開發\scratch\recovered_analysis.js"

if (-not (Test-Path $logPath)) {
    Write-Error "Log file not found!"
    exit
}

Write-Host "Reading log file..."
$content = Get-Content $logPath -Raw

Write-Host "Searching for content blocks..."
# Find all "content":"..." blocks
$pattern = '"content":"(.*?)"'
$matches = [regex]::Matches($content, $pattern)

$bestCode = ""
$maxLength = 0

foreach ($match in $matches) {
    $rawContent = $match.Groups[1].Value
    # Basic unescape
    $unescaped = $rawContent.Replace('\n', "`n").Replace('\"', '"').Replace('\\', '\')
    
    if ($unescaped.Contains("function renderAnalysis")) {
        Write-Host "Found potential code block (Length: $($unescaped.Length))"
        if ($unescaped.Length -gt $maxLength) {
            $maxLength = $unescaped.Length
            $bestCode = $unescaped
        }
    }
}

if ($bestCode -ne "") {
    $bestCode | Out-File -FilePath $outPath -Encoding utf8
    Write-Host "Successfully recovered code to $outPath"
} else {
    Write-Host "No valid code blocks found."
}
