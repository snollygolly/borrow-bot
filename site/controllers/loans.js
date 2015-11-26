"use strict";

const config = require('../../config.json');

const model = require('../models/loans');

const PER_PAGE_LIMIT = 25;

module.exports.getDashboardPage = function* getDashboardPage(page){
	// because page isn't always supplied
	if (typeof page !== "number"){
		page = 1;
	}
	let start = (page - 1) * PER_PAGE_LIMIT;
	// set it to 1 in case the parsing failed
	if (start <= 0){start = 0;}
	let results = yield model.getAllLoans(start);
	yield this.render('dashboard', {title: config.site.name, results: results, script: "dashboard"});
}

module.exports.getLoan = function* getLoan(id){
	let result = yield model.getOneLoan(id);
  yield this.render('loan', {title: config.site.name, result: result});
}
