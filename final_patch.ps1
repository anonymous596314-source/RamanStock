$utf8 = New-Object System.Text.UTF8Encoding $false
$html = [System.IO.File]::ReadAllText("C:\Users\PC\Desktop\APP開發\index_utf8.html", $utf8)

# --- 1. HTML Layout ---
$old1 = @"
            <div style="display:flex; justify-content:center; gap:8px; margin-bottom: 8px; flex-wrap:wrap;">
                <button id="tabFlashcardBtn" class="btn primary-btn" style="width:auto; padding:8px 20px;">🗂️ 單字卡</button>
                <button id="tabArticleBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">📖 短文閱讀</button>
                <button id="tabGamesBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px; background:rgba(139,92,246,0.2); border-color:rgba(139,92,246,0.5); color:#c4b5fd;">🎮 益智遊戲</button>
            </div>

            <!-- 單字卡模式區塊 -->
            <div id="flashcardSection" style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                <div style="flex:1; display:flex; gap:4px; min-width:200px;">
                    <input type="text" id="dictSearchInput" placeholder="輸入單字直接查字典..." class="input-field" style="background:rgba(0,0,0,0.3); border-color:rgba(59, 130, 246, 0.3);">
                    <button id="dictSearchBtn" class="btn primary-btn" style="padding:0 16px;">🔍 查詢</button>
                </div>
                <button id="addVocabGroupBtn" class="btn secondary-btn" style="background:rgba(16, 185, 129, 0.15); color:#6ee7b7; border-color:rgba(16, 185, 129, 0.3);">➕ 新增群組</button>
            </div>
"@
$new1 = @"
            <div style="display:flex; justify-content:center; gap:8px; margin-bottom: 8px; flex-wrap:wrap;">
                <button id="tabFlashcardBtn" class="btn primary-btn" style="width:auto; padding:8px 20px;">🗂️ 單字卡</button>
                <button id="tabDictionaryBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">🔍 查字典</button>
                <button id="tabArticleBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">📖 短文閱讀</button>
                <button id="tabGamesBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px; background:rgba(139,92,246,0.2); border-color:rgba(139,92,246,0.5); color:#c4b5fd;">🎮 益智遊戲</button>
            </div>

            <!-- 查字典模式區塊 -->
            <div id="dictionarySection" style="display:none; flex-direction:column; gap:16px;">
                <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                    <div style="flex:1; display:flex; gap:4px; min-width:200px;">
                        <input type="text" id="dictSearchInput" placeholder="輸入單字查字典..." class="input-field" style="background:rgba(0,0,0,0.3); border-color:rgba(59, 130, 246, 0.3);">
                        <button id="dictSearchBtn" class="btn primary-btn" style="padding:0 16px;">🔍 查詢</button>
                    </div>
                </div>
                <!-- 字典結果卡片 -->
                <div id="dictLoading" style="display:none; text-align:center; padding:40px; color:#cbd5e1;">讀取中...</div>
                <div id="dictResultCard" class="flashcard glass-panel" style="display:none; background: rgba(255,255,255,0.05); padding: 30px 20px 20px; border-radius: 16px; position:relative; text-align:left;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h1 id="dictWordResult" style="font-size: 40px; font-weight: 800; letter-spacing: 2px; color: #fff; margin-bottom: 4px; line-height:1;"></h1>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <p id="dictIpaResult" style="color: #94a3b8; font-size: 16px; margin: 0;"></p>
                                <button id="dictPlayBtn" style="background:transparent; border:none; color:#f8fafc; font-size:24px; cursor:pointer;" title="播放發音">🔊</button>
                            </div>
                            <div id="dictFreqResult" style="color:#fbbf24; font-size:14px; margin-top:4px;"></div>
                        </div>
                    </div>
                    <div class="divider" style="margin:20px 0;"></div>
                    <h4 style="color:#60a5fa; margin-bottom:12px; display:flex; align-items:center; gap:6px;"><span style="font-size:20px;">📝</span> <span style="font-size:18px; font-weight:800;">解釋</span></h4>
                    <div id="dictDefsContainer" style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;"></div>
                    <div class="divider" style="margin:20px 0;"></div>
                    <h4 style="color:#34d399; margin-bottom:12px; display:flex; align-items:center; gap:6px;"><span style="font-size:20px;">💡</span> <span style="font-size:18px; font-weight:800;">例句</span></h4>
                    <div id="dictEgsContainer" style="display:flex; flex-direction:column; gap:12px;"></div>
                </div>
            </div>

            <!-- 單字卡模式區塊 -->
            <div id="flashcardSection" style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap; justify-content:flex-end;">
                <button id="addVocabGroupBtn" class="btn secondary-btn" style="background:rgba(16, 185, 129, 0.15); color:#6ee7b7; border-color:rgba(16, 185, 129, 0.3);">➕ 新增群組</button>
            </div>
