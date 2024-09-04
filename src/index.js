const puppeteer = require('puppeteer');
const fs = require('fs');
const RSS = require('rss');
const { WebClient } = require('@slack/web-api');

// Configuration
const url = 'https://www.upwork.com/nx/search/jobs/?client_hires=1-9,10-&location=Canada&nbs=1&q=graphic%20designer&sort=recency';
const slackWebhookUrl = 'https://hooks.slack.com/services/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';

async function fetchJobsAndNotify() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(120000);

        // Aller à l'URL spécifiée
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Ajouter un délai pour s'assurer que tout est bien chargé
        await page.waitForTimeout(30000); // Délai supplémentaire de 30 secondes

        // Prendre une capture d'écran pour le débogage
        await page.screenshot({ path: 'debug.png' });

        // Utilisation de XPath pour rechercher les éléments des jobs
        const jobElements = await page.$x('//div[contains(@class, "job-") or contains(@class, "listing")]');

        if (jobElements.length === 0) {
            throw new Error("Les éléments de job n'ont pas été trouvés sur la page.");
        }

        // Obtenir le contenu HTML de la page
        const html = await page.content();
        fs.writeFileSync('pageContent.html', html); // Sauvegarder le HTML pour analyse

        const jobs = [];

        // Extraire les informations des jobs à partir des éléments trouvés
        for (const element of jobElements) {
            const titleElement = await element.$x('.//a[contains(@class, "job-title")]');
            const descriptionElement = await element.$x('.//div[contains(@class, "job-description")]');

            const title = titleElement.length ? await (await titleElement[0].getProperty('textContent')).jsonValue() : 'No title';
            const link = titleElement.length ? await (await titleElement[0].getProperty('href')).jsonValue() : '#';
            const description = descriptionElement.length ? await (await descriptionElement[0].getProperty('textContent')).jsonValue() : 'No description';

            jobs.push({ title: title.trim(), link: link.trim(), description: description.trim() });
        }

        if (jobs.length === 0) {
            console.log('No new jobs found.');
            return;
        }

        // Générer un flux RSS
        const feed = new RSS({
            title: 'Upwork Graphic Designer Jobs',
            description: 'Latest graphic designer jobs on Upwork',
            feed_url: 'http://example.com/rss.xml',
            site_url: 'https://www.upwork.com',
        });

        jobs.forEach(job => {
            feed.item({
                title: job.title,
                description: job.description,
                url: job.link,
                guid: job.link,
            });
        });

        const rss = feed.xml({ indent: true });
        fs.writeFileSync('rss.xml', rss);

        // Envoyer des notifications Slack
        const slackClient = new WebClient(slackWebhookUrl);
        for (const job of jobs) {
            await slackClient.chat.postMessage({
                text: `New Job Posted: *${job.title}*\n${job.description}\n<${job.link}|View Job>`,
                channel: '#upwork-international',
            });
        }

        console.log('Notifications sent successfully!');
    } catch (error) {
        console.error('Error fetching or processing jobs:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

fetchJobsAndNotify();
