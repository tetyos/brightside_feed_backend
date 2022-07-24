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

const timeframeInHoursNewsCatcher = 24;
const scrapeTargetsNewsCatcher = "pv-magazine.com, treehugger.com, positive.news, goodnewsnetwork.org";

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;

// ========== dont copy to lambda ==================
const { atlas_connection_uri, rapid_api_key, newscatcher_api_key } = require('../connection_strings');

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
  // get all scraped urls in in mongo db from last x hours + 1 day 
  // (in order to avoid bug with date-differences between news-apis and metascraper. metascraper sometimes only gets day and no hours, minutes..)
  var mongoStartingTime = new Date();
  mongoStartingTime.setHours(mongoStartingTime.getHours() - (timeframeInHoursNewsCatcher + 24));
  var mongoResult = await cachedDb.collection('scraped_items')
                                  .find({"datePublished": {"$gt": mongoStartingTime}})
                                  .project({_id:0, url: 1})
                                  .toArray();
                          
  console.log("Urls of items in mongoDB-scraped-collection published last " + (timeframeInHoursNewsCatcher + 24) + " hours:");                              
  console.log(mongoResult);

  const fetchedUrls = new Set();
  await fetchUrlsWithNewscatcher(fetchedUrls);
  await fetchUrlsWithBing(fetchedUrls);

  // use bing and iterate over all sites and fetch urls
  // use michas script and fetch url for different sites
  
  console.log("Urls returned by news apis:");                   
  console.log(fetchedUrls);
  
  // eliminate all urls that already exist in mongo collection
  fetchedUrls.forEach(scrapedUrl => {
    if (mongoResult.some(jsonElem => compareURLs(jsonElem.url, scrapedUrl))) {
      fetchedUrls.delete(scrapedUrl);
    }
  });
  console.log("Newly fetched urls: ");     
  console.log(fetchedUrls);
  if (fetchedUrls.size == 0 ) {
    return "Fetching urls finished - no new items added."
  }

  const allPromises = [];
  const scrapedItems = [];
  for (currentUrl of fetchedUrls) { 
    await new Promise(resolve => setTimeout(resolve, 100));
    var currentPromise = fetchMetaData(currentUrl, mongoStartingTime);
    currentPromise.then(scrapedItem => {
      if (scrapedItem) {
        prepareItemForMongoDB(scrapedItem);
        scrapedItems.push(scrapedItem);
      }
    });
    allPromises.push(currentPromise);
  }
  await Promise.all(allPromises);
  if (scrapedItems.length == 0 ) {
    return "Scraping meta data finished - no new items added.";
  }
  console.log("Scraping meta data finished. Sending new items to mongo db..");

  var mongoResponse = await cachedDb.collection('scraped_items').insertMany(scrapedItems);
  if (mongoResponse.acknowledged === false) {
    console.log("Could not insert scraped items");
    console.log(mongoResponse);
  }
  return "Scraping finished - " + scrapedItems.length + " items added";
  
  // non-mvp:     
  // for some sites (pv-magazine, storage, etc) one could prepopulate the category-field. 
  // one could just use the host to fetch category from a map 'host -> category'
};

