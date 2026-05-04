const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // =========================
    // 1. STRONA STARTOWA
    // =========================
   await page.goto('https://eduvulcan.pl/');

// 🔥 HARD REMOVE cookie overlay (wrapper + iframe)
await page.evaluate(() => {
  document.querySelector('#respect-privacy-wrapper')?.remove();
});

// daj UI czas na stabilizację
await page.waitForTimeout(800);


    // =========================
    // 2. KLIKNIJ "ZALOGUJ SIĘ"
    // =========================
    await page.waitForSelector('#panelLoginButton', { state: 'visible' });
    await page.click('#panelLoginButton');

    // =========================
    // 3. LOGIN (Alias)
    // =========================
    const aliasInput = page.locator('#Alias');
    await aliasInput.waitFor({ state: 'visible' });
    await aliasInput.fill(process.env.LOGIN);

    await page.click('#btNext');

    // =========================
    // 4. HASŁO
    // =========================
    const passwordInput = page.locator('#Password');
    await passwordInput.waitFor({ state: 'visible' });
    await passwordInput.fill(process.env.PASSWORD);

    await page.click('#btLogOn');

    // =========================
    // 5. CZEKAJ NA ZALOGOWANIE
    // =========================
    await page.waitForLoadState('networkidle');

    // =========================
    // 6. WYCIĄGNIJ KEY Z URL
    // =========================
    const currentUrl = page.url();
    const keyMatch = currentUrl.match(/key=([^&]+)/);
    const key = keyMatch?.[1];

    if (!key) {
      throw new Error('Nie znaleziono key w URL');
    }

    console.log('🔑 KEY:', key);

    // =========================
    // 7. API ZADANIA
    // =========================
    const url = `https://uczen.eduvulcan.pl/pszczyna/api/SprawdzianyZadaniaDomowe?key=${key}&dataOd=2026-04-30T22:00:00.000Z&dataDo=2026-05-31T21:59:59.999Z`;

    const response = await page.request.get(url);
    const data = await response.json();

    // =========================
    // 8. FILTR ZADAŃ DOMOWYCH
    // =========================
    const homework = data
      .filter(item => item.typ === 4)
      .map(item => ({
        id: item.id,
        przedmiot: item.przedmiotNazwa,
        dataDodania: item.data
      }));

    // =========================
    // 9. ZAPIS PLIKU
    // =========================
    fs.writeFileSync('tasks.json', JSON.stringify(homework, null, 2));

    console.log(`📦 Pobrano zadań: ${homework.length}`);

  } catch (err) {
    console.error('❌ Błąd:', err);

    // debug screenshot (mega pomocne w Actions)
    await page.screenshot({ path: 'error.png', fullPage: true });
  }

  await browser.close();
})();
