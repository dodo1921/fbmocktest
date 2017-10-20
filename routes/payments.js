var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

const request = require('request');

let ck = require('../paytm_utils/checksum');

let retrytime = 300000;

//let request_status_uri = 'https://pguat.paytm.com/oltp/HANDLER_INTERNAL/getTxnStatus';
let request_status_uri = 'https://secure.paytm.in/oltp/HANDLER_INTERNAL/getTxnStatus';

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
    params.MOBILE_NO = 919005835708;
    params.EMAIL = 'nvjkfjnvjdfn@nvfvnfn.com';
    params.CALLBACK_URL = 'https://fbmocktest.herokuapp.com/payments/paytmAck';


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

									
									let u = request_status_uri+'?JsonData='+encodeURIComponent(JSON.stringify(params)); 
									console.log('>>>>'+u);	
									request( u , function (error, response, body) {
								  		console.log('Here1:'+body+'::::'+error);
									    if (!error && response.statusCode == 200) {
									      console.log('Here2:'+body);
									      body = JSON.parse(body);
									      if( body.STATUS === 'TXN_SUCCESS'){
									      	//txn success
									      	console.log('Here3');
									      	txnSuccess(res, req.body, body, payment[0].fbid);
									      }else if(body.STATUS === 'TXN_FAILURE'){
									      	//txn failure
									      	console.log('Here4');
									      	txnFailure(res, 1, 'Failure' ,req.body, body, payment[0].fbid);
									      }else{
									      	//txn pending
									      	console.log('Here5');
									      	txnPending(res, req.body.ORDERID);
									      }


									    } else {
									    	//txn pending
									    	console.log('Here6');
									    	txnPending(res, req.body.ORDERID);
									    }

								  });


				    });					 

				}else{
					//transaction fail
					if(payment.length == 0){
						// no such transaction id
						console.log('Here7');
						txnFailure(res, 0, 'Illegal Transaction Number');
					}else{
						//possible tampering....amount not matching
						console.log('Here8');
						txnFailure(res, 0, 'Received transaction amount does not match');
					}
				}

		}).catch(err => {

				// txn pending
				console.log('Here9');
				txnPending(res, req.body.ORDERID);
		})

	}else{
			
		// txn fail
		// possible tampering....checksum fail
		console.log('Here10');
		txnFailure(res, 0, 'Checksum mismatch');
	}


	

});


function txnSuccess( res, req_body, body, fbid){

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
				 			//CHECKSUMHASH: req_body.CHECKSUMHASH,
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

	  			let messageData = {
				    recipient: {
				      id: fbid
				    },
				    message:{    
				      text: 'Transaction Successful.\nTransaction ID: '+req_body.ORDERID+'\nBalance updated.',
				      quick_replies:[
				          {
				            content_type:"text",
				            title:"Start Test",
				            payload:"<START TEST>"        
				          },
				          {
				            content_type:"text",
				            title:"Add Money",
				            payload:"<ADD MONEY>"        
				          },          
				          {
				            content_type:"text",
				            title:"Score",
				            payload:"<SCORE>"        
				          }
				      ]					      
				    }
				  }; 

				  callSendAPI(messageData);


					return res.render('txn_success', {
						order_id: req_body.ORDERID
					});
					//send message to messenger
					

		}).catch(err => {
				console.log('Here13');
				return res.render('txn_failure', {
					error: 'Error:'+err,
					order_id: req_body.ORDERID
				});
		});

}


