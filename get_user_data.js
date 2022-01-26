exports.getUserData = getUserData;

async function getUserData(db, event) {
  var userId = event.requestContext.authorizer.jwt.claims.sub;
  var mail = event.requestContext.authorizer.jwt.claims.email;

  var itemsIdArray = JSON.parse(event.body);
  
  var query = {
    userId: userId,
    itemId: {$in:itemsIdArray}
  };

  const votes = {};
  var callback = function(item) { 
    const itemId = item.itemId;
    votes[itemId] = item;
   };
  await db.collection('user_votes').find(query).forEach(callback);
  const userData = {};
  userData.votes = votes;
  var userDoc = await db.collection('user').findOne({_id : userId});
  
  if (userDoc == null) {
    const newUserDoc = {
      _id: userId,
      email: mail,
      signupDate: new Date(),
    };
    await db.collection('user').insertOne(newUserDoc);
    userData.userDoc = newUserDoc;
  } else {
    userData.userDoc = userDoc;
  }

  const response = {
    "statusCode": 200,
    
    "headers": {
      "Content-Type": "application/json; charset=utf-8"
    },
    "body":  JSON.stringify(userData),
  };
  return response;
}