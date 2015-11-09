"use strict";

// bring in the config
const config = require('./config');
// bring in packages
const Snoocore = require('snoocore');
const co = require('co');
const moment = require('moment');

// Our new instance associated with a single account.
// It takes in various configuration options.
const reddit = new Snoocore({
  userAgent: '/u/snollygolly borrow-bot@0.0.1', // unique string identifying the app
  oauth: {
    type: 'script',
    key: config.auth.key, // OAuth client key (provided at reddit app)
    secret: config.auth.secret, // OAuth secret (provided at reddit app)
    username: config.auth.username, // Reddit username used to make the reddit app
    password: config.auth.password, // Reddit password for the username
    // The OAuth scopes that we need to make the calls that we
    // want. The reddit documentation will specify which scope
    // is needed for evey call
    scope: [ 'identity', 'read', 'vote', 'flair' ]
  }
});

co(function *(){
  // yield any promise
  let loginResult = yield reddit('/api/v1/me').get();
  console.log(`*  : ${loginResult.name} has logged in.`);
  let listingResult = yield reddit('/r/borrow/new').listing();
  var posts = [];
  for (let post of listingResult.get.data.children){
    posts.push(processPost(post.data));
  }
  //build preferred list
  var prefPosts = [];
  for (let post of posts){
    let prefPost = displayPost(post);
    if (prefPost !== null){
      prefPosts.push(post);
    }
  }
  console.log(JSON.stringify(prefPosts, null, 2));
}).catch(onerror);

function onerror(err) {
  // log any uncaught errors
  // co will not throw any errors you do not handle!!!
  // HANDLE ALL YOUR ERRORS!!!
  console.error(err.stack);
}

function displayPost(post){
  if (post.type !== "REQ"){return null;}
  if (post.freshness.comments !== "Fresh"){return null;}
  if (post.amounts === null){return null;}
  if (post.amounts.interest === null){return null;}
  if (post.amounts.interest === "???"){return null;}
  if (post.amounts.interest < 10){return null;}
  return post;
}

function processPost(post){
  return processPostByType(post.title);

  // process post functions
  function processPostByType(title){
    var returnObj = {};
    let reqPost = /\[REQ\].?/gi;
    let paidPost = /\[PAID\].?/gi;
    let metaPost = /\[META\].?/gi;
    let unpaidPost = /\[UNPAID\].?/gi;
    if (reqPost.exec(post.title) !== null){
      returnObj.type = "REQ";
      returnObj.id = post.id;
      returnObj.amounts = processPostAmounts(post.title);
      returnObj.currency = processPostCurrency(post.title);
      returnObj.freshness = processPostFreshness(post);
      //returnObj.dates = processPostDates(post);
      return returnObj;
    }
    if (paidPost.exec(post.title) !== null){
      returnObj.type = "PAID";
      returnObj.id = post.id;
      returnObj.amounts = processPostAmounts(post.title);
      returnObj.currency = processPostCurrency(post.title);
      //returnObj.dates = processPostDates(post);
      return returnObj;
    }
    if (unpaidPost.exec(post.title) !== null){
      returnObj.type = "UNPAID";
      returnObj.id = post.id;
      returnObj.amounts = processPostAmounts(post.title);
      returnObj.currency = processPostCurrency(post.title);
      //returnObj.dates = processPostDates(post);
      return returnObj;
    }
    if (metaPost.exec(post.title) !== null){
      returnObj.type = "META";
      returnObj.id = post.id;
      return returnObj;
    }
    return null;
  }

  function processPostAmounts(title){
    var returnObj = {};
    // define all the patterns for currency matching
    let oneAmount = /\[REQ\].?[\$|£|€](\d+[,|.]?\d+)/gi;
    let twoAmount = /\[REQ\].?[\$|£|€](\d+[,|.]?\d+).+[\$|£|€](\d+[,|.]?\d+)/gi;
    // start matching them and seeing what sticks, be greedy with this
    var twoAmountMatch = twoAmount.exec(title);
    if (twoAmountMatch !== null){
      // there was a match, return out
      returnObj.borrowAmnt = twoAmountMatch[1];
      returnObj.repayAmnt = twoAmountMatch[2];
      returnObj.interest = Math.round((returnObj.repayAmnt - returnObj.borrowAmnt) / returnObj.borrowAmnt * 1000) / 10;
      return returnObj;
    }
    var oneAmountMatch = oneAmount.exec(title);
    if (oneAmountMatch !== null){
      // there was a match, return out
      returnObj.borrowAmnt = oneAmountMatch[1];
      returnObj.repayAmnt = "???";
      returnObj.interest = "???";
      return returnObj;
    }
    return null;
  }

  function processPostCurrency(title){
    var returnObj = {};
    // define all the patterns for currency matching
    let USD = /\[REQ\].?[\$|USD]/gi;
    let GBP = /\[REQ\].?[£|GBP]/gi;
    let EUR = /\[REQ\].?[€|EUR]/gi;
    // start matching them and seeing what sticks, be greedy with this
    var USDMatch = USD.test(title);
    if (USDMatch !== null){
      return "USD";
    }
    var GBPMatch = GBP.test(title);
    if (GBPMatch !== null){
      return "GBP";
    }
    var EURMatch = EUR.test(title);
    if (EURMatch !== null){
      return "EUR";
    }
    return null;
  }

  function processPostFreshness(post){
    var returnObj = {};
    returnObj.comments = post.num_comments <= 2 ? "Fresh" : "Stale";
    returnObj.commentsAmnt = post.num_comments;
    let postTime = moment.unix(post.created_utc).local();
    let nowTime = moment().local();
    returnObj.time = nowTime.diff(postTime, 'minutes');
    returnObj.timeFriendly = postTime.fromNow();
    return returnObj;
  }

  function processPostDate(title){
    var returnObj = {};
    let fullNameMonthEnd = /(January|February|March|April|May|June|July|August|September|October|November|December).+? (\d+)?/gi;
    let partialNameMonthEnd = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec).+? (\d+)?/gi
  }
}
