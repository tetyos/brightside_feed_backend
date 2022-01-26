const {URL} = require("url");
exports.postItem = postItem;

let db = null;

async function postItem(cachedDb, event) {
  db = cachedDb;
  var userId = event.requestContext.authorizer.jwt.claims.sub;
  var mail = event.requestContext.authorizer.jwt.claims.email;

  var jsonContents = JSON.parse(event.body);
  jsonContents.dateAdded = new Date();
  jsonContents.addedBy = {
    userId:userId,
    email: mail
  }

  var hostResponse = await checkHost(jsonContents.url);
  console.log(hostResponse);
  if (hostResponse) {
    jsonContents.incubatorStatus = "inc1";
  } else {
    jsonContents.incubatorStatus = "unsafe";
  }

  const mongoResponse = await db.collection('items').insertOne(jsonContents);
  
  var response;
  if (mongoResponse.acknowledged === false) {
    console.log("Insertion of new item failed.")
    console.log(mongoResponse);
    response = {
      statusCode: 500,
      body: JSON.stringify(mongoResponse),
    };
  } else {
    response = {
      statusCode: 200,
      body: JSON.stringify(jsonContents),
    };
  }
  return response;
};

async function checkHost(url) {
  var host = new URL(url).hostname;
  if (host.startsWith('www.')) {
    host = host.substring(4, host.length);
  }
  console.log(host);

  return await db.collection('hosts_safe').findOne({_id: host});
}