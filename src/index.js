const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const { WebClient } = require('@slack/web-api');
const RSS = require('rss');
const fs = require('fs');

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

        // Liste des sélecteurs possibles
        const selectors = ['.up-job-card', '.job-listing', '.job-card', '.job-listing-item'];

        let activeSelector = null;

        // Boucle pour trouver un sélecteur actif
        for (const selector of selectors) {
            const element = await page.$(selector);
            if (element) {
                activeSelector = selector;
                break;
            }
        }

        if (!activeSelector) {
            throw new Error("Aucun sélecteur actif trouvé sur la page.");
        }

        console.log(`Active selector found: ${activeSelector}`);

        // Attendre que le sélecteur apparaisse avec un timeout augmenté
        await page.waitForSelector(activeSelector, { timeout: 120000 });

        // Obtenir le contenu HTML de la page
        const html = await page.content();
        fs.writeFileSync('pageContent.html', html); // Sauvegarder le HTML pour analyse

        const $ = cheerio.load(html);
        const jobs = [];

        // Extraire les informations des jobs
        $(activeSelector).each((index, element) => {
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
