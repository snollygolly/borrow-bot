"use strict";
// bring in the config
exports.config = require('../../config.json');
exports.Promise = require('bluebird');
exports.co = require('co');
exports.moment = require('moment');
exports.rp = require('request-promise');

// Our new instance associated with a single account.
// It takes in various configuration options.
// bring in packages
const Snoocore = require('snoocore');
exports.reddit = new Snoocore({
  userAgent: '/u/snollygolly borrow-bot@0.1', // unique string identifying the app
  oauth: {
    type: 'script',
    key: exports.config.auth.key, // OAuth client key (provided at reddit app)
    secret: exports.config.auth.secret, // OAuth secret (provided at reddit app)
    username: exports.config.auth.username, // Reddit username used to make the reddit app
    password: exports.config.auth.password, // Reddit password for the username
    // The OAuth scopes that we need to make the calls that we
    // want. The reddit documentation will specify which scope
    // is needed for evey call
    scope: [ 'identity', 'read', 'vote', 'flair' ]
  }
});

exports.fs = exports.Promise.promisifyAll(require('fs'));

const mysql = require('promise-mysql');
exports.createConnection = createConnection;

function createConnection(){
  return mysql.createConnection({
      host: exports.config.db.host,
      user: exports.config.db.user,
      password: exports.config.db.password,
      database: exports.config.db.database
  });
}

function onerror(err) {
  // log any uncaught errors
  // co will not throw any errors you do not handle!!!
  // HANDLE ALL YOUR ERRORS!!!
  console.error(err.stack);
  console.log("***: Dying...");
  return process.exit();
}
