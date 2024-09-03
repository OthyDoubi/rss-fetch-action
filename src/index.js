const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const RSS = require('rss');
const fs = require('fs');

// Configuration
const url = 'https://www.upwork.com/nx/search/jobs/?client_hires=1-9,10-&location=Canada&nbs=1&q=graphic%20designer&sort=recency';
const slackWebhookUrl = 'https://hooks.slack.com/services/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';

async function fetchJobsAndNotify() {
    let browser;
    try {
        // 1. Lancer Puppeteer
        browser = await puppeteer.launch({
            headless: 'new', // Utilisation du nouveau mode headless
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        const page = await browser.newPage();

        // 2. Configurer un délai d'attente par défaut pour les actions de navigation et de recherche
        await page.setDefaultNavigationTimeout(180000); // 3 minutes

        // 3. Naviguer vers la page et attendre que le chargement du réseau soit terminé
        await page.goto(url, {
            waitUntil: 'networkidle0',
        });

        // 4. Attendre que les éléments soient disponibles avec un délai d'attente prolongé
        await page.waitForSelector('.job-tile', { timeout: 90000 }); // 1.5 minutes

        // 5. Récupérer le contenu HTML
        const html = await page.content();
        const $ = cheerio.load(html);
        const jobs = [];

        // 6. Extraire les données
        $('.job-tile').each((index, element) => {
            const title = $(element).find('.job-title a').text().trim();
            const link = 'https://www.upwork.com' + $(element).find('.job-title a').attr('href');
            const description = $(element).find('.job-description').text().trim();

            if (title && link) {
                jobs.push({ title, link, description });
            }
        });

        if (jobs.length === 0) {
            console.log('No new jobs found.');
            return;
        }

        // 7. Générer un flux RSS
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

        // 8. Envoyer des notifications sur Slack
        for (const job of jobs) {
            await axios.post(slackWebhookUrl, {
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

// Exécuter la fonction principale
fetchJobsAndNotify();
