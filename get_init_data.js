exports.getInitData = getInitData;

let db = null;

async function getInitData(cachedDb, event) {
  db = cachedDb;

  if (event.rawPath === "/get_init_data_authorized") {
    var userId = event.requestContext.authorizer.jwt.claims.sub;
  }
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
    var userDoc = await db.collection('user').findOne({_id : userId});
  }

  const responseObject = {
    queriesToItemIds: queriesToItemIds,
    items: allItems,
  }
  if (userId) {
    responseObject.userDoc = userDoc;
  }

  const response = {
    "statusCode": 200,
    "headers": {
      "Content-Type": "application/json; charset=utf-8"
    },
    "body":  JSON.stringify(responseObject),
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

  var query = buildMongoQuery(searchQuery);

  var callback = function(item) { 
    const itemId = item._id;
    idsForCurrentQuery.push(itemId);
    allItems[itemId] = item;
   };
  await db.collection('items').find(query).sort(sortObject).limit(resultLimit).forEach(callback);
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
    await db.collection('user_votes').find(voteQuery).forEach(voteCallback);
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