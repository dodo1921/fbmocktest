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

					if(pending_share>=2)
						eligible = true;


					return res.render('share_prize', {
						recipientId ,email, phone, total_share, pending_share, records, eligible
					});


			})
			.catch( err => {
				return res.render('code_expired');
			});

		
			
		

});








module.exports = router;
