const puppeteer = require('puppeteer');
const { WebClient } = require('@slack/web-api');
const RSS = require('rss');
const fs = require('fs');

// Configuration
const url = 'https://www.upwork.com/nx/search/jobs/?client_hires=1-9,10-&location=Canada&nbs=1&q=graphic%20designer&sort=recency';
const slackWebhookUrl = 'https://hooks.slack.com/services/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';

// Fonction principale
async function fetchJobsAndNotify() {
    try {
        // 1. Lancer le navigateur avec Puppeteer
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // 2. Naviguer vers l'URL cible
        await page.goto(url, { waitUntil: 'networkidle2' });

        // 3. Attendre que les éléments de travail soient présents sur la page
        await page.waitForSelector('.job-tile');

        // 4. Récupérer le contenu de la page
        const html = await page.content();
        fs.writeFileSync('page.html', html);  // Sauvegarder le contenu de la page pour débogage

        const jobs = [];
        const $ = cheerio.load(html);

        $('.job-tile').each((index, element) => {
            const title = $(element).find('.job-title a').text().trim();
            const link = 'https://www.upwork.com' + $(element).find('.job-title a').attr('href');
            const description = $(element).find('.job-description').text().trim();

            if (title && link) {
                jobs.push({ title, link, description });
                console.log(`Job found: ${title}, ${link}`); // Afficher les jobs trouvés
            }
        });

        if (jobs.length === 0) {
            console.log('No new jobs found.');
            await browser.close();
            return;
        }

        // 5. Générer un flux RSS
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

        // Sauvegarder le flux RSS dans un fichier
        const rss = feed.xml({ indent: true });
        fs.writeFileSync('rss.xml', rss);

        // 6. Envoyer des notifications sur Slack
        const slackClient = new WebClient(slackWebhookUrl);

        for (const job of jobs) {
            await slackClient.chat.postMessage({
                text: `New Job Posted: *${job.title}*\n${job.description}\n<${job.link}|View Job>`,
                channel: '#upwork-international',  // Utilisation du canal spécifié
            });
        }

        console.log('Notifications sent successfully!');
        await browser.close();
    } catch (error) {
        console.error('Error fetching or processing jobs:', error);
    }
}

// Exécuter la fonction principale
fetchJobsAndNotify();
