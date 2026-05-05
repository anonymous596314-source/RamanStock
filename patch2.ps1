$content = [System.IO.File]::ReadAllText("index_utf8.html").Replace("`r`n", "`n")

$find1 = @"
    const tabFlashcardBtn = document.getElementById('tabFlashcardBtn');
    const tabArticleBtn = document.getElementById('tabArticleBtn');
    const flashcardSection = document.getElementById('flashcardSection');
    const articleSection = document.getElementById('articleSection');
"@.Replace("`r`n", "`n")
$rep1 = @"
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
"@.Replace("`r`n", "`n")
$content = $content.Replace($find1, $rep1)

$find2 = @"
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
"@.Replace("`r`n", "`n")
$rep2 = @"
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
"@.Replace("`r`n", "`n")
$content = $content.Replace($find2, $rep2)

$find3 = @"
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
"@.Replace("`r`n", "`n")
$rep3 = @"
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
"@.Replace("`r`n", "`n")
$content = $content.Replace($find3, $rep3)


$find4 = @"
        articleContent.querySelectorAll('.clickable-word').forEach(span => {
            span.addEventListener('click', (e) => {
                const word = e.currentTarget.getAttribute('data-word');
                dictSearchInput.value = word;
                dictSearchBtn.click();
                if(tabFlashcardBtn) tabFlashcardBtn.click();
            });
        });
"@.Replace("`r`n", "`n")
$rep4 = @"
        articleContent.querySelectorAll('.clickable-word').forEach(span => {
            span.addEventListener('click', (e) => {
                const word = e.currentTarget.getAttribute('data-word');
                dictSearchInput.value = word;
                dictSearchBtn.click();
                if(tabDictionaryBtn) tabDictionaryBtn.click();
            });
        });
"@.Replace("`r`n", "`n")
$content = $content.Replace($find4, $rep4)


[System.IO.File]::WriteAllText("patched.html", $content)
