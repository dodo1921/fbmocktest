var express = require('express');
var path = require('path');

var bodyParser = require('body-parser');

var index = require('./routes/index');
var users = require('./routes/users');

var app = express();



app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use('/', index);
app.use('/users', users);

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
