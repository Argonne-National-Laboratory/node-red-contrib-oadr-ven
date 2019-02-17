
var JsonixModule = require('jsonix')
var Jsonix = JsonixModule.Jsonix;
var oadr2b_model_context = require('./oadr2b_model/oadr2b_model.js').oadr2b_model;
var context = new Jsonix.Context([oadr2b_model_context]);
var unmarshaller = context.createUnmarshaller();
var marshaller = context.createMarshaller();

var xmldsigjs = require("xmldsigjs");
var WebCrypto = require("node-webcrypto-ossl");
var webcrypto = new WebCrypto();

// xmldsigjs.Signature.prefix = "";
// xmldsigjs.DigestMethod.prefix = "";
// xmldsigjs.CanonicalizationMethod.prefix = "";
// xmldsigjs.KeyInfo.prefix = "";
// xmldsigjs.Transform.prefix = "";
// xmldsigjs.Transforms.prefix = "";
// xmldsigjs.Reference.prefix = "";
// xmldsigjs.References.prefix = "";
// xmldsigjs.SignedInfo.prefix = "";
// xmldsigjs.SignatureMethod.prefix = "";
// xmldsigjs.Signature.items.SignatureValue.prefix = "";
// xmldsigjs.Reference.items.DigestValue.prefix = ""
// xmldsigjs.KeyInfoX509Data.prefix = "";


xmldsigjs.Application.setEngine("OpenSSL", webcrypto);

const oadr2bNamespaceURI = "http:\/\/openadr.org\/oadr-2.0b\/2012\/07";

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









module.exports = function(xmlSignature, tlsNode) {

	var privateKey;
	var publicKey;

	function loadKeys(){
		if(privateKey == null || publicKey == null) {
			var pkPromise = webcrypto.subtle.importKey(
			    "pkcs8",
			    pkToArrayBuffer(tlsNode.key),
			    {
			        name: "RSASSA-PKCS1-v1_5",
			        hash: {name: "SHA-256"} // or SHA-512
			    },
			    true,
			    [ "sign"]
			);
			var pubPromise = certToArrayBuffer(tlsNode.cert)
				.exportKey({ name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } });

			return Promise.all([pkPromise, pubPromise]);
		}

		return new Promise((resolve, reject) => {
			resolve([privateKey, publicKey]);
		});	
	}

	function cacheKeys(keys){
		if(publicKey == null || privateKey == null) {
			privateKey = keys[0];
			publicKey = keys[1];
		}
		return new Promise((resolve) => {resolve([privateKey, publicKey])});
	}

	var sign = function(payloadType, payload) {
	
		let signature = new xmldsigjs.SignedXml();
		var env = {};
		env[payloadType] = payload
		env.id = "signedObject"
		var envelop = {
			oadrSignedObject: env,
		}

		var withoutSig = marshal("oadrPayload", envelop);



		return loadKeys()
			.then(cacheKeys)
			.then(function(keys){
				
				return signature.Sign(                                  // Signing document
				    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" }  },                        // algorithm 
				    keys[0],                                      // key 
				    xmldsigjs.Parse(withoutSig),                                 // document
				    {                  
				        keyValue: keys[1],
				        references: [
				            {  uri:"", hash: "SHA-256", transforms: ["enveloped", "c14n"]},
				        ]
				    })	
			})
		    .then(() => {
		    	return signature.toString();
		    })
		    .catch((e) => {console.log(e)})
	}

	var transform = function(payloadType, payload) {
		if(!xmlSignature){
			return new Promise((resolve) => {resolve( marshal(payloadType, payload))});
		}else {
			return sign(payloadType, payload);
		}
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


	var oadr2b_model = {};

	oadr2b_model.cancelPartyRegistration = function(payload) {
		return transform("oadrCancelPartyRegistration", payload);
	}

	oadr2b_model.createPartyRegistration = function(payload) {
		return transform("oadrCreatePartyRegistration", payload);
	}

	oadr2b_model.queryRegistration = function(payload) {
		return transform("oadrQueryRegistration", payload);
	}

	oadr2b_model.requestEvent = function(payload) {
		return transform("oadrRequestEvent", payload);
	}

	oadr2b_model.registeredReport = function(payload) {
		return transform("oadrRegisteredReport", payload);
	}

	oadr2b_model.createdEvent = function(payload) {
		return transform("oadrCreatedEvent", payload);
	}

	oadr2b_model.registerReport = function(payload) {
		return transform("oadrRegisterReport", payload);
	}

	oadr2b_model.updateReport = function(payload) {
		return transform("oadrUpdateReport", payload);
	}

	oadr2b_model.poll = function(payload) {
		return transform("oadrPoll", payload);
	}

	oadr2b_model.response = function(payload) {
		return transform("oadrResponse", payload);
	}

	oadr2b_model.createOpt = function(payload) {
		return transform("oadrCreateOpt", payload);
	}

	oadr2b_model.cancelOpt = function(payload) {
		return transform("oadrCancelOpt", payload);
	}

	oadr2b_model.parse = unmarshal;

	return oadr2b_model;
}


