"use strict";

const config = require('./common').config;
const Promise = require('./common').Promise;
const moment = require('./common').moment;
const client = Promise.promisifyAll(require('twilio')(config.twilio.accountSid, config.twilio.authToken));

//user consts
// decide at which grade(s) to alert on
const WORTHY_GRADES = ["AAA", "AA"];
// decide how you'd like to be alerted
const ALERT_TYPE = "sms";
// who this alert goes to
const ALERT_RCPT = config.me.number;

module.exports = {
  handleAlerts: function* handleAlerts(post){
    if (!post.grade){return;}
    let i = 0;
    while (i < WORTHY_GRADES.length){
      if (post.grade.indexOf(WORTHY_GRADES[i]) !== -1){
        // this post has that grade, alert!
        console.log("** : Sending Alert!");
        yield sendAlert(post);
        break;
      }
      i++;
    }

    function* sendAlert (post){
      if (!post.repay_date){
        post.days = "?";
      }else{
        post.days = moment(post.repay_date, "YYYY-MM-DD").diff(moment(), "days");
      }
      if (!post.interest){
        post.interest = "?";
      }
      var bodyMessage = `New loan found: Grade: ${post.grade}, Borrowing: ${post.borrow_amnt}${post.currency}@${post.interest}% for ${post.days} days. Link: reddit.com/r/borrow/${post.id}`;
      try {
        var message = yield client.messages.create({
          to: config.me.number,
        	from: config.twilio.fromNumber,
          body: bodyMessage
        });
      }catch (err){
        console.log("***: Twilio threw an error");
        console.error(err);
        throw err
      }
      console.log("** : Alerted successfully: " + message.sid);
    }
  }
};
