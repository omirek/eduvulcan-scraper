const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const results = [];

  page.on('response', async (response) => {
    try {
      if (response.url().includes('zadanie')) {
        const data = await response.json();

        if (data && data.id) {
          results.push({
            id: data.id,
            opis: data.opis,
            dataDodania: data.data,
            termin: data.terminOdpowiedzi,
            przedmiot: data.przedmiotNazwa
          });
        }
      }
    } catch (e) {}
  });

  await page.goto('https://eduvulcan.pl/logowanie');

  await page.fill('input[type="text"]', process.env.LOGIN);
  await page.fill('input[type="password"]', process.env.PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForLoadState('networkidle');

  // 👉 TU MUSISZ wejść w zadania (ważne!)
  await page.goto('https://.../zadania'); // wstaw właściwy URL

  await page.waitForTimeout(5000);

  fs.writeFileSync('tasks.json', JSON.stringify(results, null, 2));

  await browser.close();
})();
