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
  // set up a connection for the database
  connection = yield mysql.createConnection({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database
  });
  // login to redit and get your information
  let loginResult = yield reddit('/api/v1/me').get();
  console.log(`*  : ${loginResult.name} has logged in.`);
  //get a listing of all new posts on the front page
  let listingResult = yield reddit('/r/borrow/new').listing();
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
  console.log("Dying...");
  return process.exit();
}

function* storePost (post){
  post.raw = JSON.stringify(post.raw, null, 2);
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
  // patterns
  // for filtering which type of post this is
  const REQ_POST = /\[REQ\].?/gi;
  const PAID_POST =/\[PAID\].?/gi;
  const UNPAID_POST = /\[META\].?/gi;
  const META_POST = /\[UNPAID\].?/gi;
  // for figuring out how they are presenting their amounts
  const ONE_AMOUNT = /.*?[\$|£|€| ](\d+[,|.]?\d+)/gi;
  const TWO_AMOUNT = /.*?[\$|£|€| ](\d+[,|.]?\d+).+?[\$|£|€| ](\d+[,|.]?\d+)/gi;
  const PERC_INT = /(\d+)\%/gi;
  // for matching specific currencies being used
  const CAD = /.+(CAD|CDN)/gi;
  const GBP = /.+(£|GBP)/gi;
  const EUR = /.+(€|EUR)/gi;
  const USD = /.+(\$|USD)/gi;
  // for matching date types
  const ORDINAL = /(\d+)(st|nd|rd|th){1}/gi;
  const NAME_MONTH = /(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|(Nov|Dec)(?:ember)?)/gi;
  const SLASH_DATES = /(\d{1,2})\/(\d{1,2})\/?(\d{2,4})?/gi;
  const MANY_DAYS = /(\d+) days/gi;

  return processPostByType(post.title);

  // process post functions
  function processPostByType(title){
    var returnObj = {};
    // for debugging
    returnObj.raw = {};

    // set some values for everyone
    returnObj.id = post.id;
    returnObj.poster = post.author;
    returnObj.title = post.title;
    returnObj.body = post.selftext;
    returnObj.created = moment.unix(post.created_utc).local().format("YYYY-MM-DD HH:mm:ss");
    returnObj.found = moment().local().format("YYYY-MM-DD HH:mm:ss");
    returnObj.comments = post.num_comments;

    // figure out type of post by tag
    if (REQ_POST.exec(post.title) !== null){
      returnObj.type = "REQ";
    }else if (PAID_POST.exec(post.title) !== null){
      returnObj.type = "PAID";
    }else if (UNPAID_POST.exec(post.title) !== null){
      returnObj.type = "UNPAID";
    }else if (META_POST.exec(post.title) !== null){
      returnObj.type = "META";
      return returnObj;
    }else{
      returnObj.type = "???";
      return returnObj;
    }

    // create the object based on the type it is
    switch (returnObj.type){
      case "REQ":
        let dates = processPostDates(post.title);
        returnObj.raw.dates = dates;
        returnObj.repay_date = dates.date;
      case "PAID":
      case "UNPAID":
        let amounts = processPostAmounts(post.title);
        returnObj.raw.amounts = amounts;
        returnObj.borrow_amnt = amounts.borrowAmnt;
        returnObj.repay_amnt = amounts.repayAmnt;
        returnObj.interest = amounts.interest;
        returnObj.currency = processPostCurrency(post.title);
        break;
    }
    return returnObj;
  }

  function processPostAmounts(title){
    var returnObj = {};
    // start matching them and seeing what sticks, be greedy with this
    var twoAmountMatch = TWO_AMOUNT.exec(title);
    if (twoAmountMatch !== null){
      // there was a match, return out
      returnObj.borrowAmnt = twoAmountMatch[1].replace(/,/g, '');
      returnObj.repayAmnt = twoAmountMatch[2].replace(/,/g, '');
      returnObj.interest = Math.round((returnObj.repayAmnt - returnObj.borrowAmnt) / returnObj.borrowAmnt * 1000) / 10;
      return returnObj;
    }
    var oneAmountMatch = ONE_AMOUNT.exec(title);
    if (oneAmountMatch !== null){
      // there was a match, return out
      returnObj.borrowAmnt = oneAmountMatch[1].replace(/,/g, '');
      var percIntMatch = PERC_INT.exec(title);
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
    // matching for many days
    var manyDaysMatch = MANY_DAYS.exec(title);
    if (manyDaysMatch !== null){
      // we matched for xx days
      returnObj.raw.matchType = "Many Days";
      returnObj.raw.days = manyDaysMatch[1];
      returnObj.date = moment.unix(post.created_utc).add(returnObj.raw.days, "days").local().format("YYYY-MM-DD");
      return returnObj;
    }
    // matching for date names
    var nameMonthMatch = NAME_MONTH.exec(title);
    if (nameMonthMatch !== null){
      returnObj.raw.matchType = "Name Dates";
      // get the current year, although this probably won't work long term
      returnObj.raw.year = moment().year();
      returnObj.raw.month = nameMonthMatch[1];
      var ordinalMatch = ORDINAL.exec(title);
      // if the ordinal doesn't match, set it to the end of the month
      if (ordinalMatch === null){
        returnObj.raw.day = moment(`${returnObj.raw.year} ${returnObj.raw.month}`, "YYYY MMM").endOf('month').format("DD");
      }else{
        returnObj.raw.day = ordinalMatch[1];
      }
      returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MMM DD YYYY").format("YYYY-MM-DD");
      return returnObj;
    }
    // match for ordinal only (implied month)
    var ordinalMatch = ORDINAL.exec(title);
    if (ordinalMatch !== null){
      // we matched for xxth day of the month, implied month
      returnObj.raw.matchType = "Implied Month";
      returnObj.raw.day = ordinalMatch[1];
      var createdDay = moment.unix(post.created_utc).format("DD");
      if (createdDay > ordinalMatch[1]){
        returnObj.raw.month = moment.unix(post.created_utc).add(1, "month").format("MM");
        if (returnObj.raw.month === 1){
          //they mean a day next year
          returnObj.raw.year = moment().add(1, "year").format("YYYY");
        }else{
          returnObj.raw.year = moment().format("YYYY");
        }
      }else{
        returnObj.raw.month = moment.unix(post.created_utc).format("MM");
        returnObj.raw.year = moment().format("YYYY");
      }
      returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MM DD YYYY").format("YYYY-MM-DD");
      return returnObj;
    }
    // matching for slash dates
    var slashDatesMatch = SLASH_DATES.exec(title);
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
