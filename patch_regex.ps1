$content = [System.IO.File]::ReadAllText("patched.html")

$repFWD = @"
    async function fetchWordData(word) {
        try {
            // 1. Fetch Dictionary API for Definitions & Examples
            const dictUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/`$${encodeURIComponent(word)}`;
            const dictRes = await fetch(dictUrl);
            const dictJson = dictRes.ok ? await dictRes.json() : null;
            
            // 2. Fetch Datamuse for Frequency mapping
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

            // Map standard frequencies to 1-5 Collins-like stars
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

$content = $content -replace "(?s)    async function fetchWordData\(word\) \{.*?    calculate\(\);", "`n$repFWD`n`n    calculate();"
[System.IO.File]::WriteAllText("patched.html", $content)
Copy-Item "patched.html" "index.html" -Force
