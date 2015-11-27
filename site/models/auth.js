"use strict";

const passport = require('../index.js').passport;
const config = require('../../config.json');
const model = require('./accounts');
const co = require('co');

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
  function (token, tokenSecret, profile, done) {
    // retrieve user ...
    co(function *(){
      let account = yield model.getAccount(profile.id);
      if (!account){
        let result = yield model.createAccount(profile);
        account = profile;
      }
      done(null, account);
    }).catch(function onError(e){
      console.error("Something went terribly wrong!");
      console.error(e.stack);
      done(e, null);
    });

  }
));
