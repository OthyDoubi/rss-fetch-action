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
        // Lancement du navigateur
        browser = await puppeteer.launch({
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(240000); // Timeout de 4 minutes pour la navigation

        // Aller à la page d'Upwork
        await page.goto(url, { waitUntil: 'networkidle0' });

        // Attente de l'apparition des éléments avec un timeout de 60 secondes
        await page.waitForSelector('.job-tile', { timeout: 500000 });

        // Récupération du contenu HTML
        const html = await page.content();
        const $ = cheerio.load(html);
        const jobs = [];

        // Extraction des informations sur les emplois
        $('.job-tile').each((index, element) => {
            const title = $(element).find('.job-title a').text().trim();
            const link = 'https://www.upwork.com' + $(element).find('.job-title a').attr('href');
            const description = $(element).find('.job-description').text().trim();

            if (title && link) {
                jobs.push({ title, link, description });
            }
        });

        // Vérification si des emplois ont été trouvés
        if (jobs.length === 0) {
            console.log('No new jobs found.');
            return;
        }

        // Création du flux RSS
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

        // Notification sur Slack
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
        // Fermeture du navigateur
        if (browser) {
            await browser.close();
        }
    }
}

fetchJobsAndNotify();
