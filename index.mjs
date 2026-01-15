import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';

const AUTOWINI_API_URL = 'https://v2api.autowini.com/items/cars';
const AUTOWINI_API_PARAMS = {
    pageSize: 30,
    sorting: 'lowPrice',
    make: 'C0040',
    subModel: 'C1840',
    modelYearFrom: 2016,
    priceTo: 12000,
    fuelType: 'C060'
};
const AUTOWINI_BASE_URL = 'https://www.autowini.com';
const AUTOWINI_DETAIL_PREFIX = `${AUTOWINI_BASE_URL}/Cars/`;
const ENCAR_API_URL = 'https://api.encar.com/search/car/list/premium?count=true&q=(And.Year.range(201600..)._.Hidden.N._.(C.CarType.N._.(C.Manufacturer.%EC%95%84%EC%9A%B0%EB%94%94._.ModelGroup.A7.))_.FuelType.%EB%94%94%EC%A0%A4._.Price.range(..1800).)&sr=%7CPriceAsc%7C0%7C20';
const ENCAR_DETAIL_PREFIX = 'https://fem.encar.com/cars/detail/';
const ENCAR_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin': 'https://www.encar.com',
    'Referer': 'https://www.encar.com/',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};
const ENCAR_PROXY_URL = process.env.ENCAR_PROXY_URL || '';

// Configure axios with timeout and retry settings
axios.defaults.timeout = 30000; // 30 seconds timeout

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

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8349569989:AAHiHgy2WThd0_ssOqg1JvX2xnkQx6xuS80';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-4549901364';

const bot = new TelegramBot(TELEGRAM_TOKEN, {polling: true});

let storedAutowiniIds = new Map();
let storedEncarIds = new Map();
let isFirstRunAutowini = true;
let isFirstRunEncar = true;

console.log('car watcher started!!!');

