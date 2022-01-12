// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;
const {URL} = require("url");
const metascraper = require('metascraper')([
  require('metascraper-date')(),
  require('metascraper-description')(),
  require('metascraper-image')(),
  require('metascraper-lang')(),
  require('metascraper-title')(),
  require('metascraper-url')()
]);

const axios = require("axios").default;

const numberOfHoursToScrape = 24;
const scrapeTargets = ["pv-magazine.com", "treehugger.com", "positive.news"];

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;

// ========== dont copy to lambda ==================
const { atlas_connection_uri } = require('../connection_strings');

const testSet = new Set([
  //'https://www.pv-magazine.com/2022/01/07/chinese-pv-industry-brief-jinko-switches-on-8-gw-topcon-factor-tongwei-announces-skyrocketing-profits',
  //'https://www.pv-magazine.com/press-releases/goodwe-rebrands-highlighting-the-role-of-smart-tech-in-transforming-the-future-of-energy',
  //'https://www.pv-magazine.com/2022/01/07/india-cabinet-approves-intrastate-transmission-scheme-backing-20-gw-of-renewable-energy-capacity',
  //'https://www.pv-magazine.com/2022/01/07/vattenfall-launches-high-temperature-heat-pump-solution-to-replace-gas-boilers',
  // 'https://www.pv-magazine.com/2022/01/07/new-tech-to-reduce-mechanical-stress-in-floating-pv-arrays',
  // 'https://www.pv-magazine.com/2022/01/07/chinese-fish-pond-hosts-550-mw-solar-farm',
  // 'https://www.treehugger.com/chemicals-in-beauty-products-5201184',
  'https://www.pv-magazine.com/press-releases/canadian-startup-launches-the-markets-first-commercial-perovskite-ink/',
  //'https://www.treehugger.com/make-garden-passion-project-reality-5214712'
])

test().then(result => console.log(result));

async function connectToDatabase() {
  if (cachedDb) {
    return;
  }
  // Connect to our MongoDB database hosted on MongoDB Atlas
  cachedClient = await MongoClient.connect(atlas_connection_uri);
  // Specify which database we want to use
  cachedDb = cachedClient.db("chances_db");
}

async function test() {
  // Get an instance of our database
  try {
    await connectToDatabase();
    return await executeLogic();
  } finally {
    // Close the connection to the MongoDB cluster
    await cachedClient.close();
  }
};

// ========== copy below to lambda ==================

async function executeLogic() {
  // todo: test Console.error in AWS

  // get all scraped urls in in mongo db from last x hours + 1 day 
  // (in order to avoid bug with date-differences between news-apis and metascraper. metascraper sometimes only gets day and no hours, minutes..)
  var startingTime = new Date();
  startingTime.setHours(startingTime.getHours() - (numberOfHoursToScrape + 24));
  var mongoResult = await cachedDb.collection('scraped_items')
                                  .find({"datePublished": {"$gt": startingTime}})
                                  .project({_id:0, url: 1})
                                  .toArray();
                          
  console.log("Urls of items in mongoDB scraped collection published last " + (numberOfHoursToScrape + 24) + " hours:");                              
  console.log(mongoResult);

  const scrapedUrls = new Set();
  await fetchUrlsWithNewscatcher(scrapedUrls);

  // use bing and iterate over all sites and fetch urls
  // use michas script and fetch url for different sites
  
  console.log("Urls returned by news apis for last " + numberOfHoursToScrape + " hours:");                   
  console.log(scrapedUrls);
  
  // eliminate all urls that already exist in mongo collection
  scrapedUrls.forEach(scrapedUrl => {
    if (mongoResult.some(jsonElem => compareURLs(jsonElem.url, scrapedUrl))) {
      scrapedUrls.delete(scrapedUrl);
    }
  });
  console.log("Newly scraped urls: ");     
  console.log(scrapedUrls);
  if (scrapedUrls.size == 0 ) {
    return "Scraping finished - no new items added."
  }

  const allPromises = [];
  const newScrapedItems = [];
  for (currentUrl of scrapedUrls) { 
    var currentPromise = fetchMetaData(currentUrl);
    currentPromise.then(scrapedItem => {
      if (scrapedItem) {
        prepareItemForMongoDB(scrapedItem);
        newScrapedItems.push(scrapedItem);
      }
    });
    allPromises.push(currentPromise);
  }
  await Promise.all(allPromises);

  var mongoResponse = await cachedDb.collection('scraped_items').insertMany(newScrapedItems);
  if (mongoResponse.acknowledged === false) {
    console.log("Could not insert scraped items");
    console.log(mongoResponse);
  }
  return "Scraping finished - " + newScrapedItems.length + " items added";
  
  // non-mvp:     
  // for some sites (pv-magazine, storage, etc) one could prepopulate the category-field. 
  // one could just use the host to fetch category from a map 'host -> category'
};

async function fetchMetaData(urlString) {
  try {
    var options = {
      method: 'GET',
      url: urlString,
      headers: {
        // next line needed for some websites like bloomberg.org, otherwise robot-detection kicks in
        'User-Agent': 'WhatsApp/2.21.12.21 A'
      }
    };

    const response = await axios.request(options);
    const url = response.config.url;
    const html = response.data;
    var result = await metascraper({ html, url});
    if (!compareURLs(result.url, url)) {
      console.error("Url returned by metascraper different to requested url. Item not added.");
      console.error("Requested url: " + urlString);
      console.error("Url returned by metascraper" + result.url);
      return null;
    } else {
      return result;
    }
  } catch (error) {
    console.error("Could not fetch meta data for url: " + urlString);
    console.error(error);
    return null;
  }
}

async function fetchUrlsWithNewscatcher(urlSet) {
  var scrapeTargetsAsString = getScrapeTargetsAsString();
  console.log("Scraping [" + scrapeTargetsAsString + "] with newscatcher.")

  var startingTime = new Date();
  startingTime.setHours(startingTime.getHours() - numberOfHoursToScrape);

  var currentPage = 1;
  var totalPages = 1;

  var options = {
    method: 'GET',
    url: 'https://newscatcher.p.rapidapi.com/v1/search',
    params: {
      q: '*',
      lang: 'en',
      sort_by: 'date',
      from: startingTime,
      //to: '2022-01-07T19:57:28.637Z',
      sources: scrapeTargetsAsString,
      page: currentPage
    },
    headers: {
      'x-rapidapi-host': 'newscatcher.p.rapidapi.com',
      'x-rapidapi-key': 'ecd210b60cmsh5e510d95b65966dp1ed591jsn2f65bd5eb69c'
    }
  };

  while (currentPage <= totalPages) {
    try {
      const response = await axios.request(options);
      if (!response.data.articles) return;
      for (article of response.data.articles) {
        urlSet.add(article.link);
      }
      totalPages = response.data.total_pages;
      currentPage++;
      options.params.page = currentPage;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}

function getScrapeTargetsAsString() {
  var targetsAsString = "";
  for (target of scrapeTargets) {
    targetsAsString += target + ",";
  }
  return targetsAsString;
}

function prepareItemForMongoDB(item) {
  item.imageUrl = item.image;
  item.datePublished = new Date(item.date);
  item.incubatorStatus = "scraped";
  delete item.image;
  delete item.date;

  //console.log(item);
}

function compareURLs(url1, url2) {
  return removeTrailingSlash(url1) == removeTrailingSlash(url2);
}

function removeTrailingSlash(url) {
  return (url[url.length - 1] == "/") ? url.substr(0, url.length - 1) : url;
}