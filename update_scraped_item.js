// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require('mongodb').ObjectId;

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;


// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('./connection_strings');

const event1 = {
  body : "{\"itemId\" : \"61def7d8c9c5dee2d6a3e4a5\", \"categories\" : [\"tech\", \"solar\"]}",
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
  var mail = event.requestContext.authorizer.jwt.claims.email;

  var request = JSON.parse(event.body);
  var itemId = request.itemId;

  // get user
  // var userDoc = await cachedDb.collection('user').findOne({_id: userId});
  // if (userDoc == null || userDoc.rank != "admin") {
  //   return {
  //     statusCode: 401,
  //     body: "User is not authorized to execute action.",
  //   };
  // }


  try {
    // fetch scraped item
    var scraped_item = await cachedDb.collection('scraped_items').findOne({_id: new ObjectId(itemId), incubatorStatus: "scraped"});
    if (scraped_item == null) {
      return {
        statusCode: 404,
        body: "Scraped item not found.",
      };
    }

    // modify scraped_item 
    if (request.categories) { 
      scraped_item.categories = request.categories; 
    }
    scraped_item.incubatorStatus = "inc1";
    scraped_item.addedBy = {
      userId:userId,
      email: mail,
      isScraped: true,
    };
    scraped_item.dateAdded = new Date();


    // insert into items-collection
    const insertResponse = await cachedDb.collection('items').insertOne(scraped_item);
    if (insertResponse.acknowledged === false) {
      console.log("Insertion of new item failed.");
      console.log(insertResponse);
      return {
        statusCode: 500,
        body: JSON.stringify(insertResponse),
      };
    }
    console.log("Insertion of scraped items into item-collection successful.");

    // if successful update incubator status of scraped item 
    const updateResponse = await cachedDb.collection('scraped_items').updateOne({_id: new ObjectId(itemId)}, {$set: {incubatorStatus: "added"}});
    if (updateResponse.matchedCount == 0) {
      return {
        statusCode: 400,
        body: "Scraped item not found, during update. SNH!",
      };
    } else if (updateResponse.acknowledged != true || updateResponse.modifiedCount == 0) {
      return {
        statusCode: 400,
        body: "Scraped item could not be updated.",
      };
    }
    console.log("Changing of incubatorStatus of scraped item successful.");
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: "Problem while writing to database.",
    };
  }
  return {
    statusCode: 200,
    body: "Promoting scraped item successful.",
  };
}