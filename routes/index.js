var express = require('express');
var router = express.Router();

let knex = require('../db/knex');
let Promise = require('bluebird');

const request = require('request');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({ message : 'hellohello'});
});


router.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === 'mayukh_mocktest') {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }
});


// Message processing
router.post('/webhook', function (req, res) {
  console.log(req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {
    
    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);          
        } else if (event.postback) {
          receivedPostback(event);          
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});


// Incoming events handling
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;

  if( message.quick_reply.payload){

      switch (message.quick_reply.payload) {
        case '<START TEST>':{

          break;
        }
        case '<ADD MONEY>':{

          break;
        }
        case '<SCORE>':{

          knex('users').where({fbid: senderID}).select('score')
          .then( user => {

            if(user.length >0){

              let msgText = 'Overall Total Score: '+user[0].score; 
              sendMsgModeA(senderID, msgText);

            }else if( user.length == 0){

                knex('users').insert({fbid: senderID})
                .then( () => {
                  console.log('New User Created');
                  let msgText = 'Overall Total Score: 0'; 
                  sendMsgModeA(senderID, msgText);
                }).catch(err => {

                });

            }

          }).catch(err => {

          });

          break;
        }
        default:{

        }

      }


  } else if (messageText) {
    
    switch (messageText) {
      case 'generic':{

          break;
        }

      default:{          
          let msgText = "Practice mini mock tests from your facebook messenger. 10 questions 15 minutes. Each test cost just Rs 5. Get a test free on scoring full marks.";
          sendMsgModeA(senderID, msgText);
        }
      }
  } else if (messageAttachments) {

      sendTextMessage(senderID, "Message with attachment received");

  }

}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);


  knex('users').insert({fbid: senderID})
  .then( () => {
    console.log('New User Created');
    let msgText = "Practice mini mock tests from your facebook messenger. 10 questions 15 minutes. Each test cost just Rs 5. Get a test free on scoring full marks. ";
    sendMsgModeA(senderID, msgText);
  }).catch(err => {

  })

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  //sendTextMessage(senderID, "Postback called");
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendMsgModeA(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{    
      text: messageText,    
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
}





function sendGenericMessage(recipientId) {
  /*var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality. 
            Next-generation virtual reality. 
            Next-generation virtual reality. 
            Next-generation virtual reality. 
            Next-generation virtual reality. 
            Next-generation virtual reality. 
            Next-generation virtual reality. 
            Next-generation virtual reality. 
            Next-generation virtual reality. ",            
            quick_replies: [{
              type: "postback",
              title: "A",
              payload: "1. A",
            }, {
              type: "postback",
              title: "B",
              payload: "1. B",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: "http://messengerdemo.parseapp.com/img/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  }; */



  var messageData = {
  	recipient: {
      id: recipientId
    },
   	message:{
    attachment:{
      type:"image",
      payload:{
        url:"https://s3.ap-south-1.amazonaws.com/hahusers/images/elder_care.jpg"
      }
    },
    quick_replies:[
	      {
	        content_type:"text",
	        title:"A",
	        payload:"<POSTBACK_PAYLOAD>"        
	      },
	      {
	        content_type:"text",
	        title:"B",
	        payload:"<POSTBACK_PAYLOAD>"        
	      }
    	]
  	}
  }; 

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}


module.exports = router;
