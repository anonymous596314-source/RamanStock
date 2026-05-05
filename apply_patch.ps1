$ErrorActionPreference = "Stop"

$jsonRaw = Get-Content patch.json -Raw -Encoding UTF8
$patch = ConvertFrom-Json $jsonRaw

$html = Get-Content index_utf8.html -Raw -Encoding UTF8
$html = $html.Replace("`r`n", "`n")

$html = $html.Replace($patch.head_old, $patch.head_new)
$html = $html.Replace($patch.tabs_old, $patch.tabs_new)
$html = $html.Replace($patch.sections_old, $patch.sections_new)
$html = $html.Replace($patch.script_old, $patch.script_new)

$html = $html.Replace("`n", "`r`n")

[System.IO.File]::WriteAllText("$PWD\index.html", $html, [System.Text.Encoding]::UTF8)

Write-Host "Replaced sections: $($html.Contains('dictionarySection'))"
Write-Host "Replaced tabs: $($html.Contains('tabDictionaryBtn'))"
Write-Host "Replaced scripts: $($html.Contains('fetchAndShowWord'))"
Write-Host "Patch applied successfully!"
