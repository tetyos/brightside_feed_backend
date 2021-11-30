// Import the MongoDB driver
const MongoClient = require("mongodb").MongoClient;
// Once we connect to the database once, we'll store that connection and reuse it so that we don't have to connect to the database on every request.
let cachedDb = null;
const { atlas_connection_uri } = require('./connection_strings');

const event = {
  body : "{\"title\":\"A phooooooooooto tour\",\"description\":\"Vertical farms are expensive.\",\"url\":\"https://www.popsci.com/science/vertical-farms-energy-use-photos/\",\"imageUrl\":\"https://www.popsci.com/uploads/2021/11/22/vertical-farm-photo-tour4.jpg?auto=webp\",\"itemCategory\":\"ItemCategory.food\"}",
}
const event2 = {
  body : "{}",
}
test(event2).then(result => console.log(result));

async function test(event) {
  /* By default, the callback waits until the runtime event loop is empty before freezing the process and returning the results to the caller. Setting this property to false requests that AWS Lambda freeze the process soon after the callback is invoked, even if there are events in the event loop. AWS Lambda will freeze the process, any state data, and the events in the event loop. Any remaining events in the event loop are processed when the Lambda function is next invoked, if AWS Lambda chooses to use the frozen process. */
  // context.callbackWaitsForEmptyEventLoop = false;

  console.log("executing test. pre mongo connection");
  // Get an instance of our database
  const db = await connectToDatabase();


  console.log('Calling MongoDB Atlas from AWS Lambda with event: ' + JSON.stringify(event));
  var jsonContents = JSON.parse(event.body);
  //jsonContents.dateAdded = new Date();

  const mongoResponse = await db.collection('test_items').insertOne(jsonContents);
  console.log("executing test. after mongo action.");
  const response = {
    statusCode: 200,
    body: JSON.stringify(mongoResponse),
  };
  return response;
};




async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }
  // Connect to our MongoDB database hosted on MongoDB Atlas
  const client = await MongoClient.connect(atlas_connection_uri);
  // Specify which database we want to use
  const db = await client.db("chances_db");
  cachedDb = db;
  return db;
}