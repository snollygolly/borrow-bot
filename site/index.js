"use strict";

const config = require('../config.json');

const koa = require('koa');
const serve = require('koa-static-folder')
const hbs = require('koa-hbs');
const mysql = require('promise-mysql');
const Router = require('koa-router');
const Promise = require('bluebird');
const co = require('co');
// passport requires
const session = require('koa-generic-session');
const bodyParser = require('koa-bodyparser');
const passport = require('koa-passport');

const app = koa();

const testResults = require('../ingestion/test/results.json');

const SITE_NAME = "BorrowBot"
const PER_PAGE_LIMIT = 25;

const routes = new Router();
require('./auth');
require('./helpers/handlebars');

// trust proxy
app.proxy = true;

// sessions
app.keys = [config.site.secret];
app.use(session());

// body parser
app.use(bodyParser());

// authentication
app.use(passport.initialize());
app.use(passport.session());

// statically serve assets
app.use(serve('./assets'));

// load up the handlebars middlewear
app.use(hbs.middleware({
  viewPath: __dirname + '/views',
  layoutsPath: __dirname + '/views/layouts',
  partialsPath: __dirname + '/views/partials',
  defaultLayout: 'main'
}));

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
  yield this.render('index', {title: SITE_NAME});
});

app.use(routes.middleware());

console.log(`${SITE_NAME} is now listening on port ${config.site.port}`);
app.listen(config.site.port);

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
