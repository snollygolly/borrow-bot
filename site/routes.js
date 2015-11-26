"use strict";

const config = require('../config.json');

const app = require('./index.js').app;
const passport = require('./index.js').passport;
const Router = require('koa-router');

const routes = new Router();

const testResults = require('../ingestion/test/results.json');

const loans = require('./controllers/loans.js');

// routes
routes.get('/', function* (){
  let user;
  if (this.isAuthenticated()) {
    user = this.session.passport.user;
  }else{
    user = null;
  }
  yield this.render('index', {title: config.site.name, user: user});
});

routes.get('/about', function* (){
  yield this.render('about', {title: config.site.name, results: testResults.results});
});

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

routes.get('/dashboard', loans.getDashboardPage);
routes.get('/dashboard/:page', loans.getDashboardPage);

routes.get('/loan/:id', loans.getLoan);

app.use(routes.middleware());
