import io

def patch_html():
    with open('index_utf8.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Add script tag for long_articles.js
    html = html.replace('</head>', '<script src="long_articles.js"></script>\n</head>')

    # 2. Add new tab buttons before tabGamesBtn
    oldTabGames = '<button id="tabGamesBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px; background:rgba(139,92,246,0.2); border-color:rgba(139,92,246,0.5); color:#c4b5fd;">'
    newTabs = '''<button id="tabDictionaryBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">🔍 查字典</button>
                <button id="tabLongArticleBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">📚 長篇小說</button>
                <button id="tabWritingBtn" class="btn secondary-btn" style="width:auto; padding:8px 20px;">✍️ 寫作區</button>
                ''' + oldTabGames
    html = html.replace(oldTabGames, newTabs)

    # 3. Insert Dictionary + Long Article + Writing sections before gamesSection
    # Find beginning of the comment line before gamesSection
    insertBefore = html.find('id="gamesSection"')
    if insertBefore == -1:
        print("gamesSection not found")
        return
    
    insertIdx = html.rfind('\n', 0, insertBefore)
    insertIdx2 = html.rfind('\n', 0, insertIdx - 1)

    newSections = '''
            <!-- 🔍 查字典模式區塊 -->
            <div id="dictionarySection" style="display:none; flex-direction:column; gap:16px;">
                <div style="display:flex; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
                    <div style="flex:1; display:flex; gap:4px; min-width:200px;">
                        <input type="text" id="dictSearchInput" placeholder="輸入單字查字典..." class="input-field" style="background:rgba(0,0,0,0.3); border-color:rgba(59,130,246,0.3);">
                        <button id="dictSearchBtn" class="btn primary-btn" style="white-space:nowrap;">🔍 查詢</button>
                    </div>
                </div>
                <div id="dictResultCard" style="display:none; background:rgba(0,0,0,0.3); border-radius:12px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <h3 id="dictWordTitle" style="color:#60a5fa; font-size:22px;"></h3>
                        <button id="dictPlayBtn" class="btn secondary-btn" style="padding:6px 14px;">🔊 發音</button>
                    </div>
                    <p id="dictPhonetic" style="color:#94a3b8; margin-bottom:12px;"></p>
                    <div id="dictDefsContainer"></div>
                </div>
            </div>

            <!-- 📚 長篇小說區塊 -->
            <div id="longArticleSection" style="display:none; flex-direction:column; gap:16px;">
                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                    <select id="longArticleSelect" class="input-field" style="flex:1; min-width:200px; background:rgba(0,0,0,0.3); color:#e2e8f0;"></select>
                    <button id="playLongArticleBtn" class="btn primary-btn" style="padding:8px 16px;">▶️ 朗讀本章</button>
                    <button id="pauseLongArticleBtn" class="btn secondary-btn" style="padding:8px 16px;">⏸ 暫停</button>
                    <button id="stopLongArticleBtn" class="btn secondary-btn" style="padding:8px 16px;">⏹ 停止</button>
                </div>
                <div style="background:rgba(0,0,0,0.2); border-radius:12px; padding:20px; max-height:65vh; overflow-y:auto;">
                    <div id="longArticleContent" style="font-size:16px; line-height:1.8; color:#e2e8f0; white-space:pre-wrap;"></div>
                </div>
            </div>

            <!-- ✍️ 英文寫作區 -->
            <div id="writingSection" style="display:none; flex-direction:column; gap:16px;">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <label style="color:#94a3b8;">Gemini API Key：</label>
                    <input type="password" id="geminiApiKeyInput" class="input-field" placeholder="輸入 API Key..." style="max-width:220px; background:rgba(0,0,0,0.5);">
                    <button id="saveApiKeyBtn" class="btn primary-btn" style="padding:6px 14px;">儲存</button>
                    <a href="https://aistudio.google.com/apikey" target="_blank" style="color:#60a5fa; font-size:13px; text-decoration:underline;">免費申請 Gemini API Key →</a>
                </div>
                <div style="display:flex; gap:16px; flex-wrap:wrap;">
                    <div class="glass-panel" style="flex:2; padding:20px; border-radius:16px; min-width:280px; background:rgba(255,255,255,0.02);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <h3 style="color:#fcd34d; font-size:18px;">📝 撰寫文章</h3>
                            <span id="writingCharCount" style="color:#94a3b8; font-size:12px;">字數: 0</span>
                        </div>
                        <textarea id="writingTextarea" class="input-field" placeholder="在此輸入您的英文文章... (雙擊單字可查字典)" style="width:100%; height:220px; resize:vertical; background:rgba(0,0,0,0.3); color:#e2e8f0; font-size:16px; line-height:1.6; padding:12px; margin-bottom:12px;"></textarea>
                        <div style="display:flex; flex-wrap:wrap; gap:10px;">
                            <button id="aiGradeBtn" class="btn primary-btn" style="padding:8px 16px; background:rgba(245,158,11,0.2); border-color:rgba(245,158,11,0.5); color:#fcd34d;">✨ AI 批改與評分</button>
                            <button id="playWritingBtn" class="btn secondary-btn" style="padding:8px 16px;">▶️ 朗讀文章</button>
                            <button id="saveWritingBtn" class="btn secondary-btn" style="padding:8px 16px; background:rgba(52,211,153,0.2); border-color:rgba(52,211,153,0.5); color:#6ee7b7;">💾 儲存文章</button>
                            <button id="clearWritingBtn" class="btn secondary-btn" style="padding:8px 16px; color:#fca5a5;">🗑️ 清空</button>
                        </div>
                        <div id="aiFeedbackSection" style="display:none; margin-top:20px; padding:16px; border-top:1px solid rgba(255,255,255,0.1);">
                            <h4 style="color:#60a5fa; margin-bottom:12px;">🤖 AI 批改結果：</h4>
                            <div id="aiFeedbackContent" style="font-size:15px; line-height:1.7; color:#cbd5e1;"></div>
                        </div>
                    </div>
                    <div class="glass-panel" style="flex:1; padding:20px; border-radius:16px; min-width:230px; max-height:580px; overflow-y:auto; background:rgba(0,0,0,0.2);">
                        <h3 style="color:#a78bfa; font-size:18px; margin-bottom:16px;">📁 歷史紀錄</h3>
                        <div id="writingHistoryList" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                </div>
            </div>
'''
    html = html[:insertIdx2+1] + newSections + html[insertIdx2+1:]

    # 4. Append all JS before final </script>
    lastScript = html.rfind('</script>')
    if lastScript == -1:
        print("script tag not found")
        return

    jsToInsert = '''
    // ======== DICTIONARY TAB ========
    (function() {
        const tabDictionaryBtn = document.getElementById('tabDictionaryBtn');
        const dictionarySection = document.getElementById('dictionarySection');
        const flashcardSection  = document.getElementById('flashcardSection');
        const articleSection    = document.getElementById('articleSection');
        const longArticleSection= document.getElementById('longArticleSection');
        const writingSection    = document.getElementById('writingSection');
        const gamesSection      = document.getElementById('gamesSection');
        const tabFlashcardBtn   = document.getElementById('tabFlashcardBtn');
        const tabArticleBtn     = document.getElementById('tabArticleBtn');
        const tabLongArticleBtn = document.getElementById('tabLongArticleBtn');
        const tabGamesBtn       = document.getElementById('tabGamesBtn');
        const tabWritingBtn     = document.getElementById('tabWritingBtn');

        function allSections() { return [flashcardSection, articleSection, gamesSection, longArticleSection, writingSection, dictionarySection]; }
        function allTabBtns()  { return [tabFlashcardBtn, tabArticleBtn, tabGamesBtn, tabLongArticleBtn, tabWritingBtn, tabDictionaryBtn]; }
        function switchTab(activeSection, activeBtn) {
            allSections().forEach(s => { if(s) s.style.display = 'none'; });
            allTabBtns().forEach(b => { if(b) { b.classList.remove('primary-btn'); b.classList.add('secondary-btn'); } });
            if(activeSection) activeSection.style.display = 'flex';
            if(activeBtn) { activeBtn.classList.remove('secondary-btn'); activeBtn.classList.add('primary-btn'); }
        }

        if(tabDictionaryBtn) tabDictionaryBtn.addEventListener('click', () => switchTab(dictionarySection, tabDictionaryBtn));
        if(tabLongArticleBtn) tabLongArticleBtn.addEventListener('click', () => {
            switchTab(longArticleSection, tabLongArticleBtn);
            initLongArticle();
        });
        if(tabWritingBtn) tabWritingBtn.addEventListener('click', () => {
            switchTab(writingSection, tabWritingBtn);
            renderHistoryList();
        });
        // Patch existing flashcard and article tabs to also hide new sections
        if(tabFlashcardBtn) tabFlashcardBtn.addEventListener('click', () => {
            if(dictionarySection) dictionarySection.style.display = 'none';
            if(longArticleSection) longArticleSection.style.display = 'none';
            if(writingSection) writingSection.style.display = 'none';
            if(tabDictionaryBtn){ tabDictionaryBtn.classList.remove('primary-btn'); tabDictionaryBtn.classList.add('secondary-btn'); }
            if(tabLongArticleBtn){ tabLongArticleBtn.classList.remove('primary-btn'); tabLongArticleBtn.classList.add('secondary-btn'); }
            if(tabWritingBtn){ tabWritingBtn.classList.remove('primary-btn'); tabWritingBtn.classList.add('secondary-btn'); }
        });
        if(tabArticleBtn) tabArticleBtn.addEventListener('click', () => {
            if(dictionarySection) dictionarySection.style.display = 'none';
            if(longArticleSection) longArticleSection.style.display = 'none';
            if(writingSection) writingSection.style.display = 'none';
            if(tabDictionaryBtn){ tabDictionaryBtn.classList.remove('primary-btn'); tabDictionaryBtn.classList.add('secondary-btn'); }
            if(tabLongArticleBtn){ tabLongArticleBtn.classList.remove('primary-btn'); tabLongArticleBtn.classList.add('secondary-btn'); }
            if(tabWritingBtn){ tabWritingBtn.classList.remove('primary-btn'); tabWritingBtn.classList.add('secondary-btn'); }
        });

        // ── Dictionary Search ──
        const dictSearchInput = document.getElementById('dictSearchInput');
        const dictSearchBtn   = document.getElementById('dictSearchBtn');
        const dictResultCard  = document.getElementById('dictResultCard');
        const dictWordTitle   = document.getElementById('dictWordTitle');
        const dictPhonetic    = document.getElementById('dictPhonetic');
        const dictDefsContainer = document.getElementById('dictDefsContainer');
        const dictPlayBtn     = document.getElementById('dictPlayBtn');

        async function fetchAndShowWord(word) {
            if (!word) return;
            dictResultCard.style.display = 'none';
            try {
                const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
                if (!res.ok) throw new Error('Not found');
                const data = await res.json();
                const entry = data[0];
                dictWordTitle.textContent = entry.word;
                const phone = entry.phonetics?.find(p => p.text)?.text || '';
                dictPhonetic.textContent = phone;
                let html = '';
                entry.meanings?.forEach(m => {
                    html += `<div style="margin-bottom:12px;"><b style="color:#a78bfa;">${m.partOfSpeech}</b>`;
                    m.definitions?.slice(0,3).forEach(d => {
                        html += `<div style="margin:6px 0 2px 0; color:#e2e8f0;">・${d.definition}</div>`;
                        if (d.example) html += `<div style="color:#94a3b8; font-size:13px; padding-left:12px;">"${d.example}"</div>`;
                    });
                    html += '</div>';
                });
                dictDefsContainer.innerHTML = html;
                dictResultCard.style.display = 'block';
            } catch(e) {
                dictDefsContainer.innerHTML = `<p style="color:#f87171;">查無此字：${word}</p>`;
                dictWordTitle.textContent = word;
                dictPhonetic.textContent = '';
                dictResultCard.style.display = 'block';
            }
        }

        if (dictSearchBtn) dictSearchBtn.addEventListener('click', () => fetchAndShowWord(dictSearchInput.value.trim()));
        if (dictSearchInput) dictSearchInput.addEventListener('keydown', e => { if(e.key==='Enter') fetchAndShowWord(dictSearchInput.value.trim()); });
        if (dictPlayBtn) dictPlayBtn.addEventListener('click', () => {
            const w = dictWordTitle.textContent;
            if(!w) return;
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(w);
            u.lang = 'en-US';
            window.speechSynthesis.speak(u);
        });
    })();

    // ======== LONG ARTICLE ========
    var _longArticleInited = false;
    function initLongArticle() {
        if (_longArticleInited) return;
        _longArticleInited = true;
        const sel = document.getElementById('longArticleSelect');
        const content = document.getElementById('longArticleContent');
        const playBtn = document.getElementById('playLongArticleBtn');
        const pauseBtn = document.getElementById('pauseLongArticleBtn');
        const stopBtn = document.getElementById('stopLongArticleBtn');
        window.longArticleUtterances = [];

        if (!window.LONG_ARTICLES_DB || !sel) return;
        Object.keys(window.LONG_ARTICLES_DB).forEach(k => {
            const a = window.LONG_ARTICLES_DB[k];
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = a.title || k;
            sel.appendChild(opt);
        });
        function renderArticle() {
            const a = window.LONG_ARTICLES_DB[sel.value];
            if (!a || !content) return;
            if (typeof makeTextClickable === 'function') {
                content.innerHTML = makeTextClickable(a.text.replace(/\n/g, '<br>'));
            } else {
                content.textContent = a.text;
            }
        }
        sel.addEventListener('change', renderArticle);
        if (Object.keys(window.LONG_ARTICLES_DB).length > 0) renderArticle();

        function speakText(text) {
            window.speechSynthesis.cancel();
            window.longArticleUtterances = [];
            setTimeout(() => {
                text.split(/\n+/).forEach(p => {
                    (p.trim().match(/[^.!?]+[.!?]*/g) || [p.trim()]).forEach(s => {
                        const st = s.trim();
                        if (st) { const u = new SpeechSynthesisUtterance(st); u.lang='en-US'; window.longArticleUtterances.push(u); window.speechSynthesis.speak(u); }
                    });
                });
            }, 50);
        }
        if (playBtn) playBtn.addEventListener('click', () => {
            if (window.speechSynthesis.paused) { window.speechSynthesis.resume(); return; }
            const a = window.LONG_ARTICLES_DB[sel.value];
            if (a) speakText(a.text);
        });
        if (pauseBtn) pauseBtn.addEventListener('click', () => window.speechSynthesis.pause());
        if (stopBtn)  stopBtn.addEventListener('click',  () => { window.speechSynthesis.cancel(); window.longArticleUtterances = []; });
    }

    // ======== WRITING SECTION ========
    (function() {
        const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
        const saveApiKeyBtn     = document.getElementById('saveApiKeyBtn');
        const writingTextarea   = document.getElementById('writingTextarea');
        const writingCharCount  = document.getElementById('writingCharCount');
        const aiGradeBtn        = document.getElementById('aiGradeBtn');
        const playWritingBtn    = document.getElementById('playWritingBtn');
        const saveWritingBtn    = document.getElementById('saveWritingBtn');
        const clearWritingBtn   = document.getElementById('clearWritingBtn');
        const aiFeedbackSection = document.getElementById('aiFeedbackSection');
        const aiFeedbackContent = document.getElementById('aiFeedbackContent');
        const writingHistoryList= document.getElementById('writingHistoryList');
        let currentWritingId    = null;
        window.writingUtterances = [];

        const saved = localStorage.getItem('GEMINI_API_KEY');
        if (saved && geminiApiKeyInput) geminiApiKeyInput.value = saved;

        if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', () => {
            const k = geminiApiKeyInput.value.trim();
            if(k) { localStorage.setItem('GEMINI_API_KEY', k); alert('API Key 儲存成功！'); }
            else  { localStorage.removeItem('GEMINI_API_KEY'); alert('已清除 API Key。'); }
        });
        if (writingTextarea) {
            writingTextarea.addEventListener('input', () => {
                const t = writingTextarea.value.trim();
                if(writingCharCount) writingCharCount.textContent = '字數: ' + (t ? t.split(/\s+/).length : 0);
            });
            writingTextarea.addEventListener('dblclick', () => {
                const sel = window.getSelection().toString().trim().replace(/[^a-zA-Z'-]/g,'');
                if (sel) { const inp = document.getElementById('dictSearchInput'); const btn = document.getElementById('dictSearchBtn'); const tab = document.getElementById('tabDictionaryBtn'); if(inp&&btn){inp.value=sel; if(tab)tab.click(); btn.click();} }
            });
        }
        if (clearWritingBtn) clearWritingBtn.addEventListener('click', () => {
            if(confirm('確定要清空嗎？')) { currentWritingId=null; writingTextarea.value=''; if(writingCharCount) writingCharCount.textContent='字數: 0'; aiFeedbackSection.style.display='none'; aiFeedbackContent.innerHTML=''; }
        });

        function bindDictClicks(container) {
            container.querySelectorAll('.clickable-word').forEach(s => {
                s.addEventListener('click', e => {
                    const w = e.currentTarget.getAttribute('data-word');
                    const inp = document.getElementById('dictSearchInput'); const btn = document.getElementById('dictSearchBtn'); const tab = document.getElementById('tabDictionaryBtn');
                    if(inp&&btn){inp.value=w; if(tab)tab.click(); btn.click();}
                });
            });
        }

        if (aiGradeBtn) aiGradeBtn.addEventListener('click', async () => {
            const text = writingTextarea.value.trim();
            if(!text) return alert('請先輸入文章內容！');
            const apiKey = localStorage.getItem('GEMINI_API_KEY');
            if(!apiKey) return alert('請先在上方輸入並儲存您的 Gemini API Key！\\n免費申請：https://aistudio.google.com/apikey');
            aiGradeBtn.disabled = true; aiGradeBtn.textContent = '⏳ 批改中...';
            aiFeedbackSection.style.display = 'block'; aiFeedbackContent.innerHTML = '正在聯絡 AI，請稍候...';
            const prompt = `You are an expert English teacher. Review the student's English text below. Respond in Traditional Chinese (繁體中文).\\n\\nPlease structure your response with these 4 sections:\\n1. **整體評分**: Score out of 100 AND CEFR level (A1-C2)\\n2. **文法與拼字修正**: List errors with corrections. State "無錯誤" if none.\\n3. **句型潤飾建議**: Rewrite 2-3 sentences to sound more natural.\\n4. **綜合短評**: Brief encouraging comment.\\n\\nStudent's text:\\n"${text}"`;
            try {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
                });
                if(!res.ok) { const err=await res.json(); throw new Error(err.error?.message||'API Error'); }
                const data = await res.json();
                let aiText = data.candidates[0].content.parts[0].text;
                let html = aiText.replace(/\\n/g,'<br>').replace(/\\*\\*(.*?)\\*\\*/g,'<b>$1</b>');
                if(typeof makeTextClickable==='function') html = makeTextClickable(html);
                aiFeedbackContent.innerHTML = html;
                bindDictClicks(aiFeedbackContent);
            } catch(e) {
                aiFeedbackContent.innerHTML = `<span style="color:#ef4444;">發生錯誤：${e.message}</span>`;
            } finally {
                aiGradeBtn.disabled = false; aiGradeBtn.textContent = '✨ AI 批改與評分';
            }
        });

        function speakWriting() {
            const text = writingTextarea.value.trim(); if(!text) return;
            if(window.speechSynthesis.paused){window.speechSynthesis.resume();return;}
            window.speechSynthesis.cancel(); window.writingUtterances = [];
            setTimeout(()=>{ text.split(/\\n+/).forEach(p=>{ (p.trim().match(/[^.!?]+[.!?]*/g)||[p.trim()]).forEach(s=>{ const st=s.trim(); if(st){const u=new SpeechSynthesisUtterance(st);u.lang='en-US';window.writingUtterances.push(u);window.speechSynthesis.speak(u);} }); }); },50);
        }
        if(playWritingBtn) playWritingBtn.addEventListener('click', speakWriting);

        function getHistory(){ try{return JSON.parse(localStorage.getItem('WRITING_HISTORY')||'[]');}catch(e){return [];} }
        function saveHistory(h){ localStorage.setItem('WRITING_HISTORY',JSON.stringify(h)); renderHistoryList(); }

        if(saveWritingBtn) saveWritingBtn.addEventListener('click', ()=>{
            const text=writingTextarea.value.trim(); if(!text) return alert('文章是空的！');
            const fb = aiFeedbackSection.style.display!=='none' ? aiFeedbackContent.innerHTML : '';
            const history = getHistory();
            if(currentWritingId){ const idx=history.findIndex(h=>h.id===currentWritingId); if(idx!==-1){history[idx].text=text;history[idx].feedback=fb;history[idx].timestamp=new Date().toISOString();} else pushNew(history,text,fb); }
            else pushNew(history,text,fb);
            saveHistory(history); alert('文章已儲存！');
        });
        function pushNew(history,text,fb){ currentWritingId=Date.now().toString(); history.push({id:currentWritingId,text,feedback:fb,timestamp:new Date().toISOString()}); }

        window.deleteWritingHistory = function(id){
            if(!confirm('確定要刪除嗎？')) return;
            let h=getHistory().filter(x=>x.id!==id); saveHistory(h);
            if(currentWritingId===id){currentWritingId=null;writingTextarea.value='';if(writingCharCount)writingCharCount.textContent='字數: 0';if(aiFeedbackSection)aiFeedbackSection.style.display='none';}
        };
        window.loadWritingHistory = function(id){
            const item=getHistory().find(x=>x.id===id); if(!item) return;
            currentWritingId=item.id; writingTextarea.value=item.text;
            writingTextarea.dispatchEvent(new Event('input'));
            if(item.feedback&&aiFeedbackSection&&aiFeedbackContent){ aiFeedbackSection.style.display='block'; aiFeedbackContent.innerHTML=item.feedback; bindDictClicks(aiFeedbackContent); }
            else if(aiFeedbackSection){ aiFeedbackSection.style.display='none'; if(aiFeedbackContent)aiFeedbackContent.innerHTML=''; }
        };
        window.renderHistoryList = function(){
            if(!writingHistoryList) return;
            const history=getHistory().sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
            if(!history.length){ writingHistoryList.innerHTML='<div style="color:#94a3b8;font-size:14px;">目前沒有儲存的紀錄。</div>'; return; }
            writingHistoryList.innerHTML='';
            history.forEach(item=>{
                const d=document.createElement('div');
                d.style.cssText='background:rgba(255,255,255,0.05);padding:12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);display:flex;justify-content:space-between;align-items:center;';
                const date=new Date(item.timestamp).toLocaleString('zh-TW',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
                const preview=item.text.length>25?item.text.substring(0,25)+'...':item.text;
                d.innerHTML=`<div style="flex:1;cursor:pointer;" onclick="loadWritingHistory('${item.id}')"><div style="color:#cbd5e1;font-size:14px;font-weight:bold;">${date}</div><div style="color:#94a3b8;font-size:13px;margin-top:4px;">${preview}</div></div><button class="btn" style="background:transparent;color:#fca5a5;padding:4px 8px;font-size:16px;" onclick="deleteWritingHistory('${item.id}')">🗑️</button>`;
                writingHistoryList.appendChild(d);
            });
        };
    })();
'''
    html = html[:lastScript] + jsToInsert + html[lastScript:]

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Patch applied successfully, saved to index.html with UTF-8 encoding.")

if __name__ == '__main__':
    patch_html()
