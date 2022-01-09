// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require('mongodb').ObjectId;

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;


// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('./connection_strings');

const event = {
  body: "{\"limit\" : 5, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"ItemCategory.food\", \"ItemCategory.mobility\"]}",
}
const event2 = {
  body: "{\"limit\" : 15, \"sortBy\" : \"dateAdded\", \"dateLT\":\"2021-11-24T22:23:57.322Z\", \"dateGT\":\"2021-11-07T14:39:14.869661\", \"voteType\": \"upVotes\"}",
}
const event3 = {
  body: "{\"limit\" : 5, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"ItemCategory.food\"], \"incubatorStatus\" : \"inc1\", \"dateLT\":\"2021-11-24T22:23:57.322Z\", \"dateGT\":\"2021-11-07T14:39:14.869661\"}",
}
const event4 = {
  body : "{\"limit\" : 3, \"skip\" : 1, \"sortBy\" : \"lastVoteOn\", \"isFetchUserLikes\" : \"true\"}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"
        }
      }
    }
  },
  rawPath: "/get_items_authorized",
}

test(event4).then(result => console.log(result));

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
  if (event.rawPath === "/get_items_authorized") {
    var userId = event.requestContext.authorizer.jwt.claims.sub;
  }
  
  var searchQuery = JSON.parse(event.body);
  if (!userId && searchQuery.isFetchUserLikes) {
    return {
      statusCode: 401,
      body: "Not authorized to fetch user likes.",
    };
  }

  const itemsArray = await getItemsFromDB(searchQuery, userId);

  const response = {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json; charset=utf-8"
    },
    "body":  JSON.stringify(itemsArray),
  };
  return response;
};

async function getItemsFromDB(searchQuery, userId) {
  var sortObject;
  if (searchQuery.sortBy != null) {
      sortObject = {[searchQuery.sortBy]: -1};
    if (searchQuery.sortType != null) {
      sortObject = {[searchQuery.sortBy]: searchQuery.sortType}
    } 
  }
  
  var resultLimit = searchQuery.limit != null ? searchQuery.limit : 20;

  var query = buildMongoQuery(searchQuery);

  if (userId && searchQuery.isFetchUserLikes) {
    return await fetchUserLikes(userId, sortObject, resultLimit, searchQuery.skip);
  } else if (userId) {
    return await fetchItemsWithVotes(userId, query, sortObject, resultLimit);
  } else {
    return await cachedDb.collection('items').find(query).sort(sortObject).limit(resultLimit).toArray();
  }
}

async function fetchItemsWithVotes(userId, query, sortObject, resultLimit) {
  var items = {};
  var itemIds = [];
  var callback = function(item) { 
    const itemId = item._id;
    itemIds.push(itemId.toString());
    items[itemId] = item;
  };
  await cachedDb.collection('items').find(query).sort(sortObject).limit(resultLimit).forEach(callback);
  var voteQuery = {
    userId: userId,
    itemId: {$in:itemIds}
  }
  var voteCallback = function(voteItem) { 
    const itemId = voteItem.itemId;
    const item = items[itemId];
    item['userVotes'] = voteItem.votes;
  };
  await cachedDb.collection('user_votes').find(voteQuery).forEach(voteCallback);
  return Object.values(items);
}

async function fetchUserLikes(userId, sortObject, resultLimit, skip) {
  var items = {};
  var likedItemOids = [];
  var callback = function(voteItem) { 
    const likedItemId = voteItem.itemId;
    likedItemOids.push(new ObjectId(likedItemId))
    items[likedItemId] = voteItem;
  };
  await cachedDb.collection('user_votes')
                .find({userId: userId})
                .sort(sortObject)
                .skip(skip ? skip : 0)
                .limit(resultLimit)
                .forEach(callback);
  var voteQuery = {
    _id: {$in:likedItemOids}
  }
  var voteCallback = function(likedItem) {
    const itemId = likedItem._id;
    const userVotes = items[itemId].votes;
    likedItem['userVotes'] = userVotes;
    items[itemId] = likedItem;
  };
  await cachedDb.collection('items').find(voteQuery).forEach(voteCallback);
  return Object.values(items);
}

function buildMongoQuery(searchQuery) {
  var mongoQuery = {};

  // categories
  var categories = searchQuery.categories;
  var hasCategories = categories != null && categories.length != 0;
  if (hasCategories) {
    mongoQuery.categories = { $in : categories };
  }

  // date
  var dateQuery = {};
  if (searchQuery.dateLT != null) {
    dateQuery["$lt"] = new Date(searchQuery.dateLT);
    mongoQuery.dateAdded = dateQuery;
  }
  if (searchQuery.dateGT != null) {
    dateQuery["$gt"] = new Date(searchQuery.dateGT);
    mongoQuery.dateAdded = dateQuery;
  }

  // incubator status
  if (searchQuery.incubatorStatus == null) {
    mongoQuery.incubatorStatus = { $exists: false };
  } else {
    mongoQuery.incubatorStatus = searchQuery.incubatorStatus;
  }

  // voteType
  if (searchQuery.voteType != null) {
    mongoQuery[searchQuery.voteType] =  {$gt: 0};
  }

  return mongoQuery;
}