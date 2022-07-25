const {TwitterApi} = require("twitter-api-v2");
const { twitter_api_key, twitter_api_secret, twitter_access_token, twitter_access_token_scecret } = require('./connection_strings');
const client = new TwitterApi({
    appKey: twitter_api_key,
    appSecret: twitter_api_secret,
    accessToken: twitter_access_token,
    accessSecret: twitter_access_token_scecret
});
const rwClient = client.readWrite;
exports.postTweet = postTweet;

async function postTweet (itemId, url) {
    try {
        console.log("Tweeting url of item with id: " + itemId + "). Tweeted url: " + url);
        await rwClient.v2.tweet(url);
    } catch (e) {
        console.error("Error while tweeting item (id: " + itemId + "). Url: " + url);
        console.error(e);
    }
}


//tweet("42", "https://www.euronews.com/green/2022/07/17/this-ngo-is-cloning-the-world-s-oldest-trees-to-tackle-climate-change");


// aws version: 

// const {TwitterApi} = require("twitter-api-v2");
// exports.postTweet = postTweet;

// async function postTweet (itemId, url) {
//     try {
//         var client = new TwitterApi({
//          appKey: process.env['twitter_api_key'],
//          appSecret: process.env['twitter_api_secret'],
//          accessToken: process.env['twitter_access_token'],
//          accessSecret: process.env['twitter_access_token_scecret'],
//         });
//         var rwClient = client.readWrite;
        
//         console.log("Tweeting url of item with id: " + itemId + "). Tweeted url: " + url);
//         await rwClient.v2.tweet(url);
//     } catch (e) {
//         console.error("Error while tweeting item (id: " + itemId + "). Url: " + url);
//         console.error(e);
//     }
// }