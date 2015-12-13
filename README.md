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
