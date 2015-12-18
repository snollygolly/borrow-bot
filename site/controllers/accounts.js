"use strict";

const config = require('../../config.json');

const model = require('../models/accounts');

let user = null;

module.exports.index = function* index(){
	if (this.isAuthenticated()) {
		// TODO: fix the user fetching to be better
		user = yield model.getAccount(this.session.passport.user.id);
	  this.session.passport.user = user;
	}else{
		return this.redirect('/');
	}
	yield this.render('settings', {title: config.site.name, user: user, script: "settings"});
}

module.exports.updateAccount = function* updateAccount(){
	if (this.isAuthenticated()) {
		// TODO: fix the user fetching to be better
		user = yield model.getAccount(this.session.passport.user.id);
		this.session.passport.user = user;
	}else{
		return this.redirect('/');
	}
	if (!this.request.body.id){
		// they didn't provide an id, maybe tampering?
		return this.response.body = {error: "You must submit a valid account."};
	}
	if (this.request.body.id !== user.id){
		// they provided an id that didn't match theirs, naughty naughty
		return this.response.body = {error: "You must submit a valid account."};
	}
	// do some checks to make sure we're not going overboard with the alerting
	// they passed the tests, let's touch up the object
	let modifiedAccount = this.request.body;
	// check to see if the alerting is in order
	let grades = countGrades(modifiedAccount);
	console.log("grades: ", grades);
	console.log(grades.length);
	if (grades.length > 3){
		return this.response.body = {error: "You can only chose three grades to be alerted on."};
	}
	modifiedAccount.id = user.id;
	let result = yield model.modifyAccount(modifiedAccount);
	return this.response.body = {message: "Successful!", result: result}

	function countGrades(account){
		let totalGrades = ["aaa", "aa", "a", "b", "c", "d", "f"];
		let chosenGrades = [];
		for (let grade of totalGrades){
			let gradeName = `grade_${grade}`;
			console.log("checking account[" + gradeName + "]");
			console.log(account[gradeName]);
			if (parseInt(account[gradeName]) === 1){
				console.log("match");
				chosenGrades.push(grade);
			}else{
				console.log("no match");
			}
		}
		console.log("returning:", chosenGrades);
		return chosenGrades;
	}
}
