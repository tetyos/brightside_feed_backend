// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;
const {URL} = require("url");

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;


// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('./connection_strings');

const event = {
  body: "{\"limit\" : 5, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"ItemCategory.food\", \"ItemCategory.mobility\"]}",
}

test(event).then(result => console.log(result));

async function connectToDatabase() {
  if (cachedDb) {
    return;
  }
  // Connect to our MongoDB database hosted on MongoDB Atlas
  cachedClient = await MongoClient.connect(atlas_connection_uri);
  // Specify which database we want to use
  cachedDb = cachedClient.db("chances_db");
}

async function test(event) {
  // Get an instance of our database
  try {
    await connectToDatabase();
    return await executeLogic(event);
  } finally {
    // Close the connection to the MongoDB cluster
    await cachedClient.close();
  }
};

// ========== dont use in lambda ==================


async function executeLogic(event) {
  const options = {
    // Include only the `title` and `imdb` fields in the returned document
    projection: { _id: 0, url: 1},
  };

  const hostDocs = {};
  var callback = elem => {
    //console.log(elem.url);
    var host = new URL(elem.url).hostname;
    if (host.startsWith('www.')) {
      host = host.substring(4, host.length);
    }
    hostDocs[host] = {_id : host};
    console.log(host);
  }
  const mongoResponse = await cachedDb.collection('items').find({}, options).forEach(callback);
  const insertResponse = await cachedDb.collection('hosts_safe').insertMany(Object.values(hostDocs));
  console.log(insertResponse);
  return mongoResponse;
};