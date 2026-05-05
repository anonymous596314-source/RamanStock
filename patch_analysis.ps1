$content = [System.IO.File]::ReadAllText("c:\Users\PC\Desktop\APP開發\index.html", [System.Text.Encoding]::UTF8)

$search1 = '<div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center;">(?s).*?<button class="btn-delete" data-id="\$\{item\.id\}" style="padding:4px 12px; font-size:12px;">'
$replace1 = '<div style="display:flex; flex-direction:row; gap:8px; align-items:center; justify-content:flex-end;">
                          <button class="btn-analyze" data-code="${item.code}" data-name="${item.name}" style="padding:4px 12px; font-size:12px; background:transparent; color:#60a5fa; border:1px solid rgba(96,165,250,0.4); border-radius:6px; cursor:pointer;">分析</button>
                          <button class="btn-delete" data-id="${item.id}" style="padding:4px 12px; font-size:12px;">'

$content = [System.Text.RegularExpressions.Regex]::Replace($content, $search1, $replace1)

$search2 = '<div style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center;">(?s).*?<button class="btn-delete-st" data-id="\$\{item\.id\}" style="padding:4px 12px; font-size:12px;">'
$replace2 = '<div style="display:flex; flex-direction:row; gap:8px; align-items:center; justify-content:flex-end;">
                          <button class="btn-analyze" data-code="${item.code}" data-name="${item.name}" style="padding:4px 12px; font-size:12px; background:transparent; color:#60a5fa; border:1px solid rgba(96,165,250,0.4); border-radius:6px; cursor:pointer;">分析</button>
                          <button class="btn-delete-st" data-id="${item.id}" style="padding:4px 12px; font-size:12px;">'

$content = [System.Text.RegularExpressions.Regex]::Replace($content, $search2, $replace2)

$modalHTML = @"
    <div class="modal-overlay" id="analysisModal">
        <div class="modal-content" style="max-width: 800px; display:flex; flex-direction:column; gap:16px;">
            <div class="modal-header">
                <h2 id="analysisTitle">📊 個股分析</h2>
                <button class="close-btn" id="closeAnalysisBtn">&times;</button>
            </div>
            <div class="modal-body" style="flex:1; overflow-y:auto; padding-right:8px;" id="analysisBody">
                <div style="text-align:center; padding:40px; color:#94a3b8;">
                    <div class="spinner" style="width:30px; height:30px; border:3px solid rgba(255,255,255,0.1); border-top-color:#3b82f6; border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 16px;"></div>
                    載入分析數據中...
                </div>
            </div>
        </div>
    </div>
<link rel="stylesheet" href="analysis.css">
<script src="analysis.js"></script>
</body>
"@

if (-not $content.Contains('id="analysisModal"')) {
    $content = $content.Replace("</body>", $modalHTML)
}

[System.IO.File]::WriteAllText("c:\Users\PC\Desktop\APP開發\index.html", $content, [System.Text.Encoding]::UTF8)
Write-Host "Patch complete."
