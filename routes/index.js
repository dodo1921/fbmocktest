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

                      knex('users').returning('id').insert({fbid: event.sender.id})
                      .then( id => {                
                          
                          if (event.message) {
                            receivedMessage(event, { id: id[0], fbid: event.sender.id, mode: 'A', score: 0 , balance: 0.00 } );          
                          } else if (event.postback) {
                            receivedPostback(event, { id: id[0], fbid: event.sender.id, mode: 'A', score: 0 , balance: 0.00 } );          
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
              if(user.mode === 'A'){      
                console.log('Start test');          
                startTest(senderID, user);
              }
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
  
  let passcode = speakeasy.totp({secret: 'secret',  encoding: 'base32'});                
  knex('users').where({fbid:recipientId}).update({passcode})
  .then( () => {

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
                  url: "https://fbmocktest.herokuapp.com/payments/"+recipientId,
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



  }).catch(err => {});
  
  
}


function startTest(recipientId, user) {


  let qacount = 5, qbcount = 5, qa = [], qb = [], maxqa = 39, maxqb = 39, t, answer_queue='', question_queue='';
  let question_one;

  knex('tests').where({user_id: recipientId}).count('user_id as i')
  .then(val => {

        if(val[0].i >= 2 && user.balance < 5 ){

          throw new Error('Not enough balance. Please add money to start test.');          
          
        }else{

          for(let i=1; i<=qacount;i++){

                let flag=true; let t=0;

                while(flag){

                  t = Math.floor(Math.random() * (maxqa - 1 + 1)) + 1;
                  flag=false;
                  for(let j=0; j<qa.length; j++){
                    if(qa[j] == t){
                        flag=true;
                        break;
                      }

                  }

                  qa.push(t);

                }

          }

          for(let i=1; i<=qbcount;i++){

                let flag=true; let t=0;

                while(flag){

                  t = Math.floor(Math.random() * (maxqb - 1 + 1)) + 1;
                  flag=false;
                  for(let j=0; j<qb.length; j++){
                    if(qb[j] == t){
                        flag=true;
                        break;
                      }

                  }

                  qb.push(t);

                }

          }

          

          return knex('qA').whereIn('id', qa).select('id','a');         
          

        }

  })
  .then( val => {

              console.log('here1-'+val.length);
              let i=0;
              for(i=0; i< val.length-1; i++){                
                question_queue = question_queue +  ('qa'+val[i].id+',');
                answer_queue = answer_queue + (val[i].a+',');
              }

              question_queue = question_queue + ('qa'+val[i].id+',');
              answer_queue = answer_queue + (val[i].a+',');
               

              return knex('qB').whereIn('id', qb).select('id','a');

  })
  .then( valb => {

              console.log('here2-'+valb.length);
              let i=0;
              for(i=0; i< valb.length-1; i++){
                question_queue += 'qb'+valb[i].id+',';
                answer_queue +=valb[i].a+',';
              }

              question_queue += 'qb'+valb[i].id;
              answer_queue +=valb[i].a;

              let msgText = question_queue+'\n'+answer_queue;
              console.log(msgText);
              //sendMsgModeA(recipientId, msgText);

              let qid = question_queue.split(',')[0].substring(2);
              console.log('>>>>'+qid);

              return knex('qA').where({id: qid }).select('q');


  })
  .then( question => {

    if(question.length == 0 )
      throw new Error('Something went wrong. Try Again');
    else{
      question_one = question[0].q;
      console.log('Q:'+question_one);
      return knex.transaction( trx => {

          let p = [];
          let t;
          let curr_time = new Date();
          let test_end = new Date(curr_time.getTime() + 15*60000);

          let test = {
            user_id: user.id,
            start: curr_time.getTime(),
            end: test_end.getTime(),
            current_qno: 1,
            questions: question_queue,
            answers: expected_answers
          }

          t = knex('tests').insert(test).transacting(trx);
          p.push(t);

          t = knex('users').where({ id: user.id }).update({mode:'E'}).transacting(trx);
          p.push(t);

          Promise.all(p)
          .then( values => {

            for( let i=0; i<values.length; i++ ){
              console.log('>>>>>>>'+values[i]);
              if(values[i] == 0 ){                  
                throw new Error('Transaction failed');
              }
            }
                         

          })
          .then(trx.commit)
          .catch(trx.rollback)


      });

    }

  })
  .then( () => {

    sendMsgModeA(recipientId, question_one);


  })
  .catch(err=>{
    sendMsgModeA(recipientId, err.name);
  });

  
  
  
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
