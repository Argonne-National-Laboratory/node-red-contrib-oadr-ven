
var JsonixModule = require('jsonix')

var oadr2b_model = require('./oadr2b_model/oadr2b_model.js').oadr2b_model;

var xmldsigjs = require("xmldsigjs");

// var { Crypto } = require("node-webcrypto-p11");
// const config = {
//     library: "/usr/local/lib/softhsm/libsofthsm2.so",
//     name: "SoftHSM v2.0",
//     slot: 0,
//     readWrite: true,
//     pin: "1234"
// };

// var webcrypto = new Crypto(config);

var WebCrypto = require("node-webcrypto-ossl");
var webcrypto = new WebCrypto();


xmldsigjs.Application.setEngine("OpenSSL", webcrypto);

var Jsonix = JsonixModule.Jsonix;

var context = new Jsonix.Context([oadr2b_model]);

const oadr2bNamespaceURI = "http:\/\/openadr.org\/oadr-2.0b\/2012\/07";

var unmarshaller = context.createUnmarshaller();
var marshaller = context.createMarshaller();

var k = `
 -----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCDEfBKqO4yS5hp
OHcF464cx3QCSR1fsxhEbevPO8S6PZoUteuyYBiKQW3aJWVOwR+hdA4PPUHEO2in
wy8na2ll0mTH2E/Nw+yC/yyLIH7Aj0L/g7m4MY9iOGGcnsEj5fPm7VZXsGAt7JyB
GUBe6L7E8ApHiOm0yEVfagoy0wdnMDOy0EQl/NDa9qVnm7FMJOGIEiCAqaytUMlG
y60rnXonNIjKoZqA4nJ3THJdG3MYgegggmQUjXfwashCq5oI+D3NQBXOglP/2zty
f8ib1YWNLKhLgVypOle//Mp61boxEM3nM3yVSvX0U26A2O0w1xqNO1dJdpTPTKUi
tdU2PKybAgMBAAECggEAdmR3xxi8wFWkgDbu3DUDCx/m3EGq9MzTeMxJmtGELC6E
xXxmQKOoxwm+7rOkxPSRW8d3A7DzfQukxxT5vQO7GqxnOFVeEKGPO+y/EZTyqYE+
pYsY8RZjS/ddxJlqIMEQBWIRAfhhiFoYLEzg5loaJ84jmuZDJHdaoosoVyxjnYKS
JTrIv6GNsv8tGDMcSOzIH454mYCmhTheZTa4YBJ7kG4E+gdlfh/6GJdA1wo3MM3l
dlojXLBgWJzYXOsAhrmpcB+uFL1bFtJYpvrhJFbVOTlaBH6Fstp8Ja8mvS89K/Ef
9UObq6CRdXzbT0Yyfil/MCPmnxx91KMINQOBXg2xQQKBgQDK+ORy/Q1F3BUXkN/v
ogoRSz1OCKR/dQpnWpYsxkgeYI5JxLe7NFaskIN8LgRxWzpIi11kMwx1Y9wRRHpI
PQoH9ulI1DU9dhWzTCRGuftGQI40bMWhdSjQd1tNkQZGJAaT5WyqMRKXr02NLAdP
YLGcS3fhIt9heujNjs1eQCYr8QKBgQClUB1ZgADX/qk7VKKacP29Y9695tnan3zP
3HaNUF1cP2qWno6ejht0+sRR06y11yuFlTK6BRHMImDACDgypPC1ijBfYGVJ3Dc7
q4/TAz8G0BSTEURJ3tCoNaHSy7zzoo/CDZfNWjrJBfQaaeyjAnCp+F9faIZ8lwa/
+X/wysudSwKBgC/bFyH1gBekmGSCCAqcDfud3cp0RzS2B8nuldHgvkhLQ8Eo3JkK
8hSlzhqNTwbbF5bbJR3m210iOlTn7Fzz51WRZdeCETt4iA1KOpNiblhWCDFcJAy5
bvIX8jMLqosHG3Xrdf96qoORFZvfcanJhpbvREiUzE5TiGhO7yT1wwpBAoGARyKf
TokHU+qwlehIhB7FAT89dQgmjK3+fk+G8C45zl03l5KpGk9aP089NVzZv/HUN4pJ
JsTRsL7GVTv0Os7BCc1qHVCUpWDOn62mmQ2XjG3zvIk8knD/5rIVbWjgaRJ1u/Iv
dV0zWJdoQAl+m3KMWoeXOq322Rv/+pH5XPtW/NsCgYEArREhBL4MI8vfUBmyGaHc
4a0DjPJBLruPLIp+1tT8w+hCSTufzb1RUz7YGbpruDo6zN/GIDY1CBIoUlHIH7Nv
9Y6aCBbsbISt3LI4trFduFheelHqTxGCSHH3GMqFttr7KyZlepGm7CYCT5nU9ia4
SQBWkIDvX+CV7yi+Qq6qHG4=
-----END PRIVATE KEY-----

`;

