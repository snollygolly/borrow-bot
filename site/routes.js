"use strict";

const config = require('../config.json');

const app = require('./index.js').app;
const passport = require('./index.js').passport;
const Router = require('koa-router');

const routes = new Router();

const testResults = require('../ingestion/test/results.json');

const loans = require('./controllers/loans.js');
const accounts = require('./controllers/accounts.js');

// routes
let user = null;

routes.get('/', function* (){
  if (this.isAuthenticated()) {
    user = this.session.passport.user;
  }
  yield this.render('index', {title: config.site.name, user: user});
});

routes.get('/about', function* (){
  if (this.isAuthenticated()) {
    user = this.session.passport.user;
  }
  yield this.render('about', {title: config.site.name, results: testResults.results, user: user});
});

routes.get('/login', function* (){
  if (this.isAuthenticated()) {
    user = this.session.passport.user;
  }
  yield this.render('login', {user: user});
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
    successRedirect: '/settings',
    failureRedirect: '/'
  })
);

routes.get('/settings', accounts.index);
routes.put('/account', accounts.updateAccount);

routes.get('/dashboard', loans.getDashboardPage);
routes.get('/dashboard/:page', loans.getDashboardPage);

routes.get('/loan/:id', loans.getLoan);

app.use(routes.middleware());
