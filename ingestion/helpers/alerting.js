"use strict";

const config = require('./common').config;
const Promise = require('./common').Promise;
const moment = require('./common').moment;
const createConnection = require('./common').createConnection;

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
    // if there's not a grade, don't bother
    if (!post.grade){return false;}
    // if the post is closed, don't bother
    if (!post.closed){return false;}
    // get all the accounts we have
    let accounts = yield getAccounts();
    // for every person who wants alerts...
    for (let account of accounts){
      let grade = `grade_${String(post.grade).toLowerCase()}`;
      // see if they want to be alerted for this grade of loan
      if (account[grade] === 1){
        switch (account.alert_type){
          case "sms":
            console.log(`** : Sending Alert (${account.alert_type} - ${account.phone_number})!`);
            yield sendSMS(post, account);
            break;
          case "email":
            console.log(`** : Sending Alert (${account.alert_type} - ${account.email})!`);
            // TODO: add me too :)
            break;
        }
      }
    }

    function* sendSMS (post, account){
      if (!post.repay_date){
        post.days = "?";
      }else{
        post.days = moment(post.repay_date, "YYYY-MM-DD").diff(moment(), "days");
      }
      if (!post.interest){
        post.interest = "?";
      }
      let bodyMessage = `New loan found: Grade: ${post.grade}, Borrowing: ${post.borrow_amnt}${post.currency}@${post.interest}% for ${post.days} days. Link: borrowbot.net/loan/${post.id}`;
      let fromNumber = config.twilio.enabled === true ? config.twilio.fromNumber : config.twilio.magicFromNumber;
      let message;
      try {
        message = yield client.messages.create({
          to: account.phone_number,
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

    function* sendEmail (post, account){
      // TODO: add this :)
    }

    function* getAccounts(){
      const connection = yield createConnection();
      return yield connection.query(`SELECT * FROM accounts WHERE alert_type != 'none';`);
    }
  }
};
