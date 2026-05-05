$content = Get-Content -Path index_utf8.html -Raw -Encoding UTF8

# 1. Add variable bindings
$find1 = @"
    const tabFlashcardBtn = document.getElementById('tabFlashcardBtn');
    const tabArticleBtn = document.getElementById('tabArticleBtn');
    const flashcardSection = document.getElementById('flashcardSection');
    const articleSection = document.getElementById('articleSection');
"@
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
"@
$content = $content.Replace($find1, $rep1)

# 2. Add Tab Logic
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
"@
$rep2 = @"
    if(tabFlashcardBtn) {
        tabFlashcardBtn.addEventListener('click', () => {
            tabFlashcardBtn.classList.replace('secondary-btn', 'primary-btn');
            tabArticleBtn.classList.replace('primary-btn', 'secondary-btn');
            tabDictionaryBtn.classList.replace('primary-btn', 'secondary-btn');
            flashcardSection.style.display = 'flex';
            articleSection.style.display = 'none';
            dictionarySection.style.display = 'none';
        });

        tabDictionaryBtn.addEventListener('click', () => {
            tabDictionaryBtn.classList.replace('secondary-btn', 'primary-btn');
            tabFlashcardBtn.classList.replace('primary-btn', 'secondary-btn');
            tabArticleBtn.classList.replace('primary-btn', 'secondary-btn');
            dictionarySection.style.display = 'flex';
            flashcardSection.style.display = 'none';
            articleSection.style.display = 'none';
        });

        tabArticleBtn.addEventListener('click', () => {
            tabArticleBtn.classList.replace('secondary-btn', 'primary-btn');
            tabFlashcardBtn.classList.replace('primary-btn', 'secondary-btn');
            tabDictionaryBtn.classList.replace('primary-btn', 'secondary-btn');
            flashcardSection.style.display = 'none';
            dictionarySection.style.display = 'none';
            articleSection.style.display = 'flex';
"@
$content = $content.Replace($find2, $rep2)


# 3. Update Games Tab Logic inside the IIFE wrapper for modular games so they also respect the new tab
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
"@
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
"@
$content = $content.Replace($find3, $rep3)

$content | Out-File -FilePath patched.html -Encoding UTF8 -NoNewline
