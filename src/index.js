const axios = require('axios');
const cheerio = require('cheerio');
const { WebClient } = require('@slack/web-api');
const RSS = require('rss');
const fs = require('fs');

// Configuration
const url = 'https://www.upwork.com/nx/search/jobs/?client_hires=1-9,10-&location=Canada&nbs=1&q=graphic%20designer&sort=recency';
const slackWebhookUrl = 'https://hooks.slack.com/services/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';

// Fonction principale
async function fetchJobsAndNotify() {
    try {
        // 1. Récupérer le contenu de la page
        const response = await axios.get(url);
        const html = response.data;

        // 2. Analyser les données pour extraire les offres de travail
        const $ = cheerio.load(html);
        const jobs = [];

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

        // 3. Générer un flux RSS
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

        // 4. Envoyer des notifications sur Slack
        const slackClient = new WebClient(slackWebhookUrl);

        for (const job of jobs) {
            await slackClient.chat.postMessage({
                text: `New Job Posted: *${job.title}*\n${job.description}\n<${job.link}|View Job>`,
                channel: '#upwork-international',  // Utilisation du canal spécifié
            });
        }

        console.log('Notifications sent successfully!');
    } catch (error) {
        console.error('Error fetching or processing jobs:', error);
    }
}

// Exécuter la fonction principale
fetchJobsAndNotify();
