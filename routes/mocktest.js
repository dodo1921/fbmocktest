var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

let ck = require('../paytm_utils/checksum');

var router = express.Router();

/* GET users listing. */

router.post('/main', function(req, res) {  

		console.log('Password:'+req.body.password);		
		return res.render('mocktest/main');
		

});


router.post('/signup', function(req, res) {  

		//console.log('Password:'+req.body.password);		
		return res.render('mocktest/signup');
		

});


router.post('/test', function(req, res) {  

		//console.log('Password:'+req.body.password);		
		return res.render('mocktest/test');
		

});

router.post('/report', function(req, res) {  

		//console.log('Password:'+req.body.password);		
		return res.render('mocktest/report');
		

});


router.post('/pay', function(req, res) {  

		//console.log('Password:'+req.body.password);		
		return res.render('mocktest/profile');
		

});





module.exports = router;
