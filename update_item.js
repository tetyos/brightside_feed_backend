const ObjectId = require('mongodb').ObjectId;
exports.updateItem = updateItem;

async function updateItem(db, event) {
  var userId = event.requestContext.authorizer.jwt.claims.sub;
  var request = JSON.parse(event.body);
  var itemId = request.itemId;

  // get user
  var userDoc = await db.collection('user').findOne({_id: userId});
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
  const updateResponse = await db.collection('items').updateOne({_id: new ObjectId(itemId)}, updateDoc);

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