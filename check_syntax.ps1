
$content = Get-Content 'c:\Users\PC\Desktop\APP開發\analysis.js' -Raw
$chars = $content.ToCharArray()

$openBrace = 0
$closeBrace = 0
$backticks = 0

for ($i = 0; $i -lt $chars.Count; $i++) {
    if ($chars[$i] -eq '{') { $openBrace++ }
    elseif ($chars[$i] -eq '}') { $closeBrace++ }
    elseif ($chars[$i] -eq '`') { $backticks++ }
}

Write-Host "Open Braces: $openBrace"
Write-Host "Close Braces: $closeBrace"
Write-Host "Backticks: $backticks"

if ($openBrace -ne $closeBrace) { Write-Host "!!! Brace Mismatch !!!" }
if ($backticks % 2 -ne 0) { Write-Host "!!! Unclosed Template Literal !!!" }
