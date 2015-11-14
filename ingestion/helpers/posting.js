"use strict";

const moment = require('./common').moment;
const createConnection = require('./common').createConnection;

module.exports = {
  storePost: function* storePost(post){
    const connection = yield createConnection();
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
  },
  deletePost: function* deletePost(post){
    const connection = yield createConnection();
    post.raw = JSON.stringify(post.raw, null, 2);
    return yield connection.query(`DELETE FROM posts WHERE id = '${post.id}';`);
  },
  processPost: function processPost(post){
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
      if (post.notes){
        // this is a test, ignore the rest of the stuff
        returnObj.id = post.id;
        returnObj.title = post.title;
        returnObj.body = post.body;
        returnObj.created_utc = moment(post.created).format("YYYY-MM-DD HH:mm:ss").valueOf();
        // set up some other properties for this mock
        returnObj.type = "REQ";
      }else{
        // this is the real deal
        returnObj.id = post.id;
        returnObj.poster = post.author;
        returnObj.title = post.title;
        returnObj.body = post.selftext;
        returnObj.created = moment.unix(post.created_utc).local().format("YYYY-MM-DD HH:mm:ss");
        returnObj.found = moment().local().format("YYYY-MM-DD HH:mm:ss");
        returnObj.comments = post.num_comments;
      }

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
};
