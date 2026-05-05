const { chromium } = require('playwright');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    realtime: {
      transport: ws
    }
  }
);
console.log('URL:', process.env.SUPABASE_URL);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // =========================
    // 1. STRONA STARTOWA
    // =========================
    await page.goto('https://eduvulcan.pl/');
    await page.waitForTimeout(2000);

    // =========================
    // 🍪 COOKIES (POPRAWKA — iframe)
    // =========================
    try {
      const frame = page.frameLocator('#respect-privacy-frame');
      await frame.locator('#save-default-button').click({ timeout: 5000 });
    } catch {
      // ignorujemy jeśli brak popupu
    }

    await page.waitForTimeout(1000);

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
    // 🍪 DRUGI POPUP (MOŻE WRÓCIĆ)
    // =========================
    try {
      const frame2 = page.frameLocator('#respect-privacy-frame');
      await frame2.locator('#save-default-button').click({ timeout: 3000 });
    } catch {}

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
	// 6. WYBÓR UCZNIA
	// =========================
	// poczekaj aż strona faktycznie przejdzie dalej
	await page.waitForLoadState('domcontentloaded');
	await page.waitForTimeout(2000);
	
	// wybór ucznia
	const studentLink = page.locator('a.connected-account.access-row').first();
	
	await studentLink.waitFor({ state: 'visible', timeout: 60000 });
	await studentLink.click();
	
	console.log('👤 wybrano ucznia');


	// poczekaj na przejście do dziennika
	await page.waitForLoadState('networkidle');


	// =========================
	// 7. WEJDŹ W "Sprawdziany i zadania domowe"
	// =========================
	const tasksLink = page.getByRole('link', { name: 'Sprawdziany i zadania domowe' });

	await tasksLink.click();

	console.log('📚 otwarto zadania');

	// poczekaj aż aplikacja się ustabilizuje
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(3000);
	
	// =========================
	// 8. WYCIĄGNIJ KEY Z URL (NOWY SPOSÓB)
	// =========================
	const currentUrl = page.url();

	// dopasowanie: /App/KEY/
	const match = currentUrl.match(/App\/([^/]+)\//);
	const key = match?.[1];

	if (!key) {
	  throw new Error('Nie znaleziono key w URL');
	}

	console.log('🔑 KEY:', key);
	
	const now = new Date();
	const past = new Date();
	past.setDate(now.getDate() - 30);

	const dataOd = past.toISOString();
	const dataDo = now.toISOString();	
	
    // =========================
    // 7. API ZADANIA
    // =========================
    const url = `https://uczen.eduvulcan.pl/pszczyna/api/SprawdzianyZadaniaDomowe?key=${key}&dataOd=${dataOd}&dataDo=${dataDo}`;

    const response = await page.request.get(url);
    const apiResponse = await response.json();

	console.log(apiResponse)
    // =========================
    // 8. FILTR ZADAŃ DOMOWYCH
    // =========================
    const homework = apiResponse
      .filter(item => item.typ === 4)
      .map(item => ({
        id: item.id,
        przedmiot: item.przedmiotNazwa,
        dataDodania: item.data
      }));

 // =========================
// 9. ZAPIS DO SUPABASE
// =========================

// przygotuj payload pod bazę
const rows = homework.map(task => ({
  id: task.id,
  przedmiot: task.przedmiot,
  target_date: task.dataDodania,
  ingested_at: new Date().toISOString()
}));

// zapis (insert + ignore/update przy konflikcie id)
const { data, error } = await supabase
  .from('homework')
  .upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('❌ supabase error:', error);
} else {
  console.log(`✅ zapisano/zweryfikowano rekordów: ${rows.length}`);
}

    console.log(`📦 Pobrano zadań: ${homework.length}`);

  } catch (err) {
    console.error('❌ Błąd:', err);
    await page.screenshot({ path: 'error.png', fullPage: true });
  }

  await browser.close();
})();
