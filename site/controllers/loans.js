"use strict";

const config = require('../../config.json');

const model = require('../models/loans');

let user = null;

module.exports.getDashboardPage = function* getDashboardPage(){
	if (this.isAuthenticated()) {
	  user = this.session.passport.user;
	}
	let page = this.params.page;
	// because page isn't always supplied
	if (typeof page !== "number"){
		page = 1;
	}
	let start = (page - 1) * config.site.perPageLimit;
	// set it to 1 in case the parsing failed
	if (start <= 0){start = 0;}
	let results = yield model.getAllLoans(start);
	yield this.render('dashboard', {title: config.site.name, results: results, script: "dashboard", user: user});
}

module.exports.getLoan = function* getLoan(){
	if (this.isAuthenticated()) {
	  user = this.session.passport.user;
	}
	let id = this.params.id;
	let result = yield model.getOneLoan(id);
  yield this.render('loan', {title: config.site.name, result: result, user: user});
}
