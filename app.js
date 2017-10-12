var express = require('express');
var path = require('path');
const request = require('request');
var bodyParser = require('body-parser');

var index = require('./routes/index');
var payments = require('./routes/payments');
var mocktest = require('./routes/mocktest');
var leaderboard = require('./routes/leaderboard');

var app = express();


//app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.disable('x-powered-by');

app.use('/', index);
app.use('/payments', payments);
app.use('/mocktest', mocktest);
app.use('/leaderboard', leaderboard);

app.use(express.static(path.join(__dirname, 'public')));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {  
  res.status(err.status || 500);
  res.json({error: true, message: err.message });
});

module.exports = app;
