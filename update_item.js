// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require('mongodb').ObjectId;

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;


// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('./connection_strings');

const event1 = {
  body : "{\"itemId\" : \"61c32b3ba4c96266129e0925\", \"categories\" : [\"tech\", \"solar\"]}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          email: "tetyos@testmail.com",
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"
        }
      }
    }
  }
}

test(event1).then(result => console.log(result));

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
  console.log('Calling MongoDB Atlas from AWS Lambda with event: ' + JSON.stringify(event));
  var userId = event.requestContext.authorizer.jwt.claims.sub;
  var request = JSON.parse(event.body);
  var itemId = request.itemId;

  // get user
  var userDoc = await cachedDb.collection('user').findOne({_id: userId});
  if (userDoc == null || userDoc.rank != "admin") {
    return {
      statusCode: 401,
      body: "User is not authorized to execute action.",
    };
  }

  const updateDoc = {
    $set: {},
  };
  if (request.categories) {
    updateDoc["$set"].categories = request.categories; 
  }
  const updateResponse = await cachedDb.collection('items').updateOne({_id: new ObjectId(itemId)}, updateDoc);

  if (updateResponse.matchedCount == 0) {
    return {
      statusCode: 400,
      body: "Item not found.",
    };
  } else if (updateResponse.acknowledged != true || updateResponse.modifiedCount == 0) {
    return {
      statusCode: 400,
      body: "Item could not be updated.",
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify(updateResponse),
  };
};