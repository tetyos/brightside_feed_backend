/**
 * Code stub for lambda functions
 */

// Import the MongoDB driver
const MongoClient = require("mongodb").MongoClient;
// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let atlas_connection_uri;

async function connectToDatabase() {
  if (cachedDb) {
    return;
  }
  if (!atlas_connection_uri) {
    atlas_connection_uri = process.env['MONGODB_ATLAS_CLUSTER_URI'];
  }
  // Connect to our MongoDB database hosted on MongoDB Atlas
  const client = await MongoClient.connect(atlas_connection_uri);
  // Specify which database we want to use
  cachedDb = client.db("chances_db");
}

exports.handler = async (event, context) => {
  /* By default, the callback waits until the runtime event loop is empty before freezing the process and returning the results to the caller. Setting this property to false requests that AWS Lambda freeze the process soon after the callback is invoked, even if there are events in the event loop. AWS Lambda will freeze the process, any state data, and the events in the event loop. Any remaining events in the event loop are processed when the Lambda function is next invoked, if AWS Lambda chooses to use the frozen process. */
  context.callbackWaitsForEmptyEventLoop = false;
  // Get an instance of our database
  await connectToDatabase();
  return await executeLogic(event);
};

// ========== copy code from local test environment below ==================

async function executeLogic(event) {
  // replace with code that is to be executed in lambda function
};