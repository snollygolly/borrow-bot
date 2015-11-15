"use strict";

const config = require('./common').config;
const Promise = require('./common').Promise;
const moment = require('./common').moment;
let twilioConfig;
if (config.twilio.enabled === true){
  console.log("*  : Loading: Twilio [Enabled]");
  twilioConfig = {accountSid: config.twilio.accountSid, authToken: config.twilio.authToken};
}else{
  console.log("*  : Loading: Twilio [Disabled]");
  twilioConfig = {accountSid: config.twilio.magicAccountSid, authToken: config.twilio.magicAuthToken};
}
const client = Promise.promisifyAll(require('twilio')(twilioConfig.accountSid, twilioConfig.authToken));
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
      if (post.grade.indexOf(WORTHY_GRADES[i]) !== -1 && post.closed === false){
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
      let bodyMessage = `New loan found: Grade: ${post.grade}, Borrowing: ${post.borrow_amnt}${post.currency}@${post.interest}% for ${post.days} days. Link: reddit.com/r/borrow/${post.id}`;
      let fromNumber = config.twilio.enabled === true ? config.twilio.fromNumber : config.twilio.magicFromNumber;
      let message;
      try {
        message = yield client.messages.create({
          to: config.me.number,
        	from: fromNumber,
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
