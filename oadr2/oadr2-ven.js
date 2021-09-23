// 
// Title: Node-Red-Contrib-OADR-Ven
// Author: Bryan Nystrom
// Company: Argonne National Laboratory
//


/* eslint-disable radix */
"use strict";

//const http = require('http');
const express = require("express");
// const fs = require('fs');
const events = require("events");
// const os = require('os');
// const request = require('request');

const axios = require("axios");

const bodyparser = require("body-parser");

// for debugging purposes
const db = require("debug");
const debug = db("anl:oadr");

// this is used to create unique IDs (if not provided)
const { v4: uuidv4} = require("uuid");

// this is used to convert from XML to javascript objects
const xmlconvert = require("fast-xml-parser");

// Convert javascript object to XML
const d2xml = require("data2xml");
const convert = d2xml();
const app = express();

const EventEmitter = events.EventEmitter;

const https = require('https')

let tlsNode;
let oadrProfile;

let authuser;
let authpw;

let ee;

let _ids = {
  venID: "",
  vtnID: "",
  registrationID: "",
};

ee = new EventEmitter();

// Only use for debugging via docker instance. Otherwise use env DEBUG="anl:oadr" when starting Node-Red
//db.enable("anl:oadr");

////////////////////////////////////
// Node-Red stuff
///////////////////////////////////

