/**
 * Temporarily dump for test data.
 */


// get init data

exports.getInitData_1 = {
  body: "[{\"limit\" : 2, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"food\", \"medTech\"]}]",
  rawPath: "/get_init_data",
}
exports.getInitData_2 = {
  body: "[{\"limit\" : 5, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"ItemCategory.food\"]}, {\"limit\" : 5, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"ItemCategory.food\"]}]",
  rawPath: "/get_init_data",
}
exports.getInitData_3 = {
  body : "[{\"limit\" : 3, \"sortBy\" : \"dateAdded\"}]",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"}
        }
      }
    },
  rawPath: "/get_init_data_authorized",
}
exports.getInitData_4 = {
  body : "[{\"limit\" : 3, \"sortBy\" : \"dateAdded\", \"incubatorStatus\" : \"unsafe\"}]",
  rawPath: "/get_init_data",
}



// get items
exports.getItems_1 = {
  body: "{\"limit\" : 5, \"sortBy\" : \"dateAdded\",  \"categories\" : [\"solar\", \"wind\"], \"skip\":1}",
  rawPath: "/get_items"
}
exports.getItems_2 = {
  body: "{\"limit\" : 15, \"sortBy\" : \"dateAdded\", \"dateLT\":\"2021-11-24T22:23:57.322Z\", \"dateGT\":\"2021-11-07T14:39:14.869661\", \"voteType\": \"upVotes\"}",
  rawPath: "/get_items"
}
exports.getItems_3 = {
  body: "{\"limit\" : 5, \"sortBy\" : \"dateScraped\", \"incubatorStatus\" : \"scraped\", \"dateScrapedLT\":\"2022-02-11T12:11:02.927+00:00\", \"dateScrapedGT\":\"2022-02-10T17:51:48.157+00:00\"}",
  rawPath: "/get_items"
}
exports.getItems_4 = {
  body: "{\"limit\" : 25, \"sortBy\" : \"datePublished\", \"incubatorStatus\" : \"scraped\", \"datePublishedLT\":\"2022-01-12T23:00:07.000Z\"}",
  rawPath: "/get_items"
}
exports.getItems_5 = {
  body : "{\"limit\" : 3, \"skip\" : 1, \"sortBy\" : \"lastVoteOn\", \"isFetchUserLikes\" : \"true\"}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"
        }
      }
    }
  },
  rawPath: "/get_items_authorized",
}
exports.getItems_6 = {
  body : "{\"limit\" : 25, \"sortBy\" : \"lastVoteOn\", \"isFetchUserLikes\" : \"true\"}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "7c80adce-54a2-4af3-999f-786ab5dc1faf"
        }
      }
    }
  },
  rawPath: "/get_items_authorized",
}

exports.getItems_7 = {
  body : "{\"sortBy\":\"inspiringNoms\",\"limit\":25,\"voteType\":\"inspiringNoms\",\"skip\":25}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "7c80adce-54a2-4af3-999f-786ab5dc1faf"
        }
      }
    }
  },
  rawPath: "/get_items_authorized",
}

// get user data

exports.getUserData_1 = {
  body : "[\"61a3332cd30357b30b3b78e0\",\"61a2bf93a4dcd363df7755bb\",\"61a2bd940a92ccf29ea2ed63\"]",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"
        }
      }
    }
  },
  rawPath: "/get_user_data",
}
exports.getUserData_2  = {
  body : "[\"61a3332cd30357b30b3b78e0\",\"61a2bf93a4dcd363df7755bb\",\"61a2bd940a92ccf29ea2ed63\"]",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c",
          email: "renfilpe@hotmail.de",
        }
      }
    }
  },
  rawPath: "/get_user_data",
}

// post admin action

exports.postAdminAction_1 = {
    body : "{\"itemId\" : \"61f01e85f77ae044c49c2e59\", \"actionType\" : \"deleteItem\"}",
    requestContext : {
      authorizer: { 
        jwt: {
          claims: {
            email: "tetyos@testmail.com",
            sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"
          }
        }
      }
    },
    rawPath: "/post_admin_action",
  }


  // post item

exports.postItem_1 = {
  body : "{\"title\" : \"Test Title\", \"description\" : \"Test Description\", \"url\" : \"https://www.elektroauto-news.net/2021/kann-europa-leitmarkt-rgiequelle-geniale-erfindung-kombiniert-solar-und-windkraft_105884\"}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          email: "tetyos@testmail.com",
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"
        }
      }
    }
  },
  rawPath: "/post_item",
}

// post vote

exports.postVote_1 = {
  body : "{\"itemId\": \"61ef9ffc4a7b5aebce7e848e\", \"voteCategory\": \"impactNom\", \"inc\": true}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"
        }
      }
    }
  },
  rawPath: "/post_votes",
}


// update item

exports.updateItem_1 = {
  body : "{\"itemId\" : \"616daf40d8074c1dc541242e\", \"categories\" : [\"tech\", \"energy\", \"solar\", \"wind\"]}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          email: "tetyos@testmail.com",
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"
        }
      }
    }
  },
  rawPath: "/update_item",
}


// update scraped item

exports.updateScrapedItem_1 = {
  body : "{\"itemId\" : \"61ddb3ac0073167ff098630b\", \"categories\" : [\"tech\", \"solar\"]}",
  requestContext : {
    authorizer: { 
      jwt: {
        claims: {
          email: "tetyos@testmail.com",
          sub: "22686d7f-8e3e-4f67-854b-0a1918d809c3"
        }
      }
    }
  },
  rawPath: "/update_scraped_item",
}