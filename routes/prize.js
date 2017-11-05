var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

let moment = require('moment');

var router = express.Router();

/* GET users listing. */

router.get('/:recipientId', function(req, res) {  

			let recipientId = req.params.recipientId;
			let email = '';
			let phone = '';
			let total_share = 0;
			let pending_share = 0;
			let eligible = false;


			knex('users').where({fbid: recipientId}).select()
			.then( user => {

				if(user.length>0){

					email = user[0].email;
					phone = user[0].phone;
						
					return knex('users').where({ref_id: user[0].id}).count('ref_id as i')

				}else
					throw new Error('Code Expired');

			})
			.then(val => {

				total_share = val[0].i;
				return knex('refprize').where({fbid: recipientId}).select();

			})
			.then( records => {

					pending_share = total_share;

					for(let i=0; i< records.length; i++){
						pending_share -= records[i].sharecount;
					}

					if(pending_share>=200)
						eligible = true;


					return res.render('share_prize', {
						recipientId ,email, phone, total_share, pending_share, records, eligible
					});


			})
			.catch( err => {
				return res.render('code_expired');
			});

		
			
		

});


router.post('/redeemprize', function(req, res, next){

	let fbid = req.body.fbid;
	let email = req.body.email;
	let phone = req.body.phone;

	console.log(fbid+':::'+email+'::::'+phone);

	knex('users').where({fbid}).select()
	.then( user => {

		if(user.length>0){			
				
			return knex('users').where({ref_id: user[0].id}).count('ref_id as i')

		}else
			throw new Error('Code Expired');

	})
	.then(val => {

		total_share = val[0].i;
		return knex('refprize').where({fbid}).select();

	})
	.then( records => {

			pending_share = total_share;

			for(let i=0; i< records.length; i++){
				pending_share -= records[i].sharecount;
			}

			if(pending_share>=200){

						knex('users').where({fbid}).update({email, phone})
						.then( () => {

							return knex('refprize').returning('id').insert({fbid, sharecount: 200, money: 1000.00, done: 0 });
						})
						.then(id => {

							return res.render('referralprize_success');

						})
						.catch( err => {
							return next(err);
						});

			}else{

				return res.render('referralprize_success');

			}


	})	
	.catch( err => {
		return next(err);
	});

	



});








module.exports = router;
