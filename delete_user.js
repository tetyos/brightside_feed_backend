const ObjectId = require('mongodb').ObjectId;
exports.deleteUser = deleteUser;

async function deleteUser(db, event) {
  var userId = event.requestContext.authorizer.jwt.claims.sub;

  // delete user
  var response = await db.collection('user').deleteOne({_id: userId});
  if (response.acknowledged != true || response.deletedCount == 0) {
    console.error(response);
    return {
      statusCode: 404,
      body: "User not found.",
    };
  }
  
  // delete votes of user (count on items stays the same)
  const deleteVoteResponse = await db.collection('user_votes').deleteMany({userId: userId});
  if (deleteVoteResponse.acknowledged != true) {
    console.error(deleteVoteResponse);
    return {
      statusCode: 404,
      body: "User deleted. But votes of user could not be deleted.",
    };
  } else if (deleteVoteResponse.deletedCount == 0) {
    console.log("No votes of user deleted.");
  }

  return {
    statusCode: 200,
    body: "User data has been deleted.",
  };
};