var c = `
 -----BEGIN CERTIFICATE-----
MIIDPzCCAiegAwIBAgIGAWjxlrPzMA0GCSqGSIb3DQEBCwUAMF4xCzAJBgNVBAYT
AkZSMQ4wDAYDVQQIDAVQYXJpczEOMAwGA1UEBwwFUGFyaXMxDTALBgNVBAoMBEF2
b2IxDTALBgNVBAsMBEF2b2IxETAPBgNVBAMMCG9hZHIuY29tMB4XDTE5MDIxNDE1
MzY1MloXDTIwMDIxNTE1MzY1MlowYzEWMBQGA1UEAxMNdGVzdC5vYWRyLmNvbTEN
MAsGA1UECxMEQXZvYjENMAsGA1UEChMEQXZvYjEOMAwGA1UEBxMFUGFyaXMxDjAM
BgNVBAgTBVBhcmlzMQswCQYDVQQGEwJGUjCCASIwDQYJKoZIhvcNAQEBBQADggEP
ADCCAQoCggEBAIMR8Eqo7jJLmGk4dwXjrhzHdAJJHV+zGERt6887xLo9mhS167Jg
GIpBbdolZU7BH6F0Dg89QcQ7aKfDLydraWXSZMfYT83D7IL/LIsgfsCPQv+Dubgx
j2I4YZyewSPl8+btVlewYC3snIEZQF7ovsTwCkeI6bTIRV9qCjLTB2cwM7LQRCX8
0Nr2pWebsUwk4YgSIICprK1QyUbLrSudeic0iMqhmoDicndMcl0bcxiB6CCCZBSN
d/BqyEKrmgj4Pc1AFc6CU//bO3J/yJvVhY0sqEuBXKk6V7/8ynrVujEQzeczfJVK
9fRTboDY7TDXGo07V0l2lM9MpSK11TY8rJsCAwEAATANBgkqhkiG9w0BAQsFAAOC
AQEAnnwdwFzCRmKhc+Rl3mLR+NKkiQy3u6sSNmjeph6q8lBXrmjlq8rR/pmJz5sB
dHpgtgn0xBa86HO199k87/me/Hpvcuib8bjRyoIQgmxQDsvYHYqjR6u6aGZnUVVT
xkfdSgU///LcSI9mrJS+zlSsOciv3gTIbrbBBfbuPVd6DYSPC9kwt5Oqbuh/xCcR
qOkkwcT0DzMNBjjaxIYWDlSYwStw580K0lpPFCjlLay+d4H2+oTOjv+uTjEUJQvw
PJ+fy10OEFJrRWsk9m+5YSjPCAofLXOGkLV0vshs/pQprLX17IIJ5gBQMtQ4baQ3
Nmm8FOSvQW+FR9uJep0JEM3zUw==
-----END CERTIFICATE-----

`;

var p = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<oadr:oadrPayload
	xmlns:ei="http://docs.oasis-open.org/ns/energyinterop/201110"
	xmlns:gml="http://www.opengis.net/gml/3.2"
	xmlns:xmldsig="http://www.w3.org/2000/09/xmldsig#"
	xmlns:strm="urn:ietf:params:xml:ns:icalendar-2.0:stream"
	xmlns:greenbutton="http://naesb.org/espi"
	xmlns:xcal="urn:ietf:params:xml:ns:icalendar-2.0"
	xmlns:oadr="http://openadr.org/oadr-2.0b/2012/07"
	xmlns:pyld="http://docs.oasis-open.org/ns/energyinterop/201110/payloads"
	xmlns:emix="http://docs.oasis-open.org/ns/emix/2011/06"
	xmlns:ns15="urn:un:unece:uncefact:codelist:standard:5:ISO42173A:2010-04-07"
	xmlns:power="http://docs.oasis-open.org/ns/emix/2011/06/power"
	xmlns:xmldsig11="http://www.w3.org/2009/xmldsig11#"
	xmlns:ns14="http://docs.oasis-open.org/ns/emix/2011/06/siscale"
	xmlns:atom="http://www.w3.org/2005/Atom"
	xmlns:properties="http://openadr.org/oadr-2.0b/2012/07/xmldsig-properties">
	<oadr:oadrSignedObject>
		<oadr:oadrResponse>
			<ei:eiResponse>
				<ei:responseCode>200</ei:responseCode>
				<pyld:requestID>REQ_12345</pyld:requestID>
			</ei:eiResponse>
		</oadr:oadrResponse>
	</oadr:oadrSignedObject>
</oadr:oadrPayload>
`;

webcrypto.subtle.importKey(
	    "pkcs8",
	    pkToArrayBuffer(k),
	    {
	        name: "RSASSA-PKCS1-v1_5",
	        hash: {name: "SHA-256"} // or SHA-512
	    },
	    true,
	    [ "sign"]
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
		certToArrayBuffer(c).exportKey({ name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }).then(function(publicKey){
			
console.log(importedPrivateKey,publicKey)


			 let signature = new xmldsigjs.SignedXml();
			signature.Sign(                                  // Signing document
			    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" }  },                        // algorithm 
			    importedPrivateKey,                                      // key 
			    xmldsigjs.Parse(p),                                 // document
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