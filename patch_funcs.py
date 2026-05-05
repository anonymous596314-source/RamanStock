
import re
import os

path = r'c:\Users\PC\Desktop\APP開發\analysis.js'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

def replace_func(func_name, new_code):
    global lines
    start_line = -1
    for i, line in enumerate(lines):
        if f'function {func_name}(' in line:
            start_line = i
            break
    if start_line == -1: return False
    
    brace_count = 0
    end_line = -1
    started = False
    for i in range(start_line, len(lines)):
        brace_count += lines[i].count('{')
        brace_count -= lines[i].count('}')
        if '{' in lines[i]: started = True
        if started and brace_count == 0:
            end_line = i
            break
    if end_line == -1: return False
    
    lines[start_line:end_line+1] = [new_code + '\n']
    return True

new_stat_row = """function renderStatRow(label, value, barPercent = null) {
    const termKey = Object.keys(termDefinitions).find(k => label.includes(k));
    const labelHtml = termKey 
        ? `<span class="analysis-label has-info" onclick="showTermExplainer('${termKey}')">${label}</span>`
        : `<span class="analysis-label">${label}</span>`;

    return `
        <div class="analysis-stat-row">
            ${labelHtml}
            <div style="display:flex; flex-direction:column; align-items:flex-end; flex:1;">
                <span class="analysis-val">${value}</span>
                ${barPercent !== null ? `
                    <div class="progress-bar-bg" style="width: 80px;">
                        <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, barPercent))}%; background: ${barPercent > 80 ? '#ef4444' : (barPercent < 30 ? '#4ade80' : '#3b82f6')};"></div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}"""

new_percent_row = """function renderPercentRow(label, value, showBar = true) {
    const isNA = value === null || value === undefined;
    const num = parseFloat(value);
    const color = isNA ? '#64748b' : (num >= 0 ? '#ef4444' : '#10b981');
    const displayVal = isNA ? 'N/A' : (num > 0 ? '+' : '') + safeFix(num, 2) + '%';
    
    const termKey = Object.keys(termDefinitions).find(k => label.includes(k));
    const labelHtml = termKey 
        ? `<span class="analysis-label has-info" onclick="showTermExplainer('${termKey}')">${label}</span>`
        : `<span class="analysis-label">${label}</span>`;

    return `
        <div class="analysis-stat-row">
            ${labelHtml}
            <div style="display:flex; flex-direction:column; align-items:flex-end; flex:1;">
                <span class="analysis-val" style="color:${color}">${displayVal}</span>
                ${(showBar && !isNA) ? `
                    <div class="progress-bar-bg" style="width: 80px;">
                        <div class="progress-bar-fill" style="width: ${Math.min(100, Math.abs(num))}%; background: ${color}; opacity: 0.6;"></div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}"""

if replace_func('renderStatRow', new_stat_row) and replace_func('renderPercentRow', new_percent_row):
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('Success')
else:
    print('Failed')
