var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/:recipientId', function(req, res) {  
	
	res.render('views/passcode', {
		recipientId: req.param.recipientId
	});

});

module.exports = router;
