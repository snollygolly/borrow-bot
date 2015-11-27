"use strict";

const config = require('../../config.json');

const mysql = require('promise-mysql');

module.exports.getAccount = function* getAccount(id){
	const connection = yield mysql.createConnection({
		host: config.db.host,
		user: config.db.user,
		password: config.db.password,
		database: config.db.database
	});
	let results = yield connection.query("SELECT * FROM accounts WHERE id = ?;", id);
	return results[0];
};

module.exports.createAccount = function* createAccount(profile){
	const connection = yield mysql.createConnection({
		host: config.db.host,
		user: config.db.user,
		password: config.db.password,
		database: config.db.database
	});
	let results = yield connection.query("INSERT INTO accounts (id, username, alerts) VALUES (?, ?, '[]');", [profile.id, profile.name]);
	return results;
};
