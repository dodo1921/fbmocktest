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
                        receivedMessage(event, user[0], timeOfEvent);          
                      } else if (event.postback) {
                        receivedPostback(event, user[0], timeOfEvent);          
                      } else {
                        console.log("Webhook received unknown event: ", event);
                      }
                  }else if(user.length == 0) {

                      knex('users').returning('id').insert({fbid: event.sender.id})
                      .then( id => {                
                          
                          if (event.message) {
                            receivedMessage(event, { id: id[0], fbid: event.sender.id, mode: 'A', score: 0 , balance: 0.00 } , timeOfEvent);          
                          } else if (event.postback) {
                            receivedPostback(event, { id: id[0], fbid: event.sender.id, mode: 'A', score: 0 , balance: 0.00 } , timeOfEvent);          
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
function receivedMessage(event, user, timeOfEvent) {
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

            if(user.mode === 'E'){
              console.log('payload:'+message.quick_reply.payload);
              processAnswer(senderID, user, timeOfEvent, message.quick_reply.payload );              
            }

        }

      }


  } else if (messageText) {

    if(user.mode === 'A'){
      let msgText = "Practice mini mock tests from your facebook messenger. 10 questions 15 minutes. Each test cost just Rs 5. Get a test free on scoring full marks. First two tests free.";
      sendMsgModeA(senderID, msgText);
    }else if(user.mode === 'E'){
        processMessageExamMode(senderID, user, timeOfEvent);
    }   

  } else{

          if(user.mode === 'A'){
            let msgText = "Practice mini mock tests from your facebook messenger. 10 questions 15 minutes. Each test cost just Rs 5. Get a test free on scoring full marks. First two tests free.";
            sendMsgModeA(senderID, msgText);
          } 

  }

}

function receivedPostback(event, user, timeOfEvent) {

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


function sendTestQuestion(recipientId, imagename, testid, qno) {


  var messageData = {
    recipient: {
      id: recipientId
    },
    message:{    
      attachment:{
        type:"image",
        payload:{
          url:"https://s3.ap-south-1.amazonaws.com/mayukhdemo/tests/"+imagename
        }
      },   
      quick_replies:[
          {
            content_type:"text",
            title:"A",
            payload: testid+","+qno+",A"        
          },
          {
            content_type:"text",
            title:"B",
            payload: testid+","+qno+",B"         
          },          
          {
            content_type:"text",
            title:"C",
            payload: testid+","+qno+",C"         
          },
          {
            content_type:"text",
            title:"D",
            payload: testid+","+qno+",D"         
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

function processMessageExamMode(recipientId, user, timeOfEvent){

  let subquery = knex('tests').max('id').where({user_id: user.id});

  knex('tests').whereIn('id', subquery).select()
  .then(test => {

    processAnswer(recipientId, user, timeOfEvent, test[0].id+','+test[0].current_qno+','+'PASS');

  }).catch(err =>{});

}


function processAnswer(recipientId, user, timeOfEvent, payload){

    console.log('>>>'+payload);

    let ans = payload.split(',');

    console.log('>>>'+ans.length);

    if(ans.length != 3)
      return;

    let testid = ans[0];
    let qno = ans[1];
    let answer = ans[2];

    console.log(testid+':'+qno+':'+answer);

    let curr_test;

    knex('tests').where({id: testid}).select()
    .then(test =>{

        if(test.length == 0)
          throw new Error('Test Aborted');

       curr_test = test[0];

       if(test[0].end>=timeOfEvent){

          let actual_answers;

          if(test[0].actual_answers === '')
            actual_answers = answer;
          else
            actual_answers = test[0].actual_answers+','+answer;

          curr_test.actual_answers = actual_answers;

          curr_test.current_qno++;

          return knex('tests').where({id:testid}).update({actual_answers, current_qno: curr_test.current_qno });

       }else{

          let actual_answers = test[0].actual_answers;

          for(let i=qno; i<=10;i++){
            if(actual_answers === '')
              actual_answers = 'PASS';
            else
              actual_answers = actual_answers+','+'PASS';
          }

          curr_test.actual_answers = actual_answers;

          return knex('tests').where({id:testid}).update({actual_answers, current_qno:11});

       } 


    })
    .then( () => {

          if(curr_test.end>=timeOfEvent && qno<10){

              sendNextQ( recipientId ,curr_test, qno, curr_test.id);

           }else if(curr_test.end<timeOfEvent && qno<10){

              sendRemainingQ(recipientId ,curr_test, curr_test.id );  
              //sendReport(recipientId ,curr_test);

           }else if(curr_test.end>=timeOfEvent && qno>=10){

              sendReport(recipientId ,curr_test);
               
           }else{

              sendReport(recipientId ,curr_test);
               

           } 


    })
    .catch(err => {

      changeUserMode(recipientId, err.name);

    });


};


function changeUserMode(recipientId, msgText){

    knex('users').where({fbid:recipientId}).update({mode:'A'})
      .then( () => {

        sendMsgModeA(recipientId,msgText);

      }).catch(err=>{});

}

function sendNextQ( recipientId ,curr_test, qno, testid){

  let qlist = curr_test.questions;

  qarray = qlist.split(',');

  let query; question_no = qarray[qno].substring(2);

  if(qarray[qno].substring(0,2) === 'qA' )
    query = knex('qA').where({id:question_no}).select('q');
  else 
    query = knex('qB').where({id:question_no}).select('q');

  query.then( question => {

    sendTestQuestion(recipientId, question[0].q, testid, qno+1);

  }).catch(err => {});

}


function sendRemainingQ(recipientId ,curr_test, qno){


}


function sendReport(recipientId ,curr_test){

}


function startTest(recipientId, user) {


  let qacount = 5, qbcount = 5, qa = [], qb = [], maxqa = 39, maxqb = 39, t, answer_queue='', question_queue='';
  let question_one, testid;

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
          console.log('Q:'+question_one+'>>>>'+user.id);
          
          knex.transaction( trx => {

              let p = [];
              let tt;
              let curr_time = new Date();
              let test_end = new Date(curr_time.getTime() + 15*60000);

              let test = {
                user_id: user.id,
                start: curr_time.getTime(),
                end: test_end.getTime(),
                current_qno: 1,
                questions: question_queue,
                expected_answers: answer_queue
              }

              tt = knex('tests').returning('id').insert(test).transacting(trx);
              p.push(tt);

              tt = knex('users').where({ fbid: recipientId }).update({mode:'E'}).transacting(trx);
              p.push(tt);

              Promise.all(p)
              .then( values => {

                for( let i=0; i<values.length; i++ ){
                  console.log('>>>>>>>'+values[i]);
                  if(i==0)
                    testid = values[i];
                  if(values[i] == 0 ){                  
                    throw new Error('Transaction failed');
                  }
                }
                             

              })
              .then(trx.commit)
              .catch(trx.rollback)


          }).then( () => {
              sendTestQuestion(recipientId, question_one, testid, 1);
          }).catch( err => {
              console.log(err);
              sendMsgModeA(recipientId, err.name+' OMG');
          });

    }

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
