var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

var router = express.Router();

/* GET users listing. */
router.get('/:recipientId_passcode', function(req, res) {  

		console.log(req.params.recipientId_passcode);

		let sp = req.params.recipientId_passcode.split('_');

		if(sp.length != 2){
			return res.render('code_expired');
		}

		let recipientId = sp[0];
		let passcode = sp[1];

		knex('users').where({fbid: recipientId, passcode}).select()
		.then( user => {

			if(user.length == 0){
				return res.render('code_expired');
			}else{
				return res.render('payment',{recipientId});
			}	

		}).catch(err => {
				return res.render('code_expired');
		});	

		

});


router.post('/submitAmount', function(req, res) {

	//paytm stuff

	return res.json({});

});


router.post('/paytmAck', function(req, res) {

	//paytm stuff

	return res.json({});

});



module.exports = router;
