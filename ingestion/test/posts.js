'use strict';

const chai = require('chai');
const moment = require('../helpers/common').moment;
const expect = chai.expect;

const posting = require('../helpers/posting');
const tests = require('./posts.json');

describe('BorrowBot - Loan Amounts', function describeAmounts() {
  tests.forEach(function testsLoop(post, index) {
    let result = posting.processPost(post);

    it(`should match the borrow amount - [${post.id}]`, function borrowAmntMatch(done) {
      let actual = Number(result.borrow_amnt);
      let expected = Number(post.borrow_amnt);
      expect(actual).to.equal(expected);
      return done();
    });

    it(`should match the repay amount - [${post.id}]`, function repayAmntMatch(done) {
      let actual = Number(result.repay_amnt);
      let expected = Number(post.repay_amnt);
      expect(actual).to.equal(expected);
      return done();
    });

    it(`should match the interest amount - [${post.id}]`, function interestAmntMatch(done) {
      let actual = Number(result.interest);
      let expected = Number(post.interest);
      expect(actual).to.equal(expected);
      return done();
    });
	});
});

describe('BorrowBot - Loan Currency', function describeCurrency() {
  tests.forEach(function testsLoop(post, index) {
    let result = posting.processPost(post);

    it(`should match the currency - [${post.id}]`, function currencyMatch(done) {
      let actual = result.currency;
      let expected = post.currency;
      expect(actual).to.equal(expected);
      return done();
    });
	});
});

describe('BorrowBot - Loan Dates', function describeDates() {
  tests.forEach(function testsLoop(post, index) {
    let result = posting.processPost(post);

    it(`should match the dates - [${post.id}]`, function datesMatch(done) {
      let actual = moment(new Date(result.repay_date)).format("YYYY-MM-DD");
      let expected = moment(new Date(post.repay_date)).format("YYYY-MM-DD");
      if (actual === "1969-12-31"){actual = "Invalid date";}
      expect(actual).to.equal(expected);
      return done();
    });
	});
});
