var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

let ck = require('../paytm_utils/checksum');

var router = express.Router();

/* GET users listing. */

router.post('/login', function(req, res) {  

		console.log('Password:'+req.body.password);

		if(req.body.password === 'mocktest')
			return res.render('payment',{recipientId: 19841984 });
		else
			return res.render('index');
		

});

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
		params.ORDER_ID = payment[0];		
		params.INDUSTRY_TYPE_ID = process.env.INDUSTRY_TYPE;
    params.CHANNEL_ID = process.env.CHANNEL_ID;
    params.TXN_AMOUNT = amount;
    params.WEBSITE = process.env.WEBSITE;
    params.CUST_ID = fbid;    
    //params.MOBILE_NO = 919005835708;
    //params.EMAIL = 'nvjkfjnvjdfn@nvfvnfn.com';


    ck.genchecksum(params, process.env.MERCHANT_KEY, function(undefined, params ){

    	console.log('ck:'+params.CHECKSUMHASH); 
    	console.log('MID:'+params.MID); 
    	console.log('orderid:'+params.ORDER_ID); 
    	console.log('industry:'+params.INDUSTRY_TYPE_ID); 
    	console.log('Channel:'+params.CHANNEL_ID); 
    	console.log('txnamt:'+params.TXN_AMOUNT); 
    	console.log('website:'+params.WEBSITE); 
    	console.log('custid:'+params.CUST_ID); 
    	

    	//params.REQUEST_TYPE = 'DEFAULT';
    	return res.json(params);

    });

	}).catch(err => {

		next(err);

	});

	

});


router.post('/paytmAck', function(req, res) {	

	let params = {};
	params.MID = req.body.MID;
	params.ORDER_ID = req.body.ORDERID;
	params.INDUSTRY_TYPE_ID = process.env.INDUSTRY_TYPE;
  params.CHANNEL_ID = process.env.CHANNEL_ID;
  params.TXN_AMOUNT = req.body.TXNAMOUNT;
  params.WEBSITE = process.env.WEBSITE;
  params.CUST_ID = '1780356611992751';

  //console.log('Customer id:'+req.body.CUST_ID);
  //params.MOBILE_NO = 911010101010;
  //params.EMAIL = 'nvjkfjnvjdfn@nvfvnfn.com';
	params.CHECKSUMHASH = req.body.CHECKSUMHASH;

	console.log('ck:'+params.CHECKSUMHASH); 
	console.log('MID:'+params.MID); 
	console.log('orderid:'+params.ORDER_ID); 
	console.log('industry:'+params.INDUSTRY_TYPE_ID); 
	console.log('Channel:'+params.CHANNEL_ID); 
	console.log('txnamt:'+params.TXN_AMOUNT); 
	console.log('website:'+params.WEBSITE); 
	console.log('custid:'+params.CUST_ID); 

	if(ck.verifychecksum(params, process.env.MERCHANT_KEY)){
		console.log('Checksum right');

		knex('payments').where({id: req.body.ORDER_ID}).select()
		.then(payment => {

				if(payment.length>0 && payment[0].money === req.body.TXNAMOUNT){
					 if(req.body.STATUS === 'TXN_STATUS'){
					 		//success

					 		knex.transaction( trx => {

		              let p = [];
		              let tt;              

		              tt = knex('payments').where({id:req.body.ORDER_ID}).update({
							 			done:1,
							 			STATUS: req.body.STATUS,
							 			TXNID: req.body.TXNID,
							 			TXNDATE: req.body.TXNDATE,
							 			RESPMSG: req.body.RESPMSG,
							 			RESPCODE: req.body.RESPCODE,
							 			PAYMENTMODE: req.body.PAYMENTMODE,
							 			GATEWAYNAME: req.body.GATEWAYNAME,
							 			CURRENCY: req.body.CURRENCY,
							 			CHECKSUMHASH: req.body.CHECKSUMHASH,
							 			BANKNAME: req.body.BANKNAME,
							 			BANKTXNID: req.body.BANKTXNID
							 		}).transacting(trx);
		              p.push(tt);

		              tt = knex('users').where({ fbid: payment[0].fbid }).increment('balance', req.body.TXNAMOUNT).transacting(trx);
		              p.push(tt);         

		                

		              Promise.all(p)
		              .then( values => {

		                for( let i=0; i<values.length; i++ ){
		                  console.log('Promise>>>>>>>'+values[i]);                  
		                  if(values[i] == 0 ){                  
		                    throw new Error('Transaction failed');
		                  }
		                }
		                             

		              })
		              .then(trx.commit)
		              .catch(trx.rollback)


		          }).then( () => {
					 				res.render('txn_success');
					 		}).catch(err => {
					 				res.render('txn_failure', {
					 					error: 'Error '+err,
					 					order_id: req.body.ORDER_ID
					 				});
					 		});


					 		

					 }else if(req.body.STATUS === 'TXN_FAILURE'){
					 		//failure
					 		knex('payments').where({id:req.body.ORDER_ID}).update({					 			
					 			STATUS: req.body.STATUS,
					 			TXNID: req.body.TXNID,
					 			TXNDATE: req.body.TXNDATE,
					 			RESPMSG: req.body.RESPMSG,
					 			RESPCODE: req.body.RESPCODE,
					 			PAYMENTMODE: req.body.PAYMENTMODE,
					 			GATEWAYNAME: req.body.GATEWAYNAME,
					 			CURRENCY: req.body.CURRENCY,
					 			CHECKSUMHASH: req.body.CHECKSUMHASH,
					 			BANKNAME: req.body.BANKNAME,
					 			BANKTXNID: req.body.BANKTXNID
					 		}).then( () => {
					 				res.render('txn_failure', {
					 					error: req.body.RESPMSG,
					 					order_id: req.body.ORDER_ID
					 				});
					 		}).catch(err => {
					 				res.render('txn_failure', {
					 					error: 'Database error',
					 					order_id: req.body.ORDER_ID
					 				});
					 		});

					 }else if (req.body.STATUS === 'PENDING' || req.body.STATUS === 'OPEN' ){
					 		// try again to get conformation
					 		res.render('txn_pending', {
					 			status: req.body.STATUS
					 		});

					 }

				}else{

					//transaction fail

				}

		}).catch(err => {


		})

	}else{
		console.log('Checksum wrong');
		res.render('txn_failure', {
			error: 'Database error',
			order_id: req.body.ORDER_ID
		});		

	}


	

});



module.exports = router;
