// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require('mongodb').ObjectId;
const {URL} = require("url");

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;


// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('./connection_strings');

const event1 = {
  body : "{\"itemId\" : \"61b77995826c574ddc725e44\", \"actionType\" : \"removeUnsafe\"}",
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

  // get user
  var userDoc = await cachedDb.collection('user').findOne({_id: userId});
  if (userDoc == null || userDoc.rank != "admin") {
    return {
      statusCode: 401,
      body: "User is not authorized to execute action.",
    };
  }

  // get item
  var itemDoc = await cachedDb.collection('items').findOne({_id: new ObjectId(request.itemId)});
  if (itemDoc == null) {
    return {
      statusCode: 404,
      body: "Item not found.",
    };
  }

  // execute action
  const action = request.actionType;
  if (action == "deleteItem") {
    return await deleteItem(request.itemId, itemDoc);
  } else if (action == "removeIncStatus") {
    return await removeIncStatus(request.itemId, itemDoc);
  } else if (action == "removeUnsafe") {
    return await removeUnsafeStatus(request.itemId, itemDoc);
  }

  return {
    statusCode: 400,
    body: "Invalid request body.",
  };
};

async function deleteItem(itemId, itemDoc) {
  itemDoc["oldId"] = itemDoc._id;
  delete itemDoc._id;
  const insertResponse = await cachedDb.collection('deleted_items').insertOne(itemDoc);
  if (insertResponse.acknowledged != true) {
    return {
      statusCode: 500,
      body: "Item was not deleted, since backup could not be created.",
    };
  }
  const deleteResponse = await cachedDb.collection('items').deleteOne({_id: new ObjectId(itemId)});
  if (deleteResponse.acknowledged != true || deleteResponse.deletedCount == 0) {
    return {
      statusCode: 500,
      body: "Item could not be deleted. Internal server error.",
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify(deleteResponse),
  };
}

async function removeIncStatus(itemId, itemDoc) {
  if (itemDoc.incubatorStatus != "inc1") {
    return {
      statusCode: 400,
      body: "Can not remove incubator status. Item has no incubator status.",
    };
  }
  const updateDoc = {
    $unset: {"incubatorStatus": ""},
  }
  const updateResponse = await cachedDb.collection('items').updateOne({_id: new ObjectId(itemId)}, updateDoc);

  if (updateResponse.acknowledged != true || updateResponse.modifiedCount == 0) {
    return {
      statusCode: 500,
      body: "Incubator status could not be removed. Internal server error.",
    };
  }
  return {
    statusCode: 200,
    body: JSON.stringify(updateResponse),
  };
}

async function removeUnsafeStatus(itemId, itemDoc) {
  if (itemDoc.incubatorStatus != "unsafe") {
    return {
      statusCode: 400,
      body: "Can not remove unsafe status. Item has no unsafe status.",
    };
  }
  const updateDoc = {
    $set: {"incubatorStatus": "inc1"},
  }
  const updateResponse = await cachedDb.collection('items').updateOne({_id: new ObjectId(itemId)}, updateDoc);

  if (updateResponse.acknowledged != true || updateResponse.modifiedCount == 0) {
    return {
      statusCode: 500,
      body: "Unsafe status could not be removed. Internal server error.",
    };
  }
  var host = new URL(itemDoc.url).hostname;
  if (host.startsWith('www.')) {
    host = host.substring(4, host.length);
  }
  var hostAdded = true;
  try {
    await cachedDb.collection('hosts_safe').insertOne({_id: host});
  } catch (e) {
    hostAdded = false;
    if (e.errmsg.includes("E11000 duplicate key error collection")) {
      console.log("Host was already contained in list of safe hosts");
    } else {
      console.log(e);
    }
  }

  return {
    statusCode: 200,
    body: hostAdded,
  };
}