// Start HTTP server for Railway healthchecks
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({
            status: 'ok',
            service: 'autowini-car-watcher',
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

const formatPrice = (price) => {
    if (price === null || price === undefined) {
        return 'N/A';
    }
    return `$${Number(price).toLocaleString()}`;
};

const formatMileage = (mileage) => {
    if (mileage === null || mileage === undefined) {
        return 'N/A';
    }
    return `${Number(mileage).toLocaleString()} km`;
};

const formatValue = (value) => value || 'N/A';
const formatEncarWonPrice = (priceInTenThousandKrw) => {
    if (priceInTenThousandKrw === null || priceInTenThousandKrw === undefined) {
        return 'N/A';
    }

    const krw = Number(priceInTenThousandKrw) * 10000;
    if (!Number.isFinite(krw)) {
        return 'N/A';
    }

    const millions = krw / 1_000_000;
    return `${millions.toFixed(1)} million won`;
};

const buildAutowiniDetailUrl = (detailUrl) => {
    if (!detailUrl) {
        return AUTOWINI_BASE_URL;
    }

    const trimmed = detailUrl.startsWith('/items/')
        ? detailUrl.replace('/items/', '')
        : detailUrl.replace(/^\//, '');

    return `${AUTOWINI_DETAIL_PREFIX}${trimmed}/cars-detail`;
};

const buildEncarDetailUrl = (carId) => `https://fem.encar.com/cars/detail/${carId}`;

const fetchAutowiniCars = async () => {
    console.log('polling autowini cars...');

    try {
        const response = await retryRequest(() =>
            axios.get(AUTOWINI_API_URL, {
                params: AUTOWINI_API_PARAMS
            })
        );

        if (response.data?.result !== 'SUCCESS') {
            console.error('Unexpected API response:', response.data?.result);
            return;
        }

        const cars = response.data?.data?.items || [];
        console.log(`autowini items received: ${cars.length}`);

        for (const car of cars) {
            const carId = car.listingId || car.code;
            if (!carId) {
                continue;
            }

            const price = car.price ?? null;
            const detailUrl = buildAutowiniDetailUrl(car.detailUrl);
            const baseMessage =
                `${car.itemName || 'Car listing'}\n` +
                `Price: ${formatPrice(price)}\n` +
                `Mileage: ${formatMileage(car.mileage)}\n` +
                `Location: ${formatValue(car.locationName)}\n` +
                `Fuel: ${formatValue(car.fuelType)}\n` +
                `Transmission: ${formatValue(car.transmissionType)}\n` +
                `${detailUrl}`;

            if (isFirstRunAutowini) {
                storedAutowiniIds.set(carId, price);
                continue;
            }

            if (!storedAutowiniIds.has(carId)) {
                storedAutowiniIds.set(carId, price);
                try {
                    await bot.sendMessage(CHAT_ID, `New car listed (Autowini):\n${baseMessage}`);
                } catch (telegramError) {
                    console.error('Error sending Telegram message:', telegramError.message);
                }
                continue;
            }

            const previousPrice = storedAutowiniIds.get(carId);
            if (previousPrice !== price) {
                storedAutowiniIds.set(carId, price);
                try {
                    await bot.sendMessage(
                        CHAT_ID,
                        `Price change detected (Autowini):\n` +
                        `${baseMessage}\n` +
                        `Previous: ${formatPrice(previousPrice)}\n` +
                        `Current: ${formatPrice(price)}`
                    );
                } catch (telegramError) {
                    console.error('Error sending Telegram message:', telegramError.message);
                }
            }
        }

        if (isFirstRunAutowini) {
            isFirstRunAutowini = false;
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
        } else {
            console.error('Error fetching autowini cars:', error.message);
            if (error.response) {
                console.error('API Error:', error.response.status, error.response.statusText);
            }
        }
    }
};

const buildEncarTitle = (car) => {
    const parts = [car.Manufacturer, car.Model, car.Badge, car.BadgeDetail].filter(Boolean);
    return parts.length ? parts.join(' ') : 'Car listing';
};

const fetchEncarCars = async () => {
    console.log('polling encar cars...');

    try {
        const proxyAgent = ENCAR_PROXY_URL ? new HttpsProxyAgent(ENCAR_PROXY_URL) : null;
        const response = await retryRequest(() =>
            axios.get(ENCAR_API_URL, {
                headers: ENCAR_HEADERS,
                httpsAgent: proxyAgent || undefined
            })
        );

        const cars = response.data?.SearchResults || [];
        console.log(`encar items received: ${cars.length}`);

        for (const car of cars) {
            const carId = car.Id;
            if (!carId) {
                continue;
            }

            const price = car.Price ?? null;
            const detailUrl = buildEncarDetailUrl(carId);
            const baseMessage =
                `${buildEncarTitle(car)}\n` +
                `Price: ${formatEncarWonPrice(price)}\n` +
                `Mileage: ${formatMileage(car.Mileage)}\n` +
                `${detailUrl}`;

            if (isFirstRunEncar) {
                storedEncarIds.set(carId, price);
                continue;
            }

            if (!storedEncarIds.has(carId)) {
                storedEncarIds.set(carId, price);
                try {
                    await bot.sendMessage(CHAT_ID, `New car listed (Encar):\n${baseMessage}`);
                } catch (telegramError) {
                    console.error('Error sending Telegram message:', telegramError.message);
                }
                continue;
            }

            const previousPrice = storedEncarIds.get(carId);
            if (previousPrice !== price) {
                storedEncarIds.set(carId, price);
                try {
                    await bot.sendMessage(
                        CHAT_ID,
                        `Price change detected (Encar):\n` +
                        `${baseMessage}\n` +
                        `Previous: ${formatPrice(previousPrice)}\n` +
                        `Current: ${formatPrice(price)}`
                    );
                } catch (telegramError) {
                    console.error('Error sending Telegram message:', telegramError.message);
                }
            }
        }

        if (isFirstRunEncar) {
            isFirstRunEncar = false;
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
        } else {
            console.error('Error fetching encar cars:', error.message);
            if (error.response) {
                console.error('API Error:', error.response.status, error.response.statusText);
            }
        }
    }
};

const fetchAllCars = async () => {
    await fetchAutowiniCars();
    await fetchEncarCars();
};

// Run the fetch function every minute
setInterval(fetchAllCars, 1 * 60 * 1000);

// Initial fetch to populate stored ids
fetchAllCars();
