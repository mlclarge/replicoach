import { chromium } from 'playwright';
import fs from 'fs';
import { spawn } from 'child_process';
import net from 'net';
import http from 'http';

const defaultPorts = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 5181, 5182, 5183];

const findFreePort = async (ports) => {
  for (const p of ports) {
    // try to connect; if connection succeeds, port is in use
    const inUse = await new Promise((res) => {
      const s = net.createConnection({ port: p, host: '127.0.0.1' });
      let settled = false;
      s.on('connect', () => {
        settled = true;
        s.destroy();
        res(true);
      });
      s.on('error', () => {
        if (!settled) {
          settled = true;
          res(false);
        }
      });
      // safety timeout
      setTimeout(() => {
        if (!settled) {
          settled = true;
          try { s.destroy(); } catch (e) {}
          res(false);
        }
      }, 300);
    });

    if (!inUse) return p;
  }
  return null;
};

const waitForHttp = (port, timeout = 20000) => {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryReq = () => {
      const req = http.request({ method: 'GET', hostname: '127.0.0.1', port, path: '/', timeout: 2000 }, (res) => {
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
        setTimeout(tryReq, 300);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
        setTimeout(tryReq, 300);
      });
      req.end();
    };
    tryReq();
  });
};

const main = async () => {
  const freePort = await findFreePort(defaultPorts);
  if (!freePort) {
    console.error('Aucun port libre trouvé dans', defaultPorts.join(', '));
    process.exit(1);
  }

  console.log('Selected free port:', freePort);

  // Start Vite on that port
  console.log(`Starting dev server on port ${freePort} (npm run dev -- --port ${freePort})`);
  const dev = spawn('npm', ['run', 'dev', '--', '--port', String(freePort)], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
  });

  try {
    await waitForHttp(freePort, 30000);
    console.log('Dev server responsive on port', freePort);
  } catch (err) {
    console.error('Dev server did not respond in time:', err.message || err);
    dev.kill();
    process.exit(1);
  }

  const url = `http://localhost:${freePort}/`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { timeout: 60000, waitUntil: 'load' });
    await page.waitForTimeout(1000);
    const homeShot = 'scripts/screenshot_home.png';
    await page.screenshot({ path: homeShot, fullPage: true });
    console.log('Saved', homeShot);

    const link = await page.$('a[href^="/script/"]');
    if (link) {
      const href = await link.getAttribute('href');
      console.log('Found script link, navigating to', href);
      await Promise.all([page.waitForNavigation({ timeout: 10000 }), link.click()]);
      await page.waitForTimeout(800);
      const detailShot = 'scripts/screenshot_script_detail.png';
      await page.screenshot({ path: detailShot, fullPage: true });
      console.log('Saved', detailShot);
    } else {
      console.log('No /script/ link found on homepage.');
    }
  } catch (err) {
    console.error('Error during inspection:', err.message || err);
  } finally {
    await browser.close();
    // leave dev running (user can stop it) or kill it?
    // we'll keep it running so user can inspect
  }
};

main();


