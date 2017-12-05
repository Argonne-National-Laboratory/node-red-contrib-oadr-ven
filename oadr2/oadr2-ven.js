"use strict";

//const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');
const events = require('events');
const os = require('os');
const request = require('request');
const bodyparser = require('body-parser');

// this is used to create unique IDs (if not provided)
const uuidv4 = require('uuid/v4');

// const xmlconvert = require('xml-js');

// this is used to convert from XML to javascript objects
const xmlconvert = require('fast-xml-parser');

// Convert javascript object to XML
const d2xml = require('data2xml');
const convert = d2xml();
const app = express();

const EventEmitter = events.EventEmitter;

let ee;

ee = new EventEmitter();

////////////////////////////////////
// Node-Red stuff
///////////////////////////////////

module.exports = function (RED) {

  // Create a server node for monitoring incoming soap messages

  function prepareResMsg(uuid, inCmd, body){
    const msg = {};
    msg.oadr = {};
    msg.payload = {};
    msg.oadr.requestID = uuid||'unknown';
    let jsdata = xmlconvert.parse(body, { ignoreNameSpace: true });
    if(jsdata){
      if (jsdata.oadrPayload && jsdata.oadrPayload.oadrSignedObject){
        msg.payload.data = jsdata.oadrPayload.oadrSignedObject;        
      }
      msg.oadr.responseType = getOadrCommand(msg.payload.data);
    }
    msg.oadr.requestType = inCmd;
    return msg;
  }

  function prepareReqMsg(body){
    const msg = {};
    msg.oadr = {};
    msg.payload = {};
    //msg.oadr.requestID = uuid||'unknown';
    let jsdata = xmlconvert.parse(body, { ignoreNameSpace: true });
    console.log(jsdata);
    if(jsdata){
      if (jsdata.oadrPayload && jsdata.oadrPayload.oadrSignedObject){
        msg.payload.data = jsdata.oadrPayload.oadrSignedObject;
        msg.oadr.requestType = getOadrCommand(msg.payload.data);
        msg.oadr.requestID = jsdata.oadrPayload.oadrSignedObject[msg.oadr.requestType].requestID||null;
        msg.oadr.msgType = 'request';
      }
    }
    // msg.oadr.requestType = inCmd;
    return msg;
  }


  function getOadrCommand(data){
    let cmd = "unknonwn";
    let property;
    // if (data.oadrPayload.oadrSignedObject){
    //   for ( property in data.oadrPayload.oadrSignedObject ){
    //     cmd = property
    //   }        
    for ( property in data){
      cmd = property
    }
    return cmd;
  };

  function iCalDurationInSeconds(durStr){
    var exp = new RegExp(/^P/);
    let totalSec = 0;
    let valStr;
    if (durStr.match(exp)){
      exp = new RegExp(/(\d+)H/);
      valStr = durStr.match(exp);
      if(valStr) totalSec = parseInt(valStr[1]) * 60 * 60;
      exp = new RegExp(/(\d+)M/);
      valStr = durStr.match(exp);
      if(valStr) totalSec += parseInt(valStr[1]) * 60;
      exp = new RegExp(/(\d+)S/);
      valStr = durStr.match(exp);
      if(valStr) totalSec += parseInt(valStr[1]);
    }
    return totalSec;
  }

  function getXMLpayload(payloadName,payload){
    const payloadXML = {
      _attr: {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
        xmlns: 'http://openadr.org/oadr-2.0b/2012/07'
      },
      oadrSignedObject: {
      }
    };
    payloadXML.oadrSignedObject[payloadName] = payload;
    
    return convert('oadrPayload', payloadXML);
  }


  function sendRequest(url, ei, xml, cb) {
    
    const _url = `${url}/OpenADR2/Simple/2.0b/${ei}`;
    const options = {
      url: _url,
      method: "POST",
      headers: {
        "content-type": "application/xml",  // <--Very important!!!
      },
      body: xml
    };
    request(options, cb);    
  }
    

/*
  Begin NODE RED
*/
  function OADR2VEN(config) {

    RED.nodes.createNode(this, config);
    const node = this;

    const flowContext = node.context().flow;

    node.status({ fill: "blue", shape: "dot", text: "Waiting..." })

    // ee.on('error', (err) => {
    //     node.error('EMITTER ERROR: ' + err);
    // })



    app.get('/', function( req, res ) {
      console.log('got something:', req);
    });

    app.use(bodyparser.text({type: 'application/xml'}));

    app.post('/OpenADR2/Simple/2.0b/:reqType',(req, res) => {
      // console.log('req URL:', req.url);
      // console.log('req hostname:', req.hostname);
      // console.log('req IP:', req.ip);
      // console.log('req params: ', req.params)
      // console.log('req body:', req.body);
      let msg = prepareReqMsg(req.body);

      let oadrObj = msg.payload.data[msg.oadr.requestType];
      console.log(JSON.stringify(oadrObj));
      let ids = flowContext.get(`${node.name}:IDS`);
      console.log(`${node.name}:IDS`,ids);
      console.log(node.name);
      if (oadrObj.hasOwnProperty('venID')){
        console.log(oadrObj.venID);
        //ids.venID = oadrObj.registrationID;
      } 
      // if (oadrObj.hasOwnProperty('venID')) ids.venID = oadrObj.venID;
      // if (oadrObj.hasOwnProperty('vtnID')) ids.vtnID = oadrObj.vtnID;
      flowContext.set(`${node.name}:IDs`, ids);

      let id = msg.oadr.requestID||0;

      let to = setTimeout(function (id) {
        // node.log("kill:" + id);
        if (ee.listenerCount(id) > 0) {
          let evList = ee.listeners(id);
          ee.removeListener(id, evList[0]);
        }
      }, 120 * 1000, id);

      // This makes the response async so that we pass the responsibility onto the response node
      ee.once(id, function (returnMsg) {
        console.log(returnMsg);

        clearTimeout(to);
        // logData(msgTypeStr[response[msgType]], JSON.stringify(response).replace(/,/g, ", "));
        
        res.send(returnMsg);
      });

      node.send(msg);

    });

    console.log('starting server');
    const server = app.listen(8843, () => console.log('listenting on port 8843'));

    // make local copies of our configuration
    this.logging = (typeof config.log === 'boolean')? config.log : false;
    this.url = config.vtnurl;
    this.pathlog = config.pathlog;
    this.name = config.name || "OADR2 VEN";

    node.status({ fill: "green", shape: "ring", text: 'blah' })

    // Initialize the ids for this VEN
    let ids = {
      registrationID: '000',
      venID: '111',
      vtnID: '222'
    }
    flowContext.set(`${node.name}:IDs`, ids);

    const payloadAttr = {
      'd3p1:schemaVersion': '2.0b',
      'xmlns:d3p1': 'http://docs.oasis-open.org/ns/energyinterop/201110',
      'xmlns:pl': 'http://docs.oasis-open.org/ns/energyinterop/201110/payloads'
    };

    const QueryRegistration = function(msg) {
      let params = msg.payload;      
      let inCmd = msg.payload.requestType||'unknown';
      let uuid = params.requestID||uuidv4();

      let oadrQueryRegistration = {
        _attr: payloadAttr,
        'pl:requestID': params.requestID||uuidv4()        
      };

      let myXML = getXMLpayload('oadrQueryRegistration', oadrQueryRegistration);

      sendRequest(node.url,'EiRegisterParty', myXML, function(err, response, body){
        if(err){
          console.log('Error:', err);
        }    
        else {
          let msg = prepareResMsg(uuid, inCmd, body);

          if (msg.oadr.responseType == 'oadrCreatedPartyRegistration'){
            let oadrObj = msg.payload.data[msg.oadr.responseType];
            if (oadrObj.eiResponse.responseCode === 200){
              let ids = {
                registrationID:  oadrObj.registrationID||'',
                venID: oadrObj.venID||'',
                vtnID: oadrObj.vtnID||''
              }
              flowContext.set(`${node.name}:IDs`, ids);
            }
            // Include a parsed version of the polling frequency in the oadr info
            if (oadrObj.oadrRequestedOadrPollFreq && oadrObj.oadrRequestedOadrPollFreq.duration){
              msg.oadr.pollFreqSeconds = iCalDurationInSeconds(oadrObj.oadrRequestedOadrPollFreq.duration);              
            }
          }
            
          node.send(msg);
        }
      });

    }
    
    const CreatePartyRegistration = function(msg) {
      
      let params = msg.payload;
      let inCmd = msg.payload.requestType||'unknown';
      let uuid = params.requestID||uuidv4();
      
      let oadrCreatePartyRegistration = {
        _attr: payloadAttr,
        'pl:requestID': {
          _value: params.requestID||uuidv4()
        },
        oadrProfileName: "2.0b",
        oadrTransportName: "simpleHttp",
        oadrREportONly: (typeof params.oadrReportOnly === 'boolean')? params.oadrReportOnly : false,
        oadrXmlSignature: false,
        oadrVenName: node.name,
        oadrHttpPullModel: (typeof params.oadrHttpPullModel === 'boolean')? params.oadrHttpPullModel : true,
        oadrTransportAddress: params.oadrTransportAddress||null
      }

      let myXML = getXMLpayload('oadrCreatePartyRegistration', oadrCreatePartyRegistration);

      sendRequest(node.url,'EiRegisterParty', myXML, function(err, response, body){
        if(err){
          console.log('Error:', err);
        }    
        else {
          let msg = prepareResMsg(uuid, inCmd, body);

          if (msg.oadr.responseType == 'oadrCreatedPartyRegistration'){
            let oadrObj = msg.payload.data[msg.oadr.responseType];
            if (oadrObj.eiResponse.responseCode === 200){
              let ids = {
                registrationID:  oadrObj.registrationID||'',
                venID: oadrObj.venID||'',
                vtnID: oadrObj.vtnID||''
              }
              flowContext.set(`${node.name}:IDs`, ids);

            }

            // Include a parsed version of the polling frequency in the oadr info
            if (oadrObj.oadrRequestedOadrPollFreq && oadrObj.oadrRequestedOadrPollFreq.duration){
              msg.oadr.pollFreqSeconds = iCalDurationInSeconds(oadrObj.oadrRequestedOadrPollFreq.duration);
            }


          }

          node.send(msg);
        }
      });
            
    }    
      
    const CancelPartyRegistration = function(msg) {

      let params = msg.payload;
      let inCmd = msg.payload.requestType||'unknown';
      let uuid = params.requestID||uuidv4();
      
      let ids = flowContext.get(`${node.name}:IDs`);

      let oadrCancelPartyRegistration = {
        _attr: payloadAttr,
        'pl:requestID': params.requestID||uuidv4(),
        'd3p1:registrationID': params.registrationID||ids.registrationID||'',
        'd3p1:venID': params.venID||ids.venID||''  
      }

      let myXML = getXMLpayload('oadrCancelPartyRegistration', oadrCancelPartyRegistration);
      
      sendRequest(node.url,'EiRegisterParty', myXML, function(err, response, body){
        if(err){
          console.log('Error:', err);
        }    
        else {
          let msg = prepareResMsg(uuid, inCmd, body);

          if (msg.oadr.responseType == 'oadrCanceledPartyRegistration'){
            let oadrObj = msg.payload.data[msg.oadr.responseType];
            if (oadrObj.eiResponse.responseCode === 200){
              let ids = {
                registrationID: '',
                venID: '',
                vtnID: ''
              }
              flowContext.set(`${node.name}:IDs`, ids);
            }

          }

          node.send(msg);
        }
      });
      
    }    

    const RequestEvent = function(msg) {

      let params = msg.payload;
      let inCmd = msg.payload.requestType||'unknown';
      let uuid = params.requestID||uuidv4();
      
      let ids = flowContext.get(`${node.name}:IDs`);
      
      let venID = '';
      if (ids) { venID = ids.venID };

      let oadrRequestEvent = {
        _attr: payloadAttr,
        'pl:eiRequestEvent': {
          'pl:requestID': params.requestID||uuidv4(),
          'd3p1:venID' : params.venID||venID,
        } 
      };

      let myXML = getXMLpayload('oadrRequestEvent', oadrRequestEvent);
      
      sendRequest(node.url,'EiEvent', myXML, function(err, response, body){
        if(err){
          console.log('Error:', err);
        }    
        else {
          let msg = prepareResMsg(uuid, inCmd, body);
          node.send(msg);
        }
      });
              
    }

    const CreatedEvent = function(msg) {
      const params = msg.payload;
      let inCmd = params.requestType||'unknown';
      let uuid = params.requestID||uuidv4();
      
      let ids = flowContext.get(`${node.name}:IDs`);
      
      let venID = '';
      if (ids) { venID = ids.venID };

      let oadrCreatedEvent = {
        _attr: payloadAttr,
        'pl:eiCreatedEvent': {
            'd3p1:eiResponse': {
                'd3p1:responseCode' : params.responseCode||200,
                'd3p1:responseDescription': params.responseDescription|| 'OK',
                'pl:requestID': uuid
            },
            'd3p1:venID': venID            
        } 
      };

      if (params.eventResponses){
        console.log(params.eventResponses);
        console.log(params.eventResponses.length);
        if(params.eventResponses.length > 0){
          oadrCreatedEvent['pl:eiCreatedEvent']['d3p1:eventResponses'] = {};
          oadrCreatedEvent['pl:eiCreatedEvent']['d3p1:eventResponses']['d3p1:eventResponse'] = [];          
          params.eventResponses.forEach(er => {
            let eventResponse = {};
            eventResponse['d3p1:responseCode'] = er.responseCode||200;
            eventResponse['d3p1:resonseDescription'] = er.responseDescription||'OK';
            eventResponse['d3p1:requestID'] = er.requestID||uuid;
            eventResponse['d3p1:qualifiedEventID'] = {};
            eventResponse['d3p1:qualifiedEventID']['d3p1:eventID'] = er.qualifiedEventID.eventID||undefined;
            eventResponse['d3p1:qualifiedEventID']['d3p1:modificationNumber'] = er.qualifiedEventID.modificationNumber;
            
            eventResponse['d3p1:optType'] = er.optType;
            oadrCreatedEvent['pl:eiCreatedEvent']['d3p1:eventResponses']['d3p1:eventResponse'].push(eventResponse);                   
          });
        }
        
      }

      let myXML = getXMLpayload('oadrCreatedEvent', oadrCreatedEvent);
      
      // console.log(myXML);

      sendRequest(node.url,'EiEvent', myXML, function(err, response, body){
        if(err){
          console.log('Error:', err);
        }    
        else {
          let msg = prepareResMsg(uuid, inCmd, body);
          node.send(msg);
        }
      });
              
    }

    const Poll = function(msg) {

      let params = msg.payload;
      let inCmd = msg.payload.requestType||'unknown';
      let uuid = params.requestID||uuidv4();
      
      let ids = flowContext.get(`${node.name}:IDs`);
      
      let venID = '';
      if (ids) { venID = ids.venID };
      
      let oadrPoll = {
        _attr: payloadAttr,
        'd3p1:venID' :params.venID||venID
      };

      let myXML = getXMLpayload('oadrPoll', oadrPoll);
      
      sendRequest(node.url,'OadrPoll', myXML, function(err, response, body){
        if(err){
          console.log('Error:', err);
        }    
        else {
          let msg = prepareResMsg(uuid, inCmd, body);
          node.send(msg);
        }
      });
      
    }
      
    const Response = function(msg) {

      let params = msg.payload;

      let oadrResponse = {
        _attr: payloadAttr,
        eiResponse: {
          responseCode: params.responseCode||200,
          responseDescription: params.responseDescription||'OK',
          'pl:requestID': params.requestID
        },
        venID : params.venID
      }

      let myXML = getXMLpayload('oadrResponse', oadrResponse);
      console.log('Event Names:', ee.eventNames());
      ee.emit(params.requestID, myXML);
    }

    this.on('input', function (msg) {

      let opType = 'request';

      if(msg.payload){

        if (typeof msg.payload.opType === 'string' && msg.payload.opType.toLowerCase() === 'response'){
          opType = msg.payload.opType.toLowerCase();
        }
        
        if(opType === 'request' && msg.payload.requestType){
          switch(msg.payload.requestType){
            case('QueryRegistration'):
              QueryRegistration(msg);
              break;
            case('CreatePartyRegistration'):
              CreatePartyRegistration(msg);
              break;
            case('CancelPartyRegistration'):
              CancelPartyRegistration(msg);
              break;
            case('RequestEvent'):
              RequestEvent(msg);
              break;
            case('Poll'):
              Poll(msg);
              break;
            case('CreatedEvent'):
              CreatedEvent(msg);
              break;
          }
        }
        else{
          console.log('Making a respnose');
          switch(msg.payload.responseType){
            case('Response'):
              console.log('doing a Response');
              Response(msg);
              break;
          }
        }
      }
    });  // this.on('input'...)            



    this.on('close', function (removed, done) {
        console.log('About to stop the server...');
        // ee.removeAllListeners();
        //console.log(expressWs.getWss());
        //console.log(app);
        server.close();
        this.status({ fill: "grey", shape: "dot", text: "stopped" })
        done();
        // console.log('Server closed?...');

    });



    function logData(type, data) {
      if (node.logging === true) {  // only log if no errors w/ log file
        // set a timestamp for the logged item
        let date = new Date().toLocaleString();
        // create the logged info from a template
        // let logInfo = `${date} \t node: ${node.name} \t type: ${type} \t data: ${data} ${os.EOL}`;
        let logInfo = `${date} \t node: ${node.name} \t type: ${type} \t data: ${data.replace(/[\n\r]/g, "")} ${os.EOL}`;


        // create/append the log info to the file
        fs.appendFile(node.pathlog, logInfo, (err) => {
          if (err) {
            node.error(`Error writing to log file: ${err}`);
            // If something went wrong then turn off logging
            node.logging = false;
            if (this.log) this.log = null;
          }
        });
      }
    }

  }

  RED.nodes.registerType("VEN", OADR2VEN);
}


