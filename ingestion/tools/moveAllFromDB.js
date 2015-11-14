"use strict";

// bring in the config
const config = require('../helpers/common').config;
// bring in packages
const createConnection = require('../helpers/common').createConnection;
const co = require('../helpers/common').co;
const moment = require('../helpers/common').moment;
const fs = require('../helpers/common').fs;

const jsonFile = ('../test/posts.json');

console.log(`***: Starting the script at ${moment()}`);

co(function *(){
  // connect to the DB
  const connection = yield createConnection();
  let postResults = yield connection.query(`SELECT * FROM tests;`);
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
  let i = 0;
  while (i < postResults.length){
    let testObj = createTest(postResults[i]);
    // add it to the array
    jsonArr.push(testObj);
    i++;
  }
  yield fs.writeFileAsync(jsonFile, JSON.stringify(jsonArr, null, 2));
  console.log(`** : Finished inserting ${postResults.length} results into JSON from DB`);

  return process.exit();

  function createTest(post){
    delete post.type;
    delete post.poster;
    delete post.score;
    delete post.grade;
    delete post.comments;
    delete post.found;
    if (post.notes.length > 1){
      post.notes = post.notes.split(", ");
    }else{
      post.notes = [];
    }
    delete post.raw;
    post.repay_date = moment(post.repay_date).format("YYYY-MM-DD");
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
