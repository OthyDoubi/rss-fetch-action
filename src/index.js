const puppeteer = require('puppeteer');
const axios = require('axios');

const slackWebhookUrl = 'https://hooks.slack.com/services/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';
const upworkUrl = 'https://www.upwork.com/nx/search/jobs/?client_hires=1-9,10-&location=Canada&nbs=1&q=graphic%20designer&sort=recency';

let lastJobPosted = null;

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(upworkUrl);

    while (true) {
        await page.reload();
        
        const jobs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.job-tile')).map(job => ({
                title: job.querySelector('.job-title a').textContent.trim(),
                link: 'https://www.upwork.com' + job.querySelector('.job-title a').getAttribute('href'),
                description: job.querySelector('.job-description').textContent.trim(),
                postedAt: job.querySelector('.client-info').textContent.trim()
            }));
        });

        if (jobs.length > 0 && jobs[0].title !== lastJobPosted) {
            lastJobPosted = jobs[0].title;

            const message = {
                text: `Nouveau job détecté sur Upwork : *${jobs[0].title}*\nDescription: ${jobs[0].description}\nLien: ${jobs[0].link}`
            };

            await axios.post(slackWebhookUrl, message);
        }

        console.log(`Checked at ${new Date().toISOString()} - Next check in 5 minutes.`);
        await new Promise(r => setTimeout(r, 5 * 60 * 1000)); // Attendre 5 minutes avant de recharger
    }

    await browser.close();
})();
