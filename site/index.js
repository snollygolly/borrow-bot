"use strict";

const config = require('../config.json');
const koa = require('koa');
const serve = require('koa-static-folder')
const hbs = require('koa-hbs');
const route = require('koa-route');
const Promise = require('bluebird');
const co = require('co');
const app = koa();

const SITE_NAME = "BorrowBot"

// statically serve assets
app.use(serve('./assets'));

// load up the handlebars middlewear
app.use(hbs.middleware({
  viewPath: __dirname + '/views',
  layoutsPath: __dirname + '/views/layouts',
  partialsPath: __dirname + '/views/partials',
  defaultLayout: 'main'
}));

// example date middlewear
app.use(function *(next){
  let start = new Date;
  yield next;
  let ms = new Date - start;
  console.log('%s %s - %s', this.method, this.url, ms);
});

// routes
app.use(route.get('/', function *(){
  yield this.render('index', {title: SITE_NAME});
}));

console.log(`${SITE_NAME} is now listening on port ${config.site.port}`);
app.listen(config.site.port);
