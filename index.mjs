//count - https://api-statements.tnet.ge/v1/statements/count?deal_types=1&real_estate_types=1&cities=1&districts=6&currency_id=1&urbans=63&page=1
//info  - https://api-statements.tnet.ge/v1/statements?deal_types=1&real_estate_types=1&cities=1&districts=6&currency_id=1&urbans=63&page=1
//mandatory header - X-Website-Key : myhome
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import http from 'http';

// Add a request interceptor to log the full URL
// axios.interceptors.request.use(request => {
//   const fullUrl = `${request.baseURL || ''}${request.url}?${new URLSearchParams(request.params).toString()}`;
//   console.log('Requesting:', fullUrl);
//   return request;
// });

const API_URL = 'https://api-statements.tnet.ge/v1/statements';
const API_COUNT_URL = 'https://api-statements.tnet.ge/v1/statements/count';
const FILTERS = {

    deal_types: 1,
    real_estate_types: 1,
    cities: 1,
    urbans: [23, 29, 53, 59, 2, 6, 10, 78, 24],
    districts: [3, 4, 5, 1],
    currency_id: 2,
    price_from: 70000,
    price_to: 130000,
    area_from: 90,
    area_to: 150,
    area_types: 1,
    conditions: 1,
    bedroom_types: 3,
    room_types: 4,
    floor_from: 4,
    floor_to: 30,
    not_first: 1,
    page: 1

};

const headers = {
    'X-Website-Key': 'myhome'
};

// Configure axios with timeout and retry settings
axios.defaults.timeout = 30000; // 30 seconds timeout
axios.defaults.headers.common['X-Website-Key'] = 'myhome';

// Retry function with exponential backoff
const retryRequest = async (requestFn, maxRetries = 5, delay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await requestFn();
        } catch (error) {
            const isNetworkError = error.code === 'EAI_AGAIN' ||
                error.code === 'ECONNRESET' ||
                error.code === 'ETIMEDOUT' ||
                error.code === 'ENOTFOUND' ||
                error.message?.includes('getaddrinfo') ||
                (error.response === undefined && error.request !== undefined);

            if (isNetworkError && attempt < maxRetries) {
                const waitTime = delay * Math.pow(2, attempt - 1); // Exponential backoff
                console.log(`Network error (attempt ${attempt}/${maxRetries}): ${error.message || error.code}. Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw error; // Re-throw if not a network error or max retries reached
        }
    }
};

const TELEGRAM_TOKEN = '8555603450:AAH0uU4o2KVq9Y_8ktZ2BnC2w4eJBFGo11s'; // Replace with your Telegram bot token
const CHAT_ID = '-4694745286'; // Replace with the user's chat ID

const bot = new TelegramBot(TELEGRAM_TOKEN, {polling: true});

let StoreRealEstateIds = new Map();
let isFirstRun = true;

console.log("worker started!!!");

// Start HTTP server for Railway healthchecks
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            status: 'ok',
            service: 'myhome-automation',
            uptime: process.uptime()
        }));
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Health check server running on port ${PORT}`);
});

const fetchCars = async () => {

    console.log("loop started!!!");

    try {
        // Retry count API call with network error handling
        const countResponse = await retryRequest(() =>
            axios.get(API_COUNT_URL, {
                params: {...FILTERS, page: 1},
                headers: {
                    'X-Website-Key': 'myhome'
                }
            })
        );

        // Initialize page number
        let currentPage = 1;
        let lastPage = countResponse.data.data.last_page;
        console.log("total pages", countResponse.data.data.last_page);
        console.log("total statements", countResponse.data.data.total);

        do {
            // Retry API call with network error handling
            const response = await retryRequest(() =>
                axios.get(API_URL, {
                    params: {...FILTERS, page: currentPage},
                    headers: {
                        'X-Website-Key': 'myhome'
                    }
                })
            );

            const realestates = response.data.data.data;


            //console.log(typeof(realestates));

            for (let realEstate of realestates) {
                const realEstateId = realEstate.id;
                const price = realEstate.price['2'].price_total;
                const priceSquare = realEstate.price['2'].price_square;
                const realEstateUrl = `https://www.myhome.ge/pr/${realEstateId}/details/`;
                const title = realEstate.dynamic_title;

                if (isFirstRun) {
                    // Only save car IDs during the first iteration
                    StoreRealEstateIds.set(realEstateId, price);
                } else {
                    if (!StoreRealEstateIds.has(realEstateId)) {
                        // New car ID found
                        StoreRealEstateIds.set(realEstateId, price);
                        try {
                            await bot.sendMessage(CHAT_ID,
                                `დაემატა ახალი:\n` +
                                `ფასი: $${price}\n` +
                                `კვ.მ: $${priceSquare}\n` +
                                `${realEstateUrl}`);
                        } catch (telegramError) {
                            console.error('Error sending Telegram message:', telegramError.message);
                            // Continue processing even if Telegram fails
                        }
                    } else if (StoreRealEstateIds.get(realEstateId) != price) {
                        // Price change detected
                        const previousPrice = StoreRealEstateIds.get(realEstateId);
                        const priceDifference = price - previousPrice;
                        StoreRealEstateIds.set(realEstateId, price);
                        try {
                            await bot.sendMessage(CHAT_ID,
                                `Price change detected: \n` +
                                `Previous Price:   $${previousPrice}\n` +
                                `Current Price:    $${price}\n` +
                                `Price Difference: $${priceDifference}\n` +
                                `${realEstateUrl}`);
                        } catch (telegramError) {
                            console.error('Error sending Telegram message:', telegramError.message);
                            // Continue processing even if Telegram fails
                        }
                    }
                }
            }

            //console.log(currentPage);
            currentPage++; // Move to the next page
        } while (currentPage <= lastPage);
        if (isFirstRun) {
            isFirstRun = false; // Reset the flag after the first successful iteration
        }

    } catch (error) {
        const isNetworkError = error.code === 'EAI_AGAIN' ||
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            error.message?.includes('getaddrinfo') ||
            (error.response === undefined && error.request !== undefined);

        if (isNetworkError) {
            console.error('Network error (DNS/Connection issue):', error.code || error.message);
            console.log('Will retry on next interval. Data preserved.');
            // Don't clear data on network errors - just wait for next retry
        } else {
            console.error('Error fetching real estates:', error.message);
            // Only reset on non-network errors (API errors, data errors, etc.)
            // For network errors, we keep the data and retry
            if (error.response) {
                // API returned an error response
                console.error('API Error:', error.response.status, error.response.statusText);
            }
        }
    }

};

// Run the fetch function every 2 minutes
setInterval(fetchCars, 1 * 60 * 1000);

// Initial fetch to populate storedCarIds
fetchCars();
