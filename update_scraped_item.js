const ObjectId = require('mongodb').ObjectId;
exports.updateScrapedItem = updateScrapedItem;

async function updateScrapedItem(db, event) {
  var userId = event.requestContext.authorizer.jwt.claims.sub;
  var mail = event.requestContext.authorizer.jwt.claims.email;

  var request = JSON.parse(event.body);
  var itemId = request.itemId;

  // get user
  // var userDoc = await db.collection('user').findOne({_id: userId});
  // if (userDoc == null || userDoc.rank != "admin") {
  //   return {
  //     statusCode: 401,
  //     body: "User is not authorized to execute action.",
  //   };
  // }


  try {
    // fetch scraped item
    var scraped_item = await db.collection('scraped_items').findOne({_id: new ObjectId(itemId), incubatorStatus: "scraped"});
    if (scraped_item == null) {
      return {
        statusCode: 404,
        body: "Scraped item not found.",
      };
    }

    // modify scraped_item 
    if (request.categories) { 
      scraped_item.categories = request.categories; 
    }
    scraped_item.incubatorStatus = "inc1";
    scraped_item.addedBy = {
      userId:userId,
      email: mail,
      isScraped: true,
    };
    scraped_item.dateAdded = new Date();


    // insert into items-collection
    const insertResponse = await db.collection('items').insertOne(scraped_item);
    if (insertResponse.acknowledged === false) {
      console.log("Insertion of new item failed.");
      console.log(insertResponse);
      return {
        statusCode: 500,
        body: JSON.stringify(insertResponse),
      };
    }
    console.log("Insertion of scraped items into item-collection successful.");

    // if successful update incubator status of scraped item 
    const updateResponse = await db.collection('scraped_items').updateOne({_id: new ObjectId(itemId)}, {$set: {incubatorStatus: "added"}});
    if (updateResponse.matchedCount == 0) {
      return {
        statusCode: 400,
        body: "Scraped item not found, during update. SNH!",
      };
    } else if (updateResponse.acknowledged != true || updateResponse.modifiedCount == 0) {
      return {
        statusCode: 400,
        body: "Scraped item could not be updated.",
      };
    }
    console.log("Changing of incubatorStatus of scraped item successful.");
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: "Problem while writing to database.",
    };
  }
  return {
    statusCode: 200,
    body: "Promoting scraped item successful.",
  };
}