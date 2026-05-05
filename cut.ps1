
$p = "c:\Users\PC\Desktop\APP開發\analysis.js"
$c = [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
$m = "// === Indicators Encyclopedia"
$i = $c.IndexOf($m)
if ($i -gt 0) {
    $clean = $c.Substring(0, $i)
    [System.IO.File]::WriteAllText($p, $clean, [System.Text.Encoding]::UTF8)
    Write-Host "Cut Success"
}