async function fetchMetaData(urlString, mongoStartingTime) {
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
      console.error("Url returned by metascraper: " + result.url);
      return null;
    } else if (!result.date) {
      console.error("Item not added. No published date on item provided. Item: ");
      console.error(result);
    } else if (new Date(result.date) < mongoStartingTime) {
      console.error("Item not added. Item date to old. Date of item < (period of scraping + 1 day). Item:");
      console.error(result);
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
  console.log("Newscatcher:  Scraping [" + scrapeTargetsNewsCatcher + "]. Timeframe: " +timeframeInHoursNewsCatcher);

  var startingTime = new Date();
  startingTime.setHours(startingTime.getHours() - timeframeInHoursNewsCatcher);

  var currentPage = 1;
  var totalPages = 1;

  var optionsNewsCatcherRapidApi = {
    method: 'GET',
    url: 'https://newscatcher.p.rapidapi.com/v1/search',
    params: {
      q: '*',
      lang: 'en',
      sort_by: 'date',
      from: startingTime,
      //to: '2022-01-07T19:57:28.637Z',
      sources: scrapeTargetsNewsCatcher,
      page: currentPage
    },
    headers: {
      'x-rapidapi-host': 'newscatcher.p.rapidapi.com',
      'x-rapidapi-key': rapid_api_key
    },
    timeout: 5000
  };

  var dateStringNewsCatcher = startingTime.getFullYear() + '/' + (startingTime.getMonth() + 1) + '/' + startingTime.getDate();
  console.log(dateStringNewsCatcher);
  console.log(startingTime);
  var optionsNewsCatcherDirect = {
    method: 'GET',
    url: 'https://api.newscatcherapi.com/v2/search',
    params: {
      q: '*',
      lang: 'en',
      sort_by: 'date',
      from: dateStringNewsCatcher,
      //from: '2022/07/19',
      //from: startingTime,
      //to: '2022-01-07T19:57:28.637Z',
      sources: scrapeTargetsNewsCatcher,
      page: currentPage
    },
    headers: {
      'x-api-key': newscatcher_api_key
    },
    timeout: 5000
  };

  while (currentPage <= totalPages) {
    try {
      const response = await axios.request(optionsNewsCatcherRapidApi);
      if (!response.data.articles) return;
      for (article of response.data.articles) {
        urlSet.add(removeTrailingSlash(article.link));
      }
      console.log("Newscatcher: Current page: " + currentPage + " Number of total pages returned: " + response.data.total_pages);
      totalPages = response.data.total_pages;
      currentPage++;
      optionsNewsCatcherRapidApi.params.page = currentPage;
      await new Promise(resolve => setTimeout(resolve, 1100));
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}

async function fetchUrlsWithBing(urlSet) {
  var currentOffset = 0;
  var elementsPerRequest = 100;
  var numberOfResults = elementsPerRequest;

  // if timeframe is set to Week or Month, the timeframe for the mongoDB query must be adjusted, so it is known which urls were added already
  const timeframe = "Day";

  const sites = 'site:pv-magazine.com'
  + ' OR site:reneweconomy.com.au'
  + ' OR site:futurefarming.com'
  + ' OR site:treehugger.com'
  + ' OR site:inhabitat.com'
  + ' OR site:sustainablebrands.com'
  + ' OR site:positive.news'
  + ' OR site:goodnewsnetwork.com'
  + ' OR site:euronews.com/green';
  
  console.log("Scraping [" + sites + "] with bing. " + elementsPerRequest + " elements per request. Timeframe: " + timeframe);

  // bing currently finds no articles for
  // intelligentliving.co, cleantechnica.com, en.reset.org, energy-storage.news
  var options = {
    method: 'GET',
    url: 'https://bing-news-search1.p.rapidapi.com/news/search',
    params: {
      q: sites,
      count: elementsPerRequest,
      sortBy: 'date',
      freshness: timeframe,
      textFormat: 'Raw',
      safeSearch: 'Off'
    },
    headers: {
      'x-bingapis-sdk': 'true',
      'x-rapidapi-host': 'bing-news-search1.p.rapidapi.com',
      'x-rapidapi-key': rapid_api_key
    },
    timeout: 5000
  };

  while (currentOffset < numberOfResults) {
    try {
      const response = await axios.request(options);
      var data = response.data;
      if (!data.totalEstimatedMatches || data.totalEstimatedMatches == 0) return;
      for (article of data.value) {
        urlSet.add(removeTrailingSlash(article.url));
      }
      console.log("Current offset: " + currentOffset + " Number of results returned: " + data.value.length + " Number of estimated matched: " + data.totalEstimatedMatches);
      numberOfResults = data.totalEstimatedMatches;
      currentOffset += data.value.length;
      options.params.offset = currentOffset;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}

function prepareItemForMongoDB(item) {
  item.imageUrl = item.image;
  item.datePublished = new Date(item.date);
  item.dateScraped = new Date();
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