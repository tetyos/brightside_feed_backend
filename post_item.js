// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;
const {URL} = require("url");

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;


// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('./connection_strings');

const event1 = {
  body : "{\"title\" : \"Test Title\", \"description\" : \"Test Description\", \"url\" : \"https://www.elektroauto-news.net/2021/kann-europa-leitmarkt-rgiequelle-geniale-erfindung-kombiniert-solar-und-windkraft_105884\"}",
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

  var jsonContents = JSON.parse(event.body);
  jsonContents.dateAdded = new Date();
  jsonContents.addedBy = {
    userId:userId,
    email: mail
  }

  var hostResponse = await checkHost(jsonContents.url);
  console.log(hostResponse);
  if (hostResponse) {
    jsonContents.incubatorStatus = "inc1";
  } else {
    jsonContents.incubatorStatus = "unsafe";
  }

  const mongoResponse = await cachedDb.collection('items').insertOne(jsonContents);
  
  var response;
  if (mongoResponse.acknowledged === false) {
    console.log("Insertion of new item failed.")
    console.log(mongoResponse);
    response = {
      statusCode: 500,
      body: JSON.stringify(mongoResponse),
    };
  } else {
    response = {
      statusCode: 200,
      body: JSON.stringify(jsonContents),
    };
  }
  return response;
};

async function checkHost(url) {
  var host = new URL(url).hostname;
  if (host.startsWith('www.')) {
    host = host.substring(4, host.length);
  }
  console.log(host);

  return await cachedDb.collection('hosts_safe').findOne({_id: host});
}