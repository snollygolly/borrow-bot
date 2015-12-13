var Schema = {
  accounts: {
    id: {
      type: 'string',
      maxlength: 11,
      nullable: false,
      primary: true,
      comment: "The user id from reddit"
    },
    username: {
      type: 'string',
      maxlength: 255,
      nullable: false,
      comment: "The username from reddit"
    },
    admin: {
      type: 'boolean',
      nullable: false,
      defaultTo: false,
      comment: "If this person is an admin or not"
    },
    alert_type: {
      type: 'string',
      maxlength: 10,
      nullable: false,
      defaultTo: "none",
      comment: "What type of alert this user would like"
    },
    email: {
      type: 'string',
      maxlength: 255,
      nullable: true,
      comment: "This users email address"
    },
    phone_number: {
      type: 'string',
      maxlength: 50,
      nullable: true,
      comment: "This users phone number"
    },
    grade_aaa: {
      type: 'boolean',
      nullable: false,
      defaultTo: false,
      comment: "Does this person want to be notified for AAA loans"
    },
    grade_aa: {
      type: 'boolean',
      nullable: false,
      defaultTo: false,
      comment: "Does this person want to be notified for AA loans"
    },
    grade_a: {
      type: 'boolean',
      nullable: false,
      defaultTo: false,
      comment: "Does this person want to be notified for A loans"
    },
    grade_b: {
      type: 'boolean',
      nullable: false,
      defaultTo: false,
      comment: "Does this person want to be notified for B loans"
    },
    grade_c: {
      type: 'boolean',
      nullable: false,
      defaultTo: false,
      comment: "Does this person want to be notified for C loans"
    },
    grade_d: {
      type: 'boolean',
      nullable: false,
      defaultTo: false,
      comment: "Does this person want to be notified for D loans"
    },
    grade_f: {
      type: 'boolean',
      nullable: false,
      defaultTo: false,
      comment: "Does this person want to be notified for F loans"
    }
  },
  posts: {
    id: {
      type: 'string',
      maxlength: 11,
      nullable: false,
      primary: true,
      comment: "The post id from reddit"
    },
    type: {
      type: 'string',
      maxlength: 6,
      nullable: false,
      comment: "The type of post it is"
    },
    poster: {
      type: 'string',
      maxlength: 50,
      nullable: false,
      comment: "The user id from reddit"
    },
    score: {
      type: 'decimal',
      precision: 10,
      scale: 2,
      nullable: true,
      comment: "The number score of this loan, higher is better"
    },
    grade: {
      type: 'string',
      maxlength: 5,
      nullable: true,
      comment: "The letter grade of the loan"
    },
    borrow_amnt: {
      type: 'decimal',
      precision: 10,
      scale: 2,
      nullable: true,
      comment: "The amount the bot thinks the loan is asking for"
    },
    repay_amnt: {
      type: 'decimal',
      precision: 10,
      scale: 2,
      nullable: true,
      comment: "The amount the bot thinks the user is willing to repay"
    },
    interest: {
      type: 'decimal',
      precision: 10,
      scale: 2,
      nullable: true,
      comment: "The interest rate the bot thinks the user is offering"
    },
    currency: {
      type: 'string',
      maxlength: 5,
      nullable: true,
      comment: "Which currency the bot thinks the user is using"
    },
    comments: {
      type: 'integer',
      maxlength: 3,
      nullable: false,
      comment: "How many comments the thread had when the bot saw it"
    },
    created: {
      type: 'timestamp',
      nullable: false,
      comment: "What time the post was created"
    },
    found: {
      type: 'timestamp',
      nullable: false,
      comment: "What time the post was found by the bot"
    },
    repay_date: {
      type: 'date',
      nullable: true,
      comment: "What dte the bot thinks the user is intending to pay back the loan in full"
    },
    title: {
      type: 'text',
      nullable: false,
      comment: "The title of the post on reddit"
    },
    body: {
      type: 'text',
      nullable: false,
      comment: "The full body of the post on reddit"
    },
    closed: {
      type: 'boolean',
      nullable: false,
      defaultTo: false,
      comment: "Wether or not the bot thinks this post is closed"
    },
    raw: {
      type: 'text',
      nullable: true,
      comment: "A JSON formatted dump of whats going on inside the bots brain"
    }
  },
  users: {
    reddit_id: {
      type: 'string',
      maxlength: 11,
      nullable: false,
      primary: true,
      comment: "The user id from reddit"
    },
    id: {
      type: 'integer',
      maxlength: 11,
      nullable: false,
      comment: "The loansbot id for this user"
    },
    name: {
      type: 'string',
      maxlength: 50,
      nullable: false,
      comment: "The username for this user"
    },
    loans: {
      type: 'text',
      nullable: false,
      comment: "A full JSON loan output for this user"
    },
    found: {
      type: 'datetime',
      nullable: false,
      comment: "When was the last time we found this user"
    },
    karma: {
      type: 'integer',
      maxlength: 11,
      nullable: false,
      comment: "How much combined karma this user has"
    },
    age: {
      type: 'integer',
      maxlength: 11,
      nullable: false,
      comment: "How old is this user, in days"
    }
  }
};
module.exports = Schema;
