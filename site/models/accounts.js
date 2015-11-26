"use strict";

const config = require('../../config.json');

const mysql = require('promise-mysql');

module.exports.getUser = function* getUser(username){
	const connection = yield mysql.createConnection({
		host: config.db.host,
		user: config.db.user,
		password: config.db.password,
		database: config.db.database
	});
	let results = yield connection.query("SELECT * FROM accounts WHERE username = ?;", username);
	return results[0];
}
