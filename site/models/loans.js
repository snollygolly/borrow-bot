"use strict";

const config = require('../../config.json');

const mysql = require('promise-mysql');

const PER_PAGE_LIMIT = 25;

module.exports.getAllLoans = function* getAllLoans(start){
	const connection = yield mysql.createConnection({
		host: config.db.host,
		user: config.db.user,
		password: config.db.password,
		database: config.db.database
	});
	let results = yield connection.query("SELECT * FROM posts WHERE type = 'REQ' AND closed = 0 ORDER BY created DESC limit ?,?;", [start, config.site.perPageLimit]);
	return results;
}

module.exports.getOneLoan = function* getOneLoan(id){
	const connection = yield mysql.createConnection({
		host: config.db.host,
		user: config.db.user,
		password: config.db.password,
		database: config.db.database
	});
	let result = yield connection.query("SELECT * FROM posts WHERE id = ?;", id);
	return result[0];
}