"@

# Normalize spaces conditionally for robust replace
$html = $html.Replace($old1, $new1)
if (-not $html.Contains("dictResultCard")) {
    $html = $html.Replace($old1.Replace("`r`n", "`n"), $new1.Replace("`r`n", "`n"))
}

# --- 2. JS Bindings ---
$old2 = @"
    const tabFlashcardBtn = document.getElementById('tabFlashcardBtn');
    const tabArticleBtn = document.getElementById('tabArticleBtn');
    const flashcardSection = document.getElementById('flashcardSection');
    const articleSection = document.getElementById('articleSection');
"@
$new2 = @"
    const tabFlashcardBtn = document.getElementById('tabFlashcardBtn');
    const tabDictionaryBtn = document.getElementById('tabDictionaryBtn');
    const tabArticleBtn = document.getElementById('tabArticleBtn');
    const flashcardSection = document.getElementById('flashcardSection');
    const dictionarySection = document.getElementById('dictionarySection');
    const dictLoading = document.getElementById('dictLoading');
    const dictResultCard = document.getElementById('dictResultCard');
    const dictWordResult = document.getElementById('dictWordResult');
    const dictIpaResult = document.getElementById('dictIpaResult');
    const dictFreqResult = document.getElementById('dictFreqResult');
    const dictDefsContainer = document.getElementById('dictDefsContainer');
    const dictEgsContainer = document.getElementById('dictEgsContainer');
    const dictPlayBtn = document.getElementById('dictPlayBtn');
    const articleSection = document.getElementById('articleSection');
"@
$html = $html.Replace($old2, $new2)
if (-not $html.Contains("tabDictionaryBtn = document.getElementById")) {
    $html = $html.Replace($old2.Replace("`r`n", "`n"), $new2.Replace("`r`n", "`n"))
}

