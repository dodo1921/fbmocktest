var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/:recipientId', function(req, res) {  

	console.log(req.params.recipientId);
	
	res.render('passcode', {
		recipientId: req.params.recipientId
	});

});

module.exports = router;