function txnFailure(res, code, msg, req_body, body, fbid){
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
		 			//CHECKSUMHASH: req_body.CHECKSUMHASH,
		 			BANKNAME: req_body.BANKNAME,
		 			BANKTXNID: req_body.BANKTXNID
		 		}).then( () => {
		 				console.log('Here17');

		 				let messageData = {
					    recipient: {
					      id: fbid
					    },
					    message:{    
					      text: 'Transaction Failed.\nTransaction ID: '+req_body.ORDERID,
					      quick_replies:[
					          {
					            content_type:"text",
					            title:"Start Test",
					            payload:"<START TEST>"        
					          },
					          {
					            content_type:"text",
					            title:"Add Money",
					            payload:"<ADD MONEY>"        
					          },          
					          {
					            content_type:"text",
					            title:"Score",
					            payload:"<SCORE>"        
					          }
					      ]			      
					    }
					  }; 

					  callSendAPI(messageData);

		 				return res.render('txn_failure', {
		 					error: req_body.RESPMSG,
		 					order_id: req_body.ORDERID
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


function txnPending(res, orderid){

		console.log('Here19');

		setTimeout(function(){ 
			txnPoll(orderid); 
		}, retrytime); 

		return res.render('txn_pending', {
			error: 'Pending',
			order_id: orderid
		});

}


function txnPoll(orderid){

	knex('payments').where({id: orderid}).select()
	.then(payment => {

			if(payment.length>0){

						let params = {};
						params.MID = process.env.MERCHANT_ID; 
						params.ORDERID = payment[0].id;

						ck.genchecksum(params, process.env.MERCHANT_KEY, function(err, params){

									let u = request_status_uri+'?JsonData='+encodeURIComponent(JSON.stringify(params)); 
									console.log('>>>>'+u);	

									request(u, function (error, response, body) {
								  		console.log('Herep1');

									    if (!error && response.statusCode == 200) {
									    	console.log('Herep2:'+body+':::error'+error);
									      body = JSON.parse(body);									      
									      if( body.STATUS === 'TXN_SUCCESS'){
									      	//txn success
									      	console.log('Herep3');
									      	txnSuccessAfterPending(body, payment[0].fbid);
									      }else if(body.STATUS === 'TXN_FAILURE'){
									      	//txn failure
									      	console.log('Herep4');
									      	txnFailureAfterPending(body, payment[0].fbid);
									      }else{
									      	//txn pending
									      	console.log('Herep5');
									      	let c = payment[0].retry;
									      	c++;
									      	if(c<10){
										      	setTimeout(function(){ 
															txnPoll(orderid); 
														}, retrytime*Math.pow(2, c ));
													}	

													knex('payments').where({id: orderid}).increment('retry', 1).then(()=>{}).catch(err=>{});

									      }


									    } else {
									    	
									    	console.log('Herep6'+error);
									    	let c = payment[0].retry;
								      	c++;
								      	if(c<10){
									      	setTimeout(function(){ 
														txnPoll(orderid); 
													}, retrytime*Math.pow(2, c ));
												}	

												knex('payments').where({id: orderid}).increment('retry', 1).then(()=>{}).catch(err=>{});
									    }

								  });


				    });

			}

					

			

	})
	.catch(err => {

			let c = payment[0].retry;
    	c++;

    	if(c<10){
	    	setTimeout(function(){ 
					txnPoll(orderid); 
				}, retrytime);
	    }	
			knex('payments').where({id: orderid}).increment('retry', 1).then(()=>{}).catch(err=>{});

	});

}


function txnSuccessAfterPending(body, fbid){
		console.log('Herep11');
		knex.transaction( trx => {

            let p = [];
            let tt;              

            tt = knex('payments').where({id:body.ORDERID}).update({
				 			done:1,
				 			STATUS: body.STATUS,
				 			TXNID: body.TXNID,
				 			TXNDATE: body.TXNDATE,
				 			RESPMSG: body.RESPMSG,				 			
				 			PAYMENTMODE: body.PAYMENTMODE,
				 			GATEWAYNAME: body.GATEWAYNAME,			 			
				 			BANKNAME: body.BANKNAME,
				 			BANKTXNID: body.BANKTXNID
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
	  			
					//send message to messenger

					let messageData = {
				    recipient: {
				      id: fbid
				    },
				    message:{    
				      text: 'Transaction Successful.\nTransaction ID: '+body.ORDERID+'\nBalance updated.',
				      quick_replies:[
				          {
				            content_type:"text",
				            title:"Start Test",
				            payload:"<START TEST>"        
				          },
				          {
				            content_type:"text",
				            title:"Add Money",
				            payload:"<ADD MONEY>"        
				          },          
				          {
				            content_type:"text",
				            title:"Score",
				            payload:"<SCORE>"        
				          }
				      ]				      
				    }
				  }; 

				  callSendAPI(messageData);

		}).catch(err => {
				
		});

}


function txnFailureAfterPending(body, fbid){

		console.log('Herep16');
		knex('payments').where({id:body.ORDERID}).update({					 			
 			STATUS: body.STATUS,
 			TXNID: body.TXNID,
 			TXNDATE: body.TXNDATE,
 			RESPMSG: body.RESPMSG, 			
 			PAYMENTMODE: body.PAYMENTMODE,
 			GATEWAYNAME: body.GATEWAYNAME, 			
 			BANKNAME: body.BANKNAME,
 			BANKTXNID: body.BANKTXNID
 		}).then( () => {
 				
 				// send msg
 				let messageData = {
				    recipient: {
				      id: fbid
				    },
				    message:{    
				      text: 'Transaction Failed.\nTransaction ID: '+body.ORDERID			      
				    }
				  }; 

				  callSendAPI(messageData);

 		}).catch(err => {
 				
 		});

}


function callSendAPI(messageData) {
	console.log('callSendAPI');
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      //console.error(response);
      console.error(error);
    }
  });  
}



module.exports = router;
