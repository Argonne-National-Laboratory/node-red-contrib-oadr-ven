'use strict';

var JsonixModule = require('jsonix');
// @ts-ignore
var Jsonix = JsonixModule.Jsonix;
var oadr2b_model_context = require('./oadr2b_model/oadr2b_model.js')
  .oadr2b_model;
var context = new Jsonix.Context([oadr2b_model_context]);
var unmarshaller = context.createUnmarshaller();
var marshaller = context.createMarshaller();

var xmldsigjs = require('xmldsigjs');
var WebCrypto = require('node-webcrypto-ossl');
var webcrypto = new WebCrypto();

const debug = require('debug')('anl:oadr');

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

xmldsigjs.Application.setEngine('OpenSSL', webcrypto);

const oadr2bNamespaceURI = 'http://openadr.org/oadr-2.0b/2012/07';

function removeLines(str) {
  return str.replace('\n', '');
}

function atob(a) {
  return new Buffer(a, 'base64').toString('binary');
}

function base64ToArrayBuffer(b64) {
  var byteString = atob(b64);
  var byteArray = new Uint8Array(byteString.length);
  for (var i = 0; i < byteString.length; i++) {
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
  var type = 'rsa';

  function loadRsaKeys() {
    if (privateKey == null || publicKey == null) {
      console.log('Test load RSA keys');
      var pkPromise = webcrypto.subtle.importKey(
        'pkcs8',
        pkToArrayBuffer(tlsNode.key),
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: {
            name: 'SHA-256',
          }, // or SHA-512
        },
        true,
        // eslint-disable-next-line no-mixed-spaces-and-tabs
        ['sign', 'verify']
      );
      var pubPromise = certToArrayBuffer(tlsNode.cert).exportKey({
        name: 'RSASSA-PKCS1-v1_5',
        // @ts-ignore
        hash: { name: 'SHA-256' },
      });

      return Promise.all([pkPromise, pubPromise]);
    }

    return new Promise((resolve, reject) => {
      resolve([privateKey, publicKey]);
    });
  }

  function loadEccKeys() {
    if (privateKey == null || publicKey == null) {
      console.log('Test load ECC keys');
      var pkPromise = webcrypto.subtle.importKey(
        'pkcs8',
        pkToArrayBuffer(tlsNode.key),
        {
          //these are the algorithm options
          name: 'ECDSA',
          namedCurve: 'P-384', //can be "P-256", "P-384", or "P-521"
        },
        true,
        ['sign', 'verify']
      );
      var pubPromise = certToArrayBuffer(tlsNode.cert).exportKey({
        name: 'ECDSA',
        // @ts-ignore
        hash: { name: 'SHA-256' },
      });

      return Promise.all([pkPromise, pubPromise]);
    }

    return new Promise((resolve, reject) => {
      resolve([privateKey, publicKey]);
    });
  }

  function cacheKeys(keys) {
    if (keys != null && (publicKey == null || privateKey == null)) {
      privateKey = keys[0];
      publicKey = keys[1];
    }
    return new Promise(resolve => {
      resolve([privateKey, publicKey]);
    });
  }

  function addSignatureWrapperToPayload(payloadType, payload) {
    var env = {};
    env[payloadType] = payload;
    env.id = 'signedObject';
    var envelop = {
      oadrSignedObject: env,
    };
    return envelop;
  }

  var sign = function(payloadType, payload) {
    let signature = new xmldsigjs.SignedXml();
    var envelop = addSignatureWrapperToPayload(payloadType, payload);
    var withoutSig = marshal('oadrPayload', envelop);
    return loadRsaKeys()
      .catch(e => {
        // fallback to ECDSA if RSA failed
        type = 'ecdsa';
        return loadEccKeys();
      })
      .catch(e => {
        console.log(e);

        type = 'unknown';
        throw e;
      })
      .then(cacheKeys)
      .then(function(keys) {
        if (keys != null && keys[0] != null && keys[1] != null) {
          var alg;
          if (type == 'rsa') {
            alg = {
              name: 'RSASSA-PKCS1-v1_5',
              // @ts-ignore
              hash: { name: 'SHA-256' } };
          } else if (type == 'ecdsa') {
            alg = { name: 'ECDSA', hash: { name: 'SHA-256' } };
          }

          if (alg != null) {
            return signature.Sign(
              // Signing document
              alg, // algorithm
              keys[0], // key
              xmldsigjs.Parse(withoutSig), // document
              {
                keyValue: keys[1],
                references: [
                  {
                    uri: '',
                    hash: 'SHA-256',
                    transforms: ['enveloped', 'c14n'],
                  },
                ],
              }
            );
          }
        }
      })
      .then(() => {
        return signature.toString();
      })
      .catch(e => {
        console.log("Can't load VEN certificates: ", e);
      });
  };

  var verify = function(payload) {
    var xml = xmldsigjs.Parse(payload);
    var signature = new xmldsigjs.SignedXml(xml);
    var xmlSignatures = xmldsigjs.Select(
      xml,
      "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']"
    );

    if (!(xmlSignatures && xmlSignatures.length)) {
      return console.log('Cannot get XML signature from XML document');
    }

    signature.LoadXml(xmlSignatures[0]);

    return signature
      .Verify()
      .then(function(valid) {
        if (valid) {
          return new Promise((resolve, reject) => {
            resolve(unmarshal(payload));
          });
        } else {
          throw new Error('verify signature failed');
        }
      })
      .catch(function(e) {
        throw new Error('verify signature failed');
      });
  };

  var transformSign = function(payloadType, payload) {
    if (!xmlSignature) {
      return new Promise(resolve => {
        resolve(marshal(payloadType, payload));
      });
    } else {
      return sign(payloadType, payload);
    }
  };

  var transformVerify = function(payload) {
    if (!xmlSignature) {
      return new Promise(resolve => {
        resolve(unmarshal(payload));
      });
    } else {
      return verify(payload);
    }
  };

  var marshal = function(payloadType, payload) {
    return marshaller.marshalString({
      name: {
        localPart: payloadType,
        namespaceURI: oadr2bNamespaceURI,
      },
      value: payload,
    });
  };

  var unmarshal = function(payload) {
    return unmarshaller.unmarshalString(payload);
  };

  var oadr2b_model = {};

  oadr2b_model.cancelPartyRegistration = function(payload) {
    return transformSign('oadrCancelPartyRegistration', payload);
  };

  oadr2b_model.createPartyRegistration = function(payload) {
    return transformSign('oadrCreatePartyRegistration', payload);
  };

  oadr2b_model.queryRegistration = function(payload) {
    return transformSign('oadrQueryRegistration', payload);
  };

  oadr2b_model.requestEvent = function(payload) {
    return transformSign('oadrRequestEvent', payload);
  };

  oadr2b_model.registeredReport = function(payload) {
    return transformSign('oadrRegisteredReport', payload);
  };

  oadr2b_model.createdEvent = function(payload) {
    return transformSign('oadrCreatedEvent', payload);
  };

  oadr2b_model.registerReport = function(payload) {
    return transformSign('oadrRegisterReport', payload);
  };

  oadr2b_model.updateReport = function(payload) {
    return transformSign('oadrUpdateReport', payload);
  };

  oadr2b_model.poll = function(payload) {
    return transformSign('oadrPoll', payload);
  };

  oadr2b_model.response = function(payload) {
    return transformSign('oadrResponse', payload);
  };

  oadr2b_model.canceledPartyRegistration = function(payload) {
    return transformSign('oadrCanceledPartyRegistration', payload);
  };

  oadr2b_model.createOpt = function(payload) {
    return transformSign('oadrCreateOpt', payload);
  };

  oadr2b_model.cancelOpt = function(payload) {
    return transformSign('oadrCancelOpt', payload);
  };

  oadr2b_model.createdReport = function(payload) {
    return transformSign('oadrCreatedReport', payload);
  };

  oadr2b_model.canceledReport = function(payload) {
    return transformSign('oadrCanceledReport', payload);
  };

  oadr2b_model.parse = function(payload) {
    return transformVerify(payload);
  };

  oadr2b_model.hasWrapper = function(payload) {
    return payload.oadrSignedObject != null;
  };

  oadr2b_model.getWrappedPayloadName = function(payload) {
    var properties = Object.keys(payload.oadrSignedObject);
    for (var i in properties) {
      if (properties[i] != 'TYPE_NAME' && properties[i] != 'id') {
        return properties[i];
      }
    }
  };

  oadr2b_model.wrap = function(payloadType, payload) {
    return addSignatureWrapperToPayload(payloadType, payload);
  };

  oadr2b_model.unwrap = function(payloadType, payload) {
    return payload.oadrSignedObject[payloadType];
  };

  return oadr2b_model;
};
