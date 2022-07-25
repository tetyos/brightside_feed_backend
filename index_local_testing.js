/**
 * Contains everything to debug backend code locally.
 * Does not work in AWS function. Use 'index' for it.
 */

const MongoClient = require("mongodb").MongoClient;
let cachedDb = null;
let cachedClient = null;

const {getInitData} = require('./get_init_data');
const {getItems} = require('./get_items');
const {getUserData} = require('./get_user_data');
const {postAdminAction} = require('./post_admin_action');
const {postItem} = require('./post_item');
const {postVote} = require('./post_vote');
const {updateItem} = require('./update_item');
const {updateScrapedItem} = require('./update_scraped_item');
const {deleteUser} = require('./delete_user');

const { atlas_connection_uri } = require('./connection_strings');
const TestEvents = require('./test_data');

async function connectToDatabase() {
  if (cachedDb) {
    return;
  }
  cachedClient = await MongoClient.connect(atlas_connection_uri);
  cachedDb = cachedClient.db("chances_db");
}

async function test(event) {
  try {
    await connectToDatabase();
    return await handleEvent(event);
  } finally {
    // Close the connection to the MongoDB cluster
    await cachedClient.close();
  }
};

test(TestEvents.postAdminAction_1).then(result => console.log(result));

// ========== copy below to lambda ==================

async function handleEvent(event) {
  console.log('Calling MongoDB Atlas from AWS Lambda with event: ' + JSON.stringify(event));

  switch(event.rawPath) {
    case "/get_init_data":
    case "/get_init_data_authorized":
      return await getInitData(cachedDb, event);
    case "/get_items":
    case "/get_items_authorized":
      return await getItems(cachedDb, event);
    case "/get_user_data":
      return await getUserData(cachedDb, event);
    case "/post_admin_action":
      return await postAdminAction(cachedDb, event);
    case "/post_item":
      return await postItem(cachedDb, event);
    case "/post_votes":
      return await postVote(cachedDb, cachedClient, event);
    case "/update_item":
      return await updateItem(cachedDb, event);
    case "/update_scraped_item":
      return await updateScrapedItem(cachedDb, event);
    case "/delete_user":
     return await deleteUser(cachedDb, event);  
    default:
      console.error("SNH. No match found for path '" + event.rawPath + "'. Can not handle event.");
      return {
        statusCode: 500,
        body: "Internal server error.",
      };
  }
}