var express = require('express');
var router = express.Router();

let knex = require('../db/knex');
let Promise = require('bluebird');


let speakeasy = require('speakeasy');

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

            knex('users').where({fbid: event.sender.id}).select()
            .then(user => {

                  if( user && user.length>0 ){
                      if (event.message) {
                        receivedMessage(event, user[0]);          
                      } else if (event.postback) {
                        receivedPostback(event, user[0]);          
                      } else {
                        console.log("Webhook received unknown event: ", event);
                      }
                  }else if(user.length == 0) {

                      knex('users').insert({fbid: event.sender.id})
                      .then( () => {                
                          
                          if (event.message) {
                            receivedMessage(event, { fbid: event.sender.id, mode: 'A', score: 0 , balance: 0.00 } );          
                          } else if (event.postback) {
                            receivedPostback(event, { fbid: event.sender.id, mode: 'A', score: 0 , balance: 0.00 } );          
                          } else {
                            console.log("Webhook received unknown event: ", event);
                          }

                      }).catch(err => {

                      });

                  }

            }).catch( err => {});      


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
function receivedMessage(event, user) {
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

  if( message.quick_reply && message.quick_reply.payload){
      
      switch (message.quick_reply.payload) {
        case '<START TEST>':{

          break;
        }
        case '<ADD MONEY>':{

              if(user.mode === 'A'){      
                console.log('Add money');          
                sendPaymentLinkPasscode(senderID, user);
              }

          break;
        }
        case '<SCORE>':{

              if(user.mode === 'A'){
                let msgText = 'Overall Total Score: '+user.score; 
                sendMsgModeA(senderID, msgText);
              }              

            break;

        }
        default:{

            console.log('Default payload');

        }

      }


  } else if (messageText) {
    
    switch (messageText) {

        case 'generic':{

            break;
        }

        default:{   
            if(user.mode === 'A'){
              let msgText = "Practice mini mock tests from your facebook messenger. 10 questions 15 minutes. Each test cost just Rs 5. Get a test free on scoring full marks. First two tests free.";
              sendMsgModeA(senderID, msgText);
            }      
            
        }

    }

  } else{

          if(user.mode === 'A'){
            let msgText = "Practice mini mock tests from your facebook messenger. 10 questions 15 minutes. Each test cost just Rs 5. Get a test free on scoring full marks. First two tests free.";
            sendMsgModeA(senderID, msgText);
          } 

  }

}

function receivedPostback(event, user) {

  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;
  
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

  if(user.mode === 'A'){
    let msgText = "Practice mini mock tests from your facebook messenger. 10 questions 15 minutes. Each test cost just Rs 5. Get a test free on scoring full marks. First two tests free.";
    sendMsgModeA(senderID, msgText);
  }

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


function sendPaymentLinkPasscode(recipientId, user) {  

                  console.log('Add money2');          
  
  let passcode = speakeasy.totp({secret: 'secret',  encoding: 'base32'});                
  knex('users').where({fbid:recipientId}).update({passcode})
  .then( () => {

                      console.log('Add money3');          


      
      let msg = "Current Balance: Rs."+user.balance+"\n\n"+"Passcode:"+passcode+"\nUse the passcode to make a payment";

      var messageData = {
        recipient: {
          id: recipientId
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text:msg, 
              buttons: [{
                  type: "web_url",
                  url: "https://fbmocktest.herokuapp.com/payments/",
                  title: "Paytm Payment link"
                }, {
                  type: "postback",
                  title: "back",
                  payload: "<BACK>",
              }]              
            }
          }
        }
      };  


      callSendAPI(messageData); 



  }).catch(err => {

                    console.log('Add money4');          


  });
  
  
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
