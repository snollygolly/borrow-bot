"use strict";

const moment = require('./common.js').moment;

module.exports = {
  generateScore: function generateScore(post, user){
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
    const PER_DOLLAR_REPAID = 0.1;
    const PER_LOAN_BORROWED = 3;
    const PER_LOAN_LENT = 5;
    const PER_DOLLAR_LENT = 0.05;
    const PAYPAL_PAYMENT = 3;
    const OTHER_PAYMENT = -6;
    // ($$$ - LOAN) / OFFSET = POINTS
    const DOLLAR_OFFSET = 120;
    // (OFFSET - DAYS) / 7
    const PERIOD_OFFSET = 35;
    // ABS(IDEAL - INT) * OFFSET
    const INTEREST_OFFSET = 0.2;
    // the "ideal" interest, expressed in whole number (25 = 25% = .25)
    const IDEAL_INTEREST = 25;
    const PER_KARMA = 0.0005;
    const PER_DAY = 0.004;
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
    // interest offset
    if (post.interest){
      // if we even have a repayment date...
      let interestOffset = (IDEAL_INTEREST - Math.abs(IDEAL_INTEREST - post.interest)) * INTEREST_OFFSET;
      scoreObj.score += interestOffset;
      scoreObj.raw.score.interestOffset = interestOffset;
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
    }else if (scoreObj.score > F && scoreObj.score <= D){
      scoreObj.grade = "D";
    }else if (scoreObj.score > D && scoreObj.score <= C){
      scoreObj.grade = "C";
    }else if (scoreObj.score > C && scoreObj.score <= B){
      scoreObj.grade = "B";
    }else if (scoreObj.score > B && scoreObj.score <= A){
      scoreObj.grade = "A";
    }else if (scoreObj.score > A && scoreObj.score <= AA){
      scoreObj.grade = "AA";
    }else if (scoreObj.score > AA && scoreObj.score <= AAA){
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
};
