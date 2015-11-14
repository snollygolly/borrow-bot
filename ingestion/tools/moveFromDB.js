"use strict";

// bring in the config
const config = require('../helpers/common').config;
// bring in packages
const createConnection = require('../helpers/common').createConnection;
const co = require('../helpers/common').co;
const moment = require('../helpers/common').moment;
const fs = require('../helpers/common').fs;

const postID = process.argv[2];
const jsonFile = ('./tests.json');

console.log(`***: Starting the script at ${moment()}`);

co(function *(){
  // end if we didn't pass arguments
  if (!postID){
    console.log("***: You must provide the ID of the row you want to bring over");
    return process.exit();
  }
  // connect to the DB
  const connection = yield createConnection();
  let postResults = yield connection.query(`SELECT * FROM posts WHERE id = '${postID}';`);
  // if this ID isn't in the DB, end
  if (!postResults[0]){
    //this post doesn't exist in the DB
    console.log(`** : ID(${postID}) doesn't exist in the database`);
    return process.exit();
  }
  // open the json file
  let jsonStr = yield fs.readFileAsync(jsonFile, 'utf8');
  // and parse it
  let jsonArr = JSON.parse(jsonStr);
  let testObj = createTest(postResults[0]);
  // add it to the array
  jsonArr.push(testObj);
  yield fs.writeFileAsync(jsonFile, JSON.stringify(jsonArr, null, 2));
  console.log(`** : Finished inserting ID(${postID}) into JSON from DB`);

  return process.exit();

  function createTest(post){
    delete post.type;
    delete post.poster;
    delete post.comments;
    delete post.found;
    delete post.created;
    post.notes = [];
    delete post.raw;
    return post;
  }
}).catch(onerror);

function onerror(err) {
  // log any uncaught errors
  // co will not throw any errors you do not handle!!!
  // HANDLE ALL YOUR ERRORS!!!
  console.error(err.stack);
  console.log("***: Dying...");
  return process.exit();
}
