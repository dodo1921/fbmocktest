var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

let ck = require('../paytm_utils/checksum');

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


router.post('/submitAmount', function(req, res, next) {

	//paytm stuff

	let fbid = req.body.fbid;
	let amount = req.body.amount;

	knex('payments').returning('id').insert({fbid, money: amount})
	.then( payment => {

		let params = {};
		params.MID = process.env.MERCHANT_ID;
		params.ORDER_ID = payment[0].id;

		console.log('Orderid:'+payment[0].id);
		params.CUST_ID = fbid;
		params.INDUSTRY_TYPE_ID = process.env.INDUSTRY_TYPE;
    params.CHANNEL_ID = process.env.CHANNEL_ID;
    params.TXN_AMOUNT = amount;
    params.WEBSITE = process.env.WEBSITE;
    params.MOBILE_NO = 911010101010;
    params.EMAIL = 'nvjkfjnvjdfn@nvfvnfn.com'


    ck.genchecksum(params, process.env.MERCHANT_KEY, function(undefined, params ){

    	console.log(params.CHECKSUMHASH);
    	return res.json(params);

    });

	}).catch(err => {

		next(err);

	});

	

});


router.post('/paytmAck', function(req, res) {

	let ck = req.body.CHECKSUMHASH;

	console.log(ck);

	return res.render('code_expired');

});



module.exports = router;
