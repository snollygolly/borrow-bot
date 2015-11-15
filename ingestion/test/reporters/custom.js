"use strict";

const stdin = process.openStdin();

let data = "";

stdin.on('data', function(chunk) {
  data += chunk;
});

stdin.on('end', function() {
  let reportObj = createReport(JSON.parse(data));
  let i = 0;
  console.log(JSON.stringify(reportObj, null, 2));
});

function createReport(jsonObj){
  let returnObj = {};
  returnObj.tests = [];
  returnObj.results = {};

  let i = 0;
  while (i < jsonObj.tests.length){
    // get the title from the mocha title
    let suiteName = jsonObj.tests[i].title.split(" -").shift();
    // check to see if we've seen a test with this suite yet.
    if (returnObj.tests.indexOf(suiteName) === -1){
      // this test isn't captured yet
      returnObj.tests.push(suiteName);
      returnObj.results[suiteName] = {
        pass: 0,
        fail: 0,
        total: 0
      }
    }
    if (jsonObj.tests[i].err.message){
      // there was an error
      returnObj.results[suiteName].fail++;
    }else{
      // there wasn't an error
      returnObj.results[suiteName].pass++;
    }
    returnObj.results[suiteName].total++;
    i++;
  }
  i = 0;
  while (i < returnObj.tests.length){
    returnObj.results[returnObj.tests[i]].perc = Math.round(returnObj.results[returnObj.tests[i]].pass / returnObj.results[returnObj.tests[i]].total * 10000) / 100;
    i++;
  }
  return returnObj;
}
