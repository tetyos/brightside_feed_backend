/**
 * Contains everything to run in AWS function. 
 * Does not run locally. Use 'index_local_testing' for debugging, testing.
 */

const MongoClient = require("mongodb").MongoClient;
// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;
let atlas_connection_uri;

const {getInitData} = require('./get_init_data');
const {getItems} = require('./get_items');
const {getUserData} = require('./get_user_data');
const {postAdminAction} = require('./post_admin_action');
const {postItem} = require('./post_item');
const {postVote} = require('./post_vote');
const {updateItem} = require('./update_item');
const {updateScrapedItem} = require('./update_scraped_item');

async function connectToDatabase() {
  if (cachedDb && cachedClient) {
    return;
  }
  if (!atlas_connection_uri) {
    atlas_connection_uri = process.env['MONGODB_ATLAS_CLUSTER_URI'];
  }
  cachedClient = await MongoClient.connect(atlas_connection_uri);
  cachedDb = cachedClient.db("chances_db");
}

exports.handler = async (event, context) => {
  /* By default, the callback waits until the runtime event loop is empty before freezing the process and returning the results to the caller. Setting this property to false requests that AWS Lambda freeze the process soon after the callback is invoked, even if there are events in the event loop. AWS Lambda will freeze the process, any state data, and the events in the event loop. Any remaining events in the event loop are processed when the Lambda function is next invoked, if AWS Lambda chooses to use the frozen process. */
  context.callbackWaitsForEmptyEventLoop = false;
  await connectToDatabase();
  return await handleEvent(event);
};

// ========== copy code from local test environment below ==================

async function handleEvent(event) {
  // replace with code that is to be executed in lambda function
}