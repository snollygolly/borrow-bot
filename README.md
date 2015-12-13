# :moneybag: borrow-bot
A data collection bot and website aimed at helping lenders make good choices at [/r/borrow](http://reddit.com/r/borrow).

If you want to use BorrowBot without actually performing all these steps, check out the hosted version at [borrowbot.net](http://borrowbot.net)

## Prerequisites
* Node.js (Version 5 and up recommended)
* MySQL server

## Installation

* Clone down the repository
```
git clone https://github.com/snollygolly/borrow-bot.git
```

* Install packages (from inside the surveyor folder)
```
npm install
```

* Create your config.  There's a `config.json.example` file in the root.  Edit it to include all your values for the database, Reddit, Twilio, and the website.  Save it as `config.json` and leave it in the root.

* Connect to your MySQL server and create a database called `borrow-bot` with the following options
```
Database Encoding: utf8
Database Collation: utf8_general_ci
```

* Create the table schema
```
npm run migrate
```

## Components
There are two main components to BorrowBot.  One is the ingestion bot, and the other is the website.

### Ingestion
The ingestion bot is best run on a cronjob.  Reddit has fairly lax throttling limits, so once a minute is a good interval to run it.  There currently isn't any way to update or create historical records, so BorrowBot will only ever pick up the most recent 25-30.

#### Starting
* To start the ingestion bot, run the following:
```
npm run bot-start
```

#### Testing

The bot also comes with a collection of test posts (posts.json).  These are posts that real users have created, but that the bot initially got wrong when parsing.  We take these posts, manually enter the correct values, and then test the bot's logic against this.

* To move over a single post from the `posts` table to the test posts file (posts.json)
```
npm run bot-import ID
```
_Note: When running `bot-import`, be sure to manually go into the post's record in MySQL and update the borrow, repay, interest, currency, and repay date's values to the correct ones._

* To run all the tests with summarized output AND save the results back (results.json)
```
npm run bot-test-summary
```
_Note: If you've made changes to the test posts file (posts.json) or the BorrowBot logic, please make sure you run `bot-test-summary` before you commit, so you know how effective your changes were._

* To run all the tests with full output
```
npm run bot-test
```

### Site
The website portion is used to take the data the ingestion bot collects and display it in an easy to use interface.

#### Starting
* To start the website, run the following:
```
npm start
```
