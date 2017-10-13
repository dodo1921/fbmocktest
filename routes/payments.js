var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

const request = require('request');

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
    params.TXN_AMOUNT = amount+'.00';
    params.WEBSITE = process.env.WEBSITE;
    params.CUST_ID = fbid;    
    //params.MOBILE_NO = 919005835708;
    //params.EMAIL = 'nvjkfjnvjdfn@nvfvnfn.com';


    ck.genchecksum(params, process.env.MERCHANT_KEY, function(undefined, params ){

    	console.log('ck:'+params.CHECKSUMHASH); 
    	/*
    	console.log('ck:'+params.CHECKSUMHASH); 
    	console.log('MID:'+params.MID); 
    	console.log('orderid:'+params.ORDER_ID); 
    	console.log('industry:'+params.INDUSTRY_TYPE_ID); 
    	console.log('Channel:'+params.CHANNEL_ID); 
    	console.log('txnamt:'+params.TXN_AMOUNT); 
    	console.log('website:'+params.WEBSITE); 
    	console.log('custid:'+params.CUST_ID); 
    	*/

    	//params.REQUEST_TYPE = 'DEFAULT';
    	return res.json(params);

    });

	}).catch(err => {

		next(err);

	});

	

});


router.post('/paytmAck', function(req, res) {	

	

	if(ck.verifychecksum(req.body, process.env.MERCHANT_KEY)){
		console.log('Checksum right');

		knex('payments').where({id: req.body.ORDERID}).select()
		.then(payment => {

				let m = Number(payment[0].money);
				let tm = Number(req.body.TXNAMOUNT);

				if(payment.length>0 && m === tm ){
						console.log('Here');

						let params = {};
						params.MID = process.env.MERCHANT_ID; 
						params.ORDERID = payment[0].id;

						ck.genchecksum(params, process.env.MERCHANT_KEY, function(err, params){

									

									request({
								    uri: 'https://pguat.paytm.com/oltp/HANDLER_INTERNAL/getTxnStatus',								    
								    method: 'POST',
								    json: params								    
								  }, function (error, response, body) {
								  		console.log('Here1');
									    if (!error && response.statusCode == 200) {
									      console.log('Here2');
									      if( body.STATUS === 'TXN_SUCCESS'){
									      	//txn success
									      	console.log('Here3');
									      	txnSuccess(req.body, body, payment[0].fbid);
									      }else if(body.STATUS === 'TXN_FAILURE'){
									      	//txn failure
									      	console.log('Here4');
									      	txnFailure(1, 'Failure' ,req.body, body, payment[0].fbid);
									      }else{
									      	//txn pending
									      	console.log('Here5');
									      	txnPending(req.body.ORDERID);
									      }


									    } else {
									    	//txn pending
									    	console.log('Here6');
									    	txnPending(req.body.ORDERID);
									    }

								  });


				    });					 

				}else{
					//transaction fail
					if(payment.length == 0){
						// no such transaction id
						console.log('Here7');
						txnFailure(0, 'Illegal Transaction Number');
					}else{
						//possible tampering....amount not matching
						console.log('Here8');
						txnFailure(0, 'Received transaction amount does not match');
					}
				}

		}).catch(err => {

				// txn pending
				console.log('Here9');
				txnPending(req.body.ORDERID);
		})

	}else{
			
		// txn fail
		// possible tampering....checksum fail
		console.log('Here10');
		txnFailure(0, 'Checksum mismatch');
	}


	

});


function txnSuccess( req_body, body, fbid){

		console.log('Here11');

		knex.transaction( trx => {

            let p = [];
            let tt;              

            tt = knex('payments').where({id:req_body.ORDERID}).update({
				 			done:1,
				 			STATUS: body.STATUS,
				 			TXNID: req_body.TXNID,
				 			TXNDATE: req_body.TXNDATE,
				 			RESPMSG: req_body.RESPMSG,
				 			RESPCODE: req_body.RESPCODE,
				 			PAYMENTMODE: req_body.PAYMENTMODE,
				 			GATEWAYNAME: req_body.GATEWAYNAME,
				 			CURRENCY: req_body.CURRENCY,
				 			CHECKSUMHASH: req_body.CHECKSUMHASH,
				 			BANKNAME: req_body.BANKNAME,
				 			BANKTXNID: req_body.BANKTXNID
				 		}).transacting(trx);
            p.push(tt);

            tt = knex('users').where({ fbid }).increment('balance', body.TXNAMOUNT).transacting(trx);
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
	  			console.log('Here12');
					return res.render('txn_success');
					//send message to messenger

		}).catch(err => {
				console.log('Here13');
				return res.render('txn_failure', {
					error: 'Error:'+err,
					order_id: req_body.ORDERID
				});
		});

}


function txnFailure(code, msg, req_body, body, fbid){
		console.log('Here14');
		if(code == 0){
			console.log('Here15');	
			res.render('txn_failure', {
					error: msg,
					order_id: undefined
			});

		}else if(code == 1){
				console.log('Here16');
				knex('payments').where({id:req_body.ORDERID}).update({					 			
		 			STATUS: body.STATUS,
		 			TXNID: req_body.TXNID,
		 			TXNDATE: req_body.TXNDATE,
		 			RESPMSG: req_body.RESPMSG,
		 			RESPCODE: req_body.RESPCODE,
		 			PAYMENTMODE: req_body.PAYMENTMODE,
		 			GATEWAYNAME: req_body.GATEWAYNAME,
		 			CURRENCY: req_body.CURRENCY,
		 			CHECKSUMHASH: req_body.CHECKSUMHASH,
		 			BANKNAME: req_body.BANKNAME,
		 			BANKTXNID: req_body.BANKTXNID
		 		}).then( () => {
		 				console.log('Here17');
		 				return res.render('txn_failure', {
		 					error: req_body.RESPMSG,
		 					order_id: req_body.ORDER_ID
		 				});
		 				// send msg
		 		}).catch(err => {
		 				console.log('Here18');
		 				return res.render('txn_failure', {
		 					error: 'Error:'+err,
		 					order_id: req_body.ORDERID
		 				});
		 		});


		}

}


function txnPending(orderid){

		console.log('Here19');
		return res.render('txn_pending', {
			error: 'Pending',
			order_id: orderid
		});
		
}

/*

function afterPaymentStatusCheck(){


		if(req.body.STATUS === 'TXN_SUCCESS'){
		 		//success
		 		console.log('TXN_SUCCESS');

		 		knex.transaction( trx => {

            let p = [];
            let tt;              

            tt = knex('payments').where({id:req.body.ORDERID}).update({
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
		 		console.log('TXN_FAILURE');
		 		knex('payments').where({id:req.body.ORDERID}).update({					 			
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



}

*/




module.exports = router;
