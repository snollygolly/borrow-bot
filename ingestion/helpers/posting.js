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
    const ORDINAL = / ([0-3]?[0-9])(st|nd|rd|th| |,|\.){1}/gi;
    const NAME_MONTH = / (?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|(Nov|Dec)(?:ember)?) /gi;
    const SLASH_DATES = /(?:on|before|latest|\(| )(\d{1,2})(?:\/|-|\.)(\d{1,2})(?:\/|-|\.)?(\d{2,4})?/gi;
    const MANY_DAYS = /(\d+) days/gi;
    const PREARRANGED = /pre.?arranged/gi;

    return processPostByType(post.title);

    // process post functions
    function processPostByType(title){
      let returnObj = {};
      // for debugging
      returnObj.raw = {};

      // set some values for everyone
      if (post.notes){
        // this is a test, ignore the rest of the stuff
        returnObj.id = post.id;
        returnObj.title = post.title;
        returnObj.selftext = post.body;
        post.created_utc = moment(new Date(post.created)).unix();
        // set up some other properties for this mock
        returnObj.type = "REQ";
        post.link_flair_css_class = null;
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
          let datePost = {
            id: post.id,
            title: post.title,
            created_utc: post.created_utc
          }
          let dates = processPostDates(datePost);
          returnObj.raw.titleDates = dates;
          if (!dates.date){
            // we didn't find a date on the first pass, let's try again with the body
            datePost.title = post.body;
            dates = processPostDates(datePost);
            returnObj.raw.bodyDates = dates;
            returnObj.repay_date = dates.date;
          }else{
            returnObj.repay_date = dates.date;
          }
          // process if this post is closed already
          let closed = processPostClosed(post);
          returnObj.raw.closed = closed;
          returnObj.closed = closed.closed;
        case "PAID":
        case "UNPAID":
          let amounts = processPostAmounts(post.title);
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
      let returnObj = {};

      // match titles that have two amounts in the title
      let twoAmountMatch = TWO_AMOUNT.exec(title);
      if (twoAmountMatch !== null){
        return doTwoAmount(title, twoAmountMatch, returnObj);
      }

      // match title that only have one amount in the title
      let oneAmountMatch = ONE_AMOUNT.exec(title);
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
        let percIntMatch = PERC_INT.exec(title);
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
      let returnObj = {};
      // start matching them and seeing what sticks, be greedy with this
      let CADMatch = CAD.exec(title);
      if (CADMatch !== null){
        return "CAD";
      }
      let GBPMatch = GBP.exec(title);
      if (GBPMatch !== null){
        return "GBP";
      }
      let EURMatch = EUR.exec(title);
      if (EURMatch !== null){
        return "EUR";
      }
      // USD match is the greediest of all of them, match it last
      let USDMatch = USD.exec(title);
      if (USDMatch !== null){
        return "USD";
      }
      return "???";
    }

    function processPostClosed(post){
      let returnObj = {
        closed: false
      };
      returnObj.raw = {};

      //check to see if this loan was prearranged
      let preArrangedTitleMatch = PREARRANGED.exec(post.title);
      let preArrangedBodyMatch = PREARRANGED.exec(post.selftext);
      returnObj.raw.preTitle = preArrangedTitleMatch;
      returnObj.raw.preBody = preArrangedBodyMatch;
      if (preArrangedTitleMatch !== null || preArrangedBodyMatch !== null){
        // this was a prearranged loan, let's mark it closed
        returnObj.closed = true;
      }
      returnObj.raw.linkFlair = post.link_flair_css_class;
      if (post.link_flair_css_class === "nolongerneeded"){
        // this post is marked closed
        returnObj.closed = true;
      }
      return returnObj;
    }

    function processPostDates(post){
      let returnObj = {};
      returnObj.raw = {};

      // matching for slash dates
      let slashDatesMatch = SLASH_DATES.exec(post.title);
      if (slashDatesMatch !== null){
        return doSlashDates(post, slashDatesMatch, returnObj);
      }
      // matching for many days
      let manyDaysMatch = MANY_DAYS.exec(post.title);
      if (manyDaysMatch !== null){
        return doManyDays(post, manyDaysMatch, returnObj);
      }
      // matching for name month
      let nameMonthMatch = NAME_MONTH.exec(post.title);
      if (nameMonthMatch !== null){
        return doNameMonth(post, nameMonthMatch, returnObj);
      }
      // match for ordinal only (implied month)
      let ordinalMatch = ORDINAL.exec(post.title);
      if (ordinalMatch !== null){
        // we matched for xxth day of the month, implied month
        return doImpliedMonth(post, ordinalMatch, returnObj);
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
        let ordinalMatch = ORDINAL.exec(post.title);
        // if the ordinal doesn't match, set it to the end of the month
        if (ordinalMatch === null){
          returnObj.raw.day = moment(`${returnObj.raw.year} ${returnObj.raw.month}`, "YYYY MMM").endOf('month').format("DD");
        }else{
          returnObj.raw.day = ordinalMatch[1];
        }
        // check if this date is in the future
        let parsedMoment = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MMM DD YYYY");
        let createdMoment = moment.unix(post.created_utc);
        let isAfterResult = parsedMoment.isAfter(createdMoment);
        if (isAfterResult !== true){
          // the day/month combo is in the future, so add a year
          returnObj.raw.year = moment(moment.unix(post.created_utc)).add(1, "year").format("YYYY");
        }
        // return the date
        returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MMM DD YYYY").format("YYYY-MM-DD");
        return returnObj;
      }

      function doImpliedMonth(post, match, returnObj){
        returnObj.raw.matchType = "Implied Month";
        returnObj.raw.day = match[1];
        let createdDay = moment.unix(post.created_utc).format("DD");
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
        // check if this date is in the future
        let parsedMoment = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MM DD YYYY");
        let createdMoment = moment.unix(post.created_utc);
        let isAfterResult = parsedMoment.isAfter(createdMoment);
        if (isAfterResult !== true){
          // the day/month combo is in the future, so add a year
          returnObj.raw.year = moment(moment.unix(post.created_utc)).add(1, "year").format("YYYY");
        }
        returnObj.date = moment(`${returnObj.raw.month} ${returnObj.raw.day} ${returnObj.raw.year}`, "MM DD YYYY").format("YYYY-MM-DD");
        return returnObj;
      }
    }
  }
};
