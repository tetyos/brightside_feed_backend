// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;


// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('./connection_strings');

const event = {
  body : "[\"61a3332cd30357b30b3b78e0\",\"61a2bf93a4dcd363df7755bb\",\"61a2bd940a92ccf29ea2ed63\"]",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"}
        }
      }
    }
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
  console.log('Calling MongoDB Atlas from AWS Lambda with event: ' + JSON.stringify(event));
  var userId = event.requestContext.authorizer.jwt.claims.sub;

  var itemsIdArray = JSON.parse(event.body);
  
  var query = {
    userId: userId,
    itemId: {$in:itemsIdArray}
  }

  const votes = {}
  var callback = function(item) { 
    const itemId = item.itemId;
    votes[itemId] = item;
   };
  await cachedDb.collection('user_votes').find(query).forEach(callback);
  const userData = {}
  userData.votes = votes;
  var userDoc = await cachedDb.collection('user').findOne({_id : userId});
  userData.userDoc = userDoc;

  const response = {
    "statusCode": 200,
    
    "headers": {
      "Content-Type": "application/json; charset=utf-8"
    },
    "body":  JSON.stringify(userData),
  };
  return response;
};