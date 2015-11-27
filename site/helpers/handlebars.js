"use strict";

const hbs = require('koa-hbs');
const moment = require('moment');

hbs.registerHelper('if_eq', function(a, b, opts) {
  if(a == b) // Or === depending on your needs
    return opts.fn(this);
  else
    return opts.inverse(this);
});

hbs.registerHelper('copyright_year', function(opts) {
  return new Date().getFullYear();
});

hbs.registerHelper('currency_symbol', function(currency) {
  switch (currency){
    case "USD":
      return new hbs.SafeString("&dollar;");
      break;
    case "CAD":
      return new hbs.SafeString("C&dollar;");
      break;
    case "GBP":
      return new hbs.SafeString("&pound;");
      break;
    case "EUR":
      return new hbs.SafeString("&euro;");
      break;
  }
});

hbs.registerHelper('pretty_date', function(dateStr) {
  if (dateStr !== null){
    return moment(dateStr).format("ddd MMM Do YYYY");
  }else{
    return 'Unknown';
  }
});

hbs.registerHelper('pretty_elapsed', function(dateStr) {
  return moment(dateStr).fromNow();
});

hbs.registerHelper('pretty_difference', function(created, found) {
  let createdMoment = moment(created);
  let foundMoment = moment(found);
  return createdMoment.to(foundMoment);
});

hbs.registerHelper('grade_class', function(grade) {
  switch (grade){
    case "AAA":
    case "AA":
    case "A":
      return "success";
      break;
    case "B":
    case "C":
      return "warning";
      break;
    case "D":
    case "F":
      return "danger";
      break;
    default:
      return "default";
  }
});

hbs.registerHelper('in_array_checkbox', function(needle, haystack) {
  if (haystack.indexOf(needle) >= 0){
    return "checked";
  }else{
    return "";
  }
});

hbs.registerHelper('length', function(arr) {
  return arr.length;
});
