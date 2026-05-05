$content = [System.IO.File]::ReadAllText("patched.html").Replace("`r`n", "`n")

$findBlock1 = @"
    if (dictSearchBtn) {
        dictSearchBtn.addEventListener('click', () => {
            const word = dictSearchInput.value.trim().toLowerCase();
            if(!word) return;
            
            // Force skip Anki logging & directly show dict view
            currentWord = word;
            wordContent.style.display = 'none';
            wordLoading.style.display = 'block';
            actionFront.style.display = 'none';
            actionBack.style.display = 'none';
            flashcardBack.style.display = 'none';
            flashcardEgsContainer.innerHTML = '';
            wordFreqStars.innerHTML = '';

            fetchWordData(word).then(data => {
                flashcardWord.textContent = data.word;
                flashcardIpa.textContent = data.ipa;
                currentAudioUrl = data.audioUrl;
                
                let starHtml = '';
                let freqInt = Math.round(data.freqScore);
                if (freqInt > 5) freqInt = 5;
                if (freqInt < 1) freqInt = 1;
                for(let i=1; i<=5; i++) {
                    if(i <= freqInt) starHtml += '★'; else starHtml += '☆';
                }
                wordFreqStars.innerHTML = `<span title="Datamuse Frequency: `$${data.frequencyRaw || 0}/M" style="cursor:help;">`$${starHtml}</span>`;

                flashcardEngDef.textContent = data.engDef;
                flashcardChiDef.textContent = data.chiDef;
                currentEngDefText = data.engDef;
                
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
                    flashcardEgsContainer.appendChild(egDiv);
                });

                flashcardEgsContainer.querySelectorAll('.play-single-eg-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const txt = e.currentTarget.getAttribute('data-eg');
                        speakTTS(txt, 'en-US');
                    });
                });
                
                flashcardEgsContainer.querySelectorAll('.record-single-eg-btn').forEach(btn => {
                    const txt = btn.getAttribute('data-eg');
                    const resultContainer = btn.closest('.eg-item').querySelector('.shadow-result-container');
                    setupShadowing(btn, txt, resultContainer);
                });

                if (data.examples.length === 0) {
                    flashcardEgsContainer.innerHTML = `<p style="font-size:14px; color:#cbd5e1; opacity:0.5;">No examples available.</p>`;
                }

                wordLoading.style.display = 'none';
                wordContent.style.display = 'block';
                
                // Directly flip card
                flashcardBack.style.display = 'block';
                actionFront.style.display = 'none';
                actionBack.style.display = 'none';
            });
        });
    }
"@.Replace("`r`n", "`n")

$repBlock1 = @"
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
"@.Replace("`r`n", "`n")

$content = $content.Replace($findBlock1, $repBlock1)

[System.IO.File]::WriteAllText("patched.html", $content)