////////////////////////////////////////////////////////////////////////////////////
    // console.log(myXML);

    // wsdljs = xmlconvert.xml2js(wsdl15, {compact: true, spaces: 4});
    // wsdlservice = wsdljs['wsdl:definitions']['wsdl:service']._attributes.name;
    // wsdlport = wsdljs['wsdl:definitions']['wsdl:service']['wsdl:port']._attributes.name;

    // const expressServer = express();

    // expressServer.use(function(req,res,next){
    //     // console.log('In middleware #########')
    //     if (req.method == "POST" && typeof req.headers['content-type'] !== "undefined") {
    //         if (req.headers['content-type'].toLowerCase().includes('action')){
    //             // console.log(req.headers)
    //             let ctstr = req.headers['content-type'];
    //             let ctarr = ctstr.split(";");
    //             // console.log("before: ", ctarr);
    //             ctarr = ctarr.filter(function(ctitem){
    //                 return ! ctitem.toLowerCase().includes('action')
    //             })
    //             // console.log("after: ", ctarr.join(";"));
    //             req.headers['content-type'] = ctarr.join(";");
    //         }
    //     }
    //     next();
    // });



    // const server = expressServer.listen(this.svcPort, function(){
    //     let log_file;
    //     if (node.pathlog == "") node.logging = false;
    //     if (node.enabled15){
    //         soapServer15 = soap.listen(expressServer,{ path: node.svcPath15, services: ocppService15, xml: wsdl15} );
    //         soapServer15.log = (node.logging) ? logData : null;
    //     }

    //     if (node.enabled16){
    //         soapServer16 = soap.listen(expressServer,{ path: node.svcPath16, services: ocppService16, xml: wsdl16} );
    //         soapServer16.log = (node.logging) ? logData : null;
    //     }
    //     if (node.enabled16j){
    //         const wspath = `${node.svcPath16j}/:cbid`;
    //         logData('info', `Ready to recieve websocket requests on ${wspath}`);
    //         //console.log(`ws path = ${wspath}`);
    //         expressServer.ws(wspath, function(ws, req) {
    //             const CALL = 2;
    //             const CALLRESULT = 3;
    //             const CALLERROR = 4;
    //             const msgTypeStr = ['received', 'replied', 'error'];

    //             const msgType = 0;
    //             const msgId  = 1;
    //             const msgAction = 2;
    //             const msgCallPayload = 3;
    //             const msgResPayload = 2;

    //             let msg = {};
    //             msg.ocpp = {};
    //             msg.payload = {};
    //             msg.payload.data = {};

    //             msg.ocpp.ocppVersion = "1.6j";
    //             msg.ocpp.chargeBoxIdentity = req.params.cbid;

    //             // console.log('WebSocket to ocppj, ChargePointID =', req.params.cbid);
    //             node.status({fill: "green", shape: "dot", text: `Connected on ${node.svcPath16j}/${req.params.cbid}`})                

    //             let eventname = req.params.cbid + REQEVTPOSTFIX;
    //             //console.log('Connecting to: ', req.params.cbid);
    //             logData('info', `Websocket connecting to chargebox: ${req.params.cbid}`);


    //             wsrequest = (data, cb) => {
    //                 let err;
    //                 let request = [];

    //                 request[msgType] = CALL;
    //                 request[msgId] = data.payload.MessageId||uuidv4();
    //                 request[msgAction] = data.payload.command;
    //                 request[msgCallPayload] = data.payload.data||{};

    //                 logData('request', JSON.stringify(request).replace(/,/g,", "));                        

    //                 ee.once(request[msgId], (retData) => {
    //                     cb(err, retData);
    //                 });

    //                 ws.send(JSON.stringify(request));

    //             }


    //             ee.on(eventname, wsrequest);

    //             ws.on('open', function() {
    //                 //console.log('Opening a WS')
    //             } );

    //             ws.on('close', function(code, reason){
    //                 //console.log(`closing emmiter: ${eventname}, Code: ${code}, Reason ${reason}`);

    //                 ee.removeAllListeners(eventname);
    //             });

    //             ws.on('error', function(err){
    //                 node.log("Websocket Error: " + err);
    //                 //console.log("Websocket Error:",err);
    //             });

    //             ws.on('message', function(msgIn){


    //                 let response = [];

    //                 let id = uuidv4();

    //                 let currTime = new Date().toISOString();

    //                 let msgParsed;


    //                 let eventName = ws.upgradeReq.params.cbid + REQEVTPOSTFIX;
    //                 if (ee.eventNames().indexOf(eventName) == -1){
    //                     // console.log( `Need to add event ${eventName}`);
    //                     ee.on(eventname, wsrequest);
    //                 }                    

    //                 if (msgIn[0] != '['){
    //                     msgParsed = JSON.parse( '[' + msgIn + ']');
    //                 }
    //                 else{
    //                     msgParsed = JSON.parse( msgIn );
    //                 }

    //                 logData(msgTypeStr[msgParsed[msgType] - CALL], msgIn);

    //                 if (msgParsed[msgType] == CALL){
    //                     msg.msgId = id;
    //                     msg.ocpp.MessageId = msgParsed[msgId];
    //                     msg.ocpp.msgType = CALL;
    //                     msg.ocpp.command =  msgParsed[msgAction];
    //                     msg.payload.command = msgParsed[msgAction];
    //                     msg.payload.data = msgParsed[msgCallPayload];


    //                     let to = setTimeout( function(id){
    //                         // node.log("kill:" + id);
    //                         if (ee.listenerCount(id) > 0){
    //                             let evList = ee.listeners(id);
    //                             ee.removeListener(id,evList[0]);
    //                         }
    //                     }, 120 * 1000, id);

    //                     // This makes the response async so that we pass the responsibility onto the response node
    //                     ee.once(id, function(returnMsg){
    //                         clearTimeout(to);
    //                         response[msgType] = CALLRESULT;
    //                         response[msgId] = msgParsed[msgId];
    //                         response[msgResPayload] = returnMsg;                            

    //                         logData(msgTypeStr[response[msgType] - CALL], JSON.stringify(response).replace(/,/g,", ") );

    //                         ws.send(JSON.stringify(response));

    //                     });

    //                     node.send(msg);
    //                 }
    //                 else if (msgParsed[msgType] == CALLRESULT){
    //                     msg.msgId = msgParsed[msgId];
    //                     msg.ocpp.MessageId = msgParsed[msgId];
    //                     msg.ocpp.msgType = CALLRESULT;
    //                     msg.payload.data = msgParsed[msgResPayload];

    //                     ee.emit(msg.msgId, msg);

    //                 }

    //             });
    //         });
    //     }

    // });
