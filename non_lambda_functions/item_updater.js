// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;
const {URL} = require("url");

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;


// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('../connection_strings');

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
    projection: { _id: 1, title: 1},
  };

  const hostDocs = {};
  var updatesMap = new Map();

  var callback = async elem => {
    console.log(elem.title);
    var oldTitle = elem.title;
    var newTitle = oldTitle.substr(0, oldTitle.length - 15);
    console.log(newTitle);
    updatesMap.set(elem._id, newTitle);
  }
  const mongoResponse = await cachedDb.collection('items').find({title: {$regex : "heise"}}, options).forEach(callback);
  
  await executeUpdates(updatesMap);

  return "Done";
};

async function executeUpdates(updatesMap) {
  for (const [key, value] of updatesMap.entries()) {
    //console.log(`${key}: ${value}`);

    var updateDoc = {
      "$set" : {title: value}
    };
    //const updateResponse = await cachedDb.collection('items').updateOne({_id:key}, updateDoc);
    //console.log(updateResponse);
  }
}