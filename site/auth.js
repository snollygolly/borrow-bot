"use strict";

const passport = require('koa-passport');
const config = require('../config.json');

var user = { id: 1, username: 'test' }

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  done(null, user);
});

const RedditStrategy = require('passport-reddit').Strategy
  passport.use(new RedditStrategy({
    clientID: config.site.clientID,
    clientSecret: config.site.clientSecret,
    callbackURL: config.site.host + 'auth/reddit/callback',
    state: true
  },
  function(token, tokenSecret, profile, done) {
    // retrieve user ...
    done(null, user);
  }
));
