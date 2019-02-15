
var JsonixModule = require('jsonix')

var oadr2b_model = require('./oadr2b_model/oadr2b_model.js').oadr2b_model;

var xmldsigjs = require("xmldsigjs");

var { Crypto } = require("node-webcrypto-p11");
const config = {
    library: "/usr/local/lib/softhsm/libsofthsm2.so",
    name: "SoftHSM v2.0",
    slot: 0,
    readWrite: true,
    pin: "1234"
};

var webcrypto = new Crypto(config);


xmldsigjs.Application.setEngine("OpenSSL", webcrypto);

var Jsonix = JsonixModule.Jsonix;

var context = new Jsonix.Context([oadr2b_model]);

const oadr2bNamespaceURI = "http:\/\/openadr.org\/oadr-2.0b\/2012\/07";

var unmarshaller = context.createUnmarshaller();
var marshaller = context.createMarshaller();


function removeLines(str) {
    return str.replace("\n", "");
}

function atob(a) {
    return new Buffer(a, 'base64').toString('binary');
}

function base64ToArrayBuffer(b64) {
    var byteString = atob(b64);
    var byteArray = new Uint8Array(byteString.length);
    for(var i=0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
    }

    return byteArray;
}

function pkToArrayBuffer(pem) {
    var b64Lines = removeLines(pem);
    var b64Prefix = b64Lines.replace('-----BEGIN PRIVATE KEY-----', '');
    var b64Final = b64Prefix.replace('-----END PRIVATE KEY-----', '');

    return base64ToArrayBuffer(b64Final);
}

function certToArrayBuffer(pem) {
    var b64Lines = removeLines(pem);
    var b64Prefix = b64Lines.replace('-----BEGIN CERTIFICATE-----', '');
    var b64Final = b64Prefix.replace('-----END CERTIFICATE-----', '');

    var b64 = base64ToArrayBuffer(b64Final);

    return new xmldsigjs.X509Certificate(b64);
}







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



var sign = function(payloadType, payload, xmlSignatureKey) {
	webcrypto.subtle.importKey(
	    "pkcs8",
	    pkToArrayBuffer(xmlSignatureKey.key),
	    {
	        name: "RSA-OAEP",
	        hash: {name: "SHA-256"} // or SHA-512
	    },
	    true,
	    ["encrypt"]
	)
	// .then(function(importedPrivateKey){
	// 	return webcrypto.subtle.importKey(
	// 	    "pkcs11",
	// 	    certToArrayBuffer(xmlSignatureKey.cert),
	// 	    {
	// 	        name: "RSASSA-PKCS1-v1_5",
	// 	        hash: {name: "SHA-256"} // or SHA-512
	// 	    },
	// 	    true,
	// 	    ["encrypt"]
	// 	);
	// })
	

	.then(function(importedPrivateKey) {
		certToArrayBuffer(xmlSignatureKey.cert).exportKey({ name: "RSA-OAEP", hash: { name: "SHA-256" } }).then(function(publicKey){
			 let signature = new xmldsigjs.SignedXml();
			signature.Sign(                                  // Signing document
			    { name: "RSA-OAEP" },                        // algorithm 
			    importedPrivateKey,                                      // key 
			    xmldsigjs.Parse(payload),                                 // document
			    {                                                     // options
			        keyValue: publicKey,
			        references: [
			            { hash: "SHA-512", transforms: ["enveloped", "c14n"] },
			        ]
			    })
			    .then(() => {
			        console.log(signature.toString());       // <xml> document with signature
			    })
			    .catch(e => console.log(e));
			// console.log(publicKey)
		})
		// console.log(importedPrivateKey);
	 //   

		


	}).catch(function(err) {
	    console.log(err);
	});

	var env = {};
	env[payloadType] = payload

	var envelop = {
		oadrSignedObject: env
	}

	return marshal("oadrPayload", envelop);
}

var transform = function(payloadType, payload, xmlSignature, xmlSignatureKey) {
	if(!xmlSignature){
		return marshal(payloadType, payload);
	}else {
		return sign(payloadType, payload, xmlSignatureKey);
	}
}


var oadr2b_model = {};

oadr2b_model.cancelPartyRegistration = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrCancelPartyRegistration", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.createPartyRegistration = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrCreatePartyRegistration", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.queryRegistration = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrQueryRegistration", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.requestEvent = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrRequestEvent", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.registeredReport = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrRegisteredReport", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.createdEvent = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrCreatedEvent", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.registerReport = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrRegisterReport", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.updateReport = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrUpdateReport", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.poll = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrPoll", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.response = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrResponse", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.createOpt = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrCreateOpt", payload, xmlSignature, xmlSignatureKey);
}

oadr2b_model.cancelOpt = function(payload, xmlSignature, xmlSignatureKey) {
	return transform("oadrCancelOpt", payload, xmlSignature, xmlSignatureKey);
}



oadr2b_model.parse = unmarshal;

module.exports = {
	oadr2b_model: oadr2b_model
}