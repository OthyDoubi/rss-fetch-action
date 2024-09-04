const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

const url = 'https://www.upwork.com/nx/search/jobs/?client_hires=1-9,10-&location=Canada&nbs=1&q=graphic%20designer&sort=recency';

async function fetchJobsAndNotify() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new', // Utilisez le nouveau mode headless
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(120000);

        // Aller à l'URL spécifiée
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Ajouter un délai pour s'assurer que tout est bien chargé
        await page.waitForTimeout(30000); // Délai supplémentaire de 30 secondes

        // Liste des sélecteurs possibles
        const selectors = ['.up-job-card', '.job-listing', '.job-tile', '.job-listing-item'];

        let activeSelector = null;

        // Boucle pour trouver un sélecteur actif
        for (const selector of selectors) {
            const element = await page.$(selector);
            if (element) {
                activeSelector = selector;
                console.log(`Selector found: ${selector}`);
                break;
            } else {
                console.log(`Selector not found: ${selector}`);
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

        // Générer un flux RSS (partie omise pour simplicité)

        console.log('Jobs found and processed successfully!');
    } catch (error) {
        console.error('Error fetching or processing jobs:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

fetchJobsAndNotify();
