const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const contractDir = path.join(__dirname, '..', 'Contract');
const pdfFiles = fs.readdirSync(contractDir).filter(file => file.toLowerCase().endsWith('.pdf'));

if (pdfFiles.length === 0) {
  console.error('No PDF contract found in Contract/ directory!');
  process.exit(1);
}

const contractFile = pdfFiles[0];
const contractPath = path.join(contractDir, contractFile);
const contractBase = path.basename(contractFile, path.extname(contractFile)).toLowerCase();

const screenshotName = `${contractBase}_dashboard.png`;
const screenshotPath = path.join('C:', 'Users', 'Kirubhananth', '.gemini', 'antigravity', 'brain', '229bc39a-f5fd-4403-b289-9fc5661d868c', screenshotName);

(async () => {
  console.log('Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: "new",
    protocolTimeout: 300000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1200 });
  
  // Listen to console errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  
  console.log('Locating file input element...');
  const fileInput = await page.$('input[type=file]');
  if (!fileInput) {
    console.error('File input not found!');
    await browser.close();
    process.exit(1);
  }
  
  console.log(`Uploading file: ${contractPath}...`);
  await fileInput.uploadFile(contractPath);
  
  console.log('Waiting for analysis to complete (this calls Gemini)...');
  try {
    // Wait for the dashboard grid to appear (max 300 seconds)
    await page.waitForSelector('.dashboard-grid', { timeout: 300000 });
    console.log('Dashboard rendered successfully!');
    
    // Wait an additional second for any CSS transitions
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Capturing screenshot...');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to: ${screenshotPath}`);
    
    // Fetch metrics from the page to verify content
    const metrics = await page.evaluate(() => {
      const score = document.querySelector('.score-number')?.innerText;
      const totalClauses = document.querySelector('.stat-card:nth-child(1) .stat-value')?.innerText;
      const highRisks = document.querySelector('.stat-card:nth-child(2) .stat-value')?.innerText;
      const mediumRisks = document.querySelector('.stat-card:nth-child(3) .stat-value')?.innerText;
      const lowRisks = document.querySelector('.stat-card:nth-child(4) .stat-value')?.innerText;
      return { score, totalClauses, highRisks, mediumRisks, lowRisks };
    });
    
    console.log('--- UI RENDER VERIFICATION ---');
    console.log(`Overall Risk Score: ${metrics.score}`);
    console.log(`Total Segmented Clauses: ${metrics.totalClauses}`);
    console.log(`High Risk Clauses: ${metrics.highRisks}`);
    console.log(`Medium Risk Clauses: ${metrics.mediumRisks}`);
    console.log(`Low Risk Clauses: ${metrics.lowRisks}`);
    
  } catch (err) {
    console.error('Error waiting for dashboard or taking screenshot:', err);
    // Take a screenshot of the error state if possible
    await page.screenshot({ path: screenshotPath });
    console.log(`Error screenshot saved to: ${screenshotPath}`);
  }
  
  await browser.close();
  console.log('Browser closed.');
})();
