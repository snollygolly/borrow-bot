"use strict";

const config = require('../config.json');

const app = require('./index.js').app;
const passport = require('./index.js').passport;
const Router = require('koa-router');
const mysql = require('promise-mysql');
const routes = new Router();

const SITE_NAME = "BorrowBot"
const PER_PAGE_LIMIT = 25;
const testResults = require('../ingestion/test/results.json');

// routes
routes.get('/login', function* (){
  yield this.render('login');
});

routes.get('/logout', function* () {
  this.logout();
  this.redirect('/');
});

routes.get('/auth/reddit',
  passport.authenticate('reddit')
);

routes.get('/auth/reddit/callback',
  passport.authenticate('reddit', {
    successRedirect: '/dashboard',
    failureRedirect: '/'
  })
);

routes.get('/dashboard', function* (){
  let results = yield getLoanResults(0);
  yield this.render('dashboard', {title: SITE_NAME, results: results, script: "dashboard"});
});

routes.get('/dashboard/:page', function* (page){
  let start = (page - 1) * PER_PAGE_LIMIT;
  // set it to 1 in case the parsing failed
  if (start <= 0){start = 0;}
  let results = yield getLoanResults(start);
  yield this.render('dashboard', {title: SITE_NAME, results: results, script: "dashboard"});
});

routes.get('/loan/:id', function* (id){
  let result = yield getLoanResult(id);
  yield this.render('loan', {title: SITE_NAME, result: result});
});

routes.get('/about', function* (){
  yield this.render('about', {title: SITE_NAME, results: testResults.results});
});

routes.get('/', function* (){
  let user;
  if (this.isAuthenticated()) {
    user = this.session.passport.user;
  }else{
    user = null;
  }
  yield this.render('index', {title: SITE_NAME, user: user});
});

app.use(routes.middleware());

// functions start here
function* getLoanResult(id){
  let connection = yield mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
  });
  let result = yield connection.query("SELECT * FROM posts WHERE id = ?;", id);
  return result[0];
}

function* getLoanResults(start){
  let connection = yield mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
  });
  let results = yield connection.query("SELECT * FROM posts WHERE type = 'REQ' AND closed = 0 ORDER BY created DESC limit ?,?;", [start, PER_PAGE_LIMIT]);
  return results;
}
