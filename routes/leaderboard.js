var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

let moment = require('moment');

var router = express.Router();

/* GET users listing. */

router.post('/:recipientId', function(req, res) {  

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
								me: user[0],
								down,
								week: moment().week(),
								year: new Date().getFullYear()
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
