const puppeteer = require('puppeteer');

(async () => {
  const url = 'http://localhost:5173/script/dev-mock/audio?devMock=1';

  const browser = await puppeteer.launch({ args: ['--no-sandbox'], headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for Mode italienne section
    await page.waitForSelector('p.text-xs', { visible: true });

    // Click first character pill to toggle hide
    const charButton = await page.$('div.p-3.bg-amber-100 button');
    if (!charButton) throw new Error('Character button not found');
    await charButton.click();

    // Start play
    const playButton = await page.$x("//button[contains(., '▶️')]");
    if (playButton.length === 0) throw new Error('Play button not found');
    await playButton[0].click();

    // Wait for waiting indicator
    await page.waitForSelector('div.bg-green-500', { visible: true, timeout: 5000 });

    // Find the first replica bubble that is hidden and click it
    // Hidden bubble has text 'Votre réplique (masquée)'
    const hiddenBubble = await page.$x("//p[contains(., 'Votre réplique (masquée)')]/ancestor::div[2]");
    if (hiddenBubble.length === 0) throw new Error('Hidden bubble not found');

    await hiddenBubble[0].click();

    // After click, waiting indicator should disappear
    await page.waitForFunction(() => !document.querySelector('div.bg-green-500'), { timeout: 5000 });

    console.log('✅ Test OK: clicking hidden bubble removed waiting indicator.');
  } catch (err) {
    console.error('❌ Test FAILED:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
