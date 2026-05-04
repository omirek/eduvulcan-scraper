const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 🔐 logowanie
  await page.goto('https://eduvulcan.pl/logowanie');

  await page.fill('input[type="text"]', process.env.LOGIN);
  await page.fill('input[type="password"]', process.env.PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForLoadState('networkidle');

  // 🔍 przechwycenie requestu z key
  let apiUrl = null;

  page.on('request', (request) => {
    const url = request.url();

    if (url.includes('SprawdzianyZadaniaDomowe')) {
      apiUrl = url;
    }
  });

  // 👉 wymuś załadowanie danych (wejście w widok)
  await page.goto('https://uczen.eduvulcan.pl/');
  await page.waitForTimeout(5000);

  if (!apiUrl) {
    console.log('❌ Nie znaleziono API URL');
    await browser.close();
    return;
  }

  console.log('API URL:', apiUrl);

  // 📡 pobranie danych BEZ klikania
  const response = await page.request.get(apiUrl);
  const data = await response.json();

  // 🎯 filtr: tylko zadania domowe
  const homework = data
    .filter(item => item.typ === 4)
    .map(item => ({
      id: item.id,
      przedmiot: item.przedmiotNazwa,
      dataDodania: item.data
    }));

  // 💾 zapis
  fs.writeFileSync('tasks.json', JSON.stringify(homework, null, 2));

  // 🔄 porównanie z poprzednim uruchomieniem
  let old = [];
  if (fs.existsSync('tasks_old.json')) {
    old = JSON.parse(fs.readFileSync('tasks_old.json'));
  }

  const newTasks = homework.filter(
    t => !old.some(o => o.id === t.id)
  );

  if (newTasks.length > 0) {
    console.log('🆕 NOWE ZADANIA:', newTasks);
  } else {
    console.log('Brak nowych zadań');
  }

  fs.writeFileSync('tasks_old.json', JSON.stringify(homework, null, 2));

  await browser.close();
})();
