const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. wejście na stronę główną
    await page.goto('https://eduvulcan.pl/');

    // 2. klik "Zaloguj się"
    await page.click('#panelLoginButton');

    // 3. ekran loginu
    const aliasInput = page.locator('#Alias');
    await aliasInput.waitFor({ state: 'visible' });
    await aliasInput.fill(process.env.LOGIN);

    // 4. dalej
    await page.click('#btNext');

    // 5. ekran hasła
    const passwordInput = page.locator('#Password');
    await passwordInput.waitFor({ state: 'visible' });
    await passwordInput.fill(process.env.PASSWORD);

    // 6. logowanie
    await page.click('#btLogOn');

    // 7. poczekaj na pełne zalogowanie
    await page.waitForLoadState('networkidle');

    // 8. wyciągnięcie key z URL
    const currentUrl = page.url();
    const keyMatch = currentUrl.match(/key=([^&]+)/);
    const key = keyMatch?.[1];

    if (!key) {
      throw new Error('Nie znaleziono key w URL po logowaniu');
    }

    console.log('🔑 KEY:', key);

    // 9. API request
    const url = `https://uczen.eduvulcan.pl/pszczyna/api/SprawdzianyZadaniaDomowe?key=${key}&dataOd=2026-04-30T22:00:00.000Z&dataDo=2026-05-31T21:59:59.999Z`;

    const response = await page.request.get(url);
    const data = await response.json();

    // 10. filtr zadań domowych (typ: 4)
    const homework = data
      .filter(item => item.typ === 4)
      .map(item => ({
        id: item.id,
        przedmiot: item.przedmiotNazwa,
        dataDodania: item.data
      }));

    // 11. zapis
    fs.writeFileSync('tasks.json', JSON.stringify(homework, null, 2));

    console.log(`📦 Pobrano zadań: ${homework.length}`);

  } catch (err) {
    console.error('❌ Błąd:', err);
    await page.screenshot({ path: 'error.png', fullPage: true });
  }

  await browser.close();
})();
