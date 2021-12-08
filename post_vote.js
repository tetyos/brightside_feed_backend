// Import the MongoDB driver and other stuff
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require('mongodb').ObjectId;

// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
let cachedClient = null;

// ========== dont use in lambda ==================
const { atlas_connection_uri } = require('./connection_strings');

const event = {
  body : "{\"itemId\": \"619f595befae98cf8aa71c49\", \"voteCategory\": \"impactNom\", \"inc\": true}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "7ec8f757-4dfc-445c-815e-6b81f21c1295"}
        }
      }
    }
}
test(event).then(result => console.log(result));

async function connectToDatabase() {
  if (cachedDb && cachedClient) {
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
  var requestInfos = {
    userId: userId,
    itemId: jsonContents.itemId,
    voteCategory: jsonContents.voteCategory,
    isIncrease: jsonContents.inc,
  }

  if (!isValidRequest(requestInfos)) {
    var responseNonValid = {
      statusCode: 400,
      body: "Non valid request body.",
    };
    return responseNonValid;
  }

  // retrieve existing votes on item by current user, if existing
  var query = {"userId": userId, "itemId": requestInfos.itemId};
  const votesDoc = await cachedDb.collection('user_votes').findOne(query);

  // handle vote request
  if (requestInfos.isIncrease) {
    return await executeVoteIncrease(requestInfos, votesDoc);
  } else {
    return await executeVoteDecrease(requestInfos, votesDoc);
  }
}

async function executeVoteIncrease(requestInfos, votesDoc) {
  var voteCategory = requestInfos.voteCategory;
  var successful;

  if (votesDoc) {
    var isVoteContained = votesDoc.votes.includes(voteCategory);
    if (isVoteContained) {
      var error = {
        statusCode: 403,
        body: "User has already voted on item.",
      };
      return error; 
    } else {
      votesDoc.lastVoteOn = new Date();
      votesDoc.votes.push(voteCategory);
      successful = await executeTransaction(async (session) => {
        await updateCollections_replaceVariant(session, requestInfos, votesDoc)
      });
    }
  } else {
    var newVotesDoc = {
      userId : requestInfos.userId,
      itemId : requestInfos.itemId,
      votes : [voteCategory],
      lastVoteOn : new Date(),
    }
    successful = await executeTransaction(async (session) => {
      await updateCollections_replaceVariant(session, requestInfos, newVotesDoc)
    });
  }

  if (successful) {
    var ok = {
      statusCode: 200,
      body: "Vote successful.",
    };
    return ok;
  } else {
    var error = {
      statusCode: 500,
      body: "Problem while writing to database.",
    };
    return error;
  }
}

async function executeVoteDecrease(requestInfos, votesDoc) {
  var voteCategory = requestInfos.voteCategory;
  var successful;

  var canNotRemoveError = {
    statusCode: 403,
    body: "Can not remove vote. User did not vote on item so far.",
  };

  if (votesDoc) {
    var isVoteContained = votesDoc.votes.includes(voteCategory);
    if (isVoteContained) {
      if (votesDoc.votes.length == 1) {
        // only one vote by current user exists for item -> remove complete doc 
        successful = await executeTransaction(async (session) => {
          await updateCollections_deleteVariant(session, requestInfos)
        });
      } else {
        // more than one vote exists for item -> remove this vote 
        var votesArray = votesDoc.votes;
        votesArray.splice(votesArray.indexOf(voteCategory), 1);
        successful = await executeTransaction(async (session) => {
          await updateCollections_replaceVariant(session, requestInfos, votesDoc)
        });
      }
    } else {
      return canNotRemoveError; 
    }
  } else {
    return canNotRemoveError; 
  }

  if (successful) {
    var ok = {
      statusCode: 200,
      body: "Vote successful.",
    };
    return ok;
  } else {
    var error = {
      statusCode: 500,
      body: "Problem while writing to database.",
    };
    return error;
  }
}

async function updateCollections_replaceVariant(session, requestInfos, newVotesDoc) {
  // update user_votes collection
  var options = { 
    upsert: true,
    session: session,
  }
  var query = {userId: requestInfos.userId, itemId: requestInfos.itemId};
  var mongoResponse = await cachedDb.collection('user_votes').replaceOne(query, newVotesDoc, options);
  if (mongoResponse.acknowledged === false || (mongoResponse.modifiedCount === 0 && mongoResponse.upsertedCount === 0)) {
    logAbort("Updating user-votes collection failed.", mongoResponse, requestInfos);
    await session.abortTransaction();
    return;
  }

  // update items collection
  var itemUpdate = createItemUpdate(requestInfos.voteCategory, requestInfos.isIncrease);
  var mongoResponse = await cachedDb.collection('items').updateOne({_id:new ObjectId(requestInfos.itemId)}, itemUpdate, {session});
  if (mongoResponse.acknowledged === false || mongoResponse.modifiedCount === 0 || mongoResponse.matchedCount === 0) {
    logAbort("Updating item collection failed.", mongoResponse, requestInfos);
    await session.abortTransaction();
    return;
  }
}

async function updateCollections_deleteVariant(session, requestInfos) {
  // update user_votes collection
  var query = {userId: requestInfos.userId, itemId: requestInfos.itemId};
  var mongoResponse = await cachedDb.collection('user_votes').deleteOne(query, {session});
  if (mongoResponse.acknowledged === false || (mongoResponse.deletedCount != 1)) {
    logAbort("Updating user-votes collection failed.", mongoResponse, requestInfos);
    await session.abortTransaction();
    return;
  }

  // update items collection
  var itemUpdate = createItemUpdate(requestInfos.voteCategory, requestInfos.isIncrease);
  var mongoResponse = await cachedDb.collection('items').updateOne({_id:new ObjectId(requestInfos.itemId)}, itemUpdate, {session});
  if (mongoResponse.acknowledged === false || mongoResponse.modifiedCount === 0 || mongoResponse.matchedCount === 0) {
    logAbort("Updating item collection failed.", mongoResponse, requestInfos);
    await session.abortTransaction();
    return;
  }
}

function logAbort(message, mongoResponse, requestInfos) {
  console.log( message + " Aborting transaction.");
  console.log("Response by MongoDB: " + JSON.stringify(mongoResponse));
  console.log("Request data: " + JSON.stringify(requestInfos));
} 

async function executeTransaction(runnable) {
  const session = cachedClient.startSession();
  const transactionOptions = {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
  };
  try {
    const transactionResults = await session.withTransaction(runnable, transactionOptions);
    if (transactionResults) {
      return true;
    } else {
      console.log("The transaction was intentionally aborted.");
      return false;
    }
  } catch (e) {
    console.log("The transaction was aborted due to an unexpected error: " + e);
    return false;
  } finally {
    await session.endSession();
  }
}


function isValidRequest(requestInfos) {
  var inc = requestInfos.isIncrease;
  var voteCategory = requestInfos.voteCategory;
  if (requestInfos.itemId == null || voteCategory == null || inc == null) {
    return false;
  }
  if (!(voteCategory === "upVote" || voteCategory === "impactNom" || voteCategory === "inspiringNom" || voteCategory === "wellWrittenNom")) {
    return false;
  }
  if (!(inc === true || inc === false)) {
    return false;
  }
  return true;

}

function createItemUpdate(voteCategory, isIncrease) {
  var itemFieldToUpdate;
  switch(voteCategory) {
    case "upVote":
      itemFieldToUpdate = "upVotes";
      break;
    case "impactNom":
      itemFieldToUpdate = "impactNoms";
      break;
    case "inspiringNom":
      itemFieldToUpdate = "inspiringNoms";
      break;
    case "wellWrittenNom":
      itemFieldToUpdate = "wellWrittenNoms";
      break;
  }
  var incAmount = isIncrease ? 1 : -1;
  const updateDocument = {
    $inc: {[itemFieldToUpdate] : incAmount},
   };
  return updateDocument;
}