# --- 3. JS Routing Tab Logic ---
$old3 = @"
    if(tabFlashcardBtn) {
        tabFlashcardBtn.addEventListener('click', () => {
            tabFlashcardBtn.classList.replace('secondary-btn', 'primary-btn');
            tabArticleBtn.classList.replace('primary-btn', 'secondary-btn');
            flashcardSection.style.display = 'flex';
            articleSection.style.display = 'none';
        });

        tabArticleBtn.addEventListener('click', () => {
            tabArticleBtn.classList.replace('secondary-btn', 'primary-btn');
            tabFlashcardBtn.classList.replace('primary-btn', 'secondary-btn');
            flashcardSection.style.display = 'none';
            articleSection.style.display = 'flex';
            if (!articleTitle.dataset.loaded) {
"@
$new3 = @"
    if(tabFlashcardBtn) {
        tabFlashcardBtn.addEventListener('click', () => {
            tabFlashcardBtn.classList.replace('secondary-btn', 'primary-btn');
            tabArticleBtn.classList.replace('primary-btn', 'secondary-btn');
            if(tabDictionaryBtn) tabDictionaryBtn.classList.replace('primary-btn', 'secondary-btn');
            flashcardSection.style.display = 'flex';
            articleSection.style.display = 'none';
            if(dictionarySection) dictionarySection.style.display = 'none';
        });

        if(tabDictionaryBtn) tabDictionaryBtn.addEventListener('click', () => {
            tabDictionaryBtn.classList.replace('secondary-btn', 'primary-btn');
            tabFlashcardBtn.classList.replace('primary-btn', 'secondary-btn');
            tabArticleBtn.classList.replace('primary-btn', 'secondary-btn');
            if(dictionarySection) dictionarySection.style.display = 'flex';
            flashcardSection.style.display = 'none';
            articleSection.style.display = 'none';
        });

        tabArticleBtn.addEventListener('click', () => {
            tabArticleBtn.classList.replace('secondary-btn', 'primary-btn');
            tabFlashcardBtn.classList.replace('primary-btn', 'secondary-btn');
            if(tabDictionaryBtn) tabDictionaryBtn.classList.replace('primary-btn', 'secondary-btn');
            flashcardSection.style.display = 'none';
            if(dictionarySection) dictionarySection.style.display = 'none';
            articleSection.style.display = 'flex';
            if (!articleTitle.dataset.loaded) {
"@
$html = $html.Replace($old3, $new3)
if (-not $html.Contains("tabDictionaryBtn.addEventListener('click'")) {
    $html = $html.Replace($old3.Replace("`r`n", "`n"), $new3.Replace("`r`n", "`n"))
}

# --- 4. JS Routing Game Logic ---
$old4 = @"
        tabGamesBtn.addEventListener('click', () => {
            tabGamesBtn.classList.add('active-tab');
            tabFlashcardBtn2.classList.replace('primary-btn','secondary-btn');
            tabArticleBtn2.classList.replace('primary-btn','secondary-btn');
            tabFlashcardBtn2.classList.remove('active-tab');
            tabArticleBtn2.classList.remove('active-tab');
            flashcardSection2.style.display = 'none';
            articleSection2.style.display   = 'none';
            gamesSection.style.display      = 'flex';
            renderGameMenu();
        });

        tabFlashcardBtn2.addEventListener('click', () => { tabGamesBtn.classList.remove('active-tab'); gamesSection.style.display='none'; });
        tabArticleBtn2.addEventListener('click',   () => { tabGamesBtn.classList.remove('active-tab'); gamesSection.style.display='none'; });
"@
$new4 = @"
        const tabDictionaryBtn2 = document.getElementById('tabDictionaryBtn');
        const dictionarySection2 = document.getElementById('dictionarySection');
        tabGamesBtn.addEventListener('click', () => {
            tabGamesBtn.classList.add('active-tab');
            tabFlashcardBtn2.classList.replace('primary-btn','secondary-btn');
            tabArticleBtn2.classList.replace('primary-btn','secondary-btn');
            if(tabDictionaryBtn2) tabDictionaryBtn2.classList.replace('primary-btn','secondary-btn');
            tabFlashcardBtn2.classList.remove('active-tab');
            tabArticleBtn2.classList.remove('active-tab');
            flashcardSection2.style.display = 'none';
            articleSection2.style.display   = 'none';
            if(dictionarySection2) dictionarySection2.style.display = 'none';
            gamesSection.style.display      = 'flex';
            renderGameMenu();
        });

        tabFlashcardBtn2.addEventListener('click', () => { tabGamesBtn.classList.remove('active-tab'); gamesSection.style.display='none'; });
        if(tabDictionaryBtn2) tabDictionaryBtn2.addEventListener('click', () => { tabGamesBtn.classList.remove('active-tab'); gamesSection.style.display='none'; });
        tabArticleBtn2.addEventListener('click',   () => { tabGamesBtn.classList.remove('active-tab'); gamesSection.style.display='none'; });
"@
$html = $html.Replace($old4, $new4)
if (-not $html.Contains("tabDictionaryBtn2.classList")) {
    $html = $html.Replace($old4.Replace("`r`n", "`n"), $new4.Replace("`r`n", "`n"))
}

# --- 5. Dict Search Click on Article ---
$old5 = @"
        articleContent.querySelectorAll('.clickable-word').forEach(span => {
            span.addEventListener('click', (e) => {
                const word = e.currentTarget.getAttribute('data-word');
                dictSearchInput.value = word;
                dictSearchBtn.click();
                if(tabFlashcardBtn) tabFlashcardBtn.click();
            });
        });
"@
$new5 = @"
        articleContent.querySelectorAll('.clickable-word').forEach(span => {
            span.addEventListener('click', (e) => {
                const word = e.currentTarget.getAttribute('data-word');
                dictSearchInput.value = word;
                dictSearchBtn.click();
                if(tabDictionaryBtn) tabDictionaryBtn.click();
            });
        });
"@
$html = $html.Replace($old5, $new5)
if (-not $html.Contains("if(tabDictionaryBtn) tabDictionaryBtn.click();")) {
    $html = $html.Replace($old5.Replace("`r`n", "`n"), $new5.Replace("`r`n", "`n"))
}

# --- 6. Fetch Word Data & DictSearchBtn Listener ---
# Use regex to strip the ENTIRE block between `if (dictSearchBtn) {` and `calculate();`
# NOTE: The target old file has code block: "if (dictSearchBtn) { ... fetchWordData(word) { ... } \n    calculate();\n    loadInventory();"
$newJSBlock = @"
    if (dictSearchBtn) {
        dictSearchBtn.addEventListener('click', () => {
            const word = dictSearchInput.value.trim().toLowerCase();
            if(!word) return;
            
            // Switch tabs visually
            if(tabDictionaryBtn) {
                tabDictionaryBtn.classList.replace('secondary-btn', 'primary-btn');
                if(tabFlashcardBtn) tabFlashcardBtn.classList.replace('primary-btn', 'secondary-btn');
                if(tabArticleBtn) tabArticleBtn.classList.replace('primary-btn', 'secondary-btn');
                const tgb = document.getElementById('tabGamesBtn');
                if(tgb) tgb.classList.remove('active-tab');
            }
            if(dictionarySection) dictionarySection.style.display = 'flex';
            if(flashcardSection) flashcardSection.style.display = 'none';
            if(articleSection) articleSection.style.display = 'none';
            const gs = document.getElementById('gamesSection');
            if(gs) gs.style.display = 'none';

            dictLoading.style.display = 'block';
            dictResultCard.style.display = 'none';
            dictDefsContainer.innerHTML = '';
            dictEgsContainer.innerHTML = '';

            fetchWordData(word).then(data => {
                dictWordResult.textContent = data.word;
                dictIpaResult.textContent = data.ipa;
                currentAudioUrl = data.audioUrl;
                
                let starHtml = '';
                let freqInt = Math.round(data.freqScore);
                if (freqInt > 5) freqInt = 5;
                if (freqInt < 1) freqInt = 1;
                for(let i=1; i<=5; i++) {
                    if(i <= freqInt) starHtml += '★'; else starHtml += '☆';
                }
                dictFreqResult.innerHTML = `<span title="Datamuse Frequency: `$${data.frequencyRaw || 0}/M" style="cursor:help;">`$${starHtml}</span>`;

                if (!data.defs || data.defs.length === 0) {
                    if(data.engDef) data.defs = [{eng: data.engDef, chi: data.chiDef}];
                    else data.defs = [{eng: 'No specific explanation found.', chi: '未找到解釋'}];
                }

                // Render definitions
                data.defs.forEach((def, idx) => {
                    const defDiv = document.createElement('div');
                    let engFormat = def.eng;
                    if(def.pos) engFormat = `<i style="color:#fbbf24; margin-right:6px; font-size:13px;">[`$${def.pos}]</i>` + engFormat;
                    defDiv.innerHTML = `<p style="font-size:15px; color:#e2e8f0; line-height:1.5;"><b>`$${idx+1}.</b> `$${engFormat}</p>
                                        <p style="font-size:14px; color:#cbd5e1; margin-top:4px;">`$${def.chi}</p>`;
                    dictDefsContainer.appendChild(defDiv);
                });

                // Render examples
                currentEgTexts = [];
                data.examples.forEach((exObj, idx) => {
                    currentEgTexts.push(exObj.eng);
                    const egDiv = document.createElement('div');
                    egDiv.className = 'eg-item';
                    egDiv.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom:8px;">
                            <div style="flex:1;">
                                <p style="font-size:15px; color:#e2e8f0; margin-bottom:4px; font-style:italic;">`$${idx+1}. `$${exObj.eng}</p>
                                <p style="font-size:14px; color:#cbd5e1; margin:0;">`$${exObj.chi}</p>
                            </div>
                            <div style="display:flex;">
                                <button class="play-single-eg-btn" data-eg="`$${exObj.eng.replace(/"/g, '&quot;')}" style="background:transparent; border:none; cursor:pointer; font-size:20px; padding:4px;">🔊</button>
                                <button class="record-single-eg-btn" data-eg="`$${exObj.eng.replace(/"/g, '&quot;')}" style="background:transparent; border:none; cursor:pointer; font-size:20px; padding:4px;">🎤</button>
                            </div>
                        </div>
                        <div class="shadow-result-container" style="display:none; font-size:14px; margin-top:4px; margin-bottom:8px; padding:8px; background:rgba(0,0,0,0.3); border-radius:6px;"></div>`;
                    dictEgsContainer.appendChild(egDiv);
                });

                dictEgsContainer.querySelectorAll('.play-single-eg-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        speakTTS(e.currentTarget.getAttribute('data-eg'), 'en-US');
                    });
                });

                dictEgsContainer.querySelectorAll('.record-single-eg-btn').forEach(btn => {
                    const txt = btn.getAttribute('data-eg');
                    const resultContainer = btn.closest('.eg-item').querySelector('.shadow-result-container');
                    setupShadowing(btn, txt, resultContainer);
                });

                if (data.examples.length === 0) {
                    dictEgsContainer.innerHTML = `<p style="font-size:14px; color:#cbd5e1; opacity:0.5;">無例句</p>`;
                }

                dictLoading.style.display = 'none';
                dictResultCard.style.display = 'block';
            });
        });
    }

    if (dictPlayBtn) {
        dictPlayBtn.addEventListener('click', () => {
             if (currentAudioUrl && currentAudioUrl.startsWith('http')) {
                  new Audio(currentAudioUrl).play().catch(() => speakTTS(dictWordResult.textContent, 'en-US'));
             } else {
                  speakTTS(dictWordResult.textContent, 'en-US');
             }
        });
    }

    async function fetchWordData(word) {
        try {
            const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/`$${encodeURIComponent(word)}`;
            const dictRes = await fetch(dictUrl);
            const dictJson = dictRes.ok ? await dictRes.json() : null;
            
            let frequencyRaw = 0;
            let freqScore = 1; 
            try {
                const dmRes = await fetch(`https://api.datamuse.com/words?sp=`$${encodeURIComponent(word)}&md=f&max=1`);
                if (dmRes.ok) {
                    const dmJson = await dmRes.json();
                    if (dmJson.length > 0 && dmJson[0].tags) {
                        const fTag = dmJson[0].tags.find(t => t.startsWith('f:'));
                        if (fTag) frequencyRaw = parseFloat(fTag.split(':')[1]);
                    }
                }
            } catch(e){}

            if (frequencyRaw > 100) freqScore = 5;
            else if (frequencyRaw > 40) freqScore = 4;
            else if (frequencyRaw > 10) freqScore = 3;
            else if (frequencyRaw > 1) freqScore = 2;
            else freqScore = 1;
            
            let ipa = `/`$${word}/`;
            let audioUrl = '';
            
            let parsedDefs = [];
            let examplesRaw = [];

            if (dictJson && dictJson[0]) {
                const entry = dictJson[0];
                const ph = entry.phonetics.find(p => p.text);
                if (ph) ipa = ph.text;
                
                const usAu  = entry.phonetics.find(p => p.audio && p.audio.includes('-us'));
                const anyAu = entry.phonetics.find(p => p.audio && p.audio.trim() !== '');
                const rawUrl = (usAu || anyAu)?.audio || '';
                if (rawUrl.startsWith('//')) audioUrl = 'https:' + rawUrl;
                else if (rawUrl.startsWith('http')) audioUrl = rawUrl;
                else audioUrl = '';
                
                for (let m of entry.meanings) {
                    for (let d of m.definitions) {
                        if (d.definition && parsedDefs.length < 3) {
                            if(!parsedDefs.some(pd => pd.eng === d.definition)) {
                                parsedDefs.push({ eng: d.definition, pos: m.partOfSpeech });
                            }
                        }
                        if (d.example) {
                            const wordCount = d.example.split(/\s+/).length;
                            if(wordCount >= 4 && examplesRaw.length < 3 && !examplesRaw.includes(d.example)) {
                                examplesRaw.push(d.example);
                            }
                        }
                    }
                }
            }

            if (examplesRaw.length === 0) {
                const templates = [
                    `They discussed the importance of `$${word} in modern society.`,
                    `The concept of `$${word} is essential in this field.`,
                    `She tried her best to explain the meaning of `$${word}.`,
                    `Understanding `$${word} can help you communicate more effectively.`,
                    `We will focus on `$${word} in our next meeting.`
                ];
                examplesRaw.push(templates[Math.floor(Math.random() * templates.length)]);
                if(examplesRaw.length < 3) examplesRaw.push(templates[(Math.floor(Math.random() * templates.length) + 1) % templates.length]);
            }
            if (parsedDefs.length === 0) {
                parsedDefs = [{ eng: 'No specific explanation found.', pos: '' }];
            }

            let combinedString = `$${word}`;
            parsedDefs.forEach(d => combinedString += ` ||| `$${d.eng}`);
            examplesRaw.forEach(ex => combinedString += ` ||| `$${ex}`);

            const tlUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-TW&dt=t&q=`$${encodeURIComponent(combinedString)}`;
            const tlRes = await fetch(tlUrl);
            const tlJson = await tlRes.json();
            
            let translated = "";
            if (tlJson && tlJson[0]) {
                tlJson[0].forEach(t => translated += t[0]);
            }
            
            const parts = translated.split('|||').map(s => s.trim());
            
            let defsWithTranslation = [];
            for(let i=0; i<parsedDefs.length; i++){
                defsWithTranslation.push({
                    eng: parsedDefs[i].eng,
                    chi: parts[1 + i] || '翻譯遺失',
                    pos: parsedDefs[i].pos
                });
            }
            
            let processedExamples = [];
            for (let i = 0; i < examplesRaw.length; i++) {
                processedExamples.push({
                    eng: examplesRaw[i],
                    chi: parts[1 + parsedDefs.length + i] || '翻譯遺失'
                });
            }

            return {
                word, ipa, audioUrl, 
                freqScore, frequencyRaw,
                defs: defsWithTranslation,
                engDef: defsWithTranslation[0]?.eng,
                chiDef: defsWithTranslation[0]?.chi,
                examples: processedExamples
            };
        } catch (e) {
            console.error('Words API Error:', e);
            return {
                word, ipa:'', audioUrl:'', freqScore: 1, frequencyRaw: 0,
                defs: [{eng: 'Network Error', chi: '連線錯誤，請檢查網路連線。'}],
                engDef: 'Network Error', chiDef: '連線錯誤',
                examples: []
            };
        }
    }
"@

# Strict Regex anchored replace to not catch the wrong calculate()
# We match `    if (dictSearchBtn) {` exactly with preceding newline/spaces, up to `    calculate();` right after fetchWordData
$html = $html -replace "(?sm)^    if \(dictSearchBtn\) \{(.+?)^    async function fetchWordData\(word\) \{(.+?)^    calculate\(\);", "`n$newJSBlock`n`n    calculate();"


[System.IO.File]::WriteAllText("C:\Users\PC\Desktop\APP開發\index.html", $html, $utf8)
