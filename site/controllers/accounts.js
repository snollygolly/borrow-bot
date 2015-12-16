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
	// they passed the tests, let's touch up the object
	let modifiedAccount = this.request.body;
	modifiedAccount.id = user.id;
	let result = yield model.modifyAccount(modifiedAccount);
	return this.response.body = {message: "Successful!", result: result}
}
