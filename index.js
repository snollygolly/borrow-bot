"use strict";

// bring in the config
const config = require('./config');
// bring in packages
const Snoocore = require('snoocore');
const co = require('co');
const mysql = require('promise-mysql');
const moment = require('moment');

// set up some constants
// how many comments before a post is considered stale
const COMMENTS_FRESH = 2;
// how much time before a post is considered stale (in minutes)
const TIME_FRESH = 60;

var connection;

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
  connection = yield mysql.createConnection({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database
  });
  var posts = [];
  for (let post of listingResult.get.data.children){
    let newPost = processPost(post.data);
    yield storePost(newPost);
    posts.push(newPost);
  }
  console.log("*  : Everything is finished. End?");
  return process.exit();
}).catch(onerror);

function onerror(err) {
  // log any uncaught errors
  // co will not throw any errors you do not handle!!!
  // HANDLE ALL YOUR ERRORS!!!
  console.error(err.stack);
}

function* storePost (post){
  let countResults = yield connection.query(`SELECT id FROM posts WHERE id = '${post.id}';`);
  if (!countResults[0]){
    //this post doesn't exist in the DB
    console.log(`*  : Storing ${post.id} into DB`)
    return yield connection.query('INSERT INTO posts SET ?', post);
  }else{
    //this post already exists in the DB
    console.log(`*  : ${post.id} already exists in DB`)
    return yield {};
  }
}

function processPost(post){
  return processPostByType(post.title);

  // process post functions
  function processPostByType(title){
    var returnObj = {};
    // set patterns for request type
    let reqPost = /\[REQ\].?/gi;
    let paidPost = /\[PAID\].?/gi;
    let metaPost = /\[META\].?/gi;
    let unpaidPost = /\[UNPAID\].?/gi;
    // set some values for everyone
    returnObj.id = post.id;
    returnObj.poster = post.author;
    returnObj.title = post.title;
    returnObj.body = post.selftext;
    returnObj.created = moment.unix(post.created_utc).local().format("YYYY-MM-DD HH:mm:ss");
    returnObj.found = moment().local().format("YYYY-MM-DD HH:mm:ss");
    returnObj.comments = post.num_comments;
    if (reqPost.exec(post.title) !== null){
      returnObj.type = "REQ";
      let amounts = processPostAmounts(post.title);
      // process amounts for DB insertion
      returnObj.borrow_amnt = amounts.borrowAmnt;
      returnObj.repay_amnt = amounts.repayAmnt;
      returnObj.interest = amounts.interest;
      returnObj.currency = processPostCurrency(post.title);
      //returnObj.freshness = processPostFreshness(post);
      let dates = processPostDates(post.title);
      returnObj.repay_date = dates.date;
      return returnObj;
    }
    if (paidPost.exec(post.title) !== null){
      returnObj.type = "PAID";
      let amounts = processPostAmounts(post.title);
      // process amounts for DB insertion
      returnObj.borrow_amnt = amounts.borrowAmnt;
      returnObj.repay_amnt = amounts.repayAmnt;
      returnObj.interest = amounts.interest;
      returnObj.currency = processPostCurrency(post.title);
      return returnObj;
    }
    if (unpaidPost.exec(post.title) !== null){
      returnObj.type = "UNPAID";
      let amounts = processPostAmounts(post.title);
      // process amounts for DB insertion
      returnObj.borrow_amnt = amounts.borrowAmnt;
      returnObj.repay_amnt = amounts.repayAmnt;
      returnObj.interest = amounts.interest;
      returnObj.currency = processPostCurrency(post.title);
      return returnObj;
    }
    if (metaPost.exec(post.title) !== null){
      returnObj.type = "META";
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
      returnObj.borrowAmnt = twoAmountMatch[1].replace(/,/g, '');
      returnObj.repayAmnt = twoAmountMatch[2].replace(/,/g, '');
      returnObj.interest = Math.round((returnObj.repayAmnt - returnObj.borrowAmnt) / returnObj.borrowAmnt * 1000) / 10;
      return returnObj;
    }
    var oneAmountMatch = oneAmount.exec(title);
    if (oneAmountMatch !== null){
      // there was a match, return out
      returnObj.borrowAmnt = oneAmountMatch[1].replace(/,/g, '');
      let percInt = /(\d+)\%/gi;
      var percIntMatch = percInt.exec(title);
      if (percIntMatch !== null){
        // they are manually specifying an interest amount, we can work with this.
        returnObj.interest = percIntMatch[1];
        returnObj.repayAmnt = returnObj.borrowAmnt * ((percIntMatch[1] / 100) + 1);
      }else{
        returnObj.repayAmnt = null;
        returnObj.interest = null;
      }
      return returnObj;
    }
    return {borrowAmnt: null, repayAmnt: null, interest: null};
  }

  function processPostCurrency(title){
    var returnObj = {};
    // define all the patterns for currency matching
    let CAD = /.+(CAD)/gi;
    let GBP = /.+(£|GBP)/gi;
    let EUR = /.+(€|EUR)/gi;
    let USD = /.+(\$|USD)/gi;
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
    return "???";
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
      // if the ordinal doesn't match, set it to the end of the month
      if (ordinalMatch === null){
        returnObj.raw.day = moment(`${returnObj.raw.year} ${returnObj.raw.month}`, "YYYY MMM").endOf('month').format("DD");
      }else{
        returnObj.raw.day = ordinalMatch[1];
      }
      returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MMM DD YYYY").format("YYYY-MM-DD");
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
      returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MM DD YYYY").format("YYYY-MM-DD");
      return returnObj;
    }
    return {date: null};
  }
}
