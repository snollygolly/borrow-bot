"use strict";

// bring in the config
const config = require('./helpers/common').config;
// bring in packages
const connection = require('./helpers/common').connection;
const co = require('./helpers/common').co;
const moment = require('./helpers/common').moment;
const reddit = require('./helpers/common').reddit;

// require our own helpers
const usering = require('./helpers/usering');
const scoring = require('./helpers/scoring');
const posting = require('./helpers/posting');
const alerting = require('./helpers/alerting');

console.log(`***: Starting the script at ${moment()}`);

co(function *(){
  // login to redit and get your information
  let loginResult = yield reddit('/api/v1/me').get();
  console.log(`** : ${loginResult.name} has logged in.`);
  //get a listing of all new posts on the front page
  let listingResult = yield reddit('/r/borrow/new').listing();
  for (let post of listingResult.get.data.children){
    let newPost = posting.processPost(post.data);
    let user = yield usering.getUser(newPost.poster);
    if (newPost.type == "REQ"){
      // generate a score for all requested loans
      let score = scoring.generateScore(newPost, user);
      newPost.raw.score = score;
      newPost.score = score.score;
      newPost.grade = score.grade;
    }
    let storeResult = yield posting.storePost(newPost)
    if (storeResult.affectedRows >= 1){
      // we stored the post and it was new!
      // do some alerting
      yield alerting.handleAlerts(newPost);
    }
  }
  console.log("** : Everything is finished. End?");
  return process.exit();
}).catch(onerror);

function onerror(err) {
  // log any uncaught errors
  // co will not throw any errors you do not handle!!!
  // HANDLE ALL YOUR ERRORS!!!
  console.error(err.stack);
  console.log("***: Dying...");
  return process.exit();
}
