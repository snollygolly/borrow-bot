"use strict";

const config = require('../../config.json');

const model = require('../models/accounts');

let user = null;

module.exports.index = function* index(){
	console.log(this.isAuthenticated());
	if (this.isAuthenticated()) {
		console.log("setting user");
	  user = this.session.passport.user;
	}else{
		console.log("redirecting");
		return this.redirect('/');
	}
	console.log(user);
	let alerts = JSON.parse(user.alerts);
	yield this.render('settings', {title: config.site.name, user: user, alerts: alerts});
}
