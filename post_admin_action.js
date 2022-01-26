const ObjectId = require('mongodb').ObjectId;
const {URL} = require("url");
exports.postAdminAction = postAdminAction;

let db = null;

async function postAdminAction(cachedDb, event) {
  db = cachedDb;
  var userId = event.requestContext.authorizer.jwt.claims.sub;
  var request = JSON.parse(event.body);

  // get user
  var userDoc = await db.collection('user').findOne({_id: userId});
  if (userDoc == null || userDoc.rank != "admin") {
    return {
      statusCode: 401,
      body: "User is not authorized to execute action.",
    };
  }

  // get item
  var itemDoc = await db.collection('items').findOne({_id: new ObjectId(request.itemId)});
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
}

async function deleteItem(itemId, itemDoc) {
  itemDoc["oldId"] = itemDoc._id;
  delete itemDoc._id;
  const insertResponse = await db.collection('deleted_items').insertOne(itemDoc);
  if (insertResponse.acknowledged != true) {
    const errorString = "Item was not deleted, since backup could not be created.";
    console.error(errorString);
    return {
      statusCode: 500,
      body: errorString,
    };
  }
  const deleteResponse = await db.collection('items').deleteOne({_id: new ObjectId(itemId)});
  if (deleteResponse.acknowledged != true || deleteResponse.deletedCount == 0) {
    console.error("Item could not be deleted.");
    console.error(deleteResponse);
    return {
      statusCode: 500,
      body: "Item could not be deleted. Internal server error.",
    };
  }

  const deleteVotesResponse = await db.collection('user_votes').deleteMany({itemId: itemId});
  if (deleteVotesResponse.acknowledged != true || deleteVotesResponse.deletedCount == 0) {
    console.error("User votes could not be deleted for item with id: " + itemId);
    console.error(deleteResponse);
  }
  return {
    statusCode: 200,
    body: JSON.stringify(deleteResponse),
  };
}

async function removeIncStatus(itemId, itemDoc) {
  if (itemDoc.incubatorStatus != "inc1") {
    const errorString = "Can not remove incubator status. Item has no incubator status.";
    console.error(errorString);
    return {
      statusCode: 400,
      body: errorString,
    };
  }
  const updateDoc = {
    $unset: {"incubatorStatus": ""},
  };
  const updateResponse = await db.collection('items').updateOne({_id: new ObjectId(itemId)}, updateDoc);

  if (updateResponse.acknowledged != true || updateResponse.modifiedCount == 0) {
    console.error("Incubator status could not be removed.");
    console.error(updateResponse);
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
    const errorString = "Can not remove unsafe status. Item has no unsafe status.";
    console.error(errorString);
    return {
      statusCode: 400,
      body: errorString,
    };
  }
  const updateDoc = {
    $set: {"incubatorStatus": "inc1"},
  };
  const updateResponse = await db.collection('items').updateOne({_id: new ObjectId(itemId)}, updateDoc);

  if (updateResponse.acknowledged != true || updateResponse.modifiedCount == 0) {
    console.error("Unsafe status could not be removed.");
    console.error(updateResponse);
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
    await db.collection('hosts_safe').insertOne({_id: host});
  } catch (e) {
    hostAdded = false;
    if (e.errmsg.includes("E11000 duplicate key error collection")) {
      console.error("Host was already contained in list of safe hosts");
    } else {
      console.error(e);
    }
  }

  return {
    statusCode: 200,
    body: hostAdded,
  };
}