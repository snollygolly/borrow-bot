"use strict";

const config = require('../../config.json');

const model = require('../models/accounts');

let user = null;

module.exports.index = function* index(){
	if (this.isAuthenticated()) {
	  user = this.session.passport.user;
	}else{
		return this.redirect('/');
	}
	yield this.render('settings', {title: config.site.name, user: user});
}
