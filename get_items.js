const ObjectId = require('mongodb').ObjectId;
exports.getItems = getItems;

let db = null;

async function getItems(cachedDb, event) {
  db = cachedDb;

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
}

async function getItemsFromDB(searchQuery, userId) {
  var sortObject;
  if (searchQuery.sortBy != null) {
      sortObject = {[searchQuery.sortBy]: -1};
    if (searchQuery.sortType != null) {
      sortObject = {[searchQuery.sortBy]: searchQuery.sortType};
    } 
  }
  
  var resultLimit = searchQuery.limit != null ? searchQuery.limit : 20;

  var query = buildMongoQuery(searchQuery);
  const skip = searchQuery.skip;

  if (searchQuery.incubatorStatus == "scraped") {
    return await db.collection('scraped_items').find(query).sort(sortObject).skip(skip ? skip : 0).limit(resultLimit).toArray();
  } else if (userId && searchQuery.isFetchUserLikes) {
    return await fetchUserLikes(userId, sortObject, resultLimit, skip);
  } else if (userId) {
    return await fetchItemsWithVotes(userId, query, sortObject, resultLimit, skip);
  } else {
    return await db.collection('items').find(query).sort(sortObject).skip(skip ? skip : 0).limit(resultLimit).toArray();
  }
}

async function fetchItemsWithVotes(userId, query, sortObject, resultLimit, skip) {
  var items = {};
  var itemIds = [];
  var callback = function(item) { 
    const itemId = item._id;
    itemIds.push(itemId.toString());
    items[itemId] = item;
  };
  await db.collection('items')
          .find(query)
          .sort(sortObject)
          .skip(skip ? skip : 0)
          .limit(resultLimit)
          .forEach(callback);
  var voteQuery = {
    userId: userId,
    itemId: {$in:itemIds}
  };
  var voteCallback = function(voteItem) { 
    const itemId = voteItem.itemId;
    const item = items[itemId];
    item['userVotes'] = voteItem.votes;
  };
  await db.collection('user_votes').find(voteQuery).forEach(voteCallback);
  return Object.values(items);
}

async function fetchUserLikes(userId, sortObject, resultLimit, skip) {
  var itemIdToUserVotes = {};
  var itemIdToItem = {};
  var likedItemOids = [];
  var callback = function(voteItem) { 
    const likedItemId = voteItem.itemId;
    likedItemOids.push(new ObjectId(likedItemId));
    itemIdToUserVotes[likedItemId] = voteItem;
    // we want the returned items to be in order of the userVotes returned. hence we need to prepare list here
    itemIdToItem[likedItemId] = null;
  };
  await db.collection('user_votes')
                .find({userId: userId})
                .sort(sortObject)
                .skip(skip ? skip : 0)
                .limit(resultLimit)
                .forEach(callback);

  var voteQuery = {
    _id: {$in:likedItemOids}
  };
  var voteCallback = function(likedItem) {
    const userVotes = itemIdToUserVotes[likedItem._id].votes;
    likedItem['userVotes'] = userVotes;
    itemIdToItem[likedItem._id] = likedItem;
  };
  await db.collection('items').find(voteQuery).forEach(voteCallback);

  // filter out null values (in case some item belonging to a vote was not found for any reason)
  const likedItems = Object.values(itemIdToItem).filter(item => item);
  return likedItems;
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

  // date published
  var datePublishedQuery = {};
  if (searchQuery.datePublishedLT != null) {
    datePublishedQuery["$lt"] = new Date(searchQuery.datePublishedLT);
    mongoQuery.datePublished = datePublishedQuery;
  }
  if (searchQuery.datePublishedGT != null) {
    datePublishedQuery["$gt"] = new Date(searchQuery.datePublishedGT);
    mongoQuery.datePublished = datePublishedQuery;
  }

    // date scraped
    var dateScrapedQuery = {};
    if (searchQuery.dateScrapedLT != null) {
      dateScrapedQuery["$lt"] = new Date(searchQuery.dateScrapedLT);
      mongoQuery.dateScraped = dateScrapedQuery;
    }
    if (searchQuery.dateScrapedGT != null) {
      dateScrapedQuery["$gt"] = new Date(searchQuery.dateScrapedGT);
      mongoQuery.dateScraped = dateScrapedQuery;
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