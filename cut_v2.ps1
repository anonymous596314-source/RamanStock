
$p = Get-Item "analysis.js"
$c = Get-Content $p.FullName -Raw -Encoding UTF8
$m = "// === Indicators Encyclopedia"
$i = $c.IndexOf($m)
if ($i -gt 0) {
    $clean = $c.Substring(0, $i)
    Set-Content -Path $p.FullName -Value $clean -Encoding UTF8
    Write-Host "Cut Success"
}
