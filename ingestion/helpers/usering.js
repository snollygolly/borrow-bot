"use strict";

const config = require('./common').config;
const rp = require('./common').rp;
const moment = require('./common').moment;
const createConnection = require('./common').createConnection;
const reddit = require('./common').reddit;

//user consts
// how long to cache users for
const USER_CACHE = 7;

module.exports = {
  getUser: function* getUser(user){
    // first do a search for the user, since we can't get his ID from reddit.
    const connection = yield createConnection();
    let userResults = yield connection.query(`SELECT * FROM users WHERE name = '${user}';`);
    if (userResults[0]){
      // username found, check the cache and if it's fresh, return from cache
      let todayMoment = moment().format("YYYY-MM-DD HH:mm:ss");
      let foundMoment = moment(new Date(userResults[0].found)).format("YYYY-MM-DD HH:mm:ss");
      let foundFutureMoment = moment(new Date(userResults[0].found)).add(USER_CACHE, "days").format("YYYY-MM-DD HH:mm:ss");
      if (moment(todayMoment).isAfter(foundFutureMoment) === true){
        //this cache is stale, so do nothing
        console.log(`** : Cache for ${user} is stale`);
        yield connection.query(`DELETE FROM users WHERE name = '${user}';`);
      }else{
        console.log(`*  : Cache for ${user} is fresh`);
        return userResults[0];
      }
    }
    //set up user object for returning
    var userObj = {};
    let userResult = yield reddit('/user/' + user + '/about').get();
    userObj.reddit_id = userResult.data.id;
    userObj.karma = userResult.data.link_karma + userResult.data.comment_karma;
    userObj.age = moment().diff(moment.unix(userResult.data.created).local(), "days");
    // get information from reddit loans
    let options = {
      method: "POST",
      uri: "https://redditloans.com/api/users/show.json",
      body: {
        usernames: user
      },
      rejectUnauthorized: false,
      json: true
    };
    let userPage = yield rp(options);
    if (userPage[0].errors){
      // something went wrong, this user doesn't exist, create a mock
      userObj.id = 0;
      userObj.name = user;
      userObj.loans = JSON.stringify([], null, 2);
    }else{
      userObj.id = userPage[0].id;
      userObj.name = userPage[0].usernames[0].username;
      userObj.loans = JSON.stringify(userPage[0].loans, null, 2);
    }
    userObj.found = moment().local().format("YYYY-MM-DD HH:mm:ss");
    console.log(`** : Storing user ${userObj.name} into DB`)
    yield connection.query('INSERT INTO users SET ?', userObj);
    return userObj;
  }
};
