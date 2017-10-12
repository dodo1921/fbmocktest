var express = require('express');

let knex = require('../db/knex');
let Promise = require('bluebird');

var router = express.Router();

/* GET users listing. */

router.post('/:recipientId', function(req, res) {  

		

		
			return res.render('index.ejs');
		

});





module.exports = router;
