"use strict";

const config = require('../config.json');

const koa = require('koa');
const serve = require('koa-static-folder')
const hbs = require('koa-hbs');
const router = require('koa-router');
// passport requires
const session = require('koa-generic-session');
const bodyParser = require('koa-bodyparser');
const passport = require('koa-passport');

const app = koa();
exports.app = app;
exports.passport = passport;

require('./models/auth');
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

require('./routes');

console.log(`BorrowBot is now listening on port ${config.site.port}`);
app.listen(config.site.port);
