"use strict";

// bring in the config
const config = require('./config');
// bring in packages
const Snoocore = require('snoocore');
const co = require('co');
const moment = require('moment');

// set up some constants
// how many comments before a post is considered stale
const COMMENTS_FRESH = 2;
// how much time before a post is considered stale (in minutes)
const TIME_FRESH = 60;

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
      returnObj.title = post.title;
      returnObj.amounts = processPostAmounts(post.title);
      returnObj.currency = processPostCurrency(post.title);
      returnObj.freshness = processPostFreshness(post);
      returnObj.dates = processPostDates(post.title);
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
    let CAD = /\[REQ\].+(CAD)/gi;
    let GBP = /\[REQ\].+(£|GBP)/gi;
    let EUR = /\[REQ\].+(€|EUR)/gi;
    let USD = /\[REQ\].+(\$|USD)/gi;
    // start matching them and seeing what sticks, be greedy with this
    var CADMatch = CAD.exec(title);
    if (CADMatch !== null){
      return "CAD";
    }
    var GBPMatch = GBP.exec(title);
    if (GBPMatch !== null){
      return "GBP";
    }
    var EURMatch = EUR.exec(title);
    if (EURMatch !== null){
      return "EUR";
    }
    // USD match is the greediest of all of them, match it last
    var USDMatch = USD.exec(title);
    if (USDMatch !== null){
      return "USD";
    }
    return null;
  }

  function processPostFreshness(post){
    var returnObj = {};
    returnObj.comments = post.num_comments <= COMMENTS_FRESH ? "Fresh" : "Stale";
    returnObj.commentsAmnt = post.num_comments;
    let postTime = moment.unix(post.created_utc).local();
    let nowTime = moment().local();
    returnObj.timeAmnt = nowTime.diff(postTime, 'minutes');
    returnObj.time = returnObj.timeAmnt <= TIME_FRESH ? "Fresh" : "Stale";
    returnObj.timeFriendly = postTime.fromNow();
    return returnObj;
  }

  function processPostDates(title){
    var returnObj = {};
    returnObj.raw = {};
    // handle month name and ordinal number matches
    var ordinal = /(\d+)(st|nd|rd|th){1}/gi
    let nameMonth = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|(Nov|Dec)(?:ember)?)/gi;
    // handle date expression as xx/xx or xx/xx/xx or xx/xx/xxxx
    let slashDates = /(\d{1,2})\/(\d{1,2})\/?(\d{2,4})?/gi;
    // matching for date names
    var nameMonthMatch = nameMonth.exec(title);
    if (nameMonthMatch !== null){
      returnObj.raw.matchType = "Name Dates";
      // get the current year, although this probably won't work long term
      returnObj.raw.year = moment().year();
      returnObj.raw.month = nameMonthMatch[1];
      var ordinalMatch = ordinal.exec(title);
      // if the ordinal doesn't match, set it to 31
      if (ordinalMatch === null){
        returnObj.raw.day = 31;
      }else{
        returnObj.raw.day = ordinalMatch[1];
      }
      returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MMM DD YYYY");
      return returnObj;
    }
    // matching for slash dates
    var slashDatesMatch = slashDates.exec(title);
    if (slashDatesMatch !== null){
      returnObj.raw.matchType = "Slash Dates";
      let thisYear = moment().format("YY");
      // we have a match for slash dates, now just figure out which is which
      if (!slashDatesMatch[3]){
        // no year provided (probably)
        returnObj.raw.year = moment().format("YYYY");
      }else if (slashDatesMatch[3].length > 2){
        // this is probably a 4 digit year
        returnObj.raw.year = slashDatesMatch[3];
      }else if (slashDatesMatch[3] === thisYear){
        // this is a two digit year (probably)
        returnObj.raw.year = moment().format("YYYY");
      }else if (slashDatesMatch[3] === (thisYear + 1)){
        // this is probably a two digit year for next year
        returnObj.raw.year = moment(slashDatesMatch[3], "YY").format("YYYY");
      }else{
        // we have no idea what this is?
        returnObj.raw.year = moment().format("YYYY");
      }
      // start with month/day matches
      if (slashDatesMatch[1] > 12){
        // this isn't a month, use DD/MM/YYYY
        returnObj.raw.day = slashDatesMatch[1];
        returnObj.raw.month = slashDatesMatch[2];
      }else{
        // this a month (maybe), use MM/DD/YYYY
        returnObj.raw.month = slashDatesMatch[1];
        returnObj.raw.day = slashDatesMatch[2];
      }
      returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MM DD YYYY");
      return returnObj;
    }
    return null;
  }
}
