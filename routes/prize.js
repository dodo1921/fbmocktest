var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

let moment = require('moment');

var router = express.Router();

/* GET users listing. */

router.get('/:recipientId', function(req, res) {  

			let recipientId = req.params.recipientId;

			knex('users').where({fbid: recipientId}).select()
			.then( user => {

				if(user.length>0){

						let t, d;

						knex('users').where('score', '>', user[0].score).orderBy('score', 'asc').limit(5)
						.then( top => {

							t = top.reverse();
							return knex('users').where('score', '<', user[0].score).orderBy('score', 'desc').limit(10);

						})
						.then( down => {

							return res.render('leaderboard.ejs', {
								top: t,
								me: user,
								down,
								recipientId: recipientId
							});

						})
						.catch( err => {
							return res.render('code_expired');
						});

				}else
					return res.render('code_expired');

			}).catch( err => {
				return res.render('code_expired');
			});

		
			
		

});








module.exports = router;
