
var JsonixModule = require('jsonix')

var oadr2b_model = require('./oadr2b_model/oadr2b_model.js').oadr2b_model;

var Jsonix = JsonixModule.Jsonix;

var context = new Jsonix.Context([oadr2b_model]);

const oadr2bNamespaceURI = "http:\/\/openadr.org\/oadr-2.0b\/2012\/07";

var unmarshaller = context.createUnmarshaller();
var marshaller = context.createMarshaller();



var marshal = function(payloadType, payload) {
	return marshaller.marshalString({
		    name: {
		         localPart: payloadType,
		         namespaceURI: oadr2bNamespaceURI
		    },
		    value: payload
		});
}

var unmarshal = function(payloadStr, callback){
	return unmarshaller.unmarshalString(payloadStr,callback);
}

var sign = function(payload) {
	var envelop = {
		oadrSignedObject: payload
	}
	return marshal("oadrPayload", payload);
}

var transform = function(payloadType, payload, xmlSignature) {
	if(!xmlSignature){
		return marshal(payloadType, payload);
	}else {
		return sign(payload);
	}
}


var oadr2b_model = {};

oadr2b_model.cancelPartyRegistration = function(payload, xmlSignature) {
	return transform("oadrCancelPartyRegistration", payload, xmlSignature);
}

oadr2b_model.createPartyRegistration = function(payload, xmlSignature) {
	return transform("oadrCreatePartyRegistration", payload, xmlSignature);
}

oadr2b_model.queryRegistration = function(payload, xmlSignature) {
	return transform("oadrQueryRegistration", payload, xmlSignature);
}

oadr2b_model.requestEvent = function(payload, xmlSignature) {
	return transform("oadrRequestEvent", payload, xmlSignature);
}

oadr2b_model.registeredReport = function(payload, xmlSignature) {
	return transform("oadrRegisteredReport", payload, xmlSignature);
}

oadr2b_model.createdEvent = function(payload, xmlSignature) {
	return transform("oadrCreatedEvent", payload, xmlSignature);
}

oadr2b_model.registerReport = function(payload, xmlSignature) {
	return transform("oadrRegisterReport", payload, xmlSignature);
}

oadr2b_model.updateReport = function(payload, xmlSignature) {
	return transform("oadrUpdateReport", payload, xmlSignature);
}

oadr2b_model.poll = function(payload, xmlSignature) {
	return transform("oadrPoll", payload, xmlSignature);
}

oadr2b_model.response = function(payload, xmlSignature) {
	return transform("oadrResponse", payload, xmlSignature);
}

oadr2b_model.createOpt = function(payload, xmlSignature) {
	return transform("oadrCreateOpt", payload, xmlSignature);
}

oadr2b_model.cancelOpt = function(payload, xmlSignature) {
	return transform("oadrCancelOpt", payload, xmlSignature);
}



oadr2b_model.parse = unmarshal;

module.exports = {
	oadr2b_model: oadr2b_model
}