module.exports = function (RED) {
  // Create a server node for monitoring incoming soap messages

  function prepareResMsg(uuid, inCmd, body) {
    const msg = {};
    msg.oadr = {};
    msg.payload = {};
    msg.oadr.requestID = uuid || "unknown";
    let jsdata = xmlconvert.parse(body, { ignoreNameSpace: true });
    if (jsdata) {
      if (
        oadrProfile !== "2.0a" &&
        jsdata.oadrPayload &&
        jsdata.oadrPayload.oadrSignedObject
      ) {
        msg.payload.data = jsdata.oadrPayload.oadrSignedObject;
      } else if (oadrProfile == "2.0a") {
        msg.payload.data = jsdata;
      }
      msg.oadr.responseType = getOadrCommand(msg.payload.data);
    }
    msg.oadr.requestType = inCmd;
    return msg;
  }

  function prepareReqMsg(body) {
    const msg = {};
    msg.oadr = {};
    msg.payload = {};
    msg.oadr.requestType = "unknown";
    //msg.oadr.requestID = uuid||'unknown';
    let jsdata = xmlconvert.parse(body, { ignoreNameSpace: true });
    //console.log(jsdata);
    if (jsdata) {
      if (jsdata.oadrPayload && jsdata.oadrPayload.oadrSignedObject) {
        msg.payload.data = jsdata.oadrPayload.oadrSignedObject;
        msg.oadr.requestType = getOadrCommand(msg.payload.data);
        msg.oadr.requestID =
          jsdata.oadrPayload.oadrSignedObject[msg.oadr.requestType].requestID ||
          null;
        msg.oadr.msgType = "request";
      }
    }
    // msg.oadr.requestType = inCmd;
    return msg;
  }

  function getOadrCommand(data) {
    let cmd = "unknonwn";
    let property;
    // if (data.oadrPayload.oadrSignedObject){
    //   for ( property in data.oadrPayload.oadrSignedObject ){
    //     cmd = property
    //   }
    for (property in data) {
      cmd = property;
    }
    return cmd;
  }

  //
  // Takes an ical duration in a outputs it as a total # of seconds
  //
  function iCalDurationInSeconds(durStr) {
    var exp = new RegExp(/^P/);
    let totalSec = 0;
    let valStr;
    if (durStr.match(exp)) {
      // Days
      exp = new RegExp(/(\d+)D/);
      valStr = durStr.match(exp);
      if (valStr) totalSec += parseInt(valStr[1]) * 60 * 60 * 24;
      // Hours
      exp = new RegExp(/(\d+)H/);
      valStr = durStr.match(exp);
      if (valStr) totalSec += parseInt(valStr[1]) * 60 * 60;
      // Minutes
      exp = new RegExp(/(\d+)M/);
      valStr = durStr.match(exp);
      if (valStr) totalSec += parseInt(valStr[1]) * 60;
      // Seconds
      exp = new RegExp(/(\d+)S/);
      valStr = durStr.match(exp);
      if (valStr) totalSec += parseInt(valStr[1]);
    }
    return totalSec;
  }

  function getXMLpayload(payloadName, payload) {
    let returnPayload;
    if (oadrProfile !== "2.0a") {
      const payloadXML = {
        _attr: {
          xmlns: `http://openadr.org/oadr-${oadrProfile}/2012/07`,
          "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
        },
        oadrSignedObject: {},
      };
      payloadXML.oadrSignedObject[payloadName] = payload;
      returnPayload = convert("oadrPayload", payloadXML);
    } else {
      returnPayload = convert(payloadName, payload);
    }

    return returnPayload;
  }

  function sendRequest(url, ei, xml, cb, done) {
    if (!(url.indexOf("http://") === 0 || url.indexOf("https://") === 0)) {
      if (tlsNode) {
        url = "https://" + url;
      } else {
        url = "http://" + url;
      }
    }

    let url_profile = oadrProfile == "2.0a" ? "" : `${oadrProfile}/`;
    // const _url = `${url}/OpenADR2/Simple/2.0b/${ei}`;
    const _url = `${url}/OpenADR2/Simple/${url_profile}${ei}`;

    const options = {
      url: _url,
      method: "POST",
      headers: {
        "content-type": "application/xml", // <--Very important!!!
        "accept": "*/*",
      },
      withCredentials: true,
      rejectUnauthorized: false,
    };

    let options2 = {};

    if (tlsNode) {
      //console.log("Adding TLS options");
      //
      tlsNode.addTLSOptions(options2);
      options2.keepAlive = true;
      options2.rejectUnauthorized = false;
      options2.data = xml;
      options.httpsAgent = new https.Agent( options2 );
    }


    if (authuser !== "" && authpw !== "") {
      options.auth = { username: authuser, password: authpw };
    }
    options.data = xml;
    debug("Request: %s", xml);
    axios(options)
      .then(
        function (response) {
          if (response.status >= 200 && response.status < 300) {
            debug("Response: %s", response.data);
            cb(response.data);
          }
        }
      )
      .catch(function (error) {
        if (error.response) {
          debug("REQUEST ERROR STATUS: %s", error.response.status);
          debug("REQUEST ERROR DATA: %s", error.response.data);
          if (done) {
            done(
              `OADR Req Err1: ${error.response.status}\n${error.response.data}`
            );
          } else {
            node.error(
              `OADR Req Err2: ${error.response.status}`,
              error.response.data
            );
          }
        } else if (error.request) {
          debug(error.request);
          if (done) {
            done(`OADR Req Err: ${error.message}`);
          } else {
            node.error("OADR Req Err4:", error.request);
          }
        } else {
          debug("ERROR %s", error.message);
          if (done) {
            done(`Error: ${error.message}`);
          } else {
            node.error(" Error:", error.message);
          }
        }
      });
  }

  /*
  Begin NODE RED
*/
  function OADR2VEN(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    this.vtnconfig = RED.nodes.getNode(config.vtnconfig);

    this.url = this.vtnconfig.url;
    this.tls = this.vtnconfig.tls;
    this.creds = this.vtnconfig.credentials; 
    this.authuser = this.vtnconfig.authuser;
    this.authpw = this.vtnconfig.authpw;

    if (this.tls) {
      tlsNode = RED.nodes.getNode(this.tls);
    }

    authuser = this.authuser || "";
    authpw = this.authpw || "";

    oadrProfile = config.profile || "2.0b";

    this.pushPort = config.pushport;
    this.venID = config.venid || "";

    this.transportAddress = "";
    if (config.pushurl) {
      let port = node.pushPort || "8181";
      node.pushport = port;
      this.transportAddress = `${config.pushurl}:${port}`;
    }

    const flowContext = this.context().global;

    debug(
      `Starting OADR-VEN profile ${oadrProfile} on ${this.transportAddress}`
    );

    node.status({ fill: "blue", shape: "dot", text: "Waiting..." });

    // ee.on('error', (err) => {
    //     node.error('EMITTER ERROR: ' + err);
    // })

    app.get("/", function (req, res) {
      // console.log('got something:', req);
    });

    app.use(bodyparser.text({ type: "application/xml" }));

    let url_profile = oadrProfile == "2.0a" ? "" : `${oadrProfile}/`;

    let inUrl = `/OpenADR2/Simple/${url_profile}:reqType`;

    // app.post(`/OpenADR2/Simple/${url_profile}:reqType`,(req, res) => {
    app.post(inUrl, (req, res) => {
      // console.log('got a post');
      // console.log('req URL:', req.url);
      // console.log('req hostname:', req.hostname);
      // console.log('req IP:', req.ip);
      // console.log('req params: ', req.params)
      // console.log('req body:', req.body);
      // console.log('Made it to the inbound server')

      let msg = prepareReqMsg(req.body);

      let oadrObj = {};

      if (
        msg.oadr.hasOwnProperty("requestType") &&
        msg.oadr.requestType !== "unknown"
      ) {
        oadrObj = msg.payload.data[msg.oadr.requestType];
      } else {
        return;
      }

      if (oadrObj.hasOwnProperty("venID")) {
      }

      let id = msg.oadr.requestID || 0;

      if (msg.oadr.requestType == "oadrDistributeEvent") {
        res.sendStatus(200);
      } else {
        let to = setTimeout(
          function (id) {
            if (ee.listenerCount(id) > 0) {
              let evList = ee.listeners(id);
              ee.removeListener(id, evList[0]);
            }
          },
          120 * 1000,
          id
        );

        // This makes the response async so that we pass the responsibility onto the response node
        ee.once(id, function (returnMsg) {
          clearTimeout(to);
          res.send(returnMsg);
        });
      }

      node.send(msg);
    });

    const server = null;

    // isNaN(node.pushPort)
    //   ? null
    //   : app.listen(node.pushPort, () => {});

    // make local copies of our configuration
    this.logging = typeof config.log === "boolean" ? config.log : false;
    this.url = this.vtnconfig.url;
    this.pathlog = config.pathlog;
    this.name = config.name || "OADR2 VEN";

    node.status({ fill: "green", shape: "ring", text: oadrProfile });

    // Initialize the ids for this VEN
    flowContext.set(`${node.name}:IDs`.replace(".", "_"), {
      registrationID: "",
      venID: node.venID || "",
      vtnID: "",
    });

    const payloadAttr = {
      //'ei:schemaVersion': `${oadrProfile}`,
      "xmlns:ei": "http://docs.oasis-open.org/ns/energyinterop/201110",
      "xmlns:pyld":
        "http://docs.oasis-open.org/ns/energyinterop/201110/payloads",
    };
    if (oadrProfile !== "2.0a") {
      payloadAttr["ei:schemaVersion"] = oadrProfile;
    } else {
      payloadAttr.xmlns = `http://openadr.org/oadr-${oadrProfile}/2012/07`;
      payloadAttr["xmlns:xsi"] = "http://www.w3.org/2001/XMLSchema-instance";
      payloadAttr["xmlns:xsd"] = "http://www.w3.org/2001/XMLSchema";
    }

    const QueryRegistration = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID || uuidv4();

      let oadrQueryRegistration = {
        _attr: payloadAttr,
        "pyld:requestID": uuid,
      };

      let XMLpayload = getXMLpayload("oadrQueryRegistration", oadrQueryRegistration);

      sendRequest(
        node.url,
        "EiRegisterParty",
        XMLpayload,
        // function (err, response, body) {
        function (body) {
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;
          if (msg.oadr.responseType == "oadrCreatedPartyRegistration") {
            let oadrObj = msg.payload.data[msg.oadr.responseType];
            if (oadrObj.eiResponse.responseCode === 200) {
              let ids = {
                registrationID: oadrObj.registrationID || "",
                venID: oadrObj.venID || node.venID || "",
                vtnID: oadrObj.vtnID || "",
              };
              _ids.registrationID = ids.registrationID;
              _ids.venID = ids.venID;
              _ids.vtnID = ids.vtnID;

              flowContext.set(`${node.name}:IDs`.replace(".", "_"), ids);
            }
            // Include a parsed version of the polling frequency in the oadr info
            if (
              oadrObj.oadrRequestedOadrPollFreq &&
              oadrObj.oadrRequestedOadrPollFreq.duration
            ) {
              msg.oadr.pollFreqSeconds = iCalDurationInSeconds(
                oadrObj.oadrRequestedOadrPollFreq.duration
              );
            }
          }

          node.send(msg);
        },
        done
      );
    };

    const CreatePartyRegistration = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID || uuidv4();
      let ids = flowContext.get(`${node.name}:IDs`.replace(".", "_"));

      let oadrCreatePartyRegistration = {
        _attr: payloadAttr,
        "pyld:requestID": {
          _value: uuid,
        },
        "ei:venID": params.venID || ids.venID || "",
        oadrProfileName: params.oadrProfileName || oadrProfile || "2.0b",
        oadrTransportName: "simpleHttp",
        oadrTransportAddress:
          params.oadrTransportAddress || node.transportAddress || null,
        oadrReportOnly:
          typeof params.oadrReportOnly === "boolean"
            ? params.oadrReportOnly
            : false,
        oadrXmlSignature: false,
        oadrVenName: node.name,
        oadrHttpPullModel:
          typeof params.oadrHttpPullModel === "boolean"
            ? params.oadrHttpPullModel
            : true,
      };

      if (oadrCreatePartyRegistration["ei:venID"] === "") {
        delete oadrCreatePartyRegistration["ei:venID"];
      }

      let XMLpayload = getXMLpayload(
        "oadrCreatePartyRegistration",
        oadrCreatePartyRegistration
      );

      sendRequest(
        node.url,
        "EiRegisterParty",
        XMLpayload,
        // function (err, response, body) {
        function (body) {
          debug(body);
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;
          if (msg.oadr.responseType == "oadrCreatedPartyRegistration") {
            let oadrObj = msg.payload.data[msg.oadr.responseType];
            if (oadrObj.eiResponse.responseCode === 200) {
              let ids = {
                registrationID: oadrObj.registrationID || "",
                venID: oadrObj.venID || "",
                vtnID: oadrObj.vtnID || "",
              };
              _ids.registrationID = ids.registrationID;
              _ids.venID = ids.venID;
              _ids.vtnID = ids.vtnID;

              flowContext.set(`${node.name}:IDs`.replace(".", "_"), ids);
            }

            // Include a parsed version of the polling frequency in the oadr info
            if (
              oadrObj.oadrRequestedOadrPollFreq &&
              oadrObj.oadrRequestedOadrPollFreq.duration
            ) {
              msg.oadr.pollFreqSeconds = iCalDurationInSeconds(
                oadrObj.oadrRequestedOadrPollFreq.duration
              );
            }
          }
          node.send(msg);
        },
        done
      );
    };

    const CancelPartyRegistration = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID || uuidv4();

      let ids = flowContext.get(`${node.name}:IDs`.replace(".", "_"));

      let oadrCancelPartyRegistration = {
        _attr: payloadAttr,
        "pyld:requestID": uuid,
        "ei:registrationID":
          params.registrationID ||
          _ids.registrationID ||
          ids.registrationID ||
          "",
        "ei:venID": params.venID || ids.venID || "",
      };

      let XMLpayload = getXMLpayload(
        "oadrCancelPartyRegistration",
        oadrCancelPartyRegistration
      );

      sendRequest(
        node.url,
        "EiRegisterParty",
        XMLpayload,
        function (body) {
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;

          if (msg.oadr.responseType == "oadrCanceledPartyRegistration") {
            let oadrObj = msg.payload.data[msg.oadr.responseType];
            if (oadrObj.eiResponse.responseCode === 200) {
              let ids = {
                registrationID: "",
                venID: node.venID || "",
                vtnID: "",
              };
              _ids.registrationID = ids.registrationID;
              _ids.venID = ids.venID;
              _ids.vtnID = ids.vtnID;

              flowContext.set(`${node.name}:IDs`.replace(".", "_"), ids);
            }
          }
          node.send(msg);
        },
        done
      );
    };

    const RequestEvent = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID || uuidv4();

      let ids = flowContext.get(`${node.name}:IDs`.replace(".", "_"));

      let venID = params.venID || "";
      if (ids) {
        venID = ids.venID;
      }

      let oadrRequestEvent = {
        _attr: payloadAttr,
        "pyld:eiRequestEvent": {
          "pyld:requestID": uuid,
          "ei:venID": params.venID || _ids.venID || venID,
        },
      };

      let XMLpayload = getXMLpayload("oadrRequestEvent", oadrRequestEvent);

      sendRequest(
        node.url,
        "EiEvent",
        XMLpayload,
        function (body) {
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;
          node.send(msg);
        },
        done
      );
    };

    const CreatedEvent = function (msg, done) {
      const params = msg.payload;
      let inCmd = params.requestType || "unknown";
      let uuid = params.requestID || uuidv4();
      //console.log (params.requestID, uuid);
      let ids = flowContext.get(`${node.name}:IDs`.replace(".", "_"));

      let venID = params.venID || "";
      if (ids) {
        venID = ids.venID || venID;
      }

      //console.log(params.venID)

      let oadrCreatedEvent = {
        _attr: payloadAttr,
        "pyld:eiCreatedEvent": {
          "ei:eiResponse": {
            "ei:responseCode": params.responseCode || 200,
            "ei:responseDescription": params.responseDescription || "OK",
            "pyld:requestID": uuid,
          },
          "ei:venID": ids.venID || venID,
        },
      };

      if (params.eventResponses) {
        // console.log(params.eventResponses);
        // console.log(params.eventResponses.length);
        if (params.eventResponses.length > 0) {
          oadrCreatedEvent["pyld:eiCreatedEvent"]["ei:eventResponses"] = {};
          oadrCreatedEvent["pyld:eiCreatedEvent"]["ei:eventResponses"][
            "ei:eventResponse"
          ] = [];
          params.eventResponses.forEach((er) => {
            let eventResponse = {};
            eventResponse["ei:responseCode"] = er.responseCode || 200;
            eventResponse["ei:responseDescription"] =
              er.responseDescription || "OK";
            eventResponse["pyld:requestID"] = er.requestID || uuid;
            eventResponse["ei:qualifiedEventID"] = {};
            eventResponse["ei:qualifiedEventID"]["ei:eventID"] =
              er.qualifiedEventID.eventID || undefined;
            eventResponse["ei:qualifiedEventID"]["ei:modificationNumber"] =
              er.qualifiedEventID.modificationNumber;

            eventResponse["ei:optType"] = er.optType;
            oadrCreatedEvent["pyld:eiCreatedEvent"]["ei:eventResponses"][
              "ei:eventResponse"
            ].push(eventResponse);
          });
        }
      }

      //console.log(oadrCreatedEvent);

      let XMLpayload = getXMLpayload("oadrCreatedEvent", oadrCreatedEvent);
      // console.log(XMLpayload);

      sendRequest(
        node.url,
        "EiEvent",
        XMLpayload,
        function (body) {
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;
          node.send(msg);
        },
        done
      );
    };

    const RegisterReport = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID || uuidv4();

      let ids = flowContext.get(`${node.name}:IDs`.replace(".", "_"));

      let venID = params.venID || "";
      if (ids) {
        venID = ids.venID;
      }

      let oadrRegisterReport = {
        _attr: payloadAttr,
        "pyld:requestID": {
          _value: uuid,
        },
        oadrReport: {
          duration: {
            _attr: { xmlns: "urn:ietf:params:xml:ns:icalendar-2.0" },
            duration: params.duration,
          },
          oadrReportDescription: {
            "ei:rID": params.rID || "",
            "ei:reportDataSource": {
              "ei:resourceID": params.resourceID || "",
            },
            "ei:reportType": params.reportType || "",
            "ei:readingType": params.readingType || "x-notApplicable",
            marketContext: {
              _attr: { xmlns: "http://docs.oasis-open.org/ns/emix/2011/06" },
              _value: params.marketContext,
            },
            oadrSamplingRate: {
              oadrMinPeriod: params.oadrMinPeriod || "PT1M",
              oadrMaxPeriod: params.oadrMaxPeriod || "PT1M",
              oadrOnChange: params.oadrOnChange || "false",
            },
          },
          "ei:reportRequestID": params.reportRequestID || 0,
          "ei:reportSpecifierID": params.reportSpecifierID || uuidv4(),
          "ei:reportName": params.reportName || "",
          "ei:createdDateTime": params.createdDateTime,
        },
        "ei:venID": params.venID || _ids.venID || venID,
      };

      let XMLpayload = getXMLpayload("oadrRegisterReport", oadrRegisterReport);

      // console.log(XMLpayload);

      sendRequest(
        node.url,
        "EiReport",
        XMLpayload,
        function (body) {
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;
          node.send(msg);
        },
        done
      );
    };

    const RegisteredReport = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID;

      let ids = flowContext.get(`${node.name}:IDs`.replace(".", "_"));

      let venID = params.venID || "";
      if (ids) {
        venID = ids.venID;
      }

      let oadrRegisteredReport = {
        _attr: payloadAttr,
        "ei:eiResponse": {
          responseCode: params.responseCode || 200,
          responseDescription: params.responseDescription || "OK",
          "pyld:requestID": params.requestID,
        },
        "ei:venID": params.venID || _ids.venID || venID,
      };

      let XMLpayload = getXMLpayload("oadrRegisteredReport", oadrRegisteredReport);

      sendRequest(
        node.url,
        "EiReport",
        XMLpayload,
        function (body) {
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;
          node.send(msg);
        },
        done
      );
    };

    const UpdateReport = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID || uuidv4();

      let oadrUpdateReport = {
        _attr: payloadAttr,
        "pyld:requestID": {
          _value: uuid,
        },
      };

      let XMLpayload = getXMLpayload("oadrUpdateReport", oadrUpdateReport);

      sendRequest(
        node.url,
        "EiReport",
        XMLpayload,
        function (body) {
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;
          node.send(msg);
        },
        done
      );
    };

    const Poll = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID || uuidv4();

      let ids = flowContext.get(`${node.name}:IDs`.replace(".", "_"));

      let venID = "";
      if (ids) {
        venID = ids.venID;
      }

      let oadrPoll = {
        _attr: payloadAttr,
        "ei:venID": params.venID || _ids.venID || venID,
      };

      let XMLpayload = getXMLpayload("oadrPoll", oadrPoll);

      sendRequest(
        node.url,
        "OadrPoll",
        XMLpayload,
        function (body) {
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;
          node.send(msg);
        },
        done
      );
    };

    const Response = function (msg, done) {
      let params = msg.payload;

      let oadrResponse = {
        _attr: payloadAttr,
        "ei:eiResponse": {
          responseCode: params.responseCode || 200,
          responseDescription: params.responseDescription || "OK",
          "pyld:requestID": params.requestID,
        },
      };

      if (oadrProfile !== "2.0a") {
        oadrResponse.venID = params.venID;
      }

      let XMLpayload = getXMLpayload("oadrResponse", oadrResponse);
      //console.log('Event Names:', ee.eventNames());
      ee.emit(params.requestID, XMLpayload);
    };

    const CreateOpt = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID || uuidv4();
      let optID = params.optID || uuidv4();
      let date1 = new Date().toISOString();

      // console.log(JSON.stringify(params));

      let oadrCreateOpt = {
        _attr: payloadAttr,
        "ei:optID": optID,
        "ei:optType": params.optType || "optOut",
        "ei:optReason": params.optReason || "notParticipating",
        marketContext: {},
        "ei:venID": _ids.venID,
        vavailability: {
          _attr: {
            xmlns: "urn:ietf:params:xml:ns:icalendar-2.0",
          },
        },
        "ei:createdDateTime": date1,
        "pyld:requestID": {
          _value: uuid,
        },
      };

      if (params.hasOwnProperty("marketContext")) {
        oadrCreateOpt.marketContext = {
          _attr: {
            xmlns: "http://docs.oasis-open.org/ns/emix/2011/06",
          },
          _value: params.marketContext,
        };
      }

      oadrCreateOpt["ei:eiTarget"] = {};

      if (params.hasOwnProperty("resourceID")) {
        oadrCreateOpt["ei:eiTarget"] = {
          "ei:resourceID": params.resourceID,
        };
      }

      if (
        params.hasOwnProperty("components") &&
        typeof params.components === "object" &&
        params.components.length > 0
      ) {
        oadrCreateOpt.vavailability.components = {
          available: params.components,
        };
      } else {
        // Adding a single basic Opt event
        oadrCreateOpt.vavailability.components = {
          available: {
            properties: {
              dtstart: {
                "date-time": params.dtstart || params["date-time"] || date1,
              },
              duration: {
                duration: params.duration || "PT1H",
              },
            },
          },
        };
      }

      let XMLpayload = getXMLpayload("oadrCreateOpt", oadrCreateOpt);

      sendRequest(node.url, "EiOpt", XMLpayload, function (body) {
        let msg = prepareResMsg(uuid, inCmd, body);
        msg.oadr.venName = node.name;
        node.send(msg);
      });
    };

    const CancelOpt = function (msg, done) {
      let params = msg.payload;
      let inCmd = msg.payload.requestType || "unknown";
      let uuid = params.requestID || uuidv4();
      let optID = params.optID || uuidv4();

      let oadrCancelOpt = {
        _attr: payloadAttr,
        "pyld:requestID": {
          _value: uuid,
        },
        "ei:optID": optID,
        "ei:venID": _ids.venID,
      };

      let XMLpayload = getXMLpayload("oadrCancelOpt", oadrCancelOpt);

      sendRequest(
        node.url,
        "EiOpt",
        XMLpayload,
        function (body) {
          let msg = prepareResMsg(uuid, inCmd, body);
          msg.oadr.venName = node.name;
          node.send(msg);
        },
        done
      );
    };

    this.on("input", function (msg, send, done) {
      let opType = "request";

      if (msg.payload) {
        if (
          typeof msg.payload.opType === "string" &&
          msg.payload.opType.toLowerCase() === "response"
        ) {
          opType = msg.payload.opType.toLowerCase();
        }

        if (opType === "request" && msg.payload.requestType) {
          switch (msg.payload.requestType) {
            case "QueryRegistration":
              QueryRegistration(msg, done);
              break;
            case "CreatePartyRegistration":
              CreatePartyRegistration(msg, done);
              break;
            case "CancelPartyRegistration":
              CancelPartyRegistration(msg, done);
              break;
            case "CanceledPartyRegistration":
              CanceledPartyRegistration(msg, done);
              break;
            case "RequestEvent":
              RequestEvent(msg, done);
              break;
            case "RegisterReport":
              RegisterReport(msg, done);
              break;
            case "RegisteredReport":
              RegisteredReport(msg, done);
              break;
            case "CreateReport":
              CreateReport(msg, done);
              break;
            case "CreatedReport":
              CreatedReport(msg, done);
              break;
            case "UpdateReport":
              UpdateReport(msg, done);
              break;
            case "UpdatedReport":
              UpdatedReport(msg, done);
              break;
            case "CancelReport":
              CancelReport(msg, done);
              break;
            case "CanceledReport":
              CanceledReport(msg, done);
              break;
            case "Poll":
              Poll(msg, done);
              break;
            case "CreatedEvent":
              CreatedEvent(msg, done);
              break;
            case "CreateOpt":
              CreateOpt(msg, done);
              break;
            case "CancelOpt":
              CancelOpt(msg, done);
              break;
          }
        } else {
          //console.log('Making a respnose');
          switch (msg.payload.responseType) {
            case "Response":
              //console.log('doing a Response');
              Response(msg, done);
              break;
          }
        }
      }
    }); // this.on('input'...)

    this.on("close", function (removed, done) {
      //console.log('About to stop the server...');
      // ee.removeAllListeners();
      //console.log(expressWs.getWss());
      //console.log(app);
      server.close();
      this.status({ fill: "grey", shape: "dot", text: "stopped" });
      done();
      // console.log('Server closed?...');
    });

    // NOTE: Logging not yet supported
    //
    // function logData(type, data) {
    //   if (node.logging === true) {
    //     // only log if no errors w/ log file
    //     // set a timestamp for the logged item
    //     let date = new Date().toLocaleString();
    //     // create the logged info from a template
    //     // let logInfo = `${date} \t node: ${node.name} \t type: ${type} \t data: ${data} ${os.EOL}`;
    //     let xdata = data || '';
    //     let logInfo = `${date} \t node: ${
    //       node.name
    //     } \t type: ${type} \t data: ${xdata.replace(/[\n\r]/g, '')} ${os.EOL}`;

    //     // create/append the log info to the file
    //     fs.appendFile(node.pathlog, logInfo, err => {
    //       if (err) {
    //         node.error(`Error writing to log file: ${err}`);
    //         // If something went wrong then turn off logging
    //         node.logging = false;
    //         if (this.log) this.log = null;
    //       }
    //     });
    //   }
    // }
  }

  RED.nodes.registerType("VEN", OADR2VEN, {
    credentials: { authuser: { type: "text" }, authpw: { type: "password" } },
  });
};
