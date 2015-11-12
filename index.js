"use strict";

// bring in the config
const config = require('./config');
// bring in packages
const Snoocore = require('snoocore');
const Promise = require('bluebird');
const co = require('co');
const mysql = require('promise-mysql');
const moment = require('moment');
const rp = require('request-promise')
const client = Promise.promisifyAll(require('twilio')(config.twilio.accountSid, config.twilio.authToken));

// set up some constants
// how many comments before a post is considered stale
const COMMENTS_FRESH = 2;
// how much time before a post is considered stale (in minutes)
const TIME_FRESH = 60;
// how long to store a cached user (in days)
const USER_CACHE = 5;
// decide at which grade(s) to alert on
const WORTHY_GRADES = ["AAA", "AA"];
// decide how you'd like to be alerted
const ALERT_TYPE = "sms";
// who this alert goes to
const ALERT_RCPT = config.me.number;

console.log(`***: Starting the script at ${moment()}`);

var connection;

// Our new instance associated with a single account.
// It takes in various configuration options.
const reddit = new Snoocore({
  userAgent: '/u/snollygolly borrow-bot@0.1', // unique string identifying the app
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
  console.log(`** : ${loginResult.name} has logged in.`);
  //get a listing of all new posts on the front page
  let listingResult = yield reddit('/r/borrow/new').listing();
  for (let post of listingResult.get.data.children){
    let newPost = processPost(post.data);
    let user = yield getUser(newPost.poster);
    if (newPost.type == "REQ"){
      // generate a score for all requested loans
      let score = generateScore(newPost, user);
      newPost.raw.score = score;
      newPost.score = score.score;
      newPost.grade = score.grade;
    }
    let storeResult = yield storePost(newPost)
    if (storeResult.affectedRows >= 1){
      // we stored the post and it was new!
      // do some alerting
      yield handleAlerts(newPost);
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

function* handleAlerts (post){
  if (!post.grade){return;}
  let i = 0;
  while (i < WORTHY_GRADES.length){
    if (post.grade.indexOf(WORTHY_GRADES[i]) !== -1){
      // this post has that grade, alert!
      console.log("** : Sending Alert!");
      yield sendAlert(post);
      break;
    }
    i++;
  }
}

function* sendAlert (post){
  if (!post.repay_date){
    post.days = "?";
  }else{
    post.days = moment(post.repay_date, "YYYY-MM-DD").diff(moment(), "days");
  }
  if (!post.interest){
    post.interest = "?";
  }
  var bodyMessage = `New loan found: Grade: ${post.grade}, Borrowing: ${post.borrow_amnt}${post.currency}@${post.interest}% for ${post.days} days. Link: reddit.com/r/borrow/${post.id}`;
  try {
    var message = yield client.messages.create({
      to: config.me.number,
    	from: config.twilio.fromNumber,
      body: bodyMessage
    });
  }catch (err){
    console.log("***: Twilio threw an error");
    console.error(err);
    throw err
  }
  console.log("** : Alerted successfully: " + message.sid);
}

function* getUser (user){
  // first do a search for the user, since we can't get his ID from reddit.
  let userResults = yield connection.query(`SELECT * FROM users WHERE name = '${user}';`);
  if (userResults[0]){
    // username found, check the cache and if it's fresh, return from cache
    let todayMoment = moment().format("YYYY-MM-DD HH:mm:ss");
    let foundMoment = moment(new Date(userResults[0].found)).format("YYYY-MM-DD HH:mm:ss");
    let foundFutureMoment = moment(new Date(userResults[0].found)).add(USER_CACHE, "days").format("YYYY-MM-DD HH:mm:ss");
    if (moment(todayMoment).isAfter(foundFutureMoment) === true){
      //this cache is stale, so do nothing
      console.log(`** : Cache for ${user} is stale`);
      yield connection.query(`DELETE FROM users WHERE name = '${user}';`);
    }else{
      console.log(`*  : Cache for ${user} is fresh`);
      return userResults[0];
    }
  }
  //set up user object for returning
  var userObj = {};
  let userResult = yield reddit('/user/' + user + '/about').get();
  userObj.reddit_id = userResult.data.id;
  userObj.karma = userResult.data.link_karma + userResult.data.comment_karma;
  userObj.age = moment().diff(moment.unix(userResult.data.created).local(), "days");
  // get information from reddit loans
  let options = {
    method: "POST",
    uri: "https://redditloans.com/api/users/show.json",
    body: {
      usernames: user
    },
    rejectUnauthorized: false,
    json: true
  };
  let userPage = yield rp(options);
  if (userPage[0].errors){
    // something went wrong, this user doesn't exist, create a mock
    userObj.id = 0;
    userObj.name = user;
    userObj.loans = JSON.stringify([], null, 2);
  }else{
    userObj.id = userPage[0].id;
    userObj.name = userPage[0].usernames[0].username;
    userObj.loans = JSON.stringify(userPage[0].loans, null, 2);
  }
  userObj.found = moment().local().format("YYYY-MM-DD HH:mm:ss");
  console.log(`** : Storing user ${userObj.name} into DB`)
  yield connection.query('INSERT INTO users SET ?', userObj);
  return userObj;
}

function* storePost (post){
  post.raw = JSON.stringify(post.raw, null, 2);
  let countResults = yield connection.query(`SELECT id FROM posts WHERE id = '${post.id}';`);
  if (!countResults[0]){
    //this post doesn't exist in the DB
    console.log(`** : Storing post ${post.id} into DB`)
    return yield connection.query('INSERT INTO posts SET ?', post);
  }else{
    //this post already exists in the DB
    console.log(`*  : Post ${post.id} already exists in DB`)
    return yield {affected_rows: 0};
  }
}

function* deletePost (post){
  post.raw = JSON.stringify(post.raw, null, 2);
  return yield connection.query(`DELETE FROM posts WHERE id = '${post.id}';`);
}

function processPost(post){
  // patterns
  // for filtering which type of post this is
  const REQ_POST = /\[REQ\].?/gi;
  const PAID_POST =/\[PAID\].?/gi;
  const UNPAID_POST = /\[UNPAID\].?/gi;
  const META_POST = /\[META\].?/gi;
  // for figuring out how they are presenting their amounts
  const ONE_AMOUNT = /.*?[\$|£|€| ](\d+[,|.]?\d+)(?!st|nd|rd|th|\%|\/)/gi;
  const TWO_AMOUNT = /.*?[\$|£|€| ](\d+[,|.]?\d+)(?!st|nd|rd|th|\%|\/).+?[\$|£|€| ](\d+[,|.]?\d+)(?!st|nd|rd|th|\%|\/)/gi;
  const PERC_INT = /(\d+)\%/gi;
  // for matching specific currencies being used
  const CAD = /.+(CAD|CDN)/gi;
  const GBP = /.+(£|GBP)/gi;
  const EUR = /.+(€|EUR)/gi;
  const USD = /.+(\$|USD)/gi;
  // for matching date types
  const ORDINAL = / ([0-3]?[0-9])(st|nd|rd|th| |,){1}/gi;
  const NAME_MONTH = / (?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|(Nov|Dec)(?:ember)?) /gi;
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
        let dates = processPostDates(post);
        returnObj.raw.dates = dates;
        returnObj.repay_date = dates.date;
      case "PAID":
      case "UNPAID":
        var amounts = processPostAmounts(post.title);
        returnObj.raw.titleAmounts = amounts;
        if (!amounts.interest){
          // if the title doesn't have enough, maybe the body will...
          amounts = processPostAmounts(post.selftext);
          returnObj.raw.bodyAmounts = amounts;
          // use the initial borrow amount if it's not null, otherwise try for the body amount
          returnObj.borrow_amnt = returnObj.raw.titleAmounts.borrowAmnt === null ? amounts.borrowAmnt : returnObj.raw.titleAmounts.borrowAmnt;
          returnObj.repay_amnt = amounts.repayAmnt;
          // I think we need to recalculate interest when we do replacement on just the repay amount, but i'm not entirely sure, let's see if this breaks it.
          if (returnObj.repay_amnt !== null && returnObj.borrow_amnt !== null){
            returnObj.interest = Math.round((returnObj.repay_amnt - returnObj.borrow_amnt) / returnObj.borrow_amnt * 1000) / 10;
          }else{
            returnObj.interest = amounts.interest;
          }
        }else{
          returnObj.borrow_amnt = amounts.borrowAmnt;
          returnObj.repay_amnt = amounts.repayAmnt;
          returnObj.interest = amounts.interest;
        }
        returnObj.currency = processPostCurrency(post.title);
        break;
    }
    return returnObj;
  }

  function processPostAmounts(title){
    var returnObj = {};

    // match titles that have two amounts in the title
    var twoAmountMatch = TWO_AMOUNT.exec(title);
    if (twoAmountMatch !== null){
      return doTwoAmount(title, twoAmountMatch, returnObj);
    }

    // match title that only have one amount in the title
    var oneAmountMatch = ONE_AMOUNT.exec(title);
    if (oneAmountMatch !== null){
      return doOneAmount(title, oneAmountMatch, returnObj);
    }

    // give up if there's no matches
    return {borrowAmnt: null, repayAmnt: null, interest: null};

    function doTwoAmount (title, match, returnObj){
      returnObj.borrowAmnt = Number(match[1].replace(/,/g, ''));
      returnObj.repayAmnt = Number(match[2].replace(/,/g, ''));
      if (returnObj.repayAmnt < returnObj.borrowAmnt){
        // this is happening because they phrased their post oddly, they are other offering interest as a standalone value, or offering phased payments.  Let's hope it's the first one.
        returnObj.action = `Repay less than borrow, adding (${returnObj.repayAmnt})`;
        returnObj.repayAmnt += returnObj.borrowAmnt;
      }
      // TODO: add support for phased payments
      returnObj.interest = Math.round((returnObj.repayAmnt - returnObj.borrowAmnt) / returnObj.borrowAmnt * 1000) / 10;
      return returnObj;
    }

    function doOneAmount (title, match, returnObj){
      returnObj.borrowAmnt = match[1].replace(/,/g, '');
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

  function processPostDates(post){
    var returnObj = {};
    returnObj.raw = {};

    // matching for many days
    var manyDaysMatch = MANY_DAYS.exec(post.title);
    if (manyDaysMatch !== null){
      return doManyDays(post, manyDaysMatch, returnObj);
    }
    // matching for name month
    var nameMonthMatch = NAME_MONTH.exec(post.title);
    if (nameMonthMatch !== null){
      return doNameMonth(post, nameMonthMatch, returnObj);
    }
    // match for ordinal only (implied month)
    var ordinalMatch = ORDINAL.exec(post.title);
    if (ordinalMatch !== null){
      // we matched for xxth day of the month, implied month
      return doImpliedMonth(post, ordinalMatch, returnObj);
    }
    // matching for slash dates
    var slashDatesMatch = SLASH_DATES.exec(post.title);
    if (slashDatesMatch !== null){
      return doSlashDates(post, slashDatesMatch, returnObj);
    }

    // if we didn't match anything, return a null and give up
    return {date: null};

    function doManyDays(post, match, returnObj){
      returnObj.raw.matchType = "Many Days";
      returnObj.raw.days = match[1];
      returnObj.date = moment.unix(post.created_utc).add(returnObj.raw.days, "days").local().format("YYYY-MM-DD");
      return returnObj;
    }

    function doNameMonth(post, match, returnObj){
      returnObj.raw.matchType = "Name Dates";
      // get the current year, although this probably won't work long term
      returnObj.raw.year = moment().format("YYYY");
      returnObj.raw.month = match[0];
      var ordinalMatch = ORDINAL.exec(post.title);
      // if the ordinal doesn't match, set it to the end of the month
      if (ordinalMatch === null){
        returnObj.raw.day = moment(`${returnObj.raw.year} ${returnObj.raw.month}`, "YYYY MMM").endOf('month').format("DD");
      }else{
        returnObj.raw.day = ordinalMatch[1];
        if (moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MMM DD YYYY").isAfter(moment.unix(post.created_utc)) !== true){
          // the day/month combo is in the future, so leave the year alone
          returnObj.raw.year = moment(moment.unix(post.created_utc)).add(1, "year").format("YYYY");
        }
      }
      returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MMM DD YYYY").format("YYYY-MM-DD");
      return returnObj;
    }

    function doImpliedMonth(post, match, returnObj){
      returnObj.raw.matchType = "Implied Month";
      returnObj.raw.day = match[1];
      var createdDay = moment.unix(post.created_utc).format("DD");
      if (createdDay > match[1]){
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

    function doSlashDates(post, match, returnObj){
      returnObj.raw.matchType = "Slash Dates";
      let thisYear = moment().format("YY");
      // we have a match for slash dates, now just figure out which is which
      if (!match[3]){
        // no year provided (probably)
        returnObj.raw.year = moment().format("YYYY");
      }else if (match[3].length > 2){
        // this is probably a 4 digit year
        returnObj.raw.year = match[3];
      }else if (match[3] === thisYear){
        // this is a two digit year (probably)
        returnObj.raw.year = moment().format("YYYY");
      }else if (match[3] === (thisYear + 1)){
        // this is probably a two digit year for next year
        returnObj.raw.year = moment(match[3], "YY").format("YYYY");
      }else{
        // we have no idea what this is?
        returnObj.raw.year = moment().format("YYYY");
      }
      // start with month/day matches
      if (match[1] > 12){
        // this isn't a month, use DD/MM/YYYY
        returnObj.raw.day = match[1];
        returnObj.raw.month = match[2];
      }else{
        // this a month (maybe), use MM/DD/YYYY
        returnObj.raw.month = match[1];
        returnObj.raw.day = match[2];
      }
      returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MM DD YYYY").format("YYYY-MM-DD");
      return returnObj;
    }
  }
}

function generateScore(post, user){
  // set some constants for scoring
  const AMNT_1 = 10;
  const AMNT_2 = 100;
  const AMNT_3 = 500;
  const AMNT_4 = 1000;
  const AMNT_5 = 5000;
  // grading for loan quality (D = D-F)
  const F = 0;
  const D = 15;
  const C = 30;
  const B = 55;
  const A = 110;
  const AA = 175;
  const AAA = 250;
  // for variables
  const PER_LENDER_REPAID = 6;
  const PER_DOLLAR_REPAID = .1;
  const PER_LOAN_BORROWED = 3;
  const PER_LOAN_LENT = 5;
  const PER_DOLLAR_LENT = .05;
  const PAYPAL_PAYMENT = 3;
  const OTHER_PAYMENT = -6;
  // ($$$ - LOAN) / OFFSET = POINTS
  const DOLLAR_OFFSET = 120;
  // (OFFSET - DAYS) / 7
  const PERIOD_OFFSET = 35;
  const PER_KARMA = .001;
  const PER_DAY = .005;
  const PER_UNPAID = -30;

  let scoreObj = {};
  scoreObj.raw = {};

  let loanObj = parseLoans(JSON.parse(user.loans), user.id);
  scoreObj.raw.loan = loanObj;
  let paymentObj = getPaymentMethod(post);
  scoreObj.raw.payment = paymentObj;
  // go through all the variables and start to calculate the score
  scoreObj.raw.score = {};
  scoreObj.score = 0;
  scoreObj.raw.score.start = scoreObj.score;
  // per lender repaid
  let perLenderRepaid = loanObj.lendersRepaid * PER_LENDER_REPAID;
  scoreObj.score += perLenderRepaid;
  scoreObj.raw.score.perLenderRepaid = perLenderRepaid;
  // per dollar repaid
  let perDollarRepaid = (loanObj.totalCentsRepaid / 100) * PER_DOLLAR_REPAID;
  scoreObj.score += perDollarRepaid;
  scoreObj.raw.score.perDollarRepaid = perDollarRepaid;
  // per loan borrowed
  let perLoanBorrowed = loanObj.totalBorrowed * PER_LOAN_BORROWED;
  scoreObj.score += perLoanBorrowed;
  scoreObj.raw.score.perLoanBorrowed = perLoanBorrowed;
  // per loan lent
  let perLoanLent = loanObj.totalLoaned * PER_LOAN_LENT;
  scoreObj.score += perLoanLent;
  scoreObj.raw.score.perLoanLent = perLoanLent;
  // per dollar lent
  let perDollarLent = (loanObj.totalCentsLent / 100) * PER_DOLLAR_LENT;
  scoreObj.score += perDollarLent;
  scoreObj.raw.score.perDollarLent = perDollarLent;
  // paypal payment
  if (paymentObj.title.paypal === true || paymentObj.body.paypal === true){
    let paypalPayment = PAYPAL_PAYMENT;
    scoreObj.score += paypalPayment;
    scoreObj.raw.score.paypalPayment = paypalPayment;
  }
  // other payment
  if (paymentObj.title.other === true || paymentObj.body.other === true){
    let otherPayment = OTHER_PAYMENT;
    scoreObj.score += otherPayment;
    scoreObj.raw.score.otherPayment = otherPayment;
  }
  // dollar offset
  let dollarOffset = (AMNT_3 - post.borrow_amnt) / DOLLAR_OFFSET;
  scoreObj.score += dollarOffset;
  scoreObj.raw.score.dollarOffset = dollarOffset;
  // period offset
  if (post.repay_date){
    // if we even have a repayment date...
    let loanLength = moment(post.repay_date, "YYYY-MM-DD").diff(moment(), "days");
    let periodOffset = (PERIOD_OFFSET - loanLength) / 7;
    scoreObj.score += periodOffset;
    scoreObj.raw.score.periodOffset = periodOffset;
  }
  // per karma
  let perKarma = user.karma * PER_KARMA;
  scoreObj.score += perKarma;
  scoreObj.raw.score.perKarma = perKarma;
  // per day
  let perDay = user.age * PER_DAY;
  scoreObj.score += perDay;
  scoreObj.raw.score.perDay = perDay;
  // per unpaid
  let perUnpaid = loanObj.totalUnpaid * PER_UNPAID;
  scoreObj.score += perUnpaid;
  scoreObj.raw.score.perUnpaid = perUnpaid;

  // finally do some rounding
  scoreObj.score = Math.round(scoreObj.score * 100) / 100;

  // assign a grade
  if (scoreObj.score < F){
    scoreObj.grade = "F";
  }else if (scoreObj.score > F && scoreObj.score < D){
    scoreObj.grade = "D";
  }else if (scoreObj.score > D && scoreObj.score < C){
    scoreObj.grade = "C";
  }else if (scoreObj.score > C && scoreObj.score < B){
    scoreObj.grade = "B";
  }else if (scoreObj.score > B && scoreObj.score < A){
    scoreObj.grade = "A";
  }else if (scoreObj.score > A && scoreObj.score < AA){
    scoreObj.grade = "AA";
  }else if (scoreObj.score > AA && scoreObj.score < AAA){
    scoreObj.grade = "AAA";
  }else{
    scoreObj.grade = "???";
  }

  return scoreObj;

  function parseLoans(loans, userID){
    var loanObj = {
      // how many total loans on file
      totalLoans: 0,
      // how many loans where you've been the lender
      totalLoaned: 0,
      // how many loans where you've been the borrower
      totalBorrowed: 0,
      // how many individual people have been your lender (no dupes)
      totalLenders: 0,
      // who are these people?
      lenders: [],
      // how many individual people you've lent to
      totalBorrowers: 0,
      // who are these people?
      borrowers: [],
      // how many of these total lenders did you repay?
      lendersRepaid: 0,
      // how many total dollars have you borrowed?
      totalCentsBorrowed: 0,
      // how many total dollars have you repaid?
      totalCentsRepaid: 0,
      // how many dollars you've lent
      totalCentsLent: 0,
      // how many of your loans as a borrower are unpaid
      totalUnpaid: 0
    };
    // loop through all loan objects
    for (let loan of loans){
      loanObj.totalLoans++;
      // if we were a borrower for this loan
      if (loan.borrower_id === userID){
        // we were the borrower
        loanObj.totalBorrowed++;
        // track who the lender was
        if (loanObj.lenders.indexOf(loan.lender_id) === -1){
          // only push if this person isn't in the array
          loanObj.lenders.push(loan.lender_id);
        }
        loanObj.totalCentsBorrowed += loan.principal_cents;
        loanObj.totalCentsRepaid += loan.principal_repayment_cents;
        if (loan.principal_repayment_cents >= loan.principal_cents){
          // we repaid our lender
          loanObj.lendersRepaid++;
        }
        if (loan.unpaid === true){
          loanObj.totalUnpaid++;
        }
      }else if (loan.lender_id === userID){
        // we were the lender
        loanObj.totalLoaned++;
        // track who we lent to
        if (loanObj.borrowers.indexOf(loan.borrower_id) === -1){
          // only push if this person isn't in the array
          loanObj.borrowers.push(loan.borrower_id);
        }
        loanObj.totalCentsLent += loan.principal_cents;
      }
    }
    loanObj.totalLenders = loanObj.lenders.length;
    loanObj.totalBorrowers = loanObj.borrowers.length;
    if (userID === 0){
      //this is a mock user
      loanObj.isRegistered = false;
    }else{
      loanObj.isRegistered = true;
    }
    return loanObj;
  }

  function getPaymentMethod(post){
    const PAYPAL_ACCEPTED = /(paypal|pay pal)/gi;
    const OTHER_ACCEPTED = /(moneygram|money gram|quickpay|interac|e-transfer|e transfer|western union|money pak|moneypak|direct deposit)/gi;

    var returnObj = {};
    returnObj.title = checkPayment(post.title);
    returnObj.body = checkPayment(post.body);
    return returnObj;

    function checkPayment(text){
      var payObj = {
        paypal: false,
        other: false
      };
      let paypalAcceptedMatch = PAYPAL_ACCEPTED.exec(text);
      let otherAcceptedMatch = OTHER_ACCEPTED.exec(text);
      if (paypalAcceptedMatch !== null){
        //they accept paypal, probably
        payObj.paypal = true;
      }
      if (otherAcceptedMatch !== null){
        //they accept something else
        payObj.other = true;
      }
      return payObj;
    }
  }
}
