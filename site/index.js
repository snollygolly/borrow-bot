"use strict";

const config = require('../config.json');

const koa = require('koa');
const serve = require('koa-static-folder')
const hbs = require('koa-hbs');
const mysql = require('promise-mysql');
const route = require('koa-route');
const Promise = require('bluebird');
const co = require('co');
const app = koa();

const testResults = require('../ingestion/test/results.json');

const SITE_NAME = "BorrowBot"
const PER_PAGE_LIMIT = 25;

// statically serve assets
app.use(serve('./assets'));

// load up the handlebars middlewear
app.use(hbs.middleware({
  viewPath: __dirname + '/views',
  layoutsPath: __dirname + '/views/layouts',
  partialsPath: __dirname + '/views/partials',
  defaultLayout: 'main'
}));

require('./helpers/handlebars');

// example date middlewear
app.use(function *(next){
  let start = new Date;
  yield next;
  let ms = new Date - start;
  console.log('%s %s - %s', this.method, this.url, ms);
});

// routes
app.use(route.get('/dashboard', function *(){
  let results = yield getLoanResults(0);
  yield this.render('dashboard', {title: SITE_NAME, results: results, script: "dashboard"});
}));

app.use(route.get('/dashboard/:page', function *(page){
  let start = (page - 1) * PER_PAGE_LIMIT;
  // set it to 1 in case the parsing failed
  if (start <= 0){start = 0;}
  let results = yield getLoanResults(start);
  yield this.render('dashboard', {title: SITE_NAME, results: results, script: "dashboard"});
}));

app.use(route.get('/about', function *(){
  yield this.render('about', {title: SITE_NAME, results: testResults.results});
}));

app.use(route.get('/', function *(){
  yield this.render('index', {title: SITE_NAME});
}));

console.log(`${SITE_NAME} is now listening on port ${config.site.port}`);
app.listen(config.site.port);

// functions start here

function* getLoanResults(start){
  let connection = yield mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
  });
  let results = connection.query(`SELECT * FROM posts WHERE type = "REQ" AND closed = 0 ORDER BY created DESC limit ${start},${PER_PAGE_LIMIT};`)
  return results;
}
