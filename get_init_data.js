// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;


// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('./connection_strings');

const event = {
  body: "[{\"limit\" : 5, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"ItemCategory.food\", \"ItemCategory.mobility\"]}]",
}
const event2 = {
  body: "[{\"limit\" : 5, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"ItemCategory.food\"]}, {\"limit\" : 5, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"ItemCategory.food\"]}]",
}
const event3 = {
  body : "[{\"limit\" : 3, \"sortBy\" : \"dateAdded\"}]",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"}
        }
      }
    }
}


test(event3).then(result => console.log(result));

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
  var jsonContents = JSON.parse(event.body);

  const allItems = {}
  const queriesToItemIds = [];
  for (const currentSearchQuery of jsonContents) {
    const idsForCurrentQuery = [];
    await getItemsFromDB(currentSearchQuery, idsForCurrentQuery, allItems);
    queriesToItemIds.push(idsForCurrentQuery);
  }

  if (userId) {
    await addVotesToItems(userId, allItems);
  }

  const responseObject = {
    queriesToItemIds: queriesToItemIds,
    items: allItems
  }
  const response = {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json; charset=utf-8"
    },
    "body":  JSON.stringify(responseObject, null, 2),
  };
  return response;
};

async function getItemsFromDB(searchQuery, idsForCurrentQuery, allItems) {
  var sortObject;
  if (searchQuery.sortBy != null) {
      sortObject = {[searchQuery.sortBy]: -1};
    if (searchQuery.sortType != null) {
      sortObject = {[searchQuery.sortBy]: searchQuery.sortType}
    } 
  }
  
  var resultLimit = searchQuery.limit != null ? searchQuery.limit : 20;

  var categories = searchQuery.categories;
  var hasCategories = categories != null && categories.length != 0;
  var query = hasCategories ? {"itemCategory" : { $in : categories }} : {};

  if (searchQuery.dateLT != null) {
    query.dateAdded = {$lt: new Date(searchQuery.dateLT)};
  }

  var callback = function(item) { 
    const itemId = item._id;
    idsForCurrentQuery.push(itemId);
    allItems[itemId] = item;
   };
  await cachedDb.collection('items').find(query).sort(sortObject).limit(resultLimit).forEach(callback);
}

async function addVotesToItems(userId, items) {
    var voteQuery = {
      userId: userId,
      itemId: {$in:Object.keys(items)}
    }
    var voteCallback = function(voteItem) { 
      const itemId = voteItem.itemId;
      const item = items[itemId];
      item['userVotes'] = voteItem.votes;
    };
    await cachedDb.collection('user_votes').find(voteQuery).forEach(voteCallback);
}