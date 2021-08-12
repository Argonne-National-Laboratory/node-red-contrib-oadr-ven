'use strict';

module.exports = function(RED) {
    function OpenARDVTNConfigNode(n) {
          RED.nodes.createNode(this, n);
          this.name = n.name;
          this.url = n.url;
          this.tls = n.tls; 
          this.authuser = n.authuser;
          this.authpw = n.authpw;
        }
    RED.nodes.registerType('OpenADR-VTN', OpenARDVTNConfigNode